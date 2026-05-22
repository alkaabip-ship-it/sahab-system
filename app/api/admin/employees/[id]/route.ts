import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { residencyExpiry } = await req.json()
  const employee = await prisma.employee.update({
    where: { id: params.id },
    data: { residencyExpiry: residencyExpiry ? new Date(residencyExpiry) : null },
  })
  return NextResponse.json(employee)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  await prisma.employee.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
