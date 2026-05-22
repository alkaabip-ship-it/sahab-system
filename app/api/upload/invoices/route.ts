import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import Papa from 'papaparse'

export const maxDuration = 60

function parseDate(val: string | undefined): Date | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null
  const c = val.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(c)) {
    const d = new Date(c + 'T12:00:00'); return isNaN(d.getTime()) ? null : d
  }
  const p = c.split(/[\/\-\.]/)
  if (p.length === 3 && p[2].length === 4) {
    const d = new Date(`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}T12:00:00`)
    if (!isNaN(d.getTime())) return d
  }
  const d = new Date(c); return isNaN(d.getTime()) ? null : d
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
  return 'UNPAID'
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size))
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

    const invoiceNumCol  = col(['Invoice Number', 'رقم الفاتورة'])
    const invoiceIdCol   = col(['Invoice ID', 'معرف الفاتورة'])
    const customerCol    = col(['Customer Name', 'اسم العميل'])
    const dateCol        = col(['Invoice Date', 'Date', 'تاريخ الفاتورة'])
    const dueDateCol     = col(['Due Date', 'تاريخ الاستحقاق'])
    const totalCol       = col(['Total', 'المبلغ الإجمالي'])
    const balanceCol     = col(['Balance', 'الرصيد'])
    const statusCol      = col(['Invoice Status', 'Status', 'الحالة'])
    const notesCol       = col(['Notes', 'ملاحظات'])
    const projectNameCol = col(['Project Name', 'اسم المشروع'])

    if (!invoiceNumCol) {
      return NextResponse.json({
        error: `لم يتم التعرف على ملف الفواتير. الأعمدة: ${headers.slice(0, 10).join(', ')}`,
      }, { status: 400 })
    }

    // ── Deduplicate ───────────────────────────────────────────────────
    const uniqueInvoices = new Map<string, Record<string, string>>()
    for (const row of data) {
      const num = row[invoiceNumCol]?.trim()
      if (num && !uniqueInvoices.has(num)) uniqueInvoices.set(num, row)
    }

    // ── Load reference data SEQUENTIALLY (connection_limit=1) ─────────
    const allProjects = await prisma.project.findMany({
      select: { id: true, code: true, clientName: true, name: true },
    })

    const zohoIds = invoiceIdCol
      ? Array.from(uniqueInvoices.values()).map(r => r[invoiceIdCol!]?.trim()).filter(Boolean)
      : []
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { in: Array.from(uniqueInvoices.keys()) } },
          ...(zohoIds.length ? [{ zohoId: { in: zohoIds } }] : []),
        ],
      },
      select: { id: true, invoiceNumber: true, zohoId: true, projectId: true },
    })

    const invByNum  = new Map(existingInvoices.map(i => [i.invoiceNumber, i]))
    const invByZoho = new Map(existingInvoices.filter(i => i.zohoId).map(i => [i.zohoId!, i]))

    // ── Bucket rows ───────────────────────────────────────────────────
    const toCreate: any[] = []
    const toUpdate: Array<{ id: string; data: any }> = []
    let linked = 0, unlinked = 0, voided = 0

    for (const [invoiceNumber, row] of Array.from(uniqueInvoices.entries())) {
      const status = mapInvoiceStatus(statusCol ? row[statusCol] : undefined)
      if (status === 'VOID') { voided++; continue }

      const zohoId       = invoiceIdCol   ? row[invoiceIdCol]?.trim()   || null : null
      const customerName = customerCol    ? row[customerCol]?.trim()    || ''   : ''
      const invoiceDate  = parseDate(dateCol    ? row[dateCol]    : undefined) || new Date()
      const dueDate      = parseDate(dueDateCol ? row[dueDateCol] : undefined)
      const amount       = parseAmount(totalCol   ? row[totalCol]   : undefined)
      const balance      = parseAmount(balanceCol ? row[balanceCol] : undefined)
      const notes        = notesCol       ? row[notesCol]?.trim()       || null : null
      const zohoProjName = projectNameCol ? row[projectNameCol]?.trim() || null : null

      // Project matching
      let projectId: string | null = null
      if (zohoProjName) {
        const p = allProjects.find(p => p.name.toLowerCase().trim() === zohoProjName.toLowerCase().trim())
        if (p) projectId = p.id
      }
      if (!projectId && customerName) {
        const p = allProjects.find(p => p.clientName.toLowerCase().trim() === customerName.toLowerCase().trim())
        if (p) projectId = p.id
      }
      const isLinked = !!projectId

      const existing = (zohoId ? invByZoho.get(zohoId) : null) ?? invByNum.get(invoiceNumber)

      if (existing) {
        const effProjectId = projectId || existing.projectId
        toUpdate.push({
          id: existing.id,
          data: {
            customerName,
            amount,
            balance,
            invoiceDate,
            dueDate:   dueDate    ?? null,
            status,
            notes:     notes      ?? null,
            zohoId:    zohoId     ?? null,
            projectId: effProjectId ?? null,
          },
        })
        if (effProjectId) linked++; else unlinked++
      } else {
        toCreate.push({ zohoId, invoiceNumber, customerName, amount, balance, invoiceDate, dueDate, status, notes, projectId: projectId || null })
        if (isLinked) linked++; else unlinked++
      }
    }

    // ── Creates: single query ─────────────────────────────────────────
    if (toCreate.length > 0) {
      await prisma.invoice.createMany({ data: toCreate, skipDuplicates: true })
    }

    // ── Updates: single raw SQL batch per 1000 rows ───────────────────
    if (toUpdate.length > 0) {
      for (const batch of chunk(toUpdate, 1000)) {
        const rows = Prisma.join(
          batch.map(u => Prisma.sql`(
            ${u.id}::text,
            ${u.data.customerName}::text,
            ${u.data.amount}::float8,
            ${u.data.balance}::float8,
            ${u.data.invoiceDate}::timestamptz,
            ${u.data.dueDate}::timestamptz,
            ${u.data.status}::text,
            ${u.data.notes}::text,
            ${u.data.zohoId}::text,
            ${u.data.projectId}::text
          )`)
        )
        await prisma.$executeRaw`
          UPDATE "Invoice" AS i
          SET
            "customerName" = v.customer_name,
            amount         = v.amount,
            balance        = v.balance,
            "invoiceDate"  = v.invoice_date,
            "dueDate"      = v.due_date,
            status         = v.status,
            notes          = v.notes,
            "zohoId"       = COALESCE(v.zoho_id,    i."zohoId"),
            "projectId"    = COALESCE(v.project_id, i."projectId"),
            "updatedAt"    = NOW()
          FROM (VALUES ${rows})
            AS v(id, customer_name, amount, balance, invoice_date, due_date, status, notes, zoho_id, project_id)
          WHERE i.id = v.id
        `
      }
    }

    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'INVOICES_CSV',
        status: 'SUCCESS',
        message: `فواتير عملاء: ${toCreate.length} جديدة، ${toUpdate.length} محدّثة، ${linked} مرتبطة، ${unlinked} غير مرتبطة، ${voided} ملغية`,
        itemsSynced: toCreate.length + toUpdate.length,
      },
    })

    return NextResponse.json({ added: toCreate.length, updated: toUpdate.length, linked, unlinked, voided, total: uniqueInvoices.size })
  } catch (err: any) {
    console.error('[upload/invoices]', err)
    return NextResponse.json({ error: err.message || 'خطأ في معالجة الملف' }, { status: 500 })
  }
}
