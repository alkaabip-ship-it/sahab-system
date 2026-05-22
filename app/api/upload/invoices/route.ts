import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'

// Zoho Books Invoice.csv actual columns:
// Invoice Date, Invoice ID, Invoice Number, Invoice Status,
// Customer Name, Total, Balance, Due Date, Notes, Project Name ...

function parseDate(val: string | undefined): Date | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null
  const clean = val.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const d = new Date(clean + 'T12:00:00')
    return isNaN(d.getTime()) ? null : d
  }
  const parts = clean.split(/[\/\-\.]/)
  if (parts.length === 3 && parts[2].length === 4) {
    const d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T12:00:00`)
    if (!isNaN(d.getTime())) return d
  }
  const d = new Date(clean)
  return isNaN(d.getTime()) ? null : d
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0
  return parseFloat(val.replace(/[^0-9.\-]/g, '')) || 0
}

function mapInvoiceStatus(val: string | undefined): string {
  if (!val) return 'UNPAID'
  const v = val.toLowerCase().trim()
  if (v === 'paid' || v === 'closed') return 'PAID'
  if (v.includes('partial')) return 'PARTIAL'
  if (v === 'void') return 'VOID'
  // 'Open', 'Overdue', 'Draft' → UNPAID
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

    // Detect Zoho Invoice.csv columns
    const invoiceNumCol  = headers.find(h => ['Invoice Number', 'رقم الفاتورة'].includes(h)) || null
    const invoiceIdCol   = headers.find(h => ['Invoice ID', 'معرف الفاتورة'].includes(h)) || null
    const customerCol    = headers.find(h => ['Customer Name', 'اسم العميل'].includes(h)) || null
    const dateCol        = headers.find(h => ['Invoice Date', 'Date', 'تاريخ الفاتورة'].includes(h)) || null
    const dueDateCol     = headers.find(h => ['Due Date', 'تاريخ الاستحقاق'].includes(h)) || null
    const totalCol       = headers.find(h => ['Total', 'المبلغ الإجمالي'].includes(h)) || null
    const balanceCol     = headers.find(h => ['Balance', 'الرصيد'].includes(h)) || null
    const statusCol      = headers.find(h => ['Invoice Status', 'Status', 'الحالة'].includes(h)) || null
    const notesCol       = headers.find(h => ['Notes', 'ملاحظات'].includes(h)) || null
    const projectNameCol = headers.find(h => ['Project Name', 'اسم المشروع'].includes(h)) || null

    if (!invoiceNumCol) {
      return NextResponse.json({
        error: `لم يتم التعرف على ملف الفواتير. الأعمدة: ${headers.slice(0, 10).join(', ')}`,
      }, { status: 400 })
    }

    // Deduplicate: Zoho exports one row per line item
    const uniqueInvoices = new Map<string, Record<string, string>>()
    for (const row of data) {
      const num = row[invoiceNumCol]?.trim()
      if (num && !uniqueInvoices.has(num)) uniqueInvoices.set(num, row)
    }

    // Cache projects for matching
    const allProjects = await prisma.project.findMany({
      select: { id: true, code: true, clientName: true, name: true },
    })

    let added = 0
    let updated = 0
    let linked = 0
    let unlinked = 0
    let voided = 0

    for (const [invoiceNumber, row] of uniqueInvoices) {
      const status = mapInvoiceStatus(statusCol ? row[statusCol] : undefined)

      // Skip Void invoices — don't count in financials
      if (status === 'VOID') { voided++; continue }

      const zohoId      = invoiceIdCol   ? row[invoiceIdCol]?.trim()   || null : null
      const customerName = customerCol   ? row[customerCol]?.trim()    || ''   : ''
      const invoiceDate  = parseDate(dateCol    ? row[dateCol]    : undefined) || new Date()
      const dueDate      = parseDate(dueDateCol ? row[dueDateCol] : undefined)
      const amount       = parseAmount(totalCol   ? row[totalCol]   : undefined)
      const balance      = parseAmount(balanceCol ? row[balanceCol] : undefined)
      const notes        = notesCol        ? row[notesCol]?.trim()        || null : null
      const zohoProjectName = projectNameCol ? row[projectNameCol]?.trim() || null : null

      // ─── Find project ────────────────────────────────────────────
      let projectId: string | null = null

      // Priority 1: Match Zoho Project Name to project name
      if (zohoProjectName) {
        const proj = allProjects.find(p =>
          p.name.toLowerCase().trim() === zohoProjectName.toLowerCase().trim()
        )
        if (proj) projectId = proj.id
      }

      // Priority 2: Match Customer Name to project clientName
      if (!projectId && customerName) {
        const proj = allProjects.find(p =>
          p.clientName.toLowerCase().trim() === customerName.toLowerCase().trim()
        )
        if (proj) projectId = proj.id
      }

      const isLinked = !!projectId

      // ─── Upsert invoice ──────────────────────────────────────────
      const scalarData = {
        customerName,
        amount,
        balance,
        invoiceDate,
        dueDate,
        status,
        notes,
        updatedAt: new Date(),
      }

      // Try find by zohoId first, then invoice number
      const existingByZohoId = zohoId
        ? await prisma.invoice.findUnique({ where: { zohoId } })
        : null
      const existingByNum = !existingByZohoId
        ? await prisma.invoice.findUnique({ where: { invoiceNumber } })
        : null
      const existing = existingByZohoId || existingByNum

      if (existing) {
        const effProjectId = projectId || existing.projectId
        await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            ...scalarData,
            zohoId: zohoId || existing.zohoId,
            project: effProjectId ? { connect: { id: effProjectId } } : undefined,
          },
        })
        updated++
        if (effProjectId) linked++; else unlinked++
      } else {
        await prisma.invoice.create({
          data: {
            zohoId,
            invoiceNumber,
            ...scalarData,
            project: projectId ? { connect: { id: projectId } } : undefined,
          },
        })
        added++
        if (isLinked) linked++; else unlinked++
      }
    }

    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'INVOICES_CSV',
        status: 'SUCCESS',
        message: `فواتير عملاء: ${added} جديدة، ${updated} محدّثة، ${linked} مرتبطة، ${unlinked} غير مرتبطة، ${voided} ملغية`,
        itemsSynced: added + updated,
      },
    })

    return NextResponse.json({ added, updated, linked, unlinked, voided, total: uniqueInvoices.size })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في معالجة الملف' }, { status: 500 })
  }
}
