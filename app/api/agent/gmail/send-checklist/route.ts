/**
 * POST /api/agent/gmail/send-checklist
 * Sends the services checklist as a download link — no attachment to avoid spam filters.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }          from 'next-auth'
import { authOptions }               from '@/lib/auth'
import { prisma }                    from '@/lib/prisma'

async function getAccessToken(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: 'gmail_refresh_token' } })
  if (!row?.value) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: row.value,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

function buildMime(params: {
  from:        string
  to:          string
  subject:     string
  body:        string
  inReplyTo?:  string
  references?: string
}): string {
  const subj    = params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`
  const raw64   = Buffer.from(params.body, 'utf-8').toString('base64')
  const bodyB64 = raw64.match(/.{1,76}/g)?.join('\r\n') ?? raw64
  const msgId   = `<${Date.now()}.${Math.random().toString(36).slice(2)}@sahabm.com>`
  const date    = new Date().toUTCString()

  const headers: string[] = [
    `From: "Sahab Events and Exhibitions" <${params.from}>`,
    `To: ${params.to}`,
    `Subject: ${subj}`,
    `Date: ${date}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    `X-Mailer: Sahab Events System`,
  ]
  if (params.inReplyTo)  headers.push(`In-Reply-To: ${params.inReplyTo}`)
  if (params.references) headers.push(`References: ${params.references}`)

  const mime = headers.join('\r\n') + '\r\n\r\n' + bodyB64

  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { to, subject, threadId, inReplyTo } = await req.json()
  if (!to) return NextResponse.json({ error: 'to مطلوب' }, { status: 400 })

  const token = await getAccessToken()
  if (!token) return NextResponse.json({ error: 'Gmail غير مرتبط' }, { status: 400 })

  // Get sender profile
  const profile = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())
  const from = profile.emailAddress ?? 'me'

  const body =
`شكراً لتواصلك مع سحاب للفعاليات والمعارض.

لمساعدتك في تحديد متطلبات فعاليتك بدقة، أعددنا قائمة بجميع خدماتنا المتاحة.

يُرجى التواصل معنا مباشرةً عبر الرد على هذا البريد أو الاتصال بنا، وسنُرسل لك القائمة كاملةً مع عرض السعر المناسب.

نحن في خدمتكم دائماً.

Sahab Events and Exhibitions
info@sahabm.com
+971562522325`

  const raw = buildMime({
    from,
    to,
    subject:    subject ?? 'قائمة خدمات سحاب للفعاليات',
    body,
    inReplyTo,
    references: inReplyTo,
  })

  const sendRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
  })
  const result = await sendRes.json()

  if (result.error) {
    console.error('[send-checklist]', result.error)
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.id })
}
