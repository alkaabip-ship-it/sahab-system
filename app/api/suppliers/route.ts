import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        bills: { select: { amount: true, status: true } },
      },
      orderBy: { name: 'asc' },
    })

    const result = suppliers.map((s) => {
      const totalAmount = s.bills.reduce((sum, b) => sum + b.amount, 0)
      const dealCount   = s.bills.length
      return { ...s, totalAmount, dealCount }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في جلب الموردين' },
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
    const { name, phone, email, serviceType } = body

    if (!name || !serviceType) {
      return NextResponse.json(
        { error: 'الاسم ونوع الخدمة مطلوبان' },
        { status: 400 }
      )
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        serviceType,
        recommendation: 'UNDER_REVIEW',
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في إنشاء المورد' },
      { status: 500 }
    )
  }
}
