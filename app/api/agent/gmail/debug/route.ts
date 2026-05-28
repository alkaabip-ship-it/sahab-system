/**
 * GET /api/agent/gmail/debug
 * Returns diagnostic info to help troubleshoot OAuth issues (ADMIN only).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const nextauthUrl  = process.env.NEXTAUTH_URL

  const redirectUri = `${nextauthUrl ?? 'https://sahab-system.vercel.app'}/api/agent/gmail/callback`

  return NextResponse.json({
    clientId:       clientId   ? `${clientId.slice(0, 20)}...` : '❌ غير موجود',
    clientSecret:   clientSecret ? '✅ موجود' : '❌ غير موجود',
    nextauthUrl:    nextauthUrl  ?? '❌ غير موجود (سيُستخدم الافتراضي)',
    redirectUri,
    requiredInGoogleConsole: {
      authorizedRedirectURI: redirectUri,
      authorizedOrigin:      nextauthUrl ?? 'https://sahab-system.vercel.app',
    },
    instructions: [
      `1. افتح: https://console.cloud.google.com`,
      `2. APIs & Services → Credentials → OAuth 2.0 Client IDs → تعديل`,
      `3. Authorized redirect URIs: أضف "${redirectUri}"`,
      `4. OAuth consent screen → Test users: أضف "info@sahabm.com"`,
    ],
  })
}
