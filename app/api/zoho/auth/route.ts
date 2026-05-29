// @ts-nocheck
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const REDIRECT_URI = 'https://sahab-system.vercel.app/api/zoho/callback'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  // Read Client ID from DB first, fallback to env
  const dbClientId = await prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_ID' } })
  const clientId = dbClientId?.value || process.env.ZOHO_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(
      `${REDIRECT_URI.replace('/api/zoho/callback', '')}/dashboard/settings?zoho=missing_client_id`
    )
  }

  const scopes = 'ZohoBooks.fullaccess.all'
  const authUrl = new URL('https://accounts.zoho.com/oauth/v2/auth')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  return NextResponse.redirect(authUrl.toString())
}
