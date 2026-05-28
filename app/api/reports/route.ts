// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    switch (type) {
      case 'project-profitability': {
        const VAT = 1.05
        const projects = await prisma.project.findMany({
          include: { Bill: true },
          orderBy: { createdAt: 'desc' },
        })
        const result = projects.map((p) => {
          const costs        = p.Bill.reduce((s, b) => s + b.amount, 0)
          const revenueExVat = p.value / VAT
          const costsExVat   = costs / VAT
          const profit       = revenueExVat - costsExVat
          const margin       = revenueExVat > 0 ? (profit / revenueExVat) * 100 : 0
          return { ...p, costs, revenueExVat, costsExVat, profit, margin }
        })
        return NextResponse.json(result)
      }

      case 'unlinked-bills': {
        const bills = await prisma.bill.findMany({
          where: { isLinked: false },
          include: { Supplier: true },
          orderBy: { billDate: 'desc' },
        })
        return NextResponse.json(bills)
      }

      case 'unpaid-bills': {
        const bills = await prisma.bill.findMany({
          where: { status: { in: ['UNPAID', 'PARTIAL'] } },
          include: { Supplier: true, project: true },
          orderBy: { dueDate: 'asc' },
        })
        return NextResponse.json(bills)
      }

      case 'top-suppliers': {
        const suppliers = await prisma.supplier.findMany({
          include: {
            bills: { select: { amount: true } },
          },
        })
        const result = suppliers
          .map((s) => ({
            id:             s.id,
            name:           s.name,
            serviceType:    s.serviceType,
            recommendation: s.recommendation,
            totalAmount:    s.Bill.reduce((sum, b) => sum + b.amount, 0),
            dealCount:      s.Bill.length,
          }))
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .slice(0, 10)
        return NextResponse.json(result)
      }

      case 'problematic-suppliers': {
        const suppliers = await prisma.supplier.findMany({
          where: { recommendation: 'SUSPENDED' },
          include: { Bill: { select: { amount: true } } },
        })
        const result = suppliers.map((s) => ({
          id:             s.id,
          name:           s.name,
          serviceType:    s.serviceType,
          recommendation: s.recommendation,
          totalAmount:    s.Bill.reduce((sum, b) => sum + b.amount, 0),
        }))
        return NextResponse.json(result)
      }

      case 'low-profit-projects': {
        const VAT = 1.05
        const thresholdSetting = await prisma.setting.findUnique({
          where: { key: 'LOW_PROFIT_THRESHOLD' },
        })
        const threshold = parseFloat(thresholdSetting?.value || '20')

        const projects = await prisma.project.findMany({
          include: { Bill: true },
          where: { status: { not: 'QUOTE' } },
        })
        const result = projects
          .map((p) => {
            const costs        = p.Bill.reduce((s, b) => s + b.amount, 0)
            const revenueExVat = p.value / VAT
            const costsExVat   = costs / VAT
            const profit       = revenueExVat - costsExVat
            const margin       = revenueExVat > 0 ? (profit / revenueExVat) * 100 : 0
            return { ...p, costs, revenueExVat, costsExVat, profit, margin }
          })
          .filter((p) => p.margin < threshold)
          .sort((a, b) => a.margin - b.margin)
        return NextResponse.json({ projects: result, threshold })
      }

      case 'supplier-totals': {
        const suppliers = await prisma.supplier.findMany({
          include: {
            bills: { select: { amount: true, status: true } },
          },
        })
        const result = suppliers.map((s) => ({
          id:             s.id,
          name:           s.name,
          serviceType:    s.serviceType,
          recommendation: s.recommendation,
          totalAmount:    s.Bill.reduce((sum, b) => sum + b.amount, 0),
          paidAmount:     s.Bill.filter((b) => b.status === 'PAID').reduce((sum, b) => sum + b.amount, 0),
          unpaidAmount:   s.Bill.filter((b) => b.status !== 'PAID').reduce((sum, b) => sum + b.amount, 0),
          dealCount:      s.Bill.length,
        }))
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: 'نوع التقرير غير معروف' }, { status: 400 })
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'خطأ في إنشاء التقرير' }, { status: 500 })
  }
}
