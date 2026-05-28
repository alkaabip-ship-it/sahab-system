// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint — no auth required (clientId acts as access token)
export async function GET(_: NextRequest, { params }: { params: { clientId: string } }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.clientId },
      include: {
        invoices: {
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true, invoiceNumber: true, amount: true, balance: true,
            status: true, invoiceDate: true, dueDate: true,
          },
        },
        bills: {
          select: { id: true, amount: true, status: true, billDate: true },
        },
      },
    })

    if (!project) return NextResponse.json({ error: 'المشروع غير موجود' }, { status: 404 })

    const totalBills = project.bills.reduce((s, b) => s + b.amount, 0)
    const paidInvoices = project.invoices.filter(i => i.status === 'PAID')
    const totalPaid = paidInvoices.reduce((s, i) => s + i.amount, 0)
    const totalBalance = project.invoices.reduce((s, i) => s + i.balance, 0)

    const progressPct = (() => {
      const s = project.status
      if (s === 'DONE') return 100
      if (s === 'IN_PROGRESS') return 60
      if (s === 'CONFIRMED') return 30
      if (s === 'QUOTE') return 10
      return 0
    })()

    return NextResponse.json({
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      executionDate: project.executionDate,
      progressPct,
      value: project.value,
      totalBills,
      totalPaid,
      totalBalance,
      invoices: project.invoices,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'خطأ في جلب البيانات' }, { status: 500 })
  }
}
