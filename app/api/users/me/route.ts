import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const id = (session.user as any).id
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true, permissions: true },
  })
  return NextResponse.json({ role: user?.role, permissions: user?.permissions })
}
