// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page    = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
  const skip    = (page - 1) * limit
  const unlinked = searchParams.get('unlinked') === 'true'

  const where: any = {}
  if (unlinked) where.projectId = null

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { project: { select: { id: true, code: true, name: true } } },
      orderBy: { invoiceDate: 'desc' },
      skip,
      take: limit,
    }),
  ])

  return NextResponse.json({ data: invoices, total, page, limit, pages: Math.ceil(total / limit) })
}
