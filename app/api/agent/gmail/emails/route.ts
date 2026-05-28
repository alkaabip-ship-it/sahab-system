// @ts-nocheck
import { randomUUID } from 'crypto'
/**
 * GET /api/agent/gmail/emails
 * Reads inbox using stored tokens via plain fetch (no googleapis package).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Token refresh ─────────────────────────────────────────────────────
async function getValidAccessToken(): Promise<string | null> {
  const refresh = await prisma.setting.findUnique({ where: { key: 'gmail_refresh_token' } })
  if (!refresh?.value) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refresh.value,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) return null

  // Cache new access token
  await prisma.setting.upsert({
    where:  { key: 'gmail_access_token' },
    update: { value: data.access_token },
    create: { key: 'gmail_access_token', value: data.access_token },
  })
  return data.access_token
}

// ── Decode base64url email body ───────────────────────────────────────
function decodeBody(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === 'text/plain' && p.body?.data)
        return Buffer.from(p.body.data, 'base64url').toString('utf-8')
    }
    for (const p of payload.parts) { const s = decodeBody(p); if (s) return s }
  }
  return ''
}

// ── Gmail API helpers ─────────────────────────────────────────────────
async function gmailFetch(path: string, token: string) {
  const res = await fetch(`https://www.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const tokenRow = await prisma.setting.findUnique({ where: { key: 'gmail_refresh_token' } })
  const emailRow = await prisma.setting.findUnique({ where: { key: 'gmail_email' } })
  if (!tokenRow?.value) return NextResponse.json({ connected: false, emails: [] })

  try {
    const token = await getValidAccessToken()
    if (!token) return NextResponse.json({ connected: false, emails: [] })

    // List messages
    const list = await gmailFetch('/users/me/messages?labelIds=INBOX&maxResults=15', token)
    const messages: Array<{ id: string }> = list.messages ?? []
    if (messages.length === 0) {
      return NextResponse.json({ connected: true, gmailEmail: emailRow?.value, emails: [], lastSync: new Date().toISOString() })
    }

    // Fetch each message
    const rawMsgs = await Promise.all(
      messages.map(m => gmailFetch(`/users/me/messages/${m.id}?format=full`, token))
    )

    const parsed = rawMsgs.map(msg => {
      const hdr: Record<string, string> = {}
      for (const h of (msg.payload?.headers ?? [])) {
        if (h.name) hdr[h.name.toLowerCase()] = h.value ?? ''
      }
      return {
        id:        msg.id       ?? '',
        threadId:  msg.threadId ?? '',
        from:      hdr['from']       ?? '',
        subject:   hdr['subject']    ?? '(بدون موضوع)',
        date:      hdr['date']       ?? '',
        messageId: hdr['message-id'] ?? '',   // for In-Reply-To header
        body:      decodeBody(msg.payload).slice(0, 600) || msg.snippet || '',
      }
    })

    // AI analysis
    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `حلّل الإيميلات التالية لشركة "سحاب للفعاليات والمعارض" وأجب بـ JSON مصفوفة فقط بدون أي نص خارجها:
[{"id":"..","priority":"عاجل|متوسط|معلومات","category":"عميل محتمل|رد عميل|مورد|دفع|استفسار|أخرى","summary":"ملخص قصير","suggestedReply":"مسودة رد احترافية"}]

${parsed.map((e,i)=>`[${i+1}] من:${e.from}\nالموضوع:${e.subject}\n${e.body}`).join('\n---\n')}`,
      }],
    })

    let analysed: any[] = []
    try {
      const txt = aiRes.content[0].type === 'text' ? aiRes.content[0].text : ''
      const m = txt.match(/\[[\s\S]*\]/)
      if (m) analysed = JSON.parse(m[0])
    } catch { /**/ }

    const emails = parsed.map((e, i) => ({
      ...e,
      priority:       (analysed[i]?.priority ?? 'معلومات') as string,
      category:       analysed[i]?.category       ?? 'أخرى',
      summary:        analysed[i]?.summary         ?? '',
      suggestedReply: analysed[i]?.suggestedReply  ?? '',
    }))

    return NextResponse.json({
      connected:  true,
      gmailEmail: emailRow?.value ?? '',
      lastSync:   new Date().toISOString(),
      urgent:     emails.filter(e => e.priority === 'عاجل').length,
      medium:     emails.filter(e => e.priority === 'متوسط').length,
      info:       emails.filter(e => e.priority === 'معلومات').length,
      emails,
    })
  } catch (e: any) {
    console.error('[gmail/emails]', e)
    return NextResponse.json({ connected: false, error: e.message, emails: [] })
  }
}
