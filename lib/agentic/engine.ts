import Anthropic from '@anthropic-ai/sdk'
import { financialLossDetector } from './tools/financial'
import { projectProfitGuard }    from './tools/projects'
import { employeeTaskManager, teamPerformanceMonitor } from './tools/employees'
import { emailAnalyzer }         from './tools/email'
import { readFullSystemSnapshot } from './tools/system_reader'
import { createAlert }           from './alerts'
import { saveAgentRun, getAgentConfig } from './memory'
import { prisma } from '@/lib/prisma'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tool definitions for Claude ─────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_full_system',
    description: 'يقرأ لقطة شاملة من جميع صفحات النظام: المشاريع، الموردين، الفواتير، العملاء، المخزون، المهام، الفريق، المصروفات، الفعاليات، التخطيط',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'check_financial_health',
    description: 'يحلل الوضع المالي لآخر 12 شهراً ويكشف الخسائر في الإيرادات والتكاليف',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'check_project_margins',
    description: 'يحسب هوامش ربح مشاريع السنة الأخيرة ويحدد المشاريع التي هامشها تحت 20%',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'manage_employee_tasks',
    description: 'يعيّن للفريق مهام تسويقية وترويجية يومية (سوشل ميديا، محتوى، تواصل عملاء، خطط ترويج) — تسويق وترويج الشركة فقط',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'monitor_team_performance',
    description: 'يراقب نسبة إنجاز المهام التسويقية لكل موظف ويرصد التأخر',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'analyze_emails',
    description: 'يحلل الإيميلات الواردة المتعلقة بالعملاء والرعاة ويصنفها حسب الأولوية',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'create_system_alert',
    description: 'ينشئ تنبيهاً في النظام',
    input_schema: {
      type: 'object' as const,
      properties: {
        type:      { type: 'string', enum: ['FINANCIAL_LOSS','LOW_MARGIN','DELAYED_TASKS','URGENT_EMAIL','SYSTEM'] },
        severity:  { type: 'string', enum: ['INFO','WARNING','DANGER','CRITICAL'] },
        title:     { type: 'string' },
        message:   { type: 'string' },
        projectId: { type: 'string' },
      },
      required: ['type','severity','title'],
    },
  },
]

// ── Execute tool ─────────────────────────────────────────────────────
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'read_full_system': {
        const snapshot = await readFullSystemSnapshot()
        // Auto-alerts from snapshot
        // Low stock
        for (const item of snapshot.inventory.lowStock) {
          await createAlert({
            type: 'SYSTEM', severity: 'WARNING',
            title: `مخزون منخفض: ${item.name}`,
            message: `الكمية الحالية ${item.quantity} ${item.unit} (الحد الأدنى: ${item.minQuantity})`,
          })
        }
        // Expiring residencies
        for (const emp of snapshot.team.expiringResidencies.filter(e => e.daysLeft <= 30)) {
          await createAlert({
            type: 'SYSTEM', severity: emp.daysLeft <= 7 ? 'CRITICAL' : 'DANGER',
            title: `إقامة توشك على الانتهاء: ${emp.name}`,
            message: `تنتهي في ${emp.expiryDate} (${emp.daysLeft} يوم متبقي)`,
          })
        }
        // Overdue bills
        for (const bill of snapshot.financial.overdueBills.filter(b => b.daysOverdue > 7)) {
          await createAlert({
            type: 'FINANCIAL_LOSS', severity: 'WARNING',
            title: `فاتورة متأخرة: ${bill.supplier}`,
            message: `${bill.amount.toLocaleString()} د.إ — متأخرة ${bill.daysOverdue} يوم`,
          })
        }
        return JSON.stringify(snapshot, null, 2)
      }
      case 'check_financial_health': {
        const data = await financialLossDetector()
        // Auto-create critical alerts for losses
        for (const loss of data.losses) {
          await createAlert({
            type: 'FINANCIAL_LOSS', severity: 'CRITICAL',
            title: `خسارة مالية: ${loss.projectName}`,
            message: `خسارة ${loss.amount.toLocaleString()} د.إ — ${loss.reason}`,
            projectId: loss.projectId,
          })
        }
        return JSON.stringify(data, null, 2)
      }
      case 'check_project_margins': {
        const data = await projectProfitGuard()
        for (const p of data.filter(x => x.severity !== 'HEALTHY')) {
          await createAlert({
            type: 'LOW_MARGIN',
            severity: p.severity as 'WARNING'|'DANGER'|'CRITICAL',
            title: `هامش منخفض: ${p.projectName} (${p.marginPercent.toFixed(1)}%)`,
            message: p.recommendation,
            projectId: p.projectId,
          })
        }
        return JSON.stringify(data, null, 2)
      }
      case 'manage_employee_tasks': {
        const result = await employeeTaskManager()
        return JSON.stringify(result)
      }
      case 'monitor_team_performance': {
        const data = await teamPerformanceMonitor()
        const lagging = data.filter(e => e.pending > 3)
        for (const emp of lagging) {
          await createAlert({
            type: 'DELAYED_TASKS', severity: 'WARNING',
            title: `مهام متأخرة: ${emp.userName}`,
            message: `${emp.pending} مهمة متأخرة من أصل ${emp.total}`,
          })
        }
        return JSON.stringify(data)
      }
      case 'analyze_emails': {
        const data = await emailAnalyzer()
        return JSON.stringify(data)
      }
      case 'create_system_alert': {
        await createAlert({
          type:      (input.type as 'FINANCIAL_LOSS'|'LOW_MARGIN'|'DELAYED_TASKS'|'URGENT_EMAIL'|'SYSTEM'),
          severity:  (input.severity as 'INFO'|'WARNING'|'DANGER'|'CRITICAL'),
          title:     input.title as string,
          message:   input.message as string | undefined,
          projectId: input.projectId as string | undefined,
        })
        return 'تم إنشاء التنبيه'
      }
      default:
        return `أداة غير معروفة: ${name}`
    }
  } catch (e: unknown) {
    return `خطأ: ${e instanceof Error ? e.message : String(e)}`
  }
}

// ── Main agent cycle ─────────────────────────────────────────────────
export async function runAgentCycle() {
  const config = await getAgentConfig()
  if (!config.is_active) return { skipped: true, reason: 'Agent is disabled' }

  const actions: Array<{ tool: string; result: string }> = []

  // ── Step 1: Read full system snapshot first ───────────────────────────
  let snapshot: Awaited<ReturnType<typeof readFullSystemSnapshot>> | null = null
  try {
    snapshot = await readFullSystemSnapshot()
    // Auto-alerts from snapshot
    for (const item of snapshot.inventory.lowStock) {
      await createAlert({ type: 'SYSTEM', severity: 'WARNING',
        title: `مخزون منخفض: ${item.name}`,
        message: `الكمية ${item.quantity} ${item.unit} (الحد الأدنى: ${item.minQuantity})` })
    }
    for (const emp of snapshot.team.expiringResidencies.filter(e => e.daysLeft <= 30)) {
      await createAlert({ type: 'SYSTEM',
        severity: emp.daysLeft <= 7 ? 'CRITICAL' : 'DANGER',
        title: `إقامة توشك على الانتهاء: ${emp.name}`,
        message: `تنتهي ${emp.expiryDate} — ${emp.daysLeft} يوم متبقي` })
    }
    for (const bill of snapshot.financial.overdueBills.filter(b => b.daysOverdue > 7)) {
      await createAlert({ type: 'FINANCIAL_LOSS', severity: 'WARNING',
        title: `فاتورة متأخرة: ${bill.supplier}`,
        message: `${bill.amount.toLocaleString()} د.إ — متأخرة ${bill.daysOverdue} يوم` })
    }
    actions.push({ tool: 'read_full_system', result: `قرأ ${snapshot.projects.total} مشروع، ${snapshot.clients.total} عميل، ${snapshot.inventory.total} صنف مخزون، ${snapshot.events.total} فعالية` })
  } catch (err) {
    console.error('[agent] snapshot error:', err)
  }

  // ── Perception summary ────────────────────────────────────────────────
  const perception = snapshot
    ? [
        `المشاريع: ${snapshot.projects.total} (آخر سنة)`,
        `الإيرادات: ${snapshot.financial.totalRevenue.toLocaleString()} د.إ`,
        `التكاليف: ${snapshot.financial.totalCosts.toLocaleString()} د.إ`,
        `صافي الربح: ${snapshot.financial.netProfit.toLocaleString()} د.إ (${snapshot.financial.profitMargin}%)`,
        `فواتير غير مدفوعة: ${snapshot.financial.invoicesByStatus?.UNPAID?.count ?? 0} (متبقي: ${snapshot.financial.totalBalance?.toLocaleString() ?? 0} د.إ)`,
        `فواتير موردين متأخرة: ${snapshot.financial.overdueBills.length}`,
        `المخزون المنخفض: ${snapshot.inventory.lowStock.length} صنف`,
        `مهام اليوم: ${snapshot.tasks.todayTotal} (منجز: ${snapshot.tasks.todayDone} / معلق: ${snapshot.tasks.todayPending})`,
        `الفعاليات القادمة: ${snapshot.events.upcoming.length}`,
        `تنبيهات مفتوحة: ${(await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM agent_alerts WHERE acknowledged_at IS NULL`.catch(() => [{ count: BigInt(0) }]))[0]?.count ?? 0}`,
      ].join(' | ')
    : `تعذّرت قراءة النظام`

  const systemPrompt = `أنت وكيل ذكاء اصطناعي مستقل لنظام "سحاب للفعاليات والمعارض".
تعمل تلقائياً مرة يومياً. لقد قرأت للتو لقطة كاملة من جميع صفحات النظام.

نطاق تحليلك: آخر 12 شهراً ميلادياً فقط.

لقطة النظام الحالية:
${perception}

${snapshot ? `تفاصيل إضافية:
- مشاريع مفتوحة بمشاكل: ${snapshot.projects.openIssues.length}
- موردون: ${snapshot.suppliers.total} (${Object.entries(snapshot.suppliers.byRecommendation).map(([k,v])=>`${k}: ${v}`).join(', ')})
- عناصر مخزون تالفة: ${snapshot.inventory.damaged.length}
- الموظفون المؤهلون للمهام (${snapshot.team.eligibleForTasks.length}): ${snapshot.team.eligibleForTasks.map((u: {name: string}) => u.name).join('، ') || 'لا يوجد'}
- إقامات تنتهي قريباً: ${snapshot.team.expiringResidencies.length}
- مصروفات شهرية: ${snapshot.expenses.monthly.toLocaleString()} د.إ
` : ''}

مهامك بالترتيب:
1. راقب الوضع المالي → أي خسارة → تنبيه CRITICAL فوري
2. تحقق من هوامش المشاريع → تحت 20% → تنبيه + توصية
3. عيّن للفريق مهام تسويقية وترويجية يومية (سوشل ميديا، محتوى، عملاء، رعاة، خطط ترويج) — التسويق فقط لا مهام تشغيلية
4. راقب إنجاز الفريق → تأخر → نبّه المدير

نفّذ الأدوات اللازمة فقط ثم أنهِ دورتك.`

  const userMessage = `ابدأ دورة المراقبة. الملخص: ${perception}`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }]
  let reasoning = ''
  let loopCount = 0

  // Agentic loop — max 8 tool calls per cycle (snapshot already counted)
  while (loopCount < 8) {
    loopCount++
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 1024,
      system:     systemPrompt,
      tools:      TOOLS,
      messages,
    })

    reasoning += response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join(' ') + ' '

    if (response.stop_reason === 'end_turn') break

    const toolUses = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    if (toolUses.length === 0) break

    // Add assistant message
    messages.push({ role: 'assistant', content: response.content })

    // Execute tools
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input as Record<string, unknown>)
      actions.push({ tool: tu.name, result: result.slice(0, 200) })
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  await saveAgentRun({
    perception,
    reasoning: reasoning.trim().slice(0, 1000),
    actions,
    outcome: `اكتملت الدورة — ${actions.length} أدوات نُفِّذت`,
  })

  return { success: true, actionsCount: actions.length, perception }
}
