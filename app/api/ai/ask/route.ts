// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { question } = await req.json()
  if (!question?.trim()) return NextResponse.json({ error: 'السؤال فارغ' }, { status: 400 })

  try {
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)
    const yearEnd   = new Date(currentYear, 11, 31, 23, 59, 59)
    const VAT = 1.05

    const [allProjects, allBills, allSuppliers] = await Promise.all([
      prisma.project.findMany({
        include: { Bill: { select: { amount: true, status: true } } },
      }),
      prisma.bill.findMany({ select: { amount: true, status: true } }),
      prisma.supplier.findMany({
        select: { name: true, serviceType: true, recommendation: true, bills: { select: { amount: true } } },
      }),
    ])

    const yearProjects = allProjects.filter(p => {
      const d = p.executionDate || p.createdAt
      return d >= yearStart && d <= yearEnd
    })

    const yearRevenue = yearProjects.reduce((s, p) => s + p.value / VAT, 0)
    const yearCosts   = yearProjects.reduce((s, p) => s + p.Bill.reduce((x, b) => x + b.amount / VAT, 0), 0)
    const yearProfit  = yearRevenue - yearCosts
    const yearMargin  = yearRevenue > 0 ? (yearProfit / yearRevenue) * 100 : 0

    const unpaidBills = allBills.filter(b => b.status === 'UNPAID' || b.status === 'PARTIAL')
    const unpaidTotal = unpaidBills.reduce((s, b) => s + b.amount, 0)

    const activeProjects = allProjects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'CONFIRMED')
    const projectsData = allProjects.map(p => {
      const costs  = p.Bill.reduce((s, b) => s + b.amount / VAT, 0)
      const rev    = p.value / VAT
      const margin = rev > 0 ? ((rev - costs) / rev) * 100 : 0
      return `${p.code} | ${p.name} | ${p.status} | إيرادات: ${rev.toFixed(0)} | تكاليف: ${costs.toFixed(0)} | هامش: ${margin.toFixed(1)}%`
    }).join('\n')

    const suppliersData = allSuppliers.map(s => {
      const total = s.Bill.reduce((x, b) => x + b.amount, 0)
      return `${s.name} | ${s.serviceType} | ${s.recommendation} | إجمالي التعاملات: ${total.toFixed(0)}`
    }).join('\n')

    const systemPrompt = `أنت مستشار مالي ذكي لشركة سحاب لإدارة الفعاليات في الإمارات.
لديك وصول كامل لبيانات الشركة الحقيقية. أجب على أسئلة المدير بدقة ووضوح بالعربية.
اجعل إجاباتك مختصرة ومباشرة، وادعم أجوبتك بالأرقام الفعلية من البيانات.

بيانات الشركة لعام ${currentYear}:
الإيرادات: ${yearRevenue.toFixed(0)} د.إ
التكاليف: ${yearCosts.toFixed(0)} د.إ
الربح: ${yearProfit.toFixed(0)} د.إ | هامش: ${yearMargin.toFixed(1)}%
فواتير غير مسددة: ${unpaidBills.length} بقيمة ${unpaidTotal.toFixed(0)} د.إ
مشاريع نشطة: ${activeProjects.length} من أصل ${allProjects.length}

المشاريع:
${projectsData}

الموردون:
${suppliersData}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    })

    const answer = (message.content[0] as any).text
    return NextResponse.json({ answer })
  } catch (err: any) {
    console.error('ask error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
