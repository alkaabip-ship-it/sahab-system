// @ts-nocheck
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const unlinked = searchParams.get('unlinked') === 'true'
    const unpaid = searchParams.get('unpaid') === 'true'
    const supplierId = searchParams.get('supplierId')
    const projectId = searchParams.get('projectId')

    const where: any = {}

    if (unlinked) where.isLinked = false
    if (unpaid) where.status = { in: ['UNPAID', 'PARTIAL'] }
    if (supplierId) where.supplierId = supplierId
    if (projectId) where.projectId = projectId

    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const skip  = (page - 1) * limit

    const [total, bills] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        include: { supplier: true, project: true },
        orderBy: { billDate: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({ data: bills, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في جلب الفواتير' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      billNumber,
      supplierId,
      projectId,
      amount,
      billDate,
      dueDate,
      status,
    } = body

    if (!billNumber || !amount || !billDate) {
      return NextResponse.json(
        { error: 'رقم الفاتورة والمبلغ والتاريخ مطلوبة' },
        { status: 400 }
      )
    }

    let project = null
    if (projectId) {
      project = await prisma.project.findUnique({ where: { id: projectId } })
    }

    const bill = await prisma.bill.create({
      data: {
        billNumber,
        supplierId: supplierId || null,
        projectId: projectId || null,
        amount: parseFloat(amount),
        billDate: new Date(billDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'UNPAID',
        isLinked: !!projectId,
        projectCode: project?.code || null,
      },
    })

    return NextResponse.json(bill, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في إنشاء الفاتورة' },
      { status: 500 }
    )
  }
}
