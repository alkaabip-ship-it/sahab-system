import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessToken } from '@/lib/zoho'
import axios from 'axios'

const ZOHO_BASE = 'https://www.zohoapis.com/books/v3'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const type = new URL(req.url).searchParams.get('type') || 'supplier'

  try {
    if (type === 'supplier') {
      // From local DB — already synced from Zoho
      const suppliers = await prisma.supplier.findMany({
        select: { id: true, zohoId: true, name: true, email: true, phone: true, serviceType: true },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json({ contacts: suppliers })
    }

    // Clients — fetch from Zoho Books customers
    const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
    const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
    if (!orgId) return NextResponse.json({ contacts: [] })

    const token = await getAccessToken()
    const res = await axios.get(`${ZOHO_BASE}/contacts`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId, contact_type: 'customer', per_page: 200 },
    })

    const customers = (res.data.contacts || [])
      .filter((c: any) => c.email)
      .map((c: any) => ({
        id: c.contact_id,
        zohoId: c.contact_id,
        name: c.contact_name,
        email: c.email,
        serviceType: null,
      }))

    return NextResponse.json({ contacts: customers })
  } catch (err: any) {
    console.error('contacts error:', err?.message)
    return NextResponse.json({ contacts: [] })
  }
}
