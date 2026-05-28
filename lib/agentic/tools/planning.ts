// @ts-nocheck
/**
 * Agent planning tool — reads event requirements, selects best suppliers
 * from the DB, estimates costs, and saves the plan to صفحة التخطيط.
 */
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface PlanItem {
  id: string
  supplierId: string
  name: string
  serviceType: string
  quote: number
  notes?: string
}

export interface PlanResult {
  planId: string
  planName: string
  saleValue: number
  items: PlanItem[]
  totalCost: number
  margin: number
  summary: string
}

export async function createEventPlanFromMessage(userMessage: string): Promise<PlanResult | { error: string }> {
  // ── Step 1: Extract event details + fetch context in parallel ─────────
  const [extractRes, allSuppliers, pastPlans] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `من رسالة مدير شركة فعاليات، استخرج تفاصيل الفعالية المطلوبة وأجب بـ JSON فقط بدون أي نص آخر:
{
  "planName": "اسم وصفي قصير للفعالية",
  "saleValue": سعر_البيع_الإجمالي_كرقم_أو_0,
  "clientHint": "اسم العميل إن ذُكر أو null",
  "services": ["الخدمات المطلوبة بالعربي مثل: صوتيات، إضاءة، شاشات، كراسي، خيمة، طعام، تصوير، تصميم، طباعة، أمن، نقل، إلخ"]
}
قواعد: إذا ذُكر سعر بيع → استخدمه في saleValue، وإلا 0. استنتج الخدمات من نوع الفعالية وما ذُكر صراحةً.
الرسالة: "${userMessage}"`,
      }],
    }),

    prisma.supplier.findMany({
      where:   { recommendation: { not: 'SUSPENDED' } },
      include: {
        bills:         { select: { amount: true } },
        supplierEvals: { select: { performance: true, repeatBusiness: true }, orderBy: { createdAt: 'desc' }, take: 3 },
      },
    }),

    prisma.projectPlan.findMany({
      orderBy: { createdAt: 'desc' },
      take:    30,
    }),
  ])

  // Parse extraction result
  let details: { planName: string; saleValue: number; clientHint: string | null; services: string[] } | null = null
  try {
    const txt = extractRes.content[0].type === 'text' ? extractRes.content[0].text : ''
    const m = txt.match(/\{[\s\S]*?\}/)
    if (m) details = JSON.parse(m[0])
  } catch { /**/ }

  if (!details || !details.planName) {
    return { error: 'تعذّر استخراج تفاصيل الفعالية من رسالتك. يرجى ذكر نوع الفعالية والخدمات المطلوبة.' }
  }

  if (allSuppliers.length === 0) {
    return { error: 'لا يوجد موردون نشطون في النظام.' }
  }

  // ── Step 2: Build rich context from past plans ──────────────────────
  const pastPlansSummary = pastPlans.map(p => {
    let items: Array<{ name?: string; serviceType?: string; quote?: number; notes?: string }> = []
    try { items = JSON.parse(p.items) } catch { /**/ }
    const totalCost = items.reduce((s, i) => s + (Number(i.quote) || 0), 0)
    const margin    = p.saleValue > 0 ? +((( p.saleValue - totalCost) / p.saleValue) * 100).toFixed(1) : 0
    return {
      name:      p.name,
      saleValue: p.saleValue,
      totalCost: Math.round(totalCost),
      margin,
      items:     items.map(i => `${i.serviceType ?? '?'}:${i.name ?? '?'}=${(Number(i.quote) || 0).toLocaleString()}`),
    }
  })

  // Service-type price benchmarks from ALL past plans
  const _stQuotes: Record<string, number[]> = {}
  for (const plan of pastPlansSummary) {
    for (const item of plan.items) {
      const [stPart, rest] = item.split(':')
      const quotePart = rest?.split('=')[1]?.replace(/,/g, '')
      const q = parseFloat(quotePart ?? '')
      if (stPart && !isNaN(q) && q > 0) {
        if (!_stQuotes[stPart]) _stQuotes[stPart] = []
        _stQuotes[stPart].push(q)
      }
    }
  }
  const benchmarkLines = Object.entries(_stQuotes).map(([st, qs]) => {
    const avg = Math.round(qs.reduce((s, q) => s + q, 0) / qs.length)
    return `${st}: متوسط ${avg.toLocaleString()} د.إ (${Math.round(Math.min(...qs)).toLocaleString()} – ${Math.round(Math.max(...qs)).toLocaleString()}) من ${qs.length} صفقة`
  }).join('\n')

  const pastPlansContext = pastPlansSummary.length > 0
    ? `\nالخطط السابقة للتعلم منها (${pastPlansSummary.length} خطة):\n` +
      pastPlansSummary.slice(0, 10).map(p =>
        `• "${p.name}" — بيع ${p.saleValue.toLocaleString()} | تكلفة ${p.totalCost.toLocaleString()} | هامش ${p.margin}%\n  الخدمات: ${p.items.join(' | ')}`
      ).join('\n')
    : ''

  const benchmarkContext = benchmarkLines
    ? `\nمعيار أسعار الخدمات من التاريخ:\n${benchmarkLines}`
    : ''

  // ── Step 3: Build supplier list ───────────────────────────────────────
  const supplierLines = allSuppliers.map(s => {
    const avgBill = s.bills.length > 0
      ? Math.round(s.bills.reduce((sum, b) => sum + b.amount, 0) / s.bills.length)
      : 0
    const repeat = s.supplierEvals.filter(e => e.repeatBusiness).length
    return `ID:${s.id}|${s.name}|${s.serviceType}|${s.recommendation}|متوسط:${avgBill.toLocaleString()}|تكرار:${repeat}`
  }).join('\n')

  // ── Step 4: Let Claude pick best supplier per service + estimate cost ──
  const selectionRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `أنت مخطط فعاليات محترف لشركة سحاب بالإمارات. لديك تاريخ كامل من الخطط السابقة.

الفعالية المطلوبة: ${details.planName}${details.clientHint ? ` — العميل: ${details.clientHint}` : ''}
سعر البيع: ${details.saleValue > 0 ? details.saleValue.toLocaleString() + ' د.إ' : 'غير محدد — قدّر بناءً على التاريخ'}
الخدمات المطلوبة: ${details.services.join('، ')}
${pastPlansContext}
${benchmarkContext}

قائمة الموردين المتاحين:
${supplierLines}

مهمتك: اختر أفضل مورد لكل خدمة مطلوبة وقدّر التكلفة بناءً على التاريخ، ثم أجب بـ JSON مصفوفة فقط:
[{"supplierId":"...","supplierName":"...","serviceType":"...","quote":رقم,"notes":"ملاحظة اختيارية"}]

قواعد الاختيار:
- اختر مورداً واحداً لكل خدمة مطلوبة
- فضّل APPROVED/PREFERRED وأعلى تكرار
- إذا لم يوجد مورد مناسب لخدمة، تجاهلها
- التكلفة: استخدم معيار الأسعار من التاريخ كمرجع أساسي
- إذا كان سعر البيع محدداً، الإجمالي يجب ألا يتجاوز ${details.saleValue > 0 ? Math.round(details.saleValue * 0.75).toLocaleString() : 'حداً معقولاً'}
- أجب بمصفوفة JSON فقط بدون أي نص`,
    }],
  })

  let selected: Array<{ supplierId: string; supplierName: string; serviceType: string; quote: number; notes?: string }> = []
  try {
    const txt = selectionRes.content[0].type === 'text' ? selectionRes.content[0].text : ''
    const m = txt.match(/\[[\s\S]*\]/)
    if (m) selected = JSON.parse(m[0])
  } catch { /**/ }

  if (!selected || selected.length === 0) {
    return { error: 'تعذّر تحديد الموردين المناسبين. تأكد من وجود موردين في النظام للخدمات المطلوبة.' }
  }

  // Validate supplierId references exist
  const validIds = new Set(allSuppliers.map(s => s.id))
  const validItems = selected.filter(item => validIds.has(item.supplierId))
  if (validItems.length === 0) {
    return { error: 'الموردون المختارون غير موجودون في قاعدة البيانات. يرجى المحاولة مجدداً.' }
  }

  // ── Step 4: Build plan items ────────────────────────────────────────
  const items: PlanItem[] = validItems.map(item => ({
    id:          randomUUID(),
    supplierId:  item.supplierId,
    name:        item.supplierName,
    serviceType: item.serviceType,
    quote:       Number(item.quote) || 0,
    notes:       item.notes || undefined,
  }))

  const totalCost = items.reduce((s, i) => s + i.quote, 0)
  const margin    = details.saleValue > 0
    ? parseFloat(((details.saleValue - totalCost) / details.saleValue * 100).toFixed(1))
    : 0

  // ── Step 5: Save to DB (ProjectPlan) ──────────────────────────────────
  const now = new Date()
  const plan = await prisma.projectPlan.create({
    data: {
      id:        randomUUID(),
      name:      details.planName,
      saleValue: details.saleValue,
      items:     JSON.stringify(items),
      updatedAt: now,
    },
  })

  return {
    planId:    plan.id,
    planName:  details.planName,
    saleValue: details.saleValue,
    items,
    totalCost,
    margin,
    summary: [
      `✅ تم إنشاء خطة "${details.planName}" وحفظها في صفحة التخطيط`,
      `• ${items.length} مورد مختار`,
      `• إجمالي التكاليف: ${totalCost.toLocaleString()} د.إ`,
      details.saleValue > 0 ? `• سعر البيع: ${details.saleValue.toLocaleString()} د.إ` : null,
      details.saleValue > 0 ? `• هامش الربح: ${margin}%` : null,
    ].filter(Boolean).join('\n'),
  }
}
