/**
 * GET /api/agent/gmail/callback
 * Exchange auth code for tokens using plain fetch (no googleapis OAuth2 client).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')
  const base  = process.env.NEXTAUTH_URL ?? 'https://sahab-system.vercel.app'

  if (error || !code) {
    console.error('[gmail callback] error from Google:', error)
    return NextResponse.redirect(`${base}/dashboard/agent?gmail=error`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri:  `${base}/api/agent/gmail/callback`,
        grant_type:    'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    console.log('[gmail callback] token response:', JSON.stringify({ ...tokens, access_token: '***', refresh_token: tokens.refresh_token ? '***set***' : 'MISSING' }))

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${base}/dashboard/agent?gmail=no_refresh_token`)
    }

    // Get Gmail profile
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()
    const email   = profile.emailAddress ?? 'unknown'

    // Persist
    await prisma.setting.upsert({
      where:  { key: 'gmail_refresh_token' },
      update: { value: tokens.refresh_token },
      create: { key: 'gmail_refresh_token', value: tokens.refresh_token },
    })
    await prisma.setting.upsert({
      where:  { key: 'gmail_email' },
      update: { value: email },
      create: { key: 'gmail_email', value: email },
    })
    // Store access token too (for immediate use without re-auth)
    await prisma.setting.upsert({
      where:  { key: 'gmail_access_token' },
      update: { value: tokens.access_token },
      create: { key: 'gmail_access_token', value: tokens.access_token },
    })

    return NextResponse.redirect(`${base}/dashboard/agent?gmail=connected`)
  } catch (e: any) {
    console.error('[gmail callback] exception:', e)
    return NextResponse.redirect(`${base}/dashboard/agent?gmail=error`)
  }
}
