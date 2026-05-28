// @ts-nocheck
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)
    const yearEnd   = new Date(currentYear, 11, 31, 23, 59, 59)
    const VAT = 1.05

    const [allProjects, allBills, allSuppliers] = await Promise.all([
      prisma.project.findMany({ include: { bills: { select: { amount: true, status: true } } } }),
      prisma.bill.findMany({ select: { amount: true, status: true, billDate: true } }),
      prisma.supplier.findMany({ select: { recommendation: true, bills: { select: { amount: true } } } }),
    ])

    // Year projects
    const yearProjects = allProjects.filter(p => {
      const d = p.executionDate || p.createdAt
      return d >= yearStart && d <= yearEnd
    })

    const yearRevenue = yearProjects.reduce((s, p) => s + p.value / VAT, 0)
    const yearCosts   = yearProjects.reduce((s, p) => s + p.bills.reduce((x, b) => x + b.amount / VAT, 0), 0)
    const yearProfit  = yearRevenue - yearCosts
    const yearMargin  = yearRevenue > 0 ? (yearProfit / yearRevenue) * 100 : 0

    // All-time
    const totalRevenue = allProjects.reduce((s, p) => s + p.value / VAT, 0)
    const totalCosts   = allProjects.reduce((s, p) => s + p.bills.reduce((x, b) => x + b.amount / VAT, 0), 0)

    // Unpaid bills
    const unpaidBills = allBills.filter(b => b.status === 'UNPAID' || b.status === 'PARTIAL')
    const unpaidTotal = unpaidBills.reduce((s, b) => s + b.amount, 0)

    // Project health
    const projectsWithCosts = allProjects.map(p => {
      const costs = p.bills.reduce((s, b) => s + b.amount, 0)
      const rev   = p.value / VAT
      const cost  = costs / VAT
      const margin = rev > 0 ? ((rev - cost) / rev) * 100 : 0
      return { name: p.name, code: p.code, status: p.status, margin }
    })
    const lowProfitCount = projectsWithCosts.filter(p => p.margin < 20 && p.status !== 'QUOTE').length
    const activeCount    = allProjects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'CONFIRMED').length

    // Supplier risks
    const riskySuppliers = allSuppliers.filter(s => s.recommendation === 'AVOID' || s.recommendation === 'CAUTION').length

    const prompt = `أنت مستشار مالي لشركة سحاب لإدارة الفعاليات في الإمارات العربية المتحدة.
فيما يلي بيانات الشركة الحالية. اكتب تحليلاً شاملاً وقراراً واضحاً للإدارة.

📊 الأداء المالي لعام ${currentYear}:
- الإيرادات (بدون ضريبة): ${yearRevenue.toFixed(0)} د.إ
- التكاليف: ${yearCosts.toFixed(0)} د.إ
- صافي الربح: ${yearProfit.toFixed(0)} د.إ
- هامش الربح: ${yearMargin.toFixed(1)}%

💰 الفواتير غير المسددة:
- عدد الفواتير: ${unpaidBills.length}
- إجمالي المبلغ: ${unpaidTotal.toFixed(0)} د.إ

📁 المشاريع:
- المشاريع النشطة: ${activeCount}
- مشاريع بهامش ربح منخفض (أقل من 20%): ${lowProfitCount}

⚠️ الموردون ذوو المخاطر (تجنب/تحذير): ${riskySuppliers}

بناءً على هذه البيانات، اكتب تحليلاً في 4-5 نقاط يشمل:
١. تقييم الوضع المالي الحالي
٢. المخاطر الرئيسية التي تواجه الشركة
٣. فرص التحسين
٤. قرارات مقترحة يجب اتخاذها الآن

اجعل كل نقطة سطراً واحداً مباشراً، تبدأ بـ رمز مناسب. لا تكرر الأرقام بشكل مفصل.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const analysis = (message.content[0] as any).text

    return NextResponse.json({
      analysis,
      summary: {
        yearRevenue: Math.round(yearRevenue),
        yearCosts: Math.round(yearCosts),
        yearProfit: Math.round(yearProfit),
        yearMargin: parseFloat(yearMargin.toFixed(1)),
        unpaidTotal: Math.round(unpaidTotal),
        unpaidCount: unpaidBills.length,
        activeProjects: activeCount,
        currentYear,
      },
    })
  } catch (err: any) {
    console.error('company-analysis error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
