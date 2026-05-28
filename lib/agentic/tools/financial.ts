// @ts-nocheck
import { prisma } from '@/lib/prisma'

const VAT = 1.05 // same divisor used by the projects page

export interface FinancialAnalysis {
  totalRevenue: number
  totalCosts: number
  netProfit: number
  profitMargin: number
  projectBreakdowns: Array<{
    projectId: string
    projectName: string
    revenue: number
    costs: number
    netProfit: number
    margin: number
    status: 'HEALTHY' | 'WARNING' | 'DANGER' | 'CRITICAL' | 'LOSS'
  }>
  losses: Array<{ projectId: string; projectName: string; amount: number; reason: string }>
}

export async function financialLossDetector(): Promise<FinancialAnalysis> {
  // Only last 12 calendar months
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  // Revenue = project.value / VAT  (matches the projects page exactly)
  // Costs   = sum(bills) / VAT
  const projects = await prisma.project.findMany({
    where: { createdAt: { gte: oneYearAgo } },
    include: {
      bills: {
        where:  { billDate: { gte: oneYearAgo } },
        select: { amount: true, status: true },
      },
    },
  })

  const breakdowns = projects.map(p => {
    const revenue = p.value / VAT
    const costs   = p.bills.reduce((s, b) => s + b.amount, 0) / VAT
    const net     = revenue - costs
    const margin  = revenue > 0 ? ((net / revenue) * 100) : 0
    const status  = net < 0      ? 'LOSS'
                  : margin < 10  ? 'CRITICAL'
                  : margin < 15  ? 'DANGER'
                  : margin < 20  ? 'WARNING'
                  : 'HEALTHY'
    return { projectId: p.id, projectName: p.name, revenue, costs, netProfit: net, margin, status } as const
  })

  const totalRevenue = breakdowns.reduce((s, b) => s + b.revenue, 0)
  const totalCosts   = breakdowns.reduce((s, b) => s + b.costs, 0)
  const netProfit    = totalRevenue - totalCosts
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0
  const losses       = breakdowns
    .filter(b => b.status === 'LOSS')
    .map(b => ({
      projectId:   b.projectId,
      projectName: b.projectName,
      amount:      Math.abs(b.netProfit),
      reason:      b.costs > b.revenue ? 'تكاليف تتجاوز الإيرادات' : 'إيرادات منخفضة',
    }))

  return { totalRevenue, totalCosts, netProfit, profitMargin, projectBreakdowns: breakdowns, losses }
}
