import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const plans = await prisma.projectPlan.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(plans)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { name, saleValue, items } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'اسم التخطيط مطلوب' }, { status: 400 })

  const plan = await prisma.projectPlan.create({
    data: {
      name: name.trim(),
      saleValue: Number(saleValue) || 0,
      items: JSON.stringify(items || []),
    },
  })
  return NextResponse.json(plan, { status: 201 })
}
