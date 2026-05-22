import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'

export const maxDuration = 60   // Vercel Pro: up to 60 s

function parseDate(val: string | undefined): Date | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null
  const c = val.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(c)) {
    const d = new Date(c + 'T00:00:00'); return isNaN(d.getTime()) ? null : d
  }
  const p = c.split(/[\/\-\.]/)
  if (p.length === 3 && p[2].length === 4) {
    const d = new Date(`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}T00:00:00`)
    if (!isNaN(d.getTime())) return d
  }
  const d = new Date(c); return isNaN(d.getTime()) ? null : d
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
      header: true, skipEmptyLines: true, transformHeader: h => h.trim(),
    })

    if (data.length === 0) return NextResponse.json({ error: 'الملف فارغ أو غير صالح' }, { status: 400 })

    const headers = Object.keys(data[0])
    const col = (candidates: string[]) => headers.find(h => candidates.includes(h)) || null

    const billNumCol      = col(['Bill Number', 'رقم الفاتورة'])
    const billIdCol       = col(['Bill ID', 'معرف الفاتورة'])
    const vendorCol       = col(['Vendor Name', 'اسم المورد'])
    const dateCol         = col(['Bill Date', 'Date', 'تاريخ الفاتورة'])
    const dueDateCol      = col(['Due Date', 'تاريخ الاستحقاق'])
    const totalCol        = col(['Total', 'المبلغ الإجمالي', 'Grand Total'])
    const statusCol       = col(['Bill Status', 'Status', 'الحالة'])
    const notesCol        = col(['Vendor Notes', 'Notes', 'ملاحظات'])
    const customerNameCol = col(['Customer Name', 'اسم العميل'])
    const projectNameCol  = col(['Project Name', 'اسم المشروع'])

    if (!billNumCol) {
      return NextResponse.json({
        error: `لم يتم التعرف على عمود رقم الفاتورة. الأعمدة: ${headers.slice(0, 12).join(', ')}`,
      }, { status: 400 })
    }

    // ── Deduplicate (Zoho exports one row per line item) ──────────────
    const uniqueBills = new Map<string, Record<string, string>>()
    for (const row of data) {
      const bn = row[billNumCol]?.trim()
      if (bn && !uniqueBills.has(bn)) uniqueBills.set(bn, row)
    }

    // ── Load all reference data in parallel (one shot each) ───────────
    const [allProjects, allSuppliers, existingBills] = await Promise.all([
      prisma.project.findMany({ select: { id: true, code: true, clientName: true, name: true } }),
      prisma.supplier.findMany({ select: { id: true, name: true } }),
      prisma.bill.findMany({
        where: {
          OR: [
            { billNumber: { in: Array.from(uniqueBills.keys()) } },
            ...(billIdCol
              ? [{ zohoId: { in: Array.from(uniqueBills.values()).map(r => r[billIdCol!]?.trim()).filter(Boolean) } }]
              : []),
          ],
        },
        select: { id: true, billNumber: true, zohoId: true, projectId: true, isLinked: true, projectCode: true },
      }),
    ])

    const supplierMap = new Map(allSuppliers.map(s => [s.name.toLowerCase(), s]))
    const billByNum   = new Map(existingBills.map(b => [b.billNumber, b]))
    const billByZoho  = new Map(existingBills.filter(b => b.zohoId).map(b => [b.zohoId!, b]))

    // ── Collect new vendors to create ─────────────────────────────────
    const newVendorNames = new Set<string>()
    for (const row of Array.from(uniqueBills.values())) {
      const name = vendorCol ? row[vendorCol]?.trim() : null
      if (name && !supplierMap.has(name.toLowerCase())) newVendorNames.add(name)
    }
    if (newVendorNames.size > 0) {
      await prisma.supplier.createMany({
        data: Array.from(newVendorNames).map(name => ({ name, serviceType: 'OTHER', recommendation: 'UNDER_REVIEW' })),
        skipDuplicates: true,
      })
      // Reload suppliers
      const fresh = await prisma.supplier.findMany({ where: { name: { in: Array.from(newVendorNames) } }, select: { id: true, name: true } })
      for (const s of fresh) supplierMap.set(s.name.toLowerCase(), s)
    }

    // ── Build create / update buckets ─────────────────────────────────
    const toCreate: any[] = []
    const toUpdate: Array<{ id: string; data: any }> = []
    let linked = 0, unlinked = 0

    for (const [billNumber, row] of Array.from(uniqueBills.entries())) {
      const zohoId      = billIdCol ? row[billIdCol]?.trim() || null : null
      const vendorName  = vendorCol ? row[vendorCol]?.trim() || null : null
      const billDate    = parseDate(dateCol    ? row[dateCol]    : undefined) || new Date()
      const dueDate     = parseDate(dueDateCol ? row[dueDateCol] : undefined)
      const amount      = parseAmount(totalCol ? row[totalCol]   : undefined)
      const status      = mapBillStatus(statusCol ? row[statusCol] : undefined)
      const notes       = notesCol        ? row[notesCol]?.trim()         || '' : ''
      const customerName = customerNameCol ? row[customerNameCol]?.trim() || null : null
      const zohoProject  = projectNameCol  ? row[projectNameCol]?.trim()  || null : null

      const supplierId = vendorName ? (supplierMap.get(vendorName.toLowerCase())?.id ?? null) : null

      // Project matching
      let projectId: string | null = null
      let projectCode: string | null = null
      const codeMatch = notes.match(/\bPRJ-\d+\b/i)
      if (codeMatch) {
        const p = allProjects.find(p => p.code === codeMatch[0].toUpperCase())
        if (p) { projectId = p.id; projectCode = p.code }
      }
      if (!projectId && zohoProject) {
        const p = allProjects.find(p => p.name.toLowerCase().trim() === zohoProject.toLowerCase().trim())
        if (p) { projectId = p.id; projectCode = p.code }
      }
      if (!projectId && customerName) {
        const p = allProjects.find(p => p.clientName.toLowerCase().trim() === customerName.toLowerCase().trim())
        if (p) { projectId = p.id; projectCode = p.code }
      }
      const isLinked = !!projectId

      const existing = (zohoId ? billByZoho.get(zohoId) : null) ?? billByNum.get(billNumber)

      if (existing) {
        const effProjectId = projectId || existing.projectId
        const effLinked    = isLinked  || existing.isLinked
        const effCode      = projectCode || existing.projectCode
        toUpdate.push({
          id: existing.id,
          data: {
            amount, billDate, dueDate, status,
            projectCode: effCode,
            zohoCustomerName: customerName,
            isLinked: effLinked,
            updatedAt: new Date(),
            zohoId: zohoId || undefined,
            supplierId: supplierId || undefined,
            projectId: effProjectId || undefined,
          },
        })
        if (effLinked) linked++; else unlinked++
      } else {
        toCreate.push({
          zohoId, billNumber, amount, billDate, dueDate, status,
          projectCode, zohoCustomerName: customerName, isLinked,
          supplierId: supplierId || null,
          projectId:  projectId  || null,
        })
        if (isLinked) linked++; else unlinked++
      }
    }

    // ── Execute in parallel chunks ────────────────────────────────────
    const CHUNK = 50
    const chunks = <T>(arr: T[]) => Array.from({ length: Math.ceil(arr.length / CHUNK) }, (_, i) => arr.slice(i * CHUNK, (i + 1) * CHUNK))

    await Promise.all([
      // createMany is a single query
      toCreate.length > 0
        ? prisma.bill.createMany({ data: toCreate, skipDuplicates: true })
        : Promise.resolve(),
      // updates in parallel chunks
      ...chunks(toUpdate).map(chunk =>
        prisma.$transaction(chunk.map(u => prisma.bill.update({ where: { id: u.id }, data: u.data })))
      ),
    ])

    await Promise.all([
      prisma.zohoSyncLog.create({
        data: {
          syncType: 'BILLS_CSV',
          status: 'SUCCESS',
          message: `فواتير: ${toCreate.length} جديدة، ${toUpdate.length} محدّثة، ${linked} مرتبطة، ${unlinked} غير مرتبطة`,
          itemsSynced: toCreate.length + toUpdate.length,
        },
      }),
      prisma.setting.upsert({
        where: { key: 'LAST_SYNC_AT' },
        update: { value: new Date().toISOString() },
        create: { key: 'LAST_SYNC_AT', value: new Date().toISOString() },
      }),
    ])

    return NextResponse.json({
      added: toCreate.length,
      updated: toUpdate.length,
      linked,
      unlinked,
      total: uniqueBills.size,
    })
  } catch (err: any) {
    console.error('[upload/bills]', err)
    return NextResponse.json({ error: err.message || 'خطأ في معالجة الملف' }, { status: 500 })
  }
}
