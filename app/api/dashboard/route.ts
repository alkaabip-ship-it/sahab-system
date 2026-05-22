import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const [
      allProjects,
      allBills,
      allSuppliers,
      thresholdSetting,
    ] = await Promise.all([
      prisma.project.findMany({ include: { bills: true } }),
      prisma.bill.findMany({ include: { supplier: true, project: true } }),
      prisma.supplier.findMany({ include: { bills: true } }),
      prisma.setting.findUnique({ where: { key: 'LOW_PROFIT_THRESHOLD' } }),
    ])

    const threshold = parseFloat(thresholdSetting?.value || '20')

    const totalProjects = allProjects.length
    const activeProjects = allProjects.filter(
      (p) => p.status === 'IN_PROGRESS' || p.status === 'CONFIRMED'
    ).length
    const totalValue = allProjects.reduce((s, p) => s + p.value / 1.05, 0)

    // Calculate costs per project (all amounts are VAT-inclusive at 5%)
    const VAT = 1.05
    const projectsWithCosts = allProjects.map((p) => {
      const costs        = p.bills.reduce((s, b) => s + b.amount, 0)
      const revenueExVat = p.value / VAT
      const costsExVat   = costs / VAT
      const profit       = revenueExVat - costsExVat
      const margin       = revenueExVat > 0 ? (profit / revenueExVat) * 100 : 0
      return { ...p, costs, revenueExVat, costsExVat, profit, margin }
    })

    const totalCosts  = projectsWithCosts.reduce((s, p) => s + p.costsExVat, 0)
    const totalProfit = projectsWithCosts.reduce((s, p) => s + p.profit, 0)
    const avgProfitMargin =
      projectsWithCosts.length > 0
        ? projectsWithCosts.reduce((s, p) => s + p.margin, 0) /
          projectsWithCosts.length
        : 0

    const unpaidBills = allBills.filter(
      (b) => b.status === 'UNPAID' || b.status === 'PARTIAL'
    )
    const unpaidBillsCount = unpaidBills.length
    const unpaidBillsAmount = unpaidBills.reduce((s, b) => s + b.amount, 0)

    // Top suppliers by total deals amount
    const supplierTotals = allSuppliers.map((s) => ({
      id:             s.id,
      name:           s.name,
      serviceType:    s.serviceType,
      recommendation: s.recommendation,
      totalAmount:    s.bills.reduce((sum, b) => sum + b.amount, 0),
      dealCount:      s.bills.length,
    }))

    const topSuppliers = [...supplierTotals]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5)

    const problematicSuppliers = [...supplierTotals]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5)

    const lowProfitProjects = projectsWithCosts.filter(
      (p) => p.margin < threshold && p.status !== 'QUOTE'
    )

    return NextResponse.json({
      totalProjects,
      activeProjects,
      totalValue,
      totalCosts,
      totalProfit,
      avgProfitMargin,
      unpaidBillsCount,
      unpaidBillsAmount,
      topSuppliers,
      problematicSuppliers,
      lowProfitProjects,
      threshold,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: 'خطأ في جلب البيانات' },
      { status: 500 }
    )
  }
}
