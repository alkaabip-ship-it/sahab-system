// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessToken } from '@/lib/zoho'
import axios from 'axios'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    await prisma.bill.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'خطأ في حذف الفاتورة' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { projectId, status, supplierId } = body

    let updateData: any = {}

    if (projectId !== undefined) {
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
        })
        if (!project) {
          return NextResponse.json(
            { error: 'المشروع غير موجود' },
            { status: 404 }
          )
        }
        updateData.projectId = projectId
        updateData.projectCode = project.code
        updateData.isLinked = true
      } else {
        updateData.projectId = null
        updateData.projectCode = null
        updateData.isLinked = false
      }
    }

    if (status) updateData.status = status
    if (supplierId !== undefined) updateData.supplierId = supplierId || null

    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: updateData,
      include: { supplier: true, project: true },
    })

    // Update reference_number in Zoho Books if bill has zohoId and project was linked/unlinked
    if (bill.zohoId && projectId !== undefined) {
      try {
        const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
        const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
        const token = await getAccessToken()
        await axios.put(
          `https://www.zohoapis.com/books/v3/bills/${bill.zohoId}`,
          { reference_number: bill.projectCode || '' },
          {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
            params: { organization_id: orgId },
          }
        )
      } catch (zohoErr: any) {
        console.error('Zoho update skipped:', zohoErr?.message)
      }
    }

    return NextResponse.json(bill)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في تحديث الفاتورة' },
      { status: 500 }
    )
  }
}
