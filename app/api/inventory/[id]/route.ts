import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const body = await req.json()
    const item = await prisma.inventoryItem.update({
      where: { id: params.id },
      data: {
        ...(body.name        !== undefined && { name: body.name }),
        ...(body.category    !== undefined && { category: body.category }),
        ...(body.quantity    !== undefined && { quantity: parseFloat(body.quantity) }),
        ...(body.minQuantity !== undefined && { minQuantity: parseFloat(body.minQuantity) }),
        ...(body.unit        !== undefined && { unit: body.unit }),
        ...(body.location    !== undefined && { location: body.location }),
        ...(body.condition   !== undefined && { condition: body.condition }),
        ...(body.notes       !== undefined && { notes: body.notes }),
      },
    })
    return NextResponse.json(item)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'خطأ في التعديل' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    await prisma.inventoryItem.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'خطأ في الحذف' }, { status: 500 })
  }
}
