import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAccessToken } from '@/lib/zoho'
import { prisma } from '@/lib/prisma'
import axios from 'axios'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  // 1. Check required fields
  const keys = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_ORGANIZATION_ID']
  const settings = await prisma.setting.findMany({ where: { key: { in: [...keys, 'ZOHO_ACCESS_TOKEN', 'ZOHO_REFRESH_TOKEN'] } } })
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]))

  const missing = keys.filter(k => !map[k] && !process.env[k])
  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      step: 'missing_fields',
      message: `الحقول التالية فارغة: ${missing.join(', ')}`,
    })
  }

  if (!map['ZOHO_ACCESS_TOKEN'] && !map['ZOHO_REFRESH_TOKEN'] && !process.env.ZOHO_ACCESS_TOKEN) {
    return NextResponse.json({
      ok: false,
      step: 'not_connected',
      message: 'لم يتم ربط Zoho بعد — اضغط "ربط Zoho" بعد حفظ Client ID و Client Secret',
    })
  }

  // 2. Try to get access token
  let token: string
  try {
    token = await getAccessToken()
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      step: 'token',
      message: `فشل الحصول على Access Token: ${err?.message}`,
    })
  }

  // 3. Make a test call to Zoho Books
  const orgId = map['ZOHO_ORGANIZATION_ID'] || process.env.ZOHO_ORGANIZATION_ID
  try {
    const res = await axios.get('https://www.zohoapis.com/books/v3/organizations', {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
    const orgs = res.data?.organizations ?? []
    const org  = orgs.find((o: any) => String(o.organization_id) === String(orgId)) ?? orgs[0]
    return NextResponse.json({
      ok: true,
      message: `الاتصال يعمل ✓`,
      orgName: org?.name ?? null,
      orgId:   org?.organization_id ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      step: 'api_call',
      message: `وصل إلى Zoho لكن فشل الاتصال بـ Books: ${err?.response?.data?.message || err?.message}`,
    })
  }
}
