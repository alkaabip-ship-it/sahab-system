import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Returns today's date in UAE timezone (UTC+4) as "YYYY-MM-DD" */
function todayUAE(): string {
  const now = new Date()
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000)
  return uae.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const userId  = (session.user as any).id   as string
  const isAdmin = (session.user as any).role === 'ADMIN'

  const date = req.nextUrl.searchParams.get('date') || todayUAE()

  const tasks = await prisma.task.findMany({
    where: {
      taskDate: date,
      ...(isAdmin ? {} : {
        OR: [{ assignedToId: userId }, { createdById: userId }],
      }),
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy:  { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ tasks, date })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const userId  = (session.user as any).id   as string
    const isAdmin = (session.user as any).role === 'ADMIN'
    const { title, assignedToId } = await req.json()

    if (!title?.trim()) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 })

    const task = await prisma.task.create({
      data: {
        title:        title.trim(),
        status:       'PENDING',
        taskDate:     todayUAE(),
        assignedToId: isAdmin ? (assignedToId || userId) : userId,
        createdById:  userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy:  { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'خطأ في الإضافة' }, { status: 500 })
  }
}
