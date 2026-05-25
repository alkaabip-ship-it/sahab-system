import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const [invoices, projects, zohoCustomers] = await Promise.all([
    prisma.invoice.findMany({
      select: { customerName: true, amount: true, balance: true, status: true, invoiceDate: true },
    }),
    prisma.project.findMany({
      select: { clientName: true, value: true, status: true, createdAt: true },
    }),
    prisma.customer.findMany({
      select: { zohoId: true, name: true, phone: true, email: true, company: true },
    }),
  ])

  // Build client map — seeded first from Zoho customers
  const clientMap = new Map<string, {
    name: string
    phone: string | null
    email: string | null
    company: string | null
    zohoId: string | null
    invoiceCount: number
    invoiceTotal: number
    invoicePaid: number
    invoiceBalance: number
    projectCount: number
    projectValue: number
    lastActivity: Date
  }>()

  // Normalise name for matching (lowercase + trim)
  const norm = (s: string) => s.toLowerCase().trim()

  // 1. Seed from Zoho customers
  for (const c of zohoCustomers) {
    clientMap.set(norm(c.name), {
      name:           c.name,
      phone:          c.phone ?? null,
      email:          c.email ?? null,
      company:        c.company ?? null,
      zohoId:         c.zohoId ?? null,
      invoiceCount:   0,
      invoiceTotal:   0,
      invoicePaid:    0,
      invoiceBalance: 0,
      projectCount:   0,
      projectValue:   0,
      lastActivity:   new Date(0),
    })
  }

  function getOrCreate(name: string) {
    const key = norm(name)
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        name,
        phone: null, email: null, company: null, zohoId: null,
        invoiceCount: 0, invoiceTotal: 0, invoicePaid: 0, invoiceBalance: 0,
        projectCount: 0, projectValue: 0,
        lastActivity: new Date(0),
      })
    }
    return clientMap.get(key)!
  }

  // 2. Aggregate invoices
  for (const inv of invoices) {
    const c = getOrCreate(inv.customerName)
    c.invoiceCount++
    c.invoiceTotal   += inv.amount
    c.invoicePaid    += inv.amount - inv.balance
    c.invoiceBalance += inv.balance
    const d = new Date(inv.invoiceDate)
    if (d > c.lastActivity) c.lastActivity = d
  }

  // 3. Aggregate projects
  for (const prj of projects) {
    const c = getOrCreate(prj.clientName)
    c.projectCount++
    c.projectValue += prj.value / 1.05
    const d = new Date(prj.createdAt)
    if (d > c.lastActivity) c.lastActivity = d
  }

  const clients = Array.from(clientMap.values())
    .sort((a, b) => b.invoiceTotal - a.invoiceTotal)

  const topByActivity = [...clients].sort(
    (a, b) => (b.invoiceCount + b.projectCount) - (a.invoiceCount + a.projectCount)
  )[0] ?? null

  const topByPaid = [...clients].sort((a, b) => b.invoicePaid - a.invoicePaid)[0] ?? null

  return NextResponse.json({ clients, topByActivity, topByPaid })
}
