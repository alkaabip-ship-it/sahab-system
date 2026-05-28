// @ts-nocheck
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessToken } from '@/lib/zoho'
import axios from 'axios'

const ZOHO_BASE = 'https://www.zohoapis.com/books/v3'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()
  const { supplierName, amount, vatAmount, totalAmount, date, invoiceNumber, description, projectId, projectCode } = body

  try {
    const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
    const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
    const token = await getAccessToken()

    // Find or create vendor in Zoho
    let vendorId: string | null = null
    if (supplierName) {
      const vendorsRes = await axios.get(`${ZOHO_BASE}/contacts`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: { organization_id: orgId, contact_type: 'vendor', search_text: supplierName },
      })
      const found = (vendorsRes.data.contacts || []).find(
        (c: any) => c.contact_name.toLowerCase() === supplierName.toLowerCase()
      )
      if (found) {
        vendorId = found.contact_id
      } else {
        // Create vendor in Zoho if not found
        try {
          const createVendor = await axios.post(`${ZOHO_BASE}/contacts`, {
            contact_name: supplierName,
            contact_type: 'vendor',
          }, {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
            params: { organization_id: orgId },
          })
          vendorId = createVendor.data.contact?.contact_id || null
        } catch { /* continue without vendor */ }
      }
    }

    // Build Zoho bill payload
    const zohoPayload: any = {
      vendor_id: vendorId || undefined,
      bill_number: invoiceNumber || '',
      reference_number: projectCode || '',
      date: date || new Date().toISOString().split('T')[0],
      notes: description || '',
      line_items: [
        {
          account_id: '4104018000000919027', // project expense
          description: description || 'خدمات',
          rate: amount || totalAmount || 0,
          quantity: 1,
        },
      ],
    }

    // Create bill in Zoho
    const createRes = await axios.post(`${ZOHO_BASE}/bills`, zohoPayload, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId },
    })

    const zohoBill = createRes.data.bill
    if (!zohoBill) throw new Error(createRes.data.message || 'فشل إنشاء الفاتورة في Zoho')

    // Find supplier locally
    let supplier = await prisma.supplier.findFirst({ where: { name: { contains: supplierName, mode: 'insensitive' } } })

    // Find project
    let project = null
    if (projectId) project = await prisma.project.findUnique({ where: { id: projectId } })

    // Save locally
    const bill = await prisma.bill.create({
      data: {
        zohoId: zohoBill.bill_id,
        billNumber: invoiceNumber || zohoBill.bill_number,
        supplierId: supplier?.id || null,
        projectId: project?.id || null,
        projectCode: projectCode || null,
        amount: amount || totalAmount || 0,
        billDate: new Date(date || Date.now()),
        status: 'UNPAID',
        isLinked: !!project,
      },
    })

    return NextResponse.json({ success: true, bill, zohoBillId: zohoBill.bill_id })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.response?.data?.message || err.message || 'فشل إنشاء الفاتورة' }, { status: 500 })
  }
}
