import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_VIEWER_PERMISSIONS } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  if ((session.user as any).role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { name, email, password, role, permissions } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'الاسم والإيميل وكلمة المرور مطلوبة' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 10)
  const permsJson = role === 'ADMIN'
    ? null
    : JSON.stringify(permissions ?? DEFAULT_VIEWER_PERMISSIONS)

  try {
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: role || 'VIEWER', permissions: permsJson },
      select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'الإيميل مستخدم بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'خطأ في إنشاء المستخدم' }, { status: 500 })
  }
}
