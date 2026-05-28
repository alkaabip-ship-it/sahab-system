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
  // ── Step 1: Extract event details from user message ────────────────────
  const extractRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `من رسالة مدير شركة فعاليات، استخرج تفاصيل الفعالية المطلوبة وأجب بـ JSON فقط بدون أي نص آخر:
{
  "planName": "اسم وصفي قصير للفعالية",
  "saleValue": سعر_البيع_الإجمالي_كرقم_أو_0,
  "services": ["الخدمات المطلوبة بالعربي مثل: صوتيات، إضاءة، شاشات، كراسي، خيمة، طعام، تصوير، تصميم، طباعة، أمن، نقل، إلخ"]
}

قواعد:
- إذا ذُكر سعر بيع أو ميزانية → استخدمه في saleValue
- إذا لم يُذكر سعر → saleValue = 0
- استنتج الخدمات من نوع الفعالية (مؤتمر، زفاف، معرض، حفلة...) وما ذُكر صراحةً

الرسالة: "${userMessage}"`,
    }],
  })

  let details: { planName: string; saleValue: number; services: string[] } | null = null
  try {
    const txt = extractRes.content[0].type === 'text' ? extractRes.content[0].text : ''
    const m = txt.match(/\{[\s\S]*?\}/)
    if (m) details = JSON.parse(m[0])
  } catch { /**/ }

  if (!details || !details.planName) {
    return { error: 'تعذّر استخراج تفاصيل الفعالية من رسالتك. يرجى ذكر نوع الفعالية والخدمات المطلوبة.' }
  }

  // ── Step 2: Fetch active suppliers from DB ────────────────────────────
  const allSuppliers = await prisma.supplier.findMany({
    where:   { recommendation: { not: 'SUSPENDED' } },
    include: {
      bills:        { select: { amount: true } },
      supplierEvals: { select: { performance: true, repeatBusiness: true }, orderBy: { createdAt: 'desc' }, take: 3 },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (allSuppliers.length === 0) {
    return { error: 'لا يوجد موردون نشطون في النظام.' }
  }

  const supplierLines = allSuppliers.map(s => {
    const avgBill = s.bills.length > 0
      ? Math.round(s.bills.reduce((sum, b) => sum + b.amount, 0) / s.bills.length)
      : 0
    const rating  = s.recommendation
    const repeat  = s.supplierEvals.filter(e => e.repeatBusiness).length
    return `ID:${s.id}|${s.name}|${s.serviceType}|تقييم:${rating}|متوسط_فاتورة:${avgBill.toLocaleString()}|تكرار:${repeat}`
  }).join('\n')

  // ── Step 3: Let Claude pick best supplier per service + estimate cost ──
  const selectionRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `أنت مخطط فعاليات محترف لشركة سحاب بالإمارات.

الفعالية: ${details.planName}
سعر البيع الإجمالي: ${details.saleValue > 0 ? details.saleValue.toLocaleString() + ' د.إ' : 'غير محدد — قدّر تكلفة معقولة'}
الخدمات المطلوبة: ${details.services.join('، ')}

قائمة الموردين المتاحين:
${supplierLines}

مهمتك: اختر أفضل مورد لكل خدمة مطلوبة وقدّر التكلفة، ثم أجب بـ JSON مصفوفة فقط:
[
  {
    "supplierId": "معرّف المورد من القائمة",
    "supplierName": "اسم المورد",
    "serviceType": "نوع الخدمة",
    "quote": تكلفة_كرقم,
    "notes": "ملاحظة اختيارية"
  }
]

قواعد الاختيار:
- اختر مورداً واحداً لكل خدمة مطلوبة
- فضّل الموردين بتقييم APPROVED أو PREFERRED وبأعلى تكرار
- إذا لم يوجد مورد يطابق الخدمة تماماً، اختر الأقرب
- إذا لم يوجد مورد مناسب أبداً لخدمة ما، تجاهل تلك الخدمة
- التكلفة: استند إلى متوسط فواتير المورد كمرجع
- إذا كان سعر البيع محدداً، التكاليف الإجمالية يجب ألا تتجاوز ${details.saleValue > 0 ? Math.round(details.saleValue * 0.75).toLocaleString() : 'حد معقول'}
- أجب بمصفوفة JSON فقط بدون أي نص قبلها أو بعدها`,
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
