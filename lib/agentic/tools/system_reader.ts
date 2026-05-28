// @ts-nocheck
/**
 * system_reader.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Reads a COMPLETE snapshot from every page/section of the Sahab system.
 * Every field visible in the UI is represented here — no gaps.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/prisma'

const VAT = 1.05 // revenue = project.value / VAT  |  cost = bills / VAT

function oneYearAgo(): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d
}

function todayUAE(): string {
  return new Date(Date.now() + 4 * 3600000).toISOString().split('T')[0]
}

function toMonthly(amount: number, period: string): number {
  if (period === 'MONTHLY')  return amount
  if (period === 'ANNUAL')   return amount / 12
  if (period === 'BIANNUAL') return amount / 24
  return 0
}

// ── Interface ─────────────────────────────────────────────────────────────
export interface SystemSnapshot {
  generatedAt: string

  // ── Projects ──────────────────────────────────────────────────────────
  projects: {
    total: number
    byStatus: Record<string, number>
    pipeline: number          // sum of QUOTE projects value (potential revenue)
    topByRevenue: Array<{
      name: string; clientName: string; revenue: number; cost: number
      profit: number; margin: number; status: string; executionDate: string | null
    }>
    openIssues: Array<{ project: string; issueType: string; impact: string; status: string }>
  }

  // ── Financial ─────────────────────────────────────────────────────────
  financial: {
    totalRevenue: number
    totalCosts: number
    netProfit: number
    profitMargin: number
    vatCollected: number
    vatPaid: number
    netVat: number
    // Invoices
    invoicesByStatus: Record<string, { count: number; amount: number }>
    totalInvoiced: number
    totalCollected: number
    totalBalance: number        // remaining to collect
    overdueInvoices: Array<{ customer: string; amount: number; balance: number; daysOverdue: number }>
    // Bills
    billsByStatus: Record<string, { count: number; amount: number }>
    totalBilled: number
    totalBillsPaid: number
    totalBillsUnpaid: number
    overdueBills: Array<{ supplier: string; amount: number; daysOverdue: number }>
  }

  // ── Suppliers ─────────────────────────────────────────────────────────
  suppliers: {
    total: number
    byRecommendation: Record<string, number>
    list: Array<{
      name: string; serviceType: string; recommendation: string
      openIssues: number; evaluationCount: number
    }>
    recentEvaluations: Array<{ supplier: string; project: string; performance: string; repeatBusiness: boolean }>
  }

  // ── Clients ───────────────────────────────────────────────────────────
  clients: {
    total: number
    topClients: Array<{
      name: string; phone: string | null; email: string | null
      invoiceTotal: number; invoicePaid: number; invoiceBalance: number
      projectCount: number; projectValue: number
    }>
  }

  // ── Invoices (standalone view) ────────────────────────────────────────
  invoices: {
    total: number
    unlinked: number           // invoices with no project linked
    recentList: Array<{
      invoiceNumber: string; customerName: string; amount: number
      balance: number; status: string; invoiceDate: string; dueDate: string | null
    }>
  }

  // ── Bills (standalone view) ───────────────────────────────────────────
  bills: {
    total: number
    unlinked: number           // bills with no project linked
    recentList: Array<{
      billNumber: string; supplier: string; amount: number
      status: string; billDate: string; dueDate: string | null; project: string | null
    }>
  }

  // ── Inventory ─────────────────────────────────────────────────────────
  inventory: {
    total: number
    lowStock: Array<{ name: string; quantity: number; minQuantity: number; unit: string }>
    damaged: Array<{ name: string; quantity: number; unit: string }>
    byCategory: Record<string, number>
  }

  // ── Tasks ─────────────────────────────────────────────────────────────
  tasks: {
    todayTotal: number
    todayDone: number
    todayPending: number
    completionRate: number
    perUser: Array<{ name: string; done: number; pending: number }>
    recentHistory: Array<{ date: string; total: number; done: number; rate: number }>
  }

  // ── Team & Employees ─────────────────────────────────────────────────
  team: {
    usersCount: number
    eligibleForTasks: Array<{ name: string }>
    employees: Array<{
      name: string; salary: number
      residencyExpiry: string | null; daysUntilExpiry: number | null
    }>
    monthlySalaries: number
    expiringResidencies: Array<{ name: string; expiryDate: string; daysLeft: number }>
  }

  // ── Company Expenses & Overhead ───────────────────────────────────────
  expenses: {
    monthly: number            // sum of MONTHLY expenses
    annual: number             // sum of ANNUAL expenses
    monthlyEquivalent: number  // all expenses converted to monthly
    totalMonthlyOverhead: number // salaries + monthlyEquivalent
    list: Array<{ label: string; amount: number; period: string; monthlyAmount: number; expiryDate: string | null; daysLeft: number | null }>
    expiringContracts: Array<{ label: string; expiryDate: string; daysLeft: number }>
  }

  // ── Events ────────────────────────────────────────────────────────────
  events: {
    total: number
    upcoming: Array<{ name: string; client: string; venue: string; date: string; openIssues: number }>
  }

  // ── Planning ──────────────────────────────────────────────────────────
  planning: {
    total: number
    totalSaleValue: number
    totalCost: number
    totalProfit: number
    avgMargin: number
    recentPlans: Array<{
      name: string; saleValue: number; totalCost: number
      profit: number; margin: number; suppliersCount: number; createdAt: string
    }>
  }
}

// ── Main function ─────────────────────────────────────────────────────────
export async function readFullSystemSnapshot(): Promise<SystemSnapshot> {
  const yr    = oneYearAgo()
  const now   = new Date()
  const today = todayUAE()

  // ─── Parallel DB queries ──────────────────────────────────────────────
  const [
    projects,
    allInvoices,
    allBills,
    suppliers,
    evaluations,
    zohoCustomers,
    inventoryItems,
    todayTasks,
    recentTasks,
    users,
    employees,
    companyExpenses,
    projectPlans,
    projectIssues,
  ] = await Promise.all([
    // Projects — last 12 months
    prisma.project.findMany({
      where:   { createdAt: { gte: yr } },
      include: {
        bills:  { select: { amount: true, status: true, dueDate: true } },
        issues: { select: { issueType: true, impact: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // ALL invoices (for full financial picture)
    prisma.invoice.findMany({
      select: {
        invoiceNumber: true, customerName: true, projectId: true,
        amount: true, balance: true, status: true,
        invoiceDate: true, dueDate: true,
      },
      orderBy: { invoiceDate: 'desc' },
    }),

    // ALL bills (for full financial picture)
    prisma.bill.findMany({
      include: {
        supplier: { select: { name: true } },
        project:  { select: { name: true } },
      },
      orderBy: { billDate: 'desc' },
    }),

    // Suppliers with issues
    prisma.supplier.findMany({
      include: {
        issues:      { where: { status: 'OPEN' }, select: { id: true } },
        supplierEvals: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    }),

    // Supplier evaluations (last year)
    prisma.supplierEvaluation.findMany({
      where:   { createdAt: { gte: yr } },
      include: {
        supplier: { select: { name: true } },
        project:  { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Zoho customers (with contact info)
    prisma.customer.findMany({
      select: { name: true, phone: true, email: true, company: true },
      orderBy: { createdAt: 'desc' },
    }),

    // Inventory
    prisma.inventoryItem.findMany(),

    // Today's tasks
    prisma.task.findMany({
      where:   { taskDate: today },
      include: { assignedTo: { select: { name: true } } },
    }),

    // Last 30 days tasks (for history)
    prisma.task.findMany({
      where:   { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      select:  { taskDate: true, status: true },
    }),

    // Users
    prisma.user.findMany({ select: { name: true, role: true, email: true } }),

    // Employees
    prisma.employee.findMany({ select: { name: true, salary: true, residencyExpiry: true } }),

    // Company expenses
    prisma.companyExpense.findMany(),

    // Project plans
    prisma.projectPlan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),

    // Open project issues
    prisma.projectIssue.findMany({
      where:   { status: 'OPEN' },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  // ─── Events (raw table) ───────────────────────────────────────────────
  let eventRows: Array<{ id: string; data: Record<string, unknown> }> = []
  try {
    eventRows = await prisma.$queryRawUnsafe<typeof eventRows>(
      `SELECT id, data FROM event_management_events ORDER BY created_at DESC LIMIT 20`
    )
  } catch { /* table may not exist yet */ }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Projects
  // ═══════════════════════════════════════════════════════════════════════
  const byStatus: Record<string, number> = {}
  let pipelineValue = 0
  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1
    if (p.status === 'QUOTE') pipelineValue += p.value / VAT
  }

  const topByRevenue = projects
    .filter(p => p.status !== 'CANCELLED')
    .map(p => {
      const revenue = p.value / VAT
      const cost    = p.bills.reduce((s, b) => s + b.amount, 0) / VAT
      const profit  = revenue - cost
      const margin  = revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0
      return {
        name: p.name, clientName: p.clientName,
        revenue: Math.round(revenue), cost: Math.round(cost),
        profit: Math.round(profit), margin, status: p.status,
        executionDate: p.executionDate ? p.executionDate.toISOString().split('T')[0] : null,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12)

  const openIssues = projectIssues.map(i => ({
    project: i.project.name, issueType: i.issueType, impact: i.impact, status: i.status,
  }))

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Financial
  // ═══════════════════════════════════════════════════════════════════════
  const totalRevenue = projects
    .filter(p => p.status !== 'CANCELLED')
    .reduce((s, p) => s + p.value / VAT, 0)
  const totalCosts = allBills
    .filter(b => b.billDate >= yr)
    .reduce((s, b) => s + b.amount, 0) / VAT
  const netProfit    = totalRevenue - totalCosts
  const profitMargin = totalRevenue > 0 ? +((netProfit / totalRevenue) * 100).toFixed(1) : 0

  // VAT
  const vatCollected = projects
    .filter(p => p.status !== 'CANCELLED')
    .reduce((s, p) => s + (p.value - p.value / VAT), 0)
  const vatPaid = allBills
    .filter(b => b.billDate >= yr)
    .reduce((s, b) => s + (b.amount - b.amount / VAT), 0)

  // Invoices by status
  const invoicesByStatus: Record<string, { count: number; amount: number }> = {}
  let totalInvoiced = 0, totalCollected = 0, totalBalance = 0
  for (const inv of allInvoices) {
    const st = inv.status
    if (!invoicesByStatus[st]) invoicesByStatus[st] = { count: 0, amount: 0 }
    invoicesByStatus[st].count++
    invoicesByStatus[st].amount += inv.amount
    totalInvoiced  += inv.amount
    totalCollected += inv.amount - inv.balance
    totalBalance   += inv.balance
  }

  const overdueInvoices = allInvoices
    .filter(inv => inv.dueDate && new Date(inv.dueDate) < now && inv.status !== 'PAID' && inv.status !== 'VOID')
    .map(inv => ({
      customer:    inv.customerName,
      amount:      Math.round(inv.amount),
      balance:     Math.round(inv.balance),
      daysOverdue: Math.floor((now.getTime() - new Date(inv.dueDate!).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 10)

  // Bills by status
  const billsByStatus: Record<string, { count: number; amount: number }> = {}
  let totalBilled = 0, totalBillsPaid = 0, totalBillsUnpaid = 0
  for (const b of allBills) {
    const st = b.status
    if (!billsByStatus[st]) billsByStatus[st] = { count: 0, amount: 0 }
    billsByStatus[st].count++
    billsByStatus[st].amount += b.amount
    totalBilled += b.amount
    if (b.status === 'PAID') totalBillsPaid   += b.amount
    else                     totalBillsUnpaid += b.amount
  }

  const overdueBills = allBills
    .filter(b => b.dueDate && new Date(b.dueDate) < now && b.status !== 'PAID')
    .map(b => ({
      supplier:    b.supplier?.name ?? 'غير محدد',
      amount:      Math.round(b.amount),
      daysOverdue: Math.floor((now.getTime() - new Date(b.dueDate!).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 10)

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Suppliers
  // ═══════════════════════════════════════════════════════════════════════
  const byRecommendation: Record<string, number> = {}
  for (const s of suppliers) {
    byRecommendation[s.recommendation] = (byRecommendation[s.recommendation] ?? 0) + 1
  }

  const supplierList = suppliers.map(s => ({
    name:            s.name,
    serviceType:     s.serviceType,
    recommendation:  s.recommendation,
    openIssues:      s.issues.length,
    evaluationCount: s.supplierEvals.length,
  }))

  const recentEvaluations = evaluations.map(e => ({
    supplier: e.supplier.name, project: e.project.name,
    performance: e.performance, repeatBusiness: e.repeatBusiness,
  }))

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Clients (from invoices + projects + zoho customers)
  // ═══════════════════════════════════════════════════════════════════════
  const clientMap = new Map<string, {
    name: string; phone: string | null; email: string | null
    invoiceTotal: number; invoicePaid: number; invoiceBalance: number
    projectCount: number; projectValue: number
  }>()

  const norm = (s: string) => s.toLowerCase().trim()

  for (const c of zohoCustomers) {
    clientMap.set(norm(c.name), {
      name: c.name, phone: c.phone ?? null, email: c.email ?? null,
      invoiceTotal: 0, invoicePaid: 0, invoiceBalance: 0, projectCount: 0, projectValue: 0,
    })
  }

  for (const inv of allInvoices) {
    const key = norm(inv.customerName)
    if (!clientMap.has(key)) clientMap.set(key, {
      name: inv.customerName, phone: null, email: null,
      invoiceTotal: 0, invoicePaid: 0, invoiceBalance: 0, projectCount: 0, projectValue: 0,
    })
    const c = clientMap.get(key)!
    c.invoiceTotal   += inv.amount
    c.invoicePaid    += inv.amount - inv.balance
    c.invoiceBalance += inv.balance
  }

  for (const p of projects.filter(p => p.status !== 'CANCELLED')) {
    const key = norm(p.clientName)
    if (!clientMap.has(key)) clientMap.set(key, {
      name: p.clientName, phone: null, email: null,
      invoiceTotal: 0, invoicePaid: 0, invoiceBalance: 0, projectCount: 0, projectValue: 0,
    })
    const c = clientMap.get(key)!
    c.projectCount++
    c.projectValue += p.value / VAT
  }

  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.invoiceTotal - a.invoiceTotal)
    .slice(0, 15)
    .map(c => ({
      name:           c.name,
      phone:          c.phone,
      email:          c.email,
      invoiceTotal:   Math.round(c.invoiceTotal),
      invoicePaid:    Math.round(c.invoicePaid),
      invoiceBalance: Math.round(c.invoiceBalance),
      projectCount:   c.projectCount,
      projectValue:   Math.round(c.projectValue),
    }))

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Invoices standalone view
  // ═══════════════════════════════════════════════════════════════════════
  const recentInvoices = allInvoices.slice(0, 15).map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    customerName:  inv.customerName,
    amount:        Math.round(inv.amount),
    balance:       Math.round(inv.balance),
    status:        inv.status,
    invoiceDate:   inv.invoiceDate.toString().split('T')[0],
    dueDate:       inv.dueDate ? inv.dueDate.toString().split('T')[0] : null,
  }))

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Bills standalone view
  // ═══════════════════════════════════════════════════════════════════════
  const recentBills = allBills.slice(0, 15).map(b => ({
    billNumber: b.billNumber,
    supplier:   b.supplier?.name ?? 'غير محدد',
    amount:     Math.round(b.amount),
    status:     b.status,
    billDate:   b.billDate.toString().split('T')[0],
    dueDate:    b.dueDate ? b.dueDate.toString().split('T')[0] : null,
    project:    b.project?.name ?? null,
  }))

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Inventory
  // ═══════════════════════════════════════════════════════════════════════
  const lowStock = inventoryItems
    .filter(i => i.minQuantity > 0 && i.quantity <= i.minQuantity)
    .map(i => ({ name: i.name, quantity: i.quantity, minQuantity: i.minQuantity, unit: i.unit }))
  const damaged = inventoryItems
    .filter(i => i.condition === 'DAMAGED')
    .map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit }))
  const byCat: Record<string, number> = {}
  for (const i of inventoryItems) {
    byCat[i.category] = (byCat[i.category] ?? 0) + 1
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Tasks
  // ═══════════════════════════════════════════════════════════════════════
  const todayDone    = todayTasks.filter(t => t.status === 'DONE').length
  const todayPending = todayTasks.filter(t => t.status === 'PENDING').length
  const perUserMap: Record<string, { name: string; done: number; pending: number }> = {}
  for (const t of todayTasks) {
    const uid  = t.assignedToId ?? 'unknown'
    const name = t.assignedTo?.name ?? 'غير محدد'
    if (!perUserMap[uid]) perUserMap[uid] = { name, done: 0, pending: 0 }
    if (t.status === 'DONE') perUserMap[uid].done++
    else perUserMap[uid].pending++
  }

  // Task history: group by date
  const historyMap: Record<string, { total: number; done: number }> = {}
  for (const t of recentTasks) {
    if (!t.taskDate) continue
    if (!historyMap[t.taskDate]) historyMap[t.taskDate] = { total: 0, done: 0 }
    historyMap[t.taskDate].total++
    if (t.status === 'DONE') historyMap[t.taskDate].done++
  }
  const recentHistory = Object.entries(historyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([date, v]) => ({
      date,
      total: v.total,
      done:  v.done,
      rate:  v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
    }))

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Team
  // ═══════════════════════════════════════════════════════════════════════
  const monthlySalaries = employees.reduce((s, e) => s + e.salary, 0)

  const expiringResidencies = employees
    .filter(e => e.residencyExpiry)
    .map(e => {
      const daysLeft = Math.floor((new Date(e.residencyExpiry!).getTime() - now.getTime()) / 86400000)
      return { name: e.name, expiryDate: e.residencyExpiry!.toISOString().split('T')[0], daysLeft }
    })
    .filter(e => e.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const employeeList = employees.map(e => {
    const daysUntilExpiry = e.residencyExpiry
      ? Math.floor((new Date(e.residencyExpiry).getTime() - now.getTime()) / 86400000)
      : null
    return {
      name:            e.name,
      salary:          e.salary,
      residencyExpiry: e.residencyExpiry ? e.residencyExpiry.toISOString().split('T')[0] : null,
      daysUntilExpiry,
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Expenses & Overhead
  // ═══════════════════════════════════════════════════════════════════════
  let monthlyTotal = 0, annualTotal = 0, monthlyEquivalent = 0
  const expiringContracts: Array<{ label: string; expiryDate: string; daysLeft: number }> = []

  const expenseList = companyExpenses.map(exp => {
    const monthly = toMonthly(exp.amount, exp.period)
    monthlyEquivalent += monthly
    if (exp.period === 'MONTHLY') monthlyTotal += exp.amount
    if (exp.period === 'ANNUAL')  annualTotal  += exp.amount

    const daysLeft = exp.expiryDate
      ? Math.floor((new Date(exp.expiryDate).getTime() - now.getTime()) / 86400000)
      : null

    if (exp.expiryDate && daysLeft !== null && daysLeft <= 90) {
      expiringContracts.push({
        label:      exp.label,
        expiryDate: exp.expiryDate.toISOString().split('T')[0],
        daysLeft,
      })
    }

    return {
      label:         exp.label,
      amount:        exp.amount,
      period:        exp.period,
      monthlyAmount: Math.round(monthly),
      expiryDate:    exp.expiryDate ? exp.expiryDate.toISOString().split('T')[0] : null,
      daysLeft,
    }
  })

  const totalMonthlyOverhead = monthlySalaries + monthlyEquivalent

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Events
  // ═══════════════════════════════════════════════════════════════════════
  const upcoming = eventRows
    .map(r => {
      const d = r.data as Record<string, unknown>
      return {
        name:       (d.name as string)   ?? 'بدون اسم',
        client:     (d.client as string) ?? '',
        venue:      (d.venue as string)  ?? '',
        date:       (d.date as string)   ?? '',
        openIssues: ((d.issues as unknown[])?.length ?? 0),
      }
    })
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10)

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTE: Planning
  // ═══════════════════════════════════════════════════════════════════════
  const plansMapped = projectPlans.map(p => {
    let items: Array<{ quote: number }> = []
    try { items = JSON.parse(p.items) } catch { /* invalid JSON */ }
    const totalCost = items.reduce((s, i) => s + (Number(i.quote) || 0), 0)
    const profit    = p.saleValue - totalCost
    const margin    = p.saleValue > 0 ? +((profit / p.saleValue) * 100).toFixed(1) : 0
    return {
      name:           p.name,
      saleValue:      p.saleValue,
      totalCost:      Math.round(totalCost),
      profit:         Math.round(profit),
      margin,
      suppliersCount: items.length,
      createdAt:      p.createdAt.toISOString().split('T')[0],
    }
  })

  const planTotalSale  = plansMapped.reduce((s, p) => s + p.saleValue,  0)
  const planTotalCost  = plansMapped.reduce((s, p) => s + p.totalCost,  0)
  const planTotalProfit = plansMapped.reduce((s, p) => s + p.profit,    0)
  const planAvgMargin  = plansMapped.length > 0
    ? +(plansMapped.reduce((s, p) => s + p.margin, 0) / plansMapped.length).toFixed(1)
    : 0

  // ═══════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════
  return {
    generatedAt: new Date().toISOString(),

    projects: {
      total: projects.length,
      byStatus,
      pipeline: Math.round(pipelineValue),
      topByRevenue,
      openIssues,
    },

    financial: {
      totalRevenue:    Math.round(totalRevenue),
      totalCosts:      Math.round(totalCosts),
      netProfit:       Math.round(netProfit),
      profitMargin,
      vatCollected:    Math.round(vatCollected),
      vatPaid:         Math.round(vatPaid),
      netVat:          Math.round(vatCollected - vatPaid),
      invoicesByStatus,
      totalInvoiced:   Math.round(totalInvoiced),
      totalCollected:  Math.round(totalCollected),
      totalBalance:    Math.round(totalBalance),
      overdueInvoices,
      billsByStatus,
      totalBilled:     Math.round(totalBilled),
      totalBillsPaid:  Math.round(totalBillsPaid),
      totalBillsUnpaid: Math.round(totalBillsUnpaid),
      overdueBills,
    },

    suppliers: {
      total: suppliers.length,
      byRecommendation,
      list: supplierList,
      recentEvaluations,
    },

    clients: {
      total:      clientMap.size,
      topClients,
    },

    invoices: {
      total:      allInvoices.length,
      unlinked:   allInvoices.filter(i => !i.projectId).length,
      recentList: recentInvoices,
    },

    bills: {
      total:      allBills.length,
      unlinked:   allBills.filter(b => !b.projectId).length,
      recentList: recentBills,
    },

    inventory: {
      total:      inventoryItems.length,
      lowStock,
      damaged,
      byCategory: byCat,
    },

    tasks: {
      todayTotal:     todayTasks.length,
      todayDone,
      todayPending,
      completionRate: todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : 0,
      perUser:        Object.values(perUserMap),
      recentHistory,
    },

    team: {
      usersCount: users.length,
      eligibleForTasks: users.filter(u =>
        u.role !== 'ADMIN' &&
        !u.email?.toLowerCase().includes('infosahab') &&
        !u.name?.toLowerCase().includes('infosahab')
      ).map(u => ({ name: u.name })),
      employees:           employeeList,
      monthlySalaries:     Math.round(monthlySalaries),
      expiringResidencies,
    },

    expenses: {
      monthly:              Math.round(monthlyTotal),
      annual:               Math.round(annualTotal),
      monthlyEquivalent:    Math.round(monthlyEquivalent),
      totalMonthlyOverhead: Math.round(totalMonthlyOverhead),
      list:                 expenseList,
      expiringContracts,
    },

    events: {
      total:    eventRows.length,
      upcoming,
    },

    planning: {
      total:          projectPlans.length,
      totalSaleValue: Math.round(planTotalSale),
      totalCost:      Math.round(planTotalCost),
      totalProfit:    Math.round(planTotalProfit),
      avgMargin:      planAvgMargin,
      recentPlans:    plansMapped,
    },
  }
}
