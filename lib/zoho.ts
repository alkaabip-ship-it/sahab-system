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
  let page = 1
  let hasMore = true
  let synced = 0

  while (hasMore) {
    const response = await axios.get(`${ZOHO_BASE_URL}/contacts`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: {
        organization_id: orgId,
        contact_type: 'vendor',
        page,
        per_page: 200,
      },
    })

    const { contacts, page_context } = response.data

    for (const vendor of contacts) {
      const serviceType = extractServiceType(vendor)
      await prisma.supplier.upsert({
        where: { zohoId: vendor.contact_id },
        update: {
          name: vendor.contact_name,
          phone: vendor.phone || vendor.mobile || null,
          email: vendor.email || null,
          serviceType,
          updatedAt: new Date(),
        },
        create: {
          zohoId: vendor.contact_id,
          name: vendor.contact_name,
          phone: vendor.phone || vendor.mobile || null,
          email: vendor.email || null,
          serviceType,
          recommendation: 'UNDER_REVIEW',
        },
      })
      synced++
    }

    hasMore = page_context?.has_more_page || false
    page++
  }

  return synced
}

export async function syncBills(
  orgId: string,
  token: string
): Promise<number> {
  let page = 1
  let hasMore = true
  let synced = 0

  const codeSourceSetting = await prisma.setting.findUnique({
    where: { key: 'PROJECT_CODE_SOURCE' },
  })
  const codeSource = codeSourceSetting?.value || 'custom_field'

  while (hasMore) {
    const response = await axios.get(`${ZOHO_BASE_URL}/bills`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: {
        organization_id: orgId,
        page,
        per_page: 200,
      },
    })

    const { bills, page_context } = response.data

    for (const bill of bills) {
      // Find supplier
      let supplier = null
      if (bill.vendor_id) {
        supplier = await prisma.supplier.findUnique({
          where: { zohoId: bill.vendor_id },
        })
      }

      // Extract project code
      const projectCode = extractProjectCode(bill, codeSource)

      // Find project
      let project = null
      if (projectCode) {
        project = await prisma.project.findUnique({
          where: { code: projectCode },
        })
      }

      const zohoId = bill.bill_id
      const existingBill = await prisma.bill.findUnique({
        where: { zohoId },
      })

      // Preserve existing project link if Zoho has no project code
      const resolvedProjectId = project?.id || (projectCode ? null : existingBill?.projectId) || null
      const resolvedIsLinked  = !!resolvedProjectId

      const billData = {
        billNumber: bill.bill_number,
        supplierId: supplier?.id || null,
        projectId: resolvedProjectId,
        amount: parseFloat(bill.total) || 0,
        billDate: new Date(bill.date),
        dueDate: bill.due_date ? new Date(bill.due_date) : null,
        status: mapBillStatus(bill.status),
        projectCode: projectCode || existingBill?.projectCode || null,
        isLinked: resolvedIsLinked,
        updatedAt: new Date(),
      }

      if (existingBill) {
        await prisma.bill.update({
          where: { zohoId },
          data: billData,
        })
      } else {
        await prisma.bill.create({
          data: {
            zohoId,
            ...billData,
          },
        })
      }
      synced++
    }

    hasMore = page_context?.has_more_page || false
    page++
  }

  return synced
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
  const suppliers = await prisma.supplier.findMany({ select: { id: true } })

  for (const supplier of suppliers) {
    const recommendation = await calculateSupplierRecommendation(supplier.id)
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { recommendation },
    })
  }
}

export async function fullSync(): Promise<{
  vendors: number
  bills: number
  linked: number
}> {
  const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
  const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
  if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID غير محدد — أضفه في صفحة الإعدادات')

  const token = await getAccessToken()

  const vendors = await syncVendors(orgId, token)
  const bills = await syncBills(orgId, token)
  const linked = await linkBillsToProjects()
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
      message: `تمت المزامنة: ${vendors} مورد، ${bills} فاتورة، ${linked} مرتبطة`,
      itemsSynced: vendors + bills,
    },
  })

  return { vendors, bills, linked }
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
