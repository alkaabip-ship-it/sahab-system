// @ts-nocheck
import { prisma } from '@/lib/prisma'

const VAT = 1.05 // same divisor used by the projects page

export interface ProjectMarginData {
  projectId: string
  projectName: string
  marginPercent: number
  revenue: number
  cost: number
  amountToReach20: number
  severity: 'HEALTHY' | 'WARNING' | 'DANGER' | 'CRITICAL'
  recommendation: string
}

export async function projectProfitGuard(): Promise<ProjectMarginData[]> {
  // Only last 12 calendar months
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  // Revenue = project.value / VAT  (matches the projects page exactly)
  // Costs   = sum(bills) / VAT
  const projects = await prisma.project.findMany({
    include: {
      bills: {
        where:  { billDate: { gte: oneYearAgo } },
        select: { amount: true },
      },
    },
    where: {
      status:    { not: 'CANCELLED' },
      createdAt: { gte: oneYearAgo },
    },
  })

  const results: ProjectMarginData[] = []

  for (const p of projects) {
    const revenue = p.value / VAT
    const cost    = p.bills.reduce((s, b) => s + b.amount, 0) / VAT
    if (revenue === 0 && cost === 0) continue

    const margin          = revenue > 0 ? ((revenue - cost) / revenue) * 100 : -100
    const amountToReach20 = Math.max(0, cost * 0.25 - (revenue - cost))
    const severity        = margin >= 20 ? 'HEALTHY'
                          : margin >= 15 ? 'WARNING'
                          : margin >= 10 ? 'DANGER'
                          : 'CRITICAL'
    const recommendation  = severity === 'HEALTHY' ? 'هامش ممتاز'
                          : severity === 'WARNING'  ? `خفّض التكاليف بـ ${Math.round(cost * 0.05).toLocaleString()} د.إ للوصول لـ 20%`
                          : severity === 'DANGER'   ? `مطلوب تخفيض تكاليف عاجل ${Math.round(cost * 0.1).toLocaleString()} د.إ`
                          : `خطر حرج — راجع جميع بنود التكلفة فوراً`

    // Save to history
    await prisma.$executeRaw`
      INSERT INTO project_margins (id, project_id, project_name, margin_percent, revenue, cost)
      VALUES (gen_random_uuid()::text, ${p.id}, ${p.name}, ${margin}, ${revenue}, ${cost})
    `.catch(() => {})

    results.push({ projectId: p.id, projectName: p.name, marginPercent: margin, revenue, cost, amountToReach20, severity, recommendation })
  }

  return results.sort((a, b) => a.marginPercent - b.marginPercent)
}
