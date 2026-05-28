import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { readFullSystemSnapshot } from '@/lib/agentic/tools/system_reader'
import { saveMessage, getRecentMessages } from '@/lib/agentic/memory'
import {
  employeeTaskManager,
  teamPerformanceMonitor,
  createSpecificTask,
  getEligibleUsers,
} from '@/lib/agentic/tools/employees'
import { createEventPlanFromMessage } from '@/lib/agentic/tools/planning'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Detect if the message is asking to assign / create tasks ─────────
function wantsToAssignTasks(msg: string): boolean {
  const lower = msg.toLowerCase()
  const keywords = [
    'اعطي', 'أعطي', 'اعطِ', 'أعطِ', 'اسند', 'أسند', 'وزع', 'وزّع',
    'انشئ مهمة', 'أنشئ مهمة', 'إنشاء مهمة', 'كون مهمة', 'كوّن مهمة',
    'إسناد مهمة', 'توزيع مهام', 'اضف مهمة', 'أضف مهمة',
    'assign task', 'create task', 'add task',
  ]
  return keywords.some(k => lower.includes(k))
}

// ── Detect if the message is asking to create an event plan ─────────
function wantsToPlan(msg: string): boolean {
  const lower = msg.toLowerCase()
  const keywords = [
    'خطط', 'تخطيط', 'اعمل خطة', 'أعمل خطة', 'انشئ خطة', 'أنشئ خطة', 'إنشاء خطة',
    'سوّي خطة', 'سوي خطة', 'جهز خطة', 'جهّز خطة', 'خطة للفعالية', 'خطة لـ',
    'خطط للفعالية', 'خطط لفعالية', 'خطط لي', 'خطة مشروع', 'خطة المشروع',
    'وزع الميزانية', 'اقترح موردين', 'اختر موردين', 'create plan', 'plan event',
    'اعمل لي خطة', 'أعطني خطة',
  ]
  return keywords.some(k => lower.includes(k))
}

// ── Detect if asking for performance report ───────────────────────────
function wantsPerformanceReport(msg: string): boolean {
  const lower = msg.toLowerCase()
  return ['أداء الفريق', 'اداء الفريق', 'تقرير الفريق', 'إنجاز الفريق', 'انجاز الفريق',
    'مهام الفريق اليوم', 'كم مهمة', 'team performance'].some(k => lower.includes(k))
}

// ── Use Claude-haiku to extract task details from the user message ────
async function extractTaskDetails(message: string, employeeNames: string[]): Promise<{
  title: string | null
  employeeName: string | null
  assignAll: boolean
}> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `من الرسالة التالية، استخرج معلومات المهمة وأجب بـ JSON فقط بدون أي نص آخر:
{"title":"عنوان المهمة أو null إذا لم تُذكر بوضوح","employeeName":"اسم موظف واحد محدد من القائمة أو null","assignAll":true/false}

قواعد مهمة:
- employeeName = null إلا إذا ذُكر اسم موظف واحد بوضوح تام في الرسالة
- إذا قال "الموظفين" أو "الكل" أو "الفريق" أو لم يذكر اسماً → employeeName = null و assignAll = true
- إذا ذكر اسمين أو أكثر → employeeName = null و assignAll = true
- assignAll = true تعني توزيع المهمة على جميع الموظفين

قائمة الموظفين المتاحين: ${employeeNames.join('، ')}

الرسالة: "${message}"`,
    }],
  })

  try {
    const txt = res.content[0].type === 'text' ? res.content[0].text : ''
    const m = txt.match(/\{[\s\S]*?\}/)
    if (m) return JSON.parse(m[0])
  } catch { /**/ }
  return { title: null, employeeName: null, assignAll: true }
}

// ── Parse request — supports JSON or multipart FormData ──────────────
async function parseRequest(req: NextRequest): Promise<{
  message:      string
  fileContent:  Anthropic.ImageBlockParam | Anthropic.Base64PDFSource | null
  fileName:     string | null
}> {
  const ct = req.headers.get('content-type') ?? ''

  if (ct.includes('multipart/form-data')) {
    const form     = await req.formData()
    const message  = (form.get('message') as string) ?? ''
    const file     = form.get('file') as File | null

    if (!file || file.size === 0) return { message, fileContent: null, fileName: null }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mime   = file.type

    // Image
    if (['image/jpeg','image/jpg','image/png','image/gif','image/webp'].includes(mime)) {
      return {
        message,
        fileName: file.name,
        fileContent: {
          type: 'image',
          source: { type: 'base64', media_type: mime as 'image/jpeg'|'image/png'|'image/gif'|'image/webp', data: base64 },
        } as Anthropic.ImageBlockParam,
      }
    }

    // PDF
    if (mime === 'application/pdf') {
      return {
        message,
        fileName: file.name,
        fileContent: {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as unknown as Anthropic.Base64PDFSource,
      }
    }

    // Text / CSV / JSON — embed as text in message
    if (mime.startsWith('text/') || mime === 'application/json' || mime === 'text/csv') {
      const text = buffer.toString('utf-8')
      return {
        message: `${message}\n\n[محتوى الملف: ${file.name}]\n\`\`\`\n${text.slice(0, 8000)}\n\`\`\``,
        fileName: file.name,
        fileContent: null,
      }
    }

    // Unsupported — inform user
    return {
      message: `${message}\n\n[تنبيه: نوع الملف "${file.name}" (${mime}) غير مدعوم مباشرةً. الأنواع المدعومة: صور، PDF، CSV، نص]`,
      fileName: file.name,
      fileContent: null,
    }
  }

  // Plain JSON
  const body = await req.json()
  return { message: body.message ?? '', fileContent: null, fileName: null }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { message, fileContent, fileName } = await parseRequest(req)
  const displayMessage = fileName ? `[📎 ${fileName}] ${message}` : message
  await saveMessage('user', displayMessage)

  // ── Pre-execute actions based on intent ──────────────────────────────
  let actionContext = ''

  if (wantsToPlan(message)) {
    try {
      const result = await createEventPlanFromMessage(message)
      if ('error' in result) {
        actionContext = `\n[نتيجة التنفيذ] ❌ ${result.error}`
      } else {
        actionContext = `\n[نتيجة التنفيذ] ${result.summary}\n\nتفاصيل الخطة المحفوظة:\n${result.items.map((item, i) =>
          `${i + 1}. ${item.name} — ${item.serviceType}: ${item.quote.toLocaleString()} د.إ${item.notes ? ` (${item.notes})` : ''}`
        ).join('\n')}\n\nيمكنك الآن فتح صفحة التخطيط لمراجعة الخطة وتعديلها إذا لزم.`
      }
    } catch (e: any) {
      console.error('[chat:createPlan]', e)
      actionContext = `\n[نتيجة التنفيذ] خطأ أثناء إنشاء الخطة: ${e.message}`
    }
  } else if (wantsToAssignTasks(message)) {
    try {
      const users = await getEligibleUsers()
      const employeeNames = users.map(u => u.name)
      const details = await extractTaskDetails(message, employeeNames)

      if (details.title) {
        // User specified a concrete task — create exactly that
        const result = await createSpecificTask({
          title:        details.title,
          employeeName: details.employeeName,
        })
        if (result.created > 0) {
          actionContext = `\n[نتيجة التنفيذ] ✅ تم إنشاء مهمة "${details.title}" وإسنادها إلى: ${result.names.join('، ')}`
        } else {
          actionContext = `\n[نتيجة التنفيذ] لم يُعثر على الموظف "${details.employeeName ?? ''}" أو لا يوجد موظفون مؤهلون.`
        }
      } else {
        // No specific task mentioned — fall back to auto-generated tasks
        const result = await employeeTaskManager()
        if (result.created > 0) {
          actionContext = `\n[نتيجة التنفيذ] ✅ تم إسناد ${result.created} مهمة للموظفين تلقائياً. (تخطي ${result.skipped})`
        } else if ((result.skipped ?? 0) > 0) {
          actionContext = `\n[نتيجة التنفيذ] تم تخطي جميع الموظفين — لديهم بالفعل 5 مهام أو أكثر اليوم.`
        } else {
          actionContext = `\n[نتيجة التنفيذ] لم يتم إنشاء مهام — ${result.reason ?? 'لا يوجد موظفون مؤهلون'}`
        }
      }
    } catch (e: any) {
      console.error('[chat:assignTasks]', e)
      actionContext = `\n[نتيجة التنفيذ] خطأ أثناء إنشاء المهام: ${e.message}`
    }
  } else if (wantsPerformanceReport(message)) {
    try {
      const reports = await teamPerformanceMonitor()
      actionContext = reports.length === 0
        ? `\n[نتيجة التنفيذ] لا يوجد موظفون.`
        : `\n[نتيجة التنفيذ] تقرير أداء الفريق اليوم:\n${reports.map(r => `${r.userName}: ${r.done} منجز / ${r.total} مهمة (${r.rate}%)`).join('\n')}`
    } catch (e: any) {
      actionContext = `\n[نتيجة التنفيذ] خطأ في جلب تقرير الأداء: ${e.message}`
    }
  }

  // ── Read full system snapshot ─────────────────────────────────────────
  const snap = await readFullSystemSnapshot().catch(() => null)

  const systemPrompt = snap
    ? `أنت وكيل ذكاء اصطناعي لنظام "سحاب للفعاليات والمعارض". لديك بيانات كاملة من جميع صفحات النظام.

═══════════════════════════════════════
📁 المشاريع — ${snap.projects.total} مشروع (خط الأنابيب/عروض: ${snap.projects.pipeline.toLocaleString()} د.إ)
حالات: ${Object.entries(snap.projects.byStatus).map(([s,c])=>`${s}:${c}`).join(' | ')}
${snap.projects.topByRevenue.slice(0, 10).map(p =>
  `  • ${p.name} (${p.clientName}) [${p.status}]: إيراد ${p.revenue.toLocaleString()} | تكلفة ${p.cost.toLocaleString()} | ربح ${p.profit.toLocaleString()} د.إ (${p.margin}%)${p.executionDate ? ` | تاريخ: ${p.executionDate}` : ''}`
).join('\n') || '  لا توجد مشاريع'}
${snap.projects.openIssues.length > 0 ? `⚠️ مشاكل مفتوحة (${snap.projects.openIssues.length}): ${snap.projects.openIssues.slice(0,5).map(i=>`${i.project}(${i.issueType})`).join('، ')}` : ''}

═══════════════════════════════════════
💰 المالية الكاملة:
  الإيرادات (بدون ضريبة): ${snap.financial.totalRevenue.toLocaleString()} د.إ
  التكاليف (بدون ضريبة):  ${snap.financial.totalCosts.toLocaleString()} د.إ
  صافي الربح:             ${snap.financial.netProfit.toLocaleString()} د.إ (${snap.financial.profitMargin}%)
  ضريبة محصّلة:           ${snap.financial.vatCollected.toLocaleString()} د.إ
  ضريبة مدفوعة:           ${snap.financial.vatPaid.toLocaleString()} د.إ
  صافي الضريبة:           ${snap.financial.netVat.toLocaleString()} د.إ

  الفواتير — إجمالي: ${snap.financial.totalInvoiced.toLocaleString()} | محصّل: ${snap.financial.totalCollected.toLocaleString()} | متبقي: ${snap.financial.totalBalance.toLocaleString()} د.إ
  حالات الفواتير: ${Object.entries(snap.financial.invoicesByStatus).map(([s,v])=>`${s}:${v.count}(${Math.round(v.amount).toLocaleString()})`).join(' | ')}
${snap.financial.overdueInvoices.length > 0 ? `  ⚠️ فواتير متأخرة: ${snap.financial.overdueInvoices.slice(0,5).map(i=>`${i.customer}(${i.balance.toLocaleString()}د.إ,${i.daysOverdue}يوم)`).join('، ')}` : '  ✅ لا توجد فواتير متأخرة'}

  الفواتير الشرائية — إجمالي: ${snap.financial.totalBilled.toLocaleString()} | مدفوع: ${snap.financial.totalBillsPaid.toLocaleString()} | غير مدفوع: ${snap.financial.totalBillsUnpaid.toLocaleString()} د.إ
${snap.financial.overdueBills.length > 0 ? `  ⚠️ فواتير موردين متأخرة: ${snap.financial.overdueBills.slice(0,5).map(b=>`${b.supplier}(${b.amount.toLocaleString()}د.إ,${b.daysOverdue}يوم)`).join('، ')}` : '  ✅ لا توجد فواتير موردين متأخرة'}

═══════════════════════════════════════
👥 العملاء — ${snap.clients.total} عميل:
${snap.clients.topClients.slice(0, 10).map(c =>
  `  • ${c.name}${c.phone ? ` 📞${c.phone}` : ''}${c.email ? ` ✉${c.email}` : ''}: فواتير ${c.invoiceTotal.toLocaleString()} | محصّل ${c.invoicePaid.toLocaleString()} | متبقي ${c.invoiceBalance.toLocaleString()} | ${c.projectCount} مشروع`
).join('\n') || '  لا يوجد عملاء'}

═══════════════════════════════════════
🏢 الموردون — ${snap.suppliers.total} مورد:
${snap.suppliers.list.slice(0, 10).map(s =>
  `  • ${s.name} [${s.serviceType}] (${s.recommendation})${s.openIssues > 0 ? ` ⚠️${s.openIssues}مشكلة` : ''}`
).join('\n') || '  لا يوجد موردون'}
${snap.suppliers.recentEvaluations.length > 0 ? `تقييمات حديثة: ${snap.suppliers.recentEvaluations.slice(0,4).map(e=>`${e.supplier}/${e.project}(${e.performance})`).join('، ')}` : ''}

═══════════════════════════════════════
📦 المخزون — ${snap.inventory.total} صنف:
${snap.inventory.lowStock.length > 0 ? `  ⚠️ نقص: ${snap.inventory.lowStock.map(i=>`${i.name}(${i.quantity}/${i.minQuantity})`).join('، ')}` : '  ✅ لا يوجد نقص'}
${snap.inventory.damaged.length > 0 ? `  ⚠️ تالف: ${snap.inventory.damaged.map(i=>i.name).join('، ')}` : ''}
  الفئات: ${Object.entries(snap.inventory.byCategory).map(([c,n])=>`${c}:${n}`).join(' | ')}

═══════════════════════════════════════
✅ المهام:
  اليوم: ${snap.tasks.todayTotal} (منجز: ${snap.tasks.todayDone} | معلق: ${snap.tasks.todayPending} | ${snap.tasks.completionRate}%)
${snap.tasks.perUser.map(u=>`  • ${u.name}: ${u.done} منجز / ${u.pending} معلق`).join('\n')}
${snap.tasks.recentHistory.length > 0 ? `  سجل آخر 7 أيام: ${snap.tasks.recentHistory.map(h=>`${h.date}(${h.done}/${h.total}=${h.rate}%)`).join(' | ')}` : ''}

═══════════════════════════════════════
👤 الفريق والموظفون:
  مستخدمو النظام: ${snap.team.usersCount} | مؤهلون للمهام: ${snap.team.eligibleForTasks.map(u=>u.name).join('، ') || 'لا يوجد'}
  الموظفون (${snap.team.employees.length}) — رواتب شهرية: ${snap.team.monthlySalaries.toLocaleString()} د.إ:
${snap.team.employees.map(e =>
  `  • ${e.name}: راتب ${e.salary.toLocaleString()} د.إ${e.residencyExpiry ? ` | إقامة تنتهي: ${e.residencyExpiry}(${e.daysUntilExpiry}يوم)` : ''}`
).join('\n') || '  لا يوجد موظفون'}
${snap.team.expiringResidencies.length > 0 ? `  ⚠️ إقامات تنتهي قريباً: ${snap.team.expiringResidencies.map(e=>`${e.name}(${e.daysLeft}يوم)`).join(', ')}` : ''}

═══════════════════════════════════════
💸 المصروفات والتكاليف الثابتة:
  التكلفة الشهرية الكاملة: ${snap.expenses.totalMonthlyOverhead.toLocaleString()} د.إ (رواتب ${snap.team.monthlySalaries.toLocaleString()} + مصاريف ${snap.expenses.monthlyEquivalent.toLocaleString()})
${snap.expenses.list.map(e =>
  `  • ${e.label}: ${e.amount.toLocaleString()} د.إ (${e.period}) = ${e.monthlyAmount.toLocaleString()} شهرياً${e.daysLeft !== null && e.daysLeft <= 90 ? ` ⚠️ تنتهي خلال ${e.daysLeft}يوم` : ''}`
).join('\n') || '  لا توجد مصاريف'}

═══════════════════════════════════════
🎪 الفعاليات القادمة (${snap.events.total}):
${snap.events.upcoming.slice(0,5).map(e=>`  • ${e.name} | ${e.client} | ${e.venue} | ${e.date}${e.openIssues>0?` ⚠️${e.openIssues}مشكلة`:''}`).join('\n') || '  لا توجد فعاليات قادمة'}

═══════════════════════════════════════
📋 التخطيط — ${snap.planning.total} خطة:
  إجمالي البيع: ${snap.planning.totalSaleValue.toLocaleString()} | التكاليف: ${snap.planning.totalCost.toLocaleString()} | الربح: ${snap.planning.totalProfit.toLocaleString()} د.إ | متوسط الهامش: ${snap.planning.avgMargin}%
${snap.planning.recentPlans.slice(0, 10).map(p =>
  `  • ${p.name}: بيع ${p.saleValue.toLocaleString()} | تكلفة ${p.totalCost.toLocaleString()} | ربح ${p.profit.toLocaleString()} د.إ (${p.margin}%) | ${p.suppliersCount} مورد`
).join('\n') || '  لا توجد خطط'}

═══════════════════════════════════════

أجب على أسئلة المدير بدقة تامة بناءً على هذه البيانات. لا تقل "البيانات غير متوفرة" — كل شيء موجود أعلاه. كن موجزاً وعملياً. الإجابة بالعربية.

عند رفع ملف:
- اقرأ محتواه بعناية وقدّم ملخصاً واضحاً
- حدّد نوع الوثيقة (فاتورة، عرض سعر، عقد، قائمة خدمات...)
- استخرج الأرقام المهمة: المبالغ، التواريخ، أسماء الأطراف
- اقترح الإجراء المناسب: "يمكنك تسجيل هذه الفاتورة في النظام" أو "يمكنني إنشاء مهام بناءً على هذا"
- إذا كان عرض سعر من مورد: قارنه بالموردين الموجودين في النظام واقترح ما إذا كان السعر معقولاً`
    : `أنت وكيل ذكاء اصطناعي لنظام سحاب. تعذّرت قراءة البيانات — أجب بشكل عام وأخبر المدير بالمشكلة.`

  // Build message history — append action result to the user message
  const history = await getRecentMessages(10)
  const fullText = actionContext ? `${message}\n${actionContext}` : message

  // Build user content — with optional file attachment
  type ContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  let userContent: ContentBlock[] | string = fullText

  if (fileContent) {
    const blocks: ContentBlock[] = []
    if ((fileContent as any).type === 'image') {
      blocks.push(fileContent as Anthropic.ImageBlockParam)
    } else {
      // PDF document block
      blocks.push(fileContent as any)
    }
    blocks.push({ type: 'text', text: fullText || (fileName ? `حلّل هذا الملف: ${fileName}` : 'حلّل هذا الملف') })
    userContent = blocks
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(0, -1).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userContent },
  ]

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text
          fullResponse += text
          controller.enqueue(encoder.encode(text))
        }
      }
      await saveMessage('assistant', fullResponse)
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  })
}
