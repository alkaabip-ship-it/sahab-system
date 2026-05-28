/**
 * email.ts — reads Gmail using plain fetch + stored refresh token
 */
import { prisma }  from '@/lib/prisma'
import Anthropic   from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface EmailSummary {
  connected:  boolean
  gmailEmail: string | null
  lastSync:   string | null
  urgent: number; medium: number; info: number
  emails: Array<{
    id: string; from: string; subject: string; date: string
    priority: string; category: string; summary: string; suggestedReply: string
  }>
}

const NOT_CONNECTED: EmailSummary = {
  connected: false, gmailEmail: null, lastSync: null,
  urgent: 0, medium: 0, info: 0, emails: [],
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID     ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

function decodeBody(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data) return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === 'text/plain' && p.body?.data)
        return Buffer.from(p.body.data, 'base64url').toString('utf-8')
    }
    for (const p of payload.parts) { const s = decodeBody(p); if (s) return s }
  }
  return ''
}

export async function emailAnalyzer(): Promise<EmailSummary> {
  const tokenRow = await prisma.setting.findUnique({ where: { key: 'gmail_refresh_token' } }).catch(() => null)
  const emailRow = await prisma.setting.findUnique({ where: { key: 'gmail_email' } }).catch(() => null)
  if (!tokenRow?.value) return NOT_CONNECTED

  try {
    const token = await refreshAccessToken(tokenRow.value)
    if (!token) return NOT_CONNECTED

    const listRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=10', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const list = await listRes.json()
    const msgs: Array<{ id: string }> = list.messages ?? []
    if (msgs.length === 0) return { ...NOT_CONNECTED, connected: true, gmailEmail: emailRow?.value ?? null, lastSync: new Date().toISOString() }

    const rawMsgs = await Promise.all(
      msgs.map(m =>
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json())
      )
    )

    const parsed = rawMsgs.map(msg => {
      const hdr: Record<string, string> = {}
      for (const h of (msg.payload?.headers ?? [])) { if (h.name) hdr[h.name.toLowerCase()] = h.value ?? '' }
      return {
        id:      msg.id ?? '',
        from:    hdr['from']    ?? '',
        subject: hdr['subject'] ?? '(بدون موضوع)',
        date:    hdr['date']    ?? '',
        body:    decodeBody(msg.payload).slice(0, 600) || msg.snippet || '',
      }
    })

    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 2000,
      messages: [{ role: 'user', content:
        `حلّل إيميلات "سحاب للفعاليات والمعارض" وأجب بـ JSON مصفوفة فقط:
[{"id":"..","priority":"عاجل|متوسط|معلومات","category":"عميل محتمل|رد عميل|مورد|دفع|استفسار|أخرى","summary":"ملخص","suggestedReply":"مسودة رد"}]
${parsed.map((e,i)=>`[${i+1}] من:${e.from}\nالموضوع:${e.subject}\n${e.body}`).join('\n---\n')}`
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
      priority:       analysed[i]?.priority       ?? 'معلومات',
      category:       analysed[i]?.category        ?? 'أخرى',
      summary:        analysed[i]?.summary          ?? '',
      suggestedReply: analysed[i]?.suggestedReply   ?? '',
    }))

    return {
      connected: true, gmailEmail: emailRow?.value ?? null,
      lastSync: new Date().toISOString(),
      urgent: emails.filter(e => e.priority === 'عاجل').length,
      medium: emails.filter(e => e.priority === 'متوسط').length,
      info:   emails.filter(e => e.priority === 'معلومات').length,
      emails,
    }
  } catch (e: any) {
    console.error('[emailAnalyzer]', e)
    return NOT_CONNECTED
  }
}
