import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { name, saleValue, items } = await req.json()
  const plan = await prisma.projectPlan.update({
    where: { id: params.id },
    data: {
      name:      name.trim(),
      saleValue: Number(saleValue) || 0,
      items:     JSON.stringify(items || []),
      updatedAt: new Date(),
    },
  })
  return NextResponse.json(plan)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  await prisma.projectPlan.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
