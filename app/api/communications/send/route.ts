import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAccessToken } from '@/lib/zoho'
import { prisma } from '@/lib/prisma'
import axios from 'axios'

const ZOHO_BASE = 'https://www.zohoapis.com/books/v3'

async function ensureZohoContact(
  contact: { id: string; name: string; email: string; zohoId?: string | null; contactType: 'vendor' | 'customer' },
  orgId: string,
  token: string
): Promise<string | null> {
  if (contact.zohoId) return contact.zohoId

  try {
    // Search first
    const search = await axios.get(`${ZOHO_BASE}/contacts`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId, contact_type: contact.contactType, search_text: contact.name },
    })
    const found = (search.data.contacts || []).find(
      (c: any) => c.contact_name.toLowerCase() === contact.name.toLowerCase()
    )
    if (found) {
      // Save zohoId locally
      await prisma.supplier.update({ where: { id: contact.id }, data: { zohoId: found.contact_id } }).catch(() => {})
      return found.contact_id
    }

    // Create in Zoho
    const create = await axios.post(`${ZOHO_BASE}/contacts`, {
      contact_name: contact.name,
      contact_type: contact.contactType,
      email: contact.email,
    }, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId },
    })
    const newId = create.data.contact?.contact_id
    if (newId) {
      await prisma.supplier.update({ where: { id: contact.id }, data: { zohoId: newId } }).catch(() => {})
    }
    return newId || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const fd = await req.formData()
  const contacts = JSON.parse(fd.get('contacts') as string)
  const subject  = fd.get('subject') as string
  const body     = fd.get('body') as string
  const contactType = fd.get('contactType') as string
  if (!contacts?.length || !subject || !body) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  }

  try {
    const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
    const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
    const token = await getAccessToken()

    const results: { name: string; success: boolean; error?: string }[] = []

    for (const contact of contacts) {
      try {
        const zohoId = await ensureZohoContact(
          { ...contact, contactType: contactType === 'client' ? 'customer' : 'vendor' },
          orgId!,
          token
        )

        if (!zohoId) throw new Error('تعذّر إنشاء جهة الاتصال في Zoho')

        await axios.post(
          `${ZOHO_BASE}/contacts/${zohoId}/email`,
          { to_mail_ids: [contact.email], subject, body },
          {
            headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
            params: { organization_id: orgId },
          }
        )
        results.push({ name: contact.name, success: true })
      } catch (err: any) {
        results.push({
          name: contact.name,
          success: false,
          error: err?.response?.data?.message || err.message,
        })
      }
    }

    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    return NextResponse.json({ sent, failed, results })
  } catch (err: any) {
    console.error('send error:', err?.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
