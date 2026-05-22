import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'

// Zoho Books Bill.csv actual columns:
// Bill Date, Due Date, Bill ID, Vendor Name, Bill Number, Total, Balance,
// Vendor Notes, Bill Status, Customer Name, Project Name, ...

function parseDate(val: string | undefined): Date | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null
  const clean = val.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const d = new Date(clean + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }
  // DD/MM/YYYY
  const parts = clean.split(/[\/\-\.]/)
  if (parts.length === 3 && parts[2].length === 4) {
    const d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T00:00:00`)
    if (!isNaN(d.getTime())) return d
  }
  const d = new Date(clean)
  return isNaN(d.getTime()) ? null : d
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0
  return parseFloat(val.replace(/[^0-9.\-]/g, '')) || 0
}

function mapBillStatus(val: string | undefined): string {
  if (!val) return 'UNPAID'
  const v = val.toLowerCase().trim()
  if (v === 'paid') return 'PAID'
  if (v.includes('partial')) return 'PARTIAL'
  // 'Overdue', 'Open', 'Draft' etc → UNPAID
  return 'UNPAID'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 })

    const text = await file.text()

    const { data } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (data.length === 0) {
      return NextResponse.json({ error: 'الملف فارغ أو غير صالح' }, { status: 400 })
    }

    const headers = Object.keys(data[0])

    // Detect Zoho Bill.csv columns
    const billNumCol      = headers.find(h => ['Bill Number', 'رقم الفاتورة'].includes(h)) || null
    const billIdCol       = headers.find(h => ['Bill ID', 'معرف الفاتورة'].includes(h)) || null
    const vendorCol       = headers.find(h => ['Vendor Name', 'اسم المورد'].includes(h)) || null
    const dateCol         = headers.find(h => ['Bill Date', 'Date', 'تاريخ الفاتورة'].includes(h)) || null
    const dueDateCol      = headers.find(h => ['Due Date', 'تاريخ الاستحقاق'].includes(h)) || null
    const totalCol        = headers.find(h => ['Total', 'المبلغ الإجمالي', 'Grand Total'].includes(h)) || null
    const statusCol       = headers.find(h => ['Bill Status', 'Status', 'الحالة'].includes(h)) || null
    const notesCol        = headers.find(h => ['Vendor Notes', 'Notes', 'ملاحظات'].includes(h)) || null
    const customerNameCol = headers.find(h => ['Customer Name', 'اسم العميل'].includes(h)) || null
    const projectNameCol  = headers.find(h => ['Project Name', 'اسم المشروع'].includes(h)) || null

    if (!billNumCol) {
      return NextResponse.json({
        error: `لم يتم التعرف على عمود رقم الفاتورة (Bill Number). الأعمدة المتوفرة: ${headers.slice(0, 12).join(', ')}`,
      }, { status: 400 })
    }

    // Deduplicate: Zoho exports one row per line item — keep first occurrence per Bill Number
    const uniqueBills = new Map<string, Record<string, string>>()
    for (const row of data) {
      const bn = row[billNumCol]?.trim()
      if (bn && !uniqueBills.has(bn)) {
        uniqueBills.set(bn, row)
      }
    }

    let added = 0
    let updated = 0
    let linked = 0
    let unlinked = 0

    // Cache projects for matching
    const allProjects = await prisma.project.findMany({
      select: { id: true, code: true, clientName: true, name: true },
    })

    for (const [billNumber, row] of Array.from(uniqueBills)) {
      const zohoId      = billIdCol      ? row[billIdCol]?.trim()      || null : null
      const vendorName  = vendorCol      ? row[vendorCol]?.trim()      || null : null
      const billDate    = parseDate(dateCol    ? row[dateCol]    : undefined) || new Date()
      const dueDate     = parseDate(dueDateCol ? row[dueDateCol] : undefined)
      const amount      = parseAmount(totalCol ? row[totalCol]   : undefined)
      const status      = mapBillStatus(statusCol ? row[statusCol] : undefined)
      const notes       = notesCol        ? row[notesCol]?.trim()        || '' : ''
      const customerName = customerNameCol ? row[customerNameCol]?.trim() || null : null
      const zohoProjectName = projectNameCol ? row[projectNameCol]?.trim() || null : null

      // ─── Find supplier ───────────────────────────────────────────
      let supplierId: string | null = null
      if (vendorName) {
        let supplier = await prisma.supplier.findFirst({ where: { name: vendorName } })
        if (!supplier) {
          // Auto-create unknown vendor
          supplier = await prisma.supplier.create({
            data: { name: vendorName, serviceType: 'OTHER', recommendation: 'UNDER_REVIEW' },
          })
        }
        supplierId = supplier.id
      }

      // ─── Find project ────────────────────────────────────────────
      // Priority 1: PRJ-XXX code anywhere in notes
      let projectId: string | null = null
      let projectCode: string | null = null

      const codeMatch = notes.match(/\bPRJ-\d+\b/i)
      if (codeMatch) {
        const code = codeMatch[0].toUpperCase()
        const proj = allProjects.find(p => p.code === code)
        if (proj) { projectId = proj.id; projectCode = code }
      }

      // Priority 2: Match Zoho Project Name to our project name
      if (!projectId && zohoProjectName) {
        const proj = allProjects.find(p =>
          p.name.toLowerCase().trim() === zohoProjectName.toLowerCase().trim()
        )
        if (proj) { projectId = proj.id; projectCode = proj.code }
      }

      // Priority 3: Match Customer Name to project clientName (main Zoho strategy)
      if (!projectId && customerName) {
        const proj = allProjects.find(p =>
          p.clientName.toLowerCase().trim() === customerName.toLowerCase().trim()
        )
        if (proj) { projectId = proj.id; projectCode = proj.code }
      }

      const isLinked = !!projectId

      // ─── Upsert bill ─────────────────────────────────────────────
      // Use Prisma relation connect syntax (supplierId/projectId not valid directly in create)
      const relationData = {
        supplier:  supplierId ? { connect: { id: supplierId } } : undefined,
        project:   projectId  ? { connect: { id: projectId  } } : undefined,
      }

      const scalarData = {
        amount,
        billDate,
        dueDate,
        status,
        projectCode,
        zohoCustomerName: customerName,
        isLinked,
        updatedAt: new Date(),
      }

      // Try find by zohoId first, then bill number
      const existingByZohoId = zohoId
        ? await prisma.bill.findUnique({ where: { zohoId } })
        : null
      const existingByNum = !existingByZohoId
        ? await prisma.bill.findFirst({ where: { billNumber } })
        : null
      const existing = existingByZohoId || existingByNum

      if (existing) {
        // Determine effective project (keep existing link if new data has no link)
        const effectiveProjectId = projectId || existing.projectId
        const effectiveLinked    = isLinked || existing.isLinked
        const effectiveCode      = projectCode || existing.projectCode

        await prisma.bill.update({
          where: { id: existing.id },
          data: {
            ...scalarData,
            zohoId: zohoId || existing.zohoId,
            isLinked: effectiveLinked,
            projectCode: effectiveCode,
            supplier: supplierId         ? { connect: { id: supplierId } }         : undefined,
            project:  effectiveProjectId ? { connect: { id: effectiveProjectId } } : undefined,
          },
        })
        updated++
        if (effectiveLinked) linked++
        else unlinked++
      } else {
        await prisma.bill.create({
          data: { zohoId, billNumber, ...scalarData, ...relationData },
        })
        added++
        if (isLinked) linked++
        else unlinked++
      }
    }

    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'BILLS_CSV',
        status: 'SUCCESS',
        message: `فواتير: ${added} جديدة، ${updated} محدّثة، ${linked} مرتبطة بمشروع، ${unlinked} غير مرتبطة`,
        itemsSynced: added + updated,
      },
    })

    await prisma.setting.upsert({
      where: { key: 'LAST_SYNC_AT' },
      update: { value: new Date().toISOString() },
      create: { key: 'LAST_SYNC_AT', value: new Date().toISOString() },
    })

    return NextResponse.json({ added, updated, linked, unlinked, total: uniqueBills.size })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في معالجة الملف' }, { status: 500 })
  }
}
