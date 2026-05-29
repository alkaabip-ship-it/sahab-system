// @ts-nocheck
import { randomUUID } from 'crypto'
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

    // ── Load reference data SEQUENTIALLY (connection_limit=1) ─────────
    const allProjects = await prisma.project.findMany({
      select: { id: true, code: true, clientName: true, name: true },
    })
    const allSuppliers = await prisma.supplier.findMany({ select: { id: true, name: true } })

    const zohoIds = billIdCol
      ? Array.from(uniqueBills.values()).map(r => r[billIdCol!]?.trim()).filter(Boolean)
      : []
    const existingBills = await prisma.bill.findMany({
      where: {
        OR: [
          { billNumber: { in: Array.from(uniqueBills.keys()) } },
          ...(zohoIds.length ? [{ zohoId: { in: zohoIds } }] : []),
        ],
      },
      select: { id: true, billNumber: true, zohoId: true, projectId: true, isLinked: true, projectCode: true },
    })

    const supplierMap = new Map(allSuppliers.map(s => [s.name.toLowerCase(), s]))
    const billByNum   = new Map(existingBills.map(b => [b.billNumber, b]))
    const billByZoho  = new Map(existingBills.filter(b => b.zohoId).map(b => [b.zohoId!, b]))

    // ── Create new vendors ────────────────────────────────────────────
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
      const fresh = await prisma.supplier.findMany({
        where: { name: { in: Array.from(newVendorNames) } },
        select: { id: true, name: true },
      })
      for (const s of fresh) supplierMap.set(s.name.toLowerCase(), s)
    }

    // ── Build create / update buckets ─────────────────────────────────
    const toCreate: any[] = []
    const toUpdate: Array<{ id: string; data: any }> = []
    let linked = 0, unlinked = 0

    for (const [billNumber, row] of Array.from(uniqueBills.entries())) {
      const zohoId       = billIdCol ? row[billIdCol]?.trim() || null : null
      const vendorName   = vendorCol ? row[vendorCol]?.trim() || null : null
      const billDate     = parseDate(dateCol    ? row[dateCol]    : undefined) || new Date()
      const dueDate      = parseDate(dueDateCol ? row[dueDateCol] : undefined)
      const amount       = parseAmount(totalCol ? row[totalCol]   : undefined)
      const status       = mapBillStatus(statusCol ? row[statusCol] : undefined)
      const notes        = notesCol        ? row[notesCol]?.trim()          || '' : ''
      const customerName = customerNameCol ? row[customerNameCol]?.trim()  || null : null
      const zohoProject  = projectNameCol  ? row[projectNameCol]?.trim()   || null : null

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
            amount,
            billDate,
            dueDate:          dueDate      ?? null,
            status,
            projectCode:      effCode      ?? null,
            zohoCustomerName: customerName ?? null,
            isLinked:         effLinked,
            zohoId:           zohoId       ?? null,
            supplierId:       supplierId   ?? null,
            projectId:        effProjectId ?? null,
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

    // ── Creates: single query ─────────────────────────────────────────
    if (toCreate.length > 0) {
      await prisma.bill.createMany({ data: toCreate, skipDuplicates: true })
    }

    // ── Updates: single raw SQL batch per 1000 rows ───────────────────
    // Before: N/30 transactions × 32 round-trips each = hundreds of DB calls
    // After:  1 UPDATE … FROM (VALUES …) per 1000 rows = ~1 round-trip total
    if (toUpdate.length > 0) {
      for (const batch of chunk(toUpdate, 1000)) {
        const rows = Prisma.join(
          batch.map(u => Prisma.sql`(
            ${u.id}::text,
            ${u.data.amount}::float8,
            ${u.data.billDate}::timestamptz,
            ${u.data.dueDate}::timestamptz,
            ${u.data.status}::text,
            ${u.data.projectCode}::text,
            ${u.data.zohoCustomerName}::text,
            ${u.data.isLinked}::bool,
            ${u.data.zohoId}::text,
            ${u.data.supplierId}::text,
            ${u.data.projectId}::text
          )`)
        )
        await prisma.$executeRaw`
          UPDATE "Bill" AS b
          SET
            amount             = v.amount,
            "billDate"         = v.bill_date,
            "dueDate"          = v.due_date,
            status             = v.status,
            "projectCode"      = v.project_code,
            "zohoCustomerName" = v.zoho_cust,
            "isLinked"         = v.is_linked,
            "zohoId"           = COALESCE(v.zoho_id,      b."zohoId"),
            "supplierId"       = COALESCE(v.supplier_id,  b."supplierId"),
            "projectId"        = COALESCE(v.project_id,   b."projectId"),
            "updatedAt"        = NOW()
          FROM (VALUES ${rows})
            AS v(id, amount, bill_date, due_date, status, project_code, zoho_cust, is_linked, zoho_id, supplier_id, project_id)
          WHERE b.id = v.id
        `
      }
    }

    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'BILLS_CSV',
        status: 'SUCCESS',
        message: `فواتير: ${toCreate.length} جديدة، ${toUpdate.length} محدّثة، ${linked} مرتبطة، ${unlinked} غير مرتبطة`,
        itemsSynced: toCreate.length + toUpdate.length,
      },
    })
    await prisma.setting.upsert({
      where:  { key: 'LAST_SYNC_AT' },
      update: { value: new Date().toISOString() },
      create: { id: 'LAST_SYNC_AT', key: 'LAST_SYNC_AT', value: new Date().toISOString() },
    })

    return NextResponse.json({
      added: toCreate.length, updated: toUpdate.length, linked, unlinked, total: uniqueBills.size,
    })
  } catch (err: any) {
    console.error('[upload/bills]', err)
    return NextResponse.json({ error: err.message || 'خطأ في معالجة الملف' }, { status: 500 })
  }
}
