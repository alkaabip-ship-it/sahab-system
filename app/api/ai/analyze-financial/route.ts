import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { supplierName, amount, projectId } = await req.json()

  try {
    // Gather context: supplier history
    const supplier = await prisma.supplier.findFirst({
      where: { name: { contains: supplierName || '', mode: 'insensitive' } },
      include: { bills: true },
    })

    const supplierTotal = supplier?.bills.reduce((s, b) => s + b.amount, 0) ?? 0
    const supplierBillCount = supplier?.bills.length ?? 0
    const unpaidCount = supplier?.bills.filter(b => b.status === 'UNPAID' || b.status === 'PARTIAL').length ?? 0

    // Gather context: project financials
    let projectContext = ''
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { bills: { select: { amount: true } } },
      })
      if (project) {
        const VAT = 1.05
        const costs = project.bills.reduce((s, b) => s + b.amount, 0)
        const revenueExVat = project.value / VAT
        const costsExVat = costs / VAT
        const newCostExVat = (amount || 0) / VAT
        const newMargin = revenueExVat > 0
          ? ((revenueExVat - costsExVat - newCostExVat) / revenueExVat) * 100
          : 0
        projectContext = `
- المشروع: ${project.name} (${project.code})
- قيمة المشروع (بدون ض): ${(revenueExVat).toFixed(0)} د.إ
- التكاليف الحالية (بدون ض): ${(costsExVat).toFixed(0)} د.إ
- هامش الربح بعد إضافة هذه الفاتورة: ${newMargin.toFixed(1)}%`
      }
    }

    // Company-wide stats
    const [allBills, allProjects] = await Promise.all([
      prisma.bill.findMany({ select: { amount: true, status: true } }),
      prisma.project.findMany({ include: { bills: { select: { amount: true } } } }),
    ])
    const VAT = 1.05
    const totalRevenue = allProjects.reduce((s, p) => s + p.value / VAT, 0)
    const totalCosts = allProjects.reduce((s, p) => s + p.bills.reduce((x, b) => x + b.amount / VAT, 0), 0)
    const totalUnpaid = allBills.filter(b => b.status === 'UNPAID' || b.status === 'PARTIAL').reduce((s, b) => s + b.amount, 0)

    const prompt = `أنت مستشار مالي لشركة سحاب لإدارة الفعاليات في الإمارات.

بيانات الشركة العامة:
- إجمالي الإيرادات (بدون ضريبة): ${totalRevenue.toFixed(0)} د.إ
- إجمالي التكاليف (بدون ضريبة): ${totalCosts.toFixed(0)} د.إ
- هامش الربح العام: ${totalRevenue > 0 ? (((totalRevenue - totalCosts) / totalRevenue) * 100).toFixed(1) : 0}%
- إجمالي الفواتير غير المسددة: ${totalUnpaid.toFixed(0)} د.إ

بيانات المورد "${supplierName || 'غير معروف'}":
- عدد الفواتير السابقة: ${supplierBillCount}
- إجمالي المدفوعات السابقة له: ${supplierTotal.toFixed(0)} د.إ
- فواتير غير مسددة له: ${unpaidCount}
- تقييمه: ${supplier?.recommendation || 'غير مقيّم'}
${projectContext}

الفاتورة الحالية:
- المبلغ: ${amount || 0} د.إ (شامل الضريبة)

اكتب تحليلاً موجزاً في 3-4 نقاط باللغة العربية يشمل:
١. تقييم العلاقة مع هذا المورد
٢. أثر هذه الفاتورة على ربحية المشروع (إن وُجد)
٣. توصية مالية واضحة

اجعل النقاط قصيرة ومباشرة (سطر واحد كل نقطة).`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const analysis = (message.content[0] as any).text

    return NextResponse.json({ analysis })
  } catch (err: any) {
    console.error('analyze-financial error:', err)
    return NextResponse.json({ error: 'فشل التحليل' }, { status: 500 })
  }
}
