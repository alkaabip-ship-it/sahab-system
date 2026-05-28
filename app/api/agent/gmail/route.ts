/**
 * GET  /api/agent/gmail  → redirect to Google OAuth (manual URL build — no googleapis needed)
 * DELETE /api/agent/gmail → disconnect
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ')

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const clientId    = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/agent/gmail/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID غير مضبوط في بيئة التشغيل' },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return NextResponse.redirect(authUrl)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { prisma } = await import('@/lib/prisma')
  await prisma.setting.deleteMany({
    where: { key: { in: ['gmail_refresh_token', 'gmail_email'] } },
  })
  return NextResponse.json({ ok: true })
}
