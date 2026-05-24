import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import axios from 'axios'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Authorization Code مطلوب' }, { status: 400 })

  const [dbClientId, dbClientSecret] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_ID' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_SECRET' } }),
  ])

  const clientId     = dbClientId?.value     || process.env.ZOHO_CLIENT_ID
  const clientSecret = dbClientSecret?.value || process.env.ZOHO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Client ID و Client Secret مطلوبان أولاً' }, { status: 400 })
  }

  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: 'https://zohoapis.com',
      },
    })

    const { refresh_token, error } = response.data

    if (!refresh_token) {
      return NextResponse.json(
        { error: `Zoho error: ${error || JSON.stringify(response.data)}` },
        { status: 400 }
      )
    }

    await prisma.setting.upsert({
      where: { key: 'ZOHO_REFRESH_TOKEN' },
      update: { value: refresh_token },
      create: { key: 'ZOHO_REFRESH_TOKEN', value: refresh_token },
    })

    return NextResponse.json({ refresh_token })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.response?.data?.error || err?.message || 'فشل الاتصال بـ Zoho' },
      { status: 500 }
    )
  }
}
