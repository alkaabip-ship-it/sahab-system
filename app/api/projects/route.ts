import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateProjectCode } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip  = (page - 1) * limit

    const [total, projects] = await Promise.all([
      prisma.project.count(),
      prisma.project.findMany({
        include: {
          bills:    { select: { amount: true } },
          invoices: { select: { invoiceDate: true }, orderBy: { invoiceDate: 'asc' }, take: 1 },
          _count:   { select: { bills: true } },
        },
        orderBy: [{ executionDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    const VAT = 1.05
    const data = projects.map((p) => {
      const costs        = p.bills.reduce((s, b) => s + b.amount, 0)
      const revenueExVat = p.value / VAT
      const costsExVat   = costs / VAT
      const profit       = revenueExVat - costsExVat
      const margin       = revenueExVat > 0 ? (profit / revenueExVat) * 100 : 0
      // displayDate: first linked invoice date → executionDate → createdAt
      const invoiceDate  = p.invoices[0]?.invoiceDate ?? null
      const displayDate  = invoiceDate
        ? invoiceDate.toISOString().slice(0, 10)
        : p.executionDate
          ? p.executionDate.toISOString().slice(0, 10)
          : p.createdAt.toISOString().slice(0, 10)
      return { ...p, costs, revenueExVat, costsExVat, profit, margin, displayDate }
    })

    // Re-sort by displayDate descending (invoice date takes priority over executionDate)
    data.sort((a, b) => new Date(b.displayDate).getTime() - new Date(a.displayDate).getTime())

    return NextResponse.json({ data, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'خطأ في جلب المشاريع' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, clientName, value, executionDate, status, code } = body

    if (!name || !clientName || !value) {
      return NextResponse.json(
        { error: 'الحقول المطلوبة: الاسم، اسم العميل، القيمة' },
        { status: 400 }
      )
    }

    const projectCode = code || (await generateProjectCode())

    const project = await prisma.project.create({
      data: {
        code: projectCode,
        name,
        clientName,
        value: parseFloat(value),
        executionDate: executionDate ? new Date(executionDate) : null,
        status: status || 'QUOTE',
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'كود المشروع مستخدم بالفعل' },
        { status: 400 }
      )
    }
    console.error(error)
    return NextResponse.json(
      { error: 'خطأ في إنشاء المشروع' },
      { status: 500 }
    )
  }
}
