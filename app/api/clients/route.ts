import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const [invoices, projects] = await Promise.all([
    prisma.invoice.findMany({
      select: { customerName: true, amount: true, balance: true, status: true, invoiceDate: true },
    }),
    prisma.project.findMany({
      select: { clientName: true, value: true, status: true, createdAt: true },
    }),
  ])

  // Aggregate by client name
  const clientMap = new Map<string, {
    name: string
    invoiceCount: number
    invoiceTotal: number
    invoicePaid: number
    invoiceBalance: number
    projectCount: number
    projectValue: number
    lastActivity: Date
  }>()

  function getOrCreate(name: string) {
    if (!clientMap.has(name)) {
      clientMap.set(name, {
        name,
        invoiceCount: 0,
        invoiceTotal: 0,
        invoicePaid: 0,
        invoiceBalance: 0,
        projectCount: 0,
        projectValue: 0,
        lastActivity: new Date(0),
      })
    }
    return clientMap.get(name)!
  }

  for (const inv of invoices) {
    const c = getOrCreate(inv.customerName)
    c.invoiceCount++
    c.invoiceTotal  += inv.amount
    c.invoicePaid   += inv.amount - inv.balance
    c.invoiceBalance += inv.balance
    const d = new Date(inv.invoiceDate)
    if (d > c.lastActivity) c.lastActivity = d
  }

  for (const prj of projects) {
    const c = getOrCreate(prj.clientName)
    c.projectCount++
    c.projectValue += prj.value / 1.05   // ex-VAT
    const d = new Date(prj.createdAt)
    if (d > c.lastActivity) c.lastActivity = d
  }

  const clients = Array.from(clientMap.values()).sort((a, b) => b.invoiceTotal - a.invoiceTotal)

  // Summary stats
  const topByActivity = [...clients].sort((a, b) => (b.invoiceCount + b.projectCount) - (a.invoiceCount + a.projectCount))[0] ?? null
  const topByPaid     = [...clients].sort((a, b) => b.invoicePaid - a.invoicePaid)[0] ?? null

  return NextResponse.json({ clients, topByActivity, topByPaid })
}
