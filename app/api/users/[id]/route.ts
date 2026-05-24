import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { name, email, password, role, permissions } = await req.json()

  const data: any = {}
  if (name)  data.name  = name
  if (email) data.email = email
  if (role)  data.role  = role
  if (password) data.password = await bcrypt.hash(password, 10)
  if (permissions !== undefined) data.permissions = role === 'ADMIN' ? null : JSON.stringify(permissions)

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
    })
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'خطأ في التحديث' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const self = (session.user as any).id
  if (self === params.id) return NextResponse.json({ error: 'لا يمكن حذف حسابك الخاص' }, { status: 400 })

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
