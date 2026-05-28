import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { name, salary } = await req.json()
  if (!name || !salary) return NextResponse.json({ error: 'الاسم والراتب مطلوبان' }, { status: 400 })

  const employee = await prisma.employee.create({ data: { id: randomUUID(), name, salary: parseFloat(salary) } })
  return NextResponse.json(employee, { status: 201 })
}
