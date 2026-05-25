import axios from 'axios'
import { prisma } from './prisma'
import { calculateSupplierRecommendation } from './utils'

const ZOHO_BASE_URL = 'https://www.zohoapis.com/books/v3'
const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/token'

export async function getAccessToken(): Promise<string> {
  // Check cached token
  const tokenSetting = await prisma.setting.findUnique({
    where: { key: 'ZOHO_ACCESS_TOKEN' },
  })
  const expiresSetting = await prisma.setting.findUnique({
    where: { key: 'ZOHO_TOKEN_EXPIRES_AT' },
  })

  const now = Date.now()
  const expiresAt = parseInt(expiresSetting?.value || '0')

  if (tokenSetting?.value && expiresAt > now + 60000) {
    return tokenSetting.value
  }

  // Refresh token — read from DB first, fall back to env
  const [dbRefresh, dbClientId, dbClientSecret] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ZOHO_REFRESH_TOKEN' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_ID' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_SECRET' } }),
  ])
  const refreshToken  = dbRefresh?.value     || process.env.ZOHO_REFRESH_TOKEN
  const clientId      = dbClientId?.value    || process.env.ZOHO_CLIENT_ID
  const clientSecret  = dbClientSecret?.value || process.env.ZOHO_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('بيانات اعتماد Zoho غير مكتملة — أضفها في صفحة الإعدادات')
  }

  const response = await axios.post(ZOHO_AUTH_URL, null, {
    params: {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    },
  })

  const { access_token, expires_in, error } = response.data

  if (!access_token) {
    throw new Error(`Zoho رفض الاتصال: ${error || JSON.stringify(response.data)}`)
  }

  await prisma.setting.upsert({
    where: { key: 'ZOHO_ACCESS_TOKEN' },
    update: { value: access_token },
    create: { key: 'ZOHO_ACCESS_TOKEN', value: access_token },
  })

  await prisma.setting.upsert({
    where: { key: 'ZOHO_TOKEN_EXPIRES_AT' },
    update: { value: String(now + expires_in * 1000) },
    create: {
      key: 'ZOHO_TOKEN_EXPIRES_AT',
      value: String(now + expires_in * 1000),
    },
  })

  return access_token
}

export async function syncVendors(
  orgId: string,
  token: string
): Promise<number> {
  // ── 1. Fetch ALL Zoho vendors (paginated) ────────────────────────────
  const zohoVendors: any[] = []
  let page = 1, hasMore = true
  while (hasMore) {
    const response = await axios.get(`${ZOHO_BASE_URL}/contacts`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId, contact_type: 'vendor', page, per_page: 200 },
    })
    zohoVendors.push(...(response.data.contacts ?? []))
    hasMore = response.data.page_context?.has_more_page ?? false
    page++
  }

  // ── 2. Load existing suppliers from DB ───────────────────────────────
  const existing = await prisma.supplier.findMany({
    select: { id: true, zohoId: true, serviceType: true, name: true, phone: true, email: true },
  })
  const existingMap = new Map(
    existing.filter(s => s.zohoId).map(s => [s.zohoId!, s])
  )

  // ── 3. Process each vendor ───────────────────────────────────────────
  for (const vendor of zohoVendors) {
    const zohoId   = vendor.contact_id
    const prev     = existingMap.get(zohoId)

    // For existing vendors: NEVER overwrite serviceType — keep the manually-set value
    // For new vendors: auto-detect serviceType from name/notes
    const serviceType = prev ? prev.serviceType : extractServiceType(vendor)

    // Only overwrite name/phone/email from Zoho if Zoho has a non-empty value.
    // This prevents a blank Zoho record from erasing a manually-entered value.
    const zohoName  = vendor.contact_name || null
    const zohoPhone = vendor.phone || vendor.mobile || null
    const zohoEmail = vendor.email || null

    await prisma.supplier.upsert({
      where: { zohoId },
      update: {
        ...(zohoName  ? { name:  zohoName  } : {}),
        ...(zohoPhone ? { phone: zohoPhone } : {}),
        ...(zohoEmail ? { email: zohoEmail } : {}),
        // serviceType intentionally omitted — manual edits are preserved
        // recommendation intentionally omitted — recalculated separately only when evaluations exist
        updatedAt: new Date(),
      },
      create: {
        zohoId,
        name:           zohoName  ?? '',
        phone:          zohoPhone,
        email:          zohoEmail,
        serviceType,
        recommendation: 'UNDER_REVIEW',
      },
    })
  }

  return zohoVendors.length
}

export async function syncCustomers(
  orgId: string,
  token: string
): Promise<number> {
  // ── 1. Fetch ALL Zoho customers (paginated) ──────────────────────────
  const zohoCustomers: any[] = []
  let page = 1, hasMore = true
  while (hasMore) {
    const res = await axios.get(`${ZOHO_BASE_URL}/contacts`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId, contact_type: 'customer', page, per_page: 200 },
    })
    zohoCustomers.push(...(res.data.contacts ?? []))
    hasMore = res.data.page_context?.has_more_page ?? false
    page++
  }

  // ── 2. Bulk upsert ───────────────────────────────────────────────────
  for (const c of zohoCustomers) {
    await prisma.customer.upsert({
      where: { zohoId: c.contact_id },
      update: {
        name:    c.contact_name,
        phone:   c.phone || c.mobile || null,
        email:   c.email || null,
        company: c.company_name || null,
        updatedAt: new Date(),
      },
      create: {
        zohoId:  c.contact_id,
        name:    c.contact_name,
        phone:   c.phone || c.mobile || null,
        email:   c.email || null,
        company: c.company_name || null,
      },
    })
  }

  return zohoCustomers.length
}

export async function syncBills(
  orgId: string,
  token: string
): Promise<number> {
  const codeSourceSetting = await prisma.setting.findUnique({ where: { key: 'PROJECT_CODE_SOURCE' } })
  const codeSource = codeSourceSetting?.value || 'custom_field'

  // ── 1. Fetch ALL Zoho bills (all pages) ──────────────────────────────
  const zohoBills: any[] = []
  let page = 1, hasMore = true
  while (hasMore) {
    const res = await axios.get(`${ZOHO_BASE_URL}/bills`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId, page, per_page: 200 },
    })
    zohoBills.push(...(res.data.bills ?? []))
    hasMore = res.data.page_context?.has_more_page ?? false
    page++
  }

  // ── 2. Load reference data in bulk ───────────────────────────────────
  const [allSuppliers, allProjects, existingBills] = await Promise.all([
    prisma.supplier.findMany({ select: { id: true, zohoId: true } }),
    prisma.project.findMany({ select: { id: true, code: true } }),
    prisma.bill.findMany({ select: { id: true, zohoId: true, projectId: true, projectCode: true } }),
  ])

  const supplierMap = new Map(allSuppliers.filter(s => s.zohoId).map(s => [s.zohoId!, s.id]))
  const projectMap  = new Map(allProjects.map(p => [p.code, p.id]))
  const billMap     = new Map(existingBills.filter(b => b.zohoId).map(b => [b.zohoId!, b]))

  // ── 3. Process in memory ─────────────────────────────────────────────
  const toCreate: any[] = []
  const toUpdate: any[] = []

  for (const bill of zohoBills) {
    const zohoId      = bill.bill_id
    const projectCode = extractProjectCode(bill, codeSource)
    const existing    = billMap.get(zohoId)
    const projectId   = (projectCode ? projectMap.get(projectCode) : null)
                        || (!projectCode ? existing?.projectId : null)
                        || null

    const data = {
      billNumber:  bill.bill_number,
      supplierId:  supplierMap.get(bill.vendor_id) || null,
      projectId,
      amount:      parseFloat(bill.total) || 0,
      billDate:    new Date(bill.date + 'T12:00:00'),
      dueDate:     bill.due_date ? new Date(bill.due_date + 'T12:00:00') : null,
      status:      mapBillStatus(bill.status),
      projectCode: projectCode || existing?.projectCode || null,
      isLinked:    !!projectId,
    }

    if (existing) toUpdate.push({ zohoId, data })
    else          toCreate.push({ zohoId, ...data })
  }

  // ── 4. Bulk DB writes ────────────────────────────────────────────────
  if (toCreate.length > 0) {
    await prisma.bill.createMany({ data: toCreate, skipDuplicates: true })
  }
  for (const { zohoId, data } of toUpdate) {
    await prisma.bill.update({ where: { zohoId }, data })
  }

  return zohoBills.length
}

export async function linkBillsToProjects(): Promise<number> {
  const unlinkedBills = await prisma.bill.findMany({
    where: { isLinked: false, projectCode: { not: null } },
  })

  let linked = 0

  for (const bill of unlinkedBills) {
    if (!bill.projectCode) continue

    const project = await prisma.project.findUnique({
      where: { code: bill.projectCode },
    })

    if (project) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { projectId: project.id, isLinked: true },
      })
      linked++
    }
  }

  return linked
}

export async function recalculateAllSupplierRecommendations(): Promise<void> {
  // Only recalculate suppliers that actually have evaluations.
  // Suppliers without evaluations keep their manually-set recommendation.
  const suppliersWithEvals = await prisma.supplierEvaluation.findMany({
    select: { supplierId: true },
    distinct: ['supplierId'],
  })
  const ids = suppliersWithEvals.map(e => e.supplierId)

  for (const id of ids) {
    const recommendation = await calculateSupplierRecommendation(id)
    await prisma.supplier.update({
      where: { id },
      data: { recommendation },
    })
  }
}

export async function syncInvoices(
  orgId: string,
  token: string
): Promise<number> {
  // ── 1. Fetch ALL Zoho invoices (all pages) ────────────────────────────
  const zohoInvoices: any[] = []
  let page = 1, hasMore = true
  while (hasMore) {
    const res = await axios.get(`${ZOHO_BASE_URL}/invoices`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId, page, per_page: 200 },
    })
    zohoInvoices.push(...(res.data.invoices ?? []))
    hasMore = res.data.page_context?.has_more_page ?? false
    page++
  }

  // ── 2. Load reference data in bulk ───────────────────────────────────
  const [allProjects, existingInvoices] = await Promise.all([
    prisma.project.findMany({ select: { id: true, clientName: true } }),
    prisma.invoice.findMany({ select: { id: true, zohoId: true, invoiceNumber: true, projectId: true } }),
  ])

  const projectByClient = new Map(allProjects.map(p => [p.clientName.toLowerCase().trim(), p.id]))
  const invByZoho  = new Map(existingInvoices.filter(i => i.zohoId).map(i => [i.zohoId!, i]))
  const invByNum   = new Map(existingInvoices.map(i => [i.invoiceNumber, i]))

  // ── 3. Process in memory ─────────────────────────────────────────────
  const toCreate: any[] = []
  const toUpdate: any[] = []

  for (const inv of zohoInvoices) {
    const status = mapInvoiceStatus(inv.status)
    if (status === 'VOID') continue

    const zohoId        = inv.invoice_id
    const invoiceNumber = inv.invoice_number
    const customerName  = inv.customer_name || ''
    const amount        = parseFloat(inv.total)   || 0
    const balance       = parseFloat(inv.balance) || 0
    const invoiceDate   = new Date(inv.date + 'T12:00:00')
    const dueDate       = inv.due_date ? new Date(inv.due_date + 'T12:00:00') : null
    const projectId     = projectByClient.get(customerName.toLowerCase().trim()) || null

    const existing = invByZoho.get(zohoId) ?? invByNum.get(invoiceNumber)

    if (existing) {
      toUpdate.push({
        id: existing.id,
        data: { zohoId, customerName, amount, balance, invoiceDate, dueDate, status,
                projectId: projectId || existing.projectId || null },
      })
    } else {
      toCreate.push({ zohoId, invoiceNumber, customerName, amount, balance, invoiceDate, dueDate, status, projectId })
    }
  }

  // ── 4. Bulk DB writes ────────────────────────────────────────────────
  if (toCreate.length > 0) {
    await prisma.invoice.createMany({ data: toCreate, skipDuplicates: true })
  }
  for (const { id, data } of toUpdate) {
    await prisma.invoice.update({ where: { id }, data })
  }

  return zohoInvoices.length
}

function mapInvoiceStatus(zohoStatus: string): string {
  switch (zohoStatus?.toLowerCase()) {
    case 'paid':     return 'PAID'
    case 'void':     return 'VOID'
    case 'partial':
    case 'partially_paid': return 'PARTIAL'
    default:         return 'UNPAID'
  }
}

export async function fullSync(): Promise<{
  vendors: number
  bills: number
  invoices: number
  linked: number
}> {
  const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
  const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
  if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID غير محدد — أضفه في صفحة الإعدادات')

  const token = await getAccessToken()

  const vendors   = await syncVendors(orgId, token)
  const customers = await syncCustomers(orgId, token)
  const bills     = await syncBills(orgId, token)
  const invoices  = await syncInvoices(orgId, token)
  const linked    = await linkBillsToProjects()
  await recalculateAllSupplierRecommendations()

  await prisma.setting.upsert({
    where: { key: 'LAST_SYNC_AT' },
    update: { value: new Date().toISOString() },
    create: { key: 'LAST_SYNC_AT', value: new Date().toISOString() },
  })

  await prisma.zohoSyncLog.create({
    data: {
      syncType: 'FULL',
      status: 'SUCCESS',
      message: `تمت المزامنة: ${vendors} مورد، ${customers} عميل، ${bills} فاتورة شراء، ${invoices} فاتورة مبيعات، ${linked} مرتبطة`,
      itemsSynced: vendors + customers + bills + invoices,
    },
  })

  return { vendors, bills, invoices, linked }
}

function extractProjectCode(bill: any, source: string): string | null {
  if (source === 'custom_field') {
    const customFields = bill.custom_fields || []
    for (const field of customFields) {
      if (
        field.label === 'Project Code' ||
        field.label === 'كود المشروع' ||
        field.label === 'project_code'
      ) {
        const code = field.value?.toString().trim()
        if (code && /^PRJ-\d+$/i.test(code)) return code.toUpperCase()
      }
    }
  }

  if (source === 'reference' || source === 'custom_field') {
    const ref = bill.reference_number?.toString().trim()
    if (ref && /^PRJ-\d+$/i.test(ref)) return ref.toUpperCase()
  }

  if (source === 'notes' || source === 'custom_field') {
    const notes = bill.notes?.toString() || ''
    const match = notes.match(/PRJ-\d+/i)
    if (match) return match[0].toUpperCase()
  }

  return null
}

function extractServiceType(vendor: any): string {
  const notes = (vendor.notes || '').toLowerCase()
  const name = (vendor.contact_name || '').toLowerCase()

  if (notes.includes('screen') || name.includes('screen') || name.includes('شاشة') || name.includes('عرض'))
    return 'SCREENS'
  if (notes.includes('audio') || name.includes('audio') || name.includes('sound') || name.includes('صوت'))
    return 'AUDIO'
  if (notes.includes('light') || name.includes('light') || name.includes('إضاءة') || name.includes('ضوء'))
    return 'LIGHTING'
  if (notes.includes('print') || name.includes('print') || name.includes('طباعة') || name.includes('مطبعة'))
    return 'PRINTING'
  if (notes.includes('carpet') || name.includes('carpet') || name.includes('سجاد'))
    return 'CARPET'
  if (notes.includes('carpent') || name.includes('wood') || name.includes('نجارة') || name.includes('أثاث'))
    return 'CARPENTRY'
  if (notes.includes('flower') || name.includes('flower') || name.includes('ورود') || name.includes('زهور'))
    return 'FLOWERS'
  if (notes.includes('photo') || name.includes('photo') || name.includes('تصوير'))
    return 'PHOTOGRAPHY'
  if (notes.includes('video') || name.includes('video') || name.includes('فيديو'))
    return 'VIDEO'
  if (notes.includes('transport') || name.includes('نقل') || name.includes('شحن'))
    return 'TRANSPORT'
  if (notes.includes('labor') || name.includes('عمالة') || name.includes('عمال'))
    return 'LABOR'
  if (notes.includes('hospit') || name.includes('ضيافة') || name.includes('كاتر'))
    return 'HOSPITALITY'

  return 'OTHER'
}

function mapBillStatus(zohoStatus: string): string {
  switch (zohoStatus?.toLowerCase()) {
    case 'paid':
      return 'PAID'
    case 'partially_paid':
    case 'partial':
      return 'PARTIAL'
    default:
      return 'UNPAID'
  }
}
