// @ts-nocheck
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
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        bills: {
          include: { Supplier: true },
          orderBy: { billDate: 'desc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'المشروع غير موجود' }, { status: 404 })
    }

    const VAT = 1.05
    const costs          = project.Bill.reduce((s, b) => s + b.amount, 0)
    const revenueExVat   = project.value / VAT
    const costsExVat     = costs / VAT
    const profit         = revenueExVat - costsExVat
    const margin         = revenueExVat > 0 ? (profit / revenueExVat) * 100 : 0
    const vatCollected   = project.value - revenueExVat
    const vatPaid        = costs - costsExVat
    const netVat         = vatCollected - vatPaid

    // Unique suppliers from bills
    const supplierMap = new Map()
    for (const bill of project.Bill) {
      if (bill.supplier && !supplierMap.has(bill.supplier.id)) {
        supplierMap.set(bill.supplier.id, {
          ...bill.supplier,
          totalAmount: 0,
        })
      }
      if (bill.supplier) {
        supplierMap.get(bill.supplier.id).totalAmount += bill.amount
      }
    }

    return NextResponse.json({
      ...project,
      costs,
      revenueExVat,
      costsExVat,
      profit,
      margin,
      vatCollected,
      vatPaid,
      netVat,
      suppliers: Array.from(supplierMap.values()),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في جلب بيانات المشروع' },
      { status: 500 }
    )
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
    const { name, clientName, value, executionDate, status } = body

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(clientName && { clientName }),
        ...(value !== undefined && { value: parseFloat(value) }),
        ...(executionDate !== undefined && {
          executionDate: executionDate ? new Date(executionDate) : null,
        }),
        ...(status && { status }),
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في تحديث المشروع' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const role = (session.user as any)?.role
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'مخصص للمديرين فقط' },
      { status: 403 }
    )
  }

  try {
    // Unlink related records before deleting (SQLite has no cascade)
    await prisma.bill.updateMany({
      where: { projectId: params.id },
      data: { projectId: null, projectCode: null, isLinked: false },
    })
    await prisma.invoice.updateMany({
      where: { projectId: params.id },
      data: { projectId: null },
    })
    await prisma.projectIssue.deleteMany({ where: { projectId: params.id } })
    await prisma.supplierEvaluation.deleteMany({ where: { projectId: params.id } })
    await prisma.project.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في حذف المشروع' },
      { status: 500 }
    )
  }
}
