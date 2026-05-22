import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function toMonthly(amount: number, period: string): number {
  if (period === 'MONTHLY')  return amount
  if (period === 'ANNUAL')   return amount / 12
  if (period === 'BIANNUAL') return amount / 24
  return 0
}

function daysUntil(date: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const [employees, expenses] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.companyExpense.findMany({ orderBy: { key: 'asc' } }),
  ])

  const monthlySalaries = employees.reduce((s, e) => s + e.salary, 0)
  const monthlyExpenses = expenses.reduce((s, e) => s + toMonthly(e.amount, e.period), 0)
  const totalMonthlyOverhead = monthlySalaries + monthlyExpenses

  // Build expiry warnings (expired or within 90 days)
  type Warning = { label: string; daysLeft: number; expired: boolean; type: string }
  const warnings: Warning[] = []

  for (const exp of expenses) {
    if (exp.expiryDate) {
      const days = daysUntil(exp.expiryDate)
      if (days <= 90) {
        warnings.push({ label: exp.label, daysLeft: days, expired: days < 0, type: 'expense' })
      }
    }
  }

  for (const emp of employees) {
    if (emp.residencyExpiry) {
      const days = daysUntil(emp.residencyExpiry)
      if (days <= 90) {
        warnings.push({ label: `إقامة ${emp.name}`, daysLeft: days, expired: days < 0, type: 'residency' })
      }
    }
  }

  warnings.sort((a, b) => a.daysLeft - b.daysLeft)

  return NextResponse.json({ employees, expenses, monthlySalaries, monthlyExpenses, totalMonthlyOverhead, warnings })
}
