// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const userId  = (session.user as any).id
    const isAdmin = (session.user as any).role === 'ADMIN'
    const body    = await req.json()

    // Verify access: only assigned user or admin can update
    const existing = await prisma.task.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 })
    if (!isAdmin && existing.assignedToId !== userId && existing.createdById !== userId) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const data: any = {}
    if (body.status    !== undefined) data.status    = body.status
    if (body.notes     !== undefined) data.notes     = body.notes
    // Admin-only fields
    if (isAdmin) {
      if (body.title        !== undefined) data.title        = body.title
      if (body.description  !== undefined) data.description  = body.description
      if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId
      if (body.dueDate      !== undefined) data.dueDate      = body.dueDate ? new Date(body.dueDate) : null
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy:  { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(task)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'خطأ في التعديل' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const userId  = (session.user as any).id
    const isAdmin = (session.user as any).role === 'ADMIN'

    const existing = await prisma.task.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 })
    if (!isAdmin && existing.createdById !== userId) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    await prisma.task.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'خطأ في الحذف' }, { status: 500 })
  }
}
