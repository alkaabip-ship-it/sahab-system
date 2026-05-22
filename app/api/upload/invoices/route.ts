import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

    // ── Load reference data in one shot ──────────────────────────────
    const zohoIds = invoiceIdCol
      ? Array.from(uniqueInvoices.values()).map(r => r[invoiceIdCol!]?.trim()).filter(Boolean)
      : []

    const [allProjects, existingInvoices] = await Promise.all([
      prisma.project.findMany({ select: { id: true, code: true, clientName: true, name: true } }),
      prisma.invoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { in: Array.from(uniqueInvoices.keys()) } },
            ...(zohoIds.length ? [{ zohoId: { in: zohoIds } }] : []),
          ],
        },
        select: { id: true, invoiceNumber: true, zohoId: true, projectId: true },
      }),
    ])

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

      const scalar = { customerName, amount, balance, invoiceDate, dueDate, status, notes, updatedAt: new Date() }

      if (existing) {
        const effProjectId = projectId || existing.projectId
        toUpdate.push({
          id: existing.id,
          data: { ...scalar, zohoId: zohoId || undefined, projectId: effProjectId || undefined },
        })
        if (effProjectId) linked++; else unlinked++
      } else {
        toCreate.push({ zohoId, invoiceNumber, ...scalar, projectId: projectId || null })
        if (isLinked) linked++; else unlinked++
      }
    }

    // ── Execute sequentially (connection_limit=1 on Supabase pooler) ──
    const CHUNK = 30
    const chunks = <T>(arr: T[]) =>
      Array.from({ length: Math.ceil(arr.length / CHUNK) }, (_, i) => arr.slice(i * CHUNK, (i + 1) * CHUNK))

    if (toCreate.length > 0) {
      await prisma.invoice.createMany({ data: toCreate, skipDuplicates: true })
    }
    for (const chunk of chunks(toUpdate)) {
      await prisma.$transaction(
        chunk.map(u => prisma.invoice.update({ where: { id: u.id }, data: u.data }))
      )
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
