import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const body = await req.json()
    const { projectId } = body

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        projectId: projectId || null,
      },
      include: { project: { select: { id: true, code: true, name: true } } },
    })

    return NextResponse.json(invoice)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'خطأ في تحديث الفاتورة' }, { status: 500 })
  }
}
