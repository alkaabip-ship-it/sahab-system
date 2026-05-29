// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { prisma } from '@/lib/prisma'

const REDIRECT_URI    = 'https://sahab-system.vercel.app/api/zoho/callback'
const SETTINGS_URL    = 'https://sahab-system.vercel.app/dashboard/settings'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${SETTINGS_URL}?zoho=error`)
  }

  // Read credentials from DB (user saved them in settings)
  const [dbClientId, dbClientSecret] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_ID' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_SECRET' } }),
  ])
  const clientId     = dbClientId?.value     || process.env.ZOHO_CLIENT_ID
  const clientSecret = dbClientSecret?.value || process.env.ZOHO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${SETTINGS_URL}?zoho=missing_credentials`)
  }

  try {
    const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      },
    })

    const { access_token, refresh_token, expires_in } = res.data

    if (!access_token) {
      console.error('[Zoho callback] no access_token:', res.data)
      return NextResponse.redirect(`${SETTINGS_URL}?zoho=error`)
    }

    const now = Date.now()

    // Save access token + expiry + optional refresh token
    await prisma.setting.upsert({
      where:  { key: 'ZOHO_ACCESS_TOKEN' },
      update: { value: access_token },
      create: { id: 'ZOHO_ACCESS_TOKEN', key: 'ZOHO_ACCESS_TOKEN', value: access_token },
    })
    await prisma.setting.upsert({
      where:  { key: 'ZOHO_TOKEN_EXPIRES_AT' },
      update: { value: String(now + (expires_in ?? 3600) * 1000) },
      create: { id: 'ZOHO_TOKEN_EXPIRES_AT', key: 'ZOHO_TOKEN_EXPIRES_AT', value: String(now + (expires_in ?? 3600) * 1000) },
    })
    if (refresh_token) {
      await prisma.setting.upsert({
        where:  { key: 'ZOHO_REFRESH_TOKEN' },
        update: { value: refresh_token },
        create: { id: 'ZOHO_REFRESH_TOKEN', key: 'ZOHO_REFRESH_TOKEN', value: refresh_token },
      })
    }

    return NextResponse.redirect(`${SETTINGS_URL}?zoho=connected`)
  } catch (err: any) {
    console.error('[Zoho callback] exchange error:', err?.response?.data || err?.message)
    return NextResponse.redirect(`${SETTINGS_URL}?zoho=error`)
  }
}
