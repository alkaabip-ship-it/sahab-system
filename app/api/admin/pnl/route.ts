import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const fromDate = from ? new Date(from) : undefined
  const toDate   = to   ? new Date(to + 'T23:59:59') : undefined

  // Filter projects by executionDate (fall back to createdAt when null)
  const where: any = {}
  if (fromDate || toDate) {
    where.OR = [
      {
        executionDate: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate   ? { lte: toDate   } : {}),
        },
      },
      {
        executionDate: null,
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate   ? { lte: toDate   } : {}),
        },
      },
    ]
  }

  const projects = await prisma.project.findMany({
    where,
    include: { bills: { select: { amount: true } } },
  })

  const VAT = 1.05
  const revenue      = projects.reduce((s, p) => s + p.value / VAT, 0)
  const costs        = projects.reduce((s, p) => s + p.bills.reduce((bs, b) => bs + b.amount, 0) / VAT, 0)
  const grossProfit  = revenue - costs
  const vatCollected = projects.reduce((s, p) => s + (p.value - p.value / VAT), 0)
  const vatPaid      = projects.reduce((s, p) => {
    const c = p.bills.reduce((bs, b) => bs + b.amount, 0)
    return s + (c - c / VAT)
  }, 0)
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  return NextResponse.json({
    revenue,
    costs,
    grossProfit,
    margin,
    vatCollected,
    vatPaid,
    netVat: vatCollected - vatPaid,
    projectCount: projects.length,
  })
}
