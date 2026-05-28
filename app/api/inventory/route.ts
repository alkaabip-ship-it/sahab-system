import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const items = await prisma.inventoryItem.findMany({ orderBy: { category: 'asc' } })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const body = await req.json()
    const { name, category, quantity, minQuantity, unit, location, condition, notes } = body
    if (!name?.trim()) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })

    const item = await prisma.inventoryItem.create({
      data: {
        name: name.trim(),
        category: category || 'OTHER',
        quantity:    parseFloat(quantity)    || 0,
        minQuantity: parseFloat(minQuantity) || 0,
        unit: unit || 'قطعة',
        location: location || null,
        condition: condition || 'GOOD',
        notes: notes || null,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'خطأ في الإضافة' }, { status: 500 })
  }
}
