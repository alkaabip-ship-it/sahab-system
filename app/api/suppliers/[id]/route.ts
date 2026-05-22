import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
      include: {
        bills: {
          include: { project: true },
          orderBy: { billDate: 'desc' },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    const totalAmount = supplier.bills.reduce((s, b) => s + b.amount, 0)
    const paidAmount  = supplier.bills.filter((b) => b.status === 'PAID').reduce((s, b) => s + b.amount, 0)

    // Unique projects from bills
    const projectMap = new Map()
    for (const bill of supplier.bills) {
      if (bill.project && !projectMap.has(bill.project.id)) {
        projectMap.set(bill.project.id, bill.project)
      }
    }

    return NextResponse.json({
      ...supplier,
      totalAmount,
      paidAmount,
      projectCount: projectMap.size,
      projects: Array.from(projectMap.values()),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في جلب بيانات المورد' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    // Delete bills first, then supplier
    await prisma.bill.deleteMany({ where: { supplierId: params.id } })
    await prisma.supplier.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'خطأ في حذف المورد' }, { status: 500 })
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
    const { name, phone, email, serviceType, recommendation } = body

    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(serviceType && { serviceType }),
        ...(recommendation && { recommendation }),
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في تحديث المورد' },
      { status: 500 }
    )
  }
}
