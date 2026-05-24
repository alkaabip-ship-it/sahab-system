import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessToken } from '@/lib/zoho'
import axios from 'axios'

const ZOHO_BASE = 'https://www.zohoapis.com/books/v3'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
    const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
    if (!orgId) return NextResponse.json({ deleted: 0 })

    const token = await getAccessToken()

    // Collect all Zoho bill IDs (paginated)
    const zohoBillIds = new Set<string>()
    let page = 1
    let hasMore = true

    while (hasMore) {
      const res = await axios.get(`${ZOHO_BASE}/bills`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: { organization_id: orgId, page, per_page: 200 },
      })
      const { bills, page_context } = res.data
      for (const b of bills ?? []) zohoBillIds.add(b.bill_id)
      hasMore = page_context?.has_more_page ?? false
      page++
    }

    // Find local bills with zohoId not present in Zoho
    const localBills = await prisma.bill.findMany({
      where: { zohoId: { not: null } },
      select: { id: true, zohoId: true },
    })

    const toDelete = localBills
      .filter(b => b.zohoId && !zohoBillIds.has(b.zohoId))
      .map(b => b.id)

    if (toDelete.length > 0) {
      await prisma.bill.deleteMany({ where: { id: { in: toDelete } } })
    }

    return NextResponse.json({ deleted: toDelete.length })
  } catch (err: any) {
    console.error('Sync bills error:', err?.message)
    return NextResponse.json({ deleted: 0 })
  }
}
