// @ts-nocheck
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
    const currentYear = new Date().getFullYear()
    const yearStart   = new Date(currentYear, 0, 1)
    const yearEnd     = new Date(currentYear, 11, 31, 23, 59, 59)

    // Current VAT quarter boundaries
    const now = new Date()
    const qMonth = Math.floor(now.getMonth() / 3) * 3 // 0, 3, 6, or 9
    const quarterStart = new Date(currentYear, qMonth, 1)
    const quarterEnd   = new Date(currentYear, qMonth + 3, 0, 23, 59, 59) // last day of quarter

    const [
      allProjects,
      allBills,
      allSuppliers,
      thresholdSetting,
      quarterBills,
      quarterInvoices,
      companyExpenses,
    ] = await Promise.all([
      prisma.project.findMany({ include: { Bill: true } }),
      prisma.bill.findMany({ include: { Supplier: true, Project: true } }),
      prisma.supplier.findMany({ include: { Bill: true } }),
      prisma.setting.findUnique({ where: { key: 'LOW_PROFIT_THRESHOLD' } }),
      // Bills (purchases) in current quarter → input VAT
      prisma.bill.findMany({
        where: { billDate: { gte: quarterStart, lte: quarterEnd } },
        select: { amount: true },
      }),
      // Invoices (sales) in current quarter → output VAT
      prisma.invoice.findMany({
        where: { invoiceDate: { gte: quarterStart, lte: quarterEnd } },
        select: { amount: true },
      }),
      prisma.companyExpense.findMany(),
    ])

    const threshold = parseFloat(thresholdSetting?.value || '20')

    // Year-filtered projects for the financial summary
    const yearProjects = allProjects.filter(p => {
      const d = p.executionDate || p.createdAt
      return d >= yearStart && d <= yearEnd
    })

    const totalProjects = allProjects.length
    const activeProjects = allProjects.filter(
      (p) => p.status === 'IN_PROGRESS' || p.status === 'CONFIRMED'
    ).length
    const totalValue = allProjects.reduce((s, p) => s + p.value / 1.05, 0)

    // Calculate costs per project (all amounts are VAT-inclusive at 5%)
    const VAT = 1.05
    const projectsWithCosts = allProjects.map((p) => {
      const costs        = p.Bill.reduce((s, b) => s + b.amount, 0)
      const revenueExVat = p.value / VAT
      const costsExVat   = costs / VAT
      const profit       = revenueExVat - costsExVat
      const margin       = revenueExVat > 0 ? (profit / revenueExVat) * 100 : 0
      return { ...p, costs, revenueExVat, costsExVat, profit, margin }
    })

    // Year-filtered financial summary
    const yearProjectIds = new Set(yearProjects.map(p => p.id))
    const yearProjectsWithCosts = projectsWithCosts.filter(p => yearProjectIds.has(p.id))

    const totalRevenue = yearProjectsWithCosts.reduce((s, p) => s + p.revenueExVat, 0)
    const totalCosts   = yearProjectsWithCosts.reduce((s, p) => s + p.costsExVat, 0)
    const totalProfit  = yearProjectsWithCosts.reduce((s, p) => s + p.profit, 0)

    const vatOnRevenue = totalRevenue * 0.05
    const vatOnCosts   = totalCosts   * 0.05
    const netVat       = vatOnRevenue - vatOnCosts

    const profitingProjects = yearProjectsWithCosts.filter(p => p.profit > 0)
    const losingProjects    = yearProjectsWithCosts.filter(p => p.profit < 0)
    const totalGains        = profitingProjects.reduce((s, p) => s + p.profit, 0)
    const totalLosses       = Math.abs(losingProjects.reduce((s, p) => s + p.profit, 0))

    const avgProfitMargin =
      projectsWithCosts.length > 0
        ? projectsWithCosts.reduce((s, p) => s + p.margin, 0) /
          projectsWithCosts.length
        : 0

    const unpaidBills = allBills.filter(
      (b) => b.status === 'UNPAID' || b.status === 'PARTIAL'
    )
    const unpaidBillsCount = unpaidBills.length
    const unpaidBillsAmount = unpaidBills.reduce((s, b) => s + b.amount, 0) * 1.05

    // Top suppliers by total deals amount
    const supplierTotals = allSuppliers.map((s) => ({
      id:             s.id,
      name:           s.name,
      serviceType:    s.serviceType,
      recommendation: s.recommendation,
      totalAmount:    s.Bill.reduce((sum, b) => sum + b.amount, 0),
      dealCount:      s.Bill.length,
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

    // ── Quarterly VAT calculation ──────────────────────────────────────
    // All amounts are stored VAT-inclusive at 5%
    // Output VAT = VAT collected from clients (invoices)
    // Input VAT  = VAT paid to suppliers (bills) — this is deductible
    const quarterOutputVatBase = quarterInvoices.reduce((s, i) => s + i.amount, 0)
    const quarterInputVatBase  = quarterBills.reduce((s, b) => s + b.amount, 0)
    const quarterOutputVat = quarterOutputVatBase * 5 / 105   // VAT portion in invoices
    const quarterInputVat  = quarterInputVatBase  * 5 / 105   // VAT portion in bills
    const quarterNetVat    = quarterOutputVat - quarterInputVat // what you owe the FTA
    const quarterLabel     = `الربع ${['الأول','الثاني','الثالث','الرابع'][Math.floor(now.getMonth()/3)]}`

    // Build expense map for easy lookup
    const expenseMap = Object.fromEntries(companyExpenses.map(e => [e.key, e]))

    return NextResponse.json({
      currentYear,
      totalProjects,
      activeProjects,
      totalValue: totalRevenue,
      totalCosts,
      totalProfit,
      totalGains,
      totalLosses,
      vatOnRevenue,
      vatOnCosts,
      netVat,
      avgProfitMargin,
      unpaidBillsCount,
      unpaidBillsAmount,
      quarterOutputVat,
      quarterInputVat,
      quarterNetVat,
      quarterLabel,
      topSuppliers,
      problematicSuppliers,
      lowProfitProjects,
      threshold,
      rentExpense:    expenseMap['RENT']    ?? null,
      licenseExpense: expenseMap['LICENSE'] ?? null,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: 'خطأ في جلب البيانات' },
      { status: 500 }
    )
  }
}
