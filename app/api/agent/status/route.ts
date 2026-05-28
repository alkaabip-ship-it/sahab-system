import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAgentConfig, getRecentRuns } from '@/lib/agentic/memory'
import { getUnacknowledgedAlerts } from '@/lib/agentic/alerts'
import { prisma } from '@/lib/prisma'

const VAT = 1.05 // identical to projects page formula

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  // Last 12 months filter (same as agent tools)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const [config, runs, allAlerts, todayTasksCount, projects] = await Promise.all([
    getAgentConfig(),
    getRecentRuns(5),
    getUnacknowledgedAlerts(),
    prisma.task.count({ where: { status: 'PENDING' } }),
    // Fetch projects — same fields as projects page
    prisma.project.findMany({
      where:   { status: { not: 'CANCELLED' } },
      include: {
        bills:    { select: { amount: true, billDate: true } },
        invoices: { select: { invoiceDate: true }, orderBy: { invoiceDate: 'asc' }, take: 1 },
      },
    }),
  ])

  // ── Compute margins exactly like the projects page ────────────────────
  // revenue = project.value / VAT  |  costs = sum(bills) / VAT
  const allMapped = projects
    .map(p => {
      const revenue = p.value / VAT
      const costs   = p.bills.reduce((s, b) => s + b.amount, 0) / VAT
      const margin  = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0
      const profit  = revenue - costs

      // displayDate: فاتورة → تاريخ التنفيذ → تاريخ الإنشاء (identical to projects page)
      const invoiceDate = p.invoices[0]?.invoiceDate ?? null
      const displayDate = invoiceDate
        ? invoiceDate.toISOString().slice(0, 10)
        : p.executionDate
          ? p.executionDate.toISOString().slice(0, 10)
          : p.createdAt.toISOString().slice(0, 10)

      return {
        project_id:     p.id,
        project_name:   p.name,
        client_name:    p.clientName,
        status:         p.status,
        revenue:        Math.round(revenue),
        cost:           Math.round(costs),
        profit:         Math.round(profit),
        margin_percent: parseFloat(margin.toFixed(1)),
        display_date:   displayDate,
      }
    })
    // استثناء مشاريع داخلية لا ترغب إظهارها
    .filter(p => !['مصاريف المكتب'].some(ex =>
      p.project_name.toLowerCase().includes(ex.toLowerCase())
    ))
    // Sort by display_date descending (latest first) then take last 10
    .sort((a, b) => new Date(b.display_date).getTime() - new Date(a.display_date).getTime())

  // Last 10 projects for the records table
  const last10 = allMapped.slice(0, 10)
  const last10Ids = new Set(last10.map(p => p.project_id))

  // Margins: last 10 projects sorted by margin ascending (worst first) for easy review
  const margins = [...last10].sort((a, b) => a.margin_percent - b.margin_percent)

  // Alerts: project alerts limited to last 10 projects + system alerts (no project_id)
  const alerts = allAlerts.filter(a =>
    a.project_id === null || a.project_id === '' || last10Ids.has(a.project_id)
  )

  // ── Financial totals — آخر 10 مشاريع فقط ────────────────────────────
  const totalRevenue  = last10.reduce((s, p) => s + p.revenue, 0)
  const totalCosts    = last10.reduce((s, p) => s + p.cost,    0)
  const netProfit     = totalRevenue - totalCosts
  const profitMargin  = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0
  const avgMargin     = last10.length > 0
    ? last10.reduce((s, p) => s + p.margin_percent, 0) / last10.length
    : 0

  const minutesSinceRun = config.last_run
    ? Math.floor((Date.now() - new Date(config.last_run).getTime()) / 60000)
    : null

  return NextResponse.json({
    config, runs, alerts, minutesSinceRun,
    metrics: {
      alertsToday:   alerts.length,
      pendingTasks:  todayTasksCount,
      projectCount:  last10.length,
      cyclesRun:     runs.length,
    },
    margins,
    financials: {
      totalRevenue:  Math.round(totalRevenue),
      totalCosts:    Math.round(totalCosts),
      netProfit:     Math.round(netProfit),
      profitMargin:  parseFloat(profitMargin.toFixed(1)),
      avgMargin:     parseFloat(avgMargin.toFixed(1)),
      period:        'آخر 10 مشاريع',
    },
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const { isActive } = await req.json()
  const { setAgentActive } = await import('@/lib/agentic/memory')
  await setAgentActive(isActive)
  return NextResponse.json({ ok: true })
}
