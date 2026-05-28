// @ts-nocheck
/**
 * employees.ts — Professional task engine for Sahab team
 *
 * Task Priority Order:
 *  1. INVOICE_FOLLOWUP  — collect overdue / unpaid invoices (revenue in hand)
 *  2. CLIENT_RENEWAL    — re-engage past clients before they go to competitors
 *  3. NEW_LEADS         — professional BD: venues, corporates, govt, agencies
 *  4. CONTENT_MARKETING — professional content: case studies, LinkedIn, newsletter
 *
 * Each eligible team member receives up to 7 tasks per day.
 */

import { prisma } from '@/lib/prisma'

function todayUAE(): string {
  return new Date(Date.now() + 4 * 3600000).toISOString().split('T')[0]
}

const COMPANY = 'سحاب للفعاليات والمعارض'
const DAILY_TARGET = 7   // tasks per employee per day

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 1 — Invoice Follow-up (تحصيل الفواتير)
// ─────────────────────────────────────────────────────────────────────────────
function makeInvoiceCallTask(clientName: string, balance: number, invoiceNumber: string, daysOverdue: number): string {
  const urgency = daysOverdue > 60 ? '🔴 عاجل جداً' : daysOverdue > 30 ? '🟠 عاجل' : '🟡 متابعة'
  return `${urgency} — اتصل بـ "${clientName}" اليوم ومتابعة تسديد الفاتورة رقم ${invoiceNumber} بمبلغ ${Math.round(balance).toLocaleString()} د.إ (متأخرة ${daysOverdue} يوم) — سجّل نتيجة المكالمة وموعد الدفع المتفق عليه`
}

function makeInvoiceEmailTask(clientName: string, balance: number, invoiceNumber: string): string {
  return `أرسل بريداً رسمياً لـ "${clientName}" بشأن الرصيد المستحق ${Math.round(balance).toLocaleString()} د.إ (فاتورة ${invoiceNumber}) — اذكر الجدول الزمني للسداد وعرض تسهيلات إذا لزم`
}

function makeInvoiceWhatsAppTask(clientName: string, balance: number, invoiceNumber: string): string {
  return `أرسل رسالة واتساب مهذّبة لـ "${clientName}" بخصوص الفاتورة ${invoiceNumber} بمبلغ ${Math.round(balance).toLocaleString()} د.إ — ذكّرهم بموعد السداد وأكد استعدادك للتسهيل`
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 2 — Past Client Re-engagement (تجديد العلاقات)
// ─────────────────────────────────────────────────────────────────────────────
function makeClientRenewalCall(clientName: string, lastProject: string): string {
  return `اتصل بـ "${clientName}" لتجديد العلاقة — تذكّرهم بنجاح "${lastProject}" واستفسر عن فعالياتهم القادمة هذا الموسم، سجّل ملاحظاتهم وأي فرصة محتملة`
}

function makeClientCheckIn(clientName: string): string {
  return `أرسل رسالة واتساب أو بريداً شخصياً لـ "${clientName}" — اسأل عن احتياجاتهم القادمة وقدّم عرضاً مبدئياً لأي فعالية يخططون لها`
}

function makeProposalFollowUp(clientName: string, projectName: string): string {
  return `تابع مع "${clientName}" بشأن عرض السعر المقدَّم لـ "${projectName}" — استفسر عن قرارهم وقدّم أي تعديلات مطلوبة لإتمام الصفقة`
}

function makeReferralOutreach(clientName: string, lastProject: string): string {
  return `اتصل بـ "${clientName}" واطلب منهم إحالة شركاء أعمال أو معارف يحتاجون تنظيم فعاليات — ذكّرهم بنجاح "${lastProject}" كمرجع`
}

function makeUpsellCall(clientName: string, lastProject: string): string {
  return `اتصل بـ "${clientName}" وعرّفهم بخدمات ${COMPANY} الجديدة — يمكن توسعة "${lastProject}" أو تنظيم فعالية موازية بتكلفة أقل كعميل قديم`
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 3 — New Leads (اكتساب عملاء جدد)
// ─────────────────────────────────────────────────────────────────────────────
const VENUE_TYPES = ['فنادق', 'قاعات مؤتمرات', 'مراكز تسوق', 'منتجعات', 'مراكز أعمال', 'مراكز مجتمعية']
const UAE_AREAS   = ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين']
const CORP_SECTORS = [
  'شركات العقارات والتطوير العمراني',
  'البنوك والمؤسسات المالية',
  'شركات الاتصالات والتقنية',
  'شركات الرعاية الصحية والأدوية',
  'تجمعات الشركات التجارية والاتحادات',
  'شركات الاستشارات والتدريب',
  'مجموعات الفنادق والضيافة',
  'شركات السيارات الفاخرة',
]
const GOVT_ENTITIES = [
  'دوائر حكومية وهيئات اتحادية',
  'بلديات الإمارات',
  'غرف التجارة والصناعة',
  'مكاتب السياحة الإماراتية',
  'صناديق الاستثمار الحكومية',
]

function makeVenueOutreach(): string {
  const vt   = VENUE_TYPES[Math.floor(Math.random() * VENUE_TYPES.length)]
  const area = UAE_AREAS[Math.floor(Math.random() * UAE_AREAS.length)]
  return `اتصل بـ 3 مدراء فعاليات في ${vt} بمنطقة ${area} — عرّف بـ ${COMPANY} وخدماتها، واسأل عن فعالياتهم القادمة التي تحتاج موردين للتجهيزات الصوتية والبصرية والديكور`
}

function makeCorporateOutreach(): string {
  const sector = CORP_SECTORS[Math.floor(Math.random() * CORP_SECTORS.length)]
  return `اجمع قائمة بـ 5 شركات من قطاع "${sector}" في الإمارات وتواصل مع مدير التسويق أو HR — قدّم خدمات ${COMPANY} لفعالياتهم السنوية والمؤتمرات الداخلية والاحتفالات`
}

function makeGovernmentTender(): string {
  const entity = GOVT_ENTITIES[Math.floor(Math.random() * GOVT_ENTITIES.length)]
  return `ابحث عن مناقصات الفعاليات المفتوحة في ${entity} عبر بوابة المشتريات الحكومية وأعدّ ملف تأهيل ${COMPANY} للتقديم`
}

function makeAgencyPartnership(): string {
  return `تواصل مع 3 وكالات إعلانية أو PR في الإمارات واقترح شراكة — نحن ننفذ الفعاليات، هم يجلبون العملاء. حدد الشروط وأرسل بريداً رسمياً بملف الشركة`
}

function makeLinkedInProspecting(): string {
  return `ابحث على LinkedIn عن مدراء فعاليات وتسويق في الإمارات وتواصل مع 10 منهم بطلب اتصال مهني مع رسالة قصيرة تعريفية عن ${COMPANY} وخبراتها`
}

function makeExhibitionPresence(): string {
  const events = [
    'فعاليات ومعارض الأعمال في دبي وورلد ترايد سنتر',
    'معارض قطاعية وتجارية في أبوظبي ناشيونال إكزيبيشن سنتر',
    'فعاليات غرف التجارة في الإمارات',
  ]
  return `ابحث عن ${events[Math.floor(Math.random() * events.length)]} خلال الشهرين القادمين وسجّل ${COMPANY} كمشارك أو راعٍ — فرصة تشبيك مهني مباشر مع صناع القرار`
}

function makeDirectCall(): string {
  const area = UAE_AREAS[Math.floor(Math.random() * UAE_AREAS.length)]
  const sector = CORP_SECTORS[Math.floor(Math.random() * CORP_SECTORS.length)]
  return `أجرِ 5 مكالمات باردة (Cold Calls) اليوم لشركات من قطاع ${sector} في ${area} — قدّم ${COMPANY} وسجّل ردود الفعل وأي اهتمام للمتابعة`
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 4 — Professional Content Marketing
// ─────────────────────────────────────────────────────────────────────────────
function makeCaseStudy(project: string, client: string): string {
  return `أعدّ Case Study احترافياً لمشروع "${project}" مع ${client} — وثّق التحديات والحلول والنتائج، وانشره على الموقع وLinkedIn الشركة كمرجع يجذب عملاء جدد`
}

function makeNewsletterTask(recentProject: string): string {
  return `أعدّ وأرسل Newsletter شهرية لقائمة عملاء ${COMPANY} السابقين — أبرز مشروع "${recentProject}" مع عروض الموسم القادم وحالات نجاح`
}

function makeLinkedInPost(project: string, client: string): string {
  return `انشر على LinkedIn صفحة ${COMPANY} عن مشروع "${project}" مع ${client} — أبرز الخبرة التقنية والتنفيذية بأسلوب B2B محترف يستهدف صناع القرار`
}

function makeTestimonialRequest(clientName: string, project: string): string {
  return `تواصل مع "${clientName}" واطلب شهادة رسمية أو تقييماً مكتوباً عن "${project}" — الهدف نشره كـ Testimonial على الموقع وLinkedIn ويُرفق في ملف الشركة للعملاء الجدد`
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

interface PoolTask {
  title:    string
  category: string
  priority: 'HIGH' | 'MEDIUM'
}

/** Generate a fresh BD task on demand (used when pool runs out) */
function generateBdTask(): PoolTask {
  const fns = [makeVenueOutreach, makeCorporateOutreach, makeGovernmentTender, makeAgencyPartnership, makeLinkedInProspecting, makeExhibitionPresence, makeDirectCall]
  return {
    title:    fns[Math.floor(Math.random() * fns.length)](),
    category: 'اكتساب عملاء جدد وتطوير الأعمال',
    priority: 'MEDIUM',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: Build priority-ordered task pool → assign 7 tasks per employee
// ─────────────────────────────────────────────────────────────────────────────
export async function employeeTaskManager() {
  const today          = todayUAE()
  const oneYearAgo     = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  // ── Parallel DB fetch ──────────────────────────────────────────────────
  const [users, overdueInvoices, pendingInvoices, completedProjects, quoteProjects] = await Promise.all([
    // Eligible team members (exclude admin & infosahab)
    prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        NOT: [
          { email: { contains: 'infosahab', mode: 'insensitive' } },
          { name:  { contains: 'infosahab', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    }),

    // Overdue invoices (>30 days)
    prisma.invoice.findMany({
      where: {
        status:  { in: ['UNPAID', 'PARTIAL'] },
        balance: { gt: 0 },
        dueDate: { lt: new Date(Date.now() - 30 * 86400000) },
      },
      orderBy: { balance: 'desc' },
      take: 20,
    }),

    // Pending invoices (0–30 days overdue or no due date)
    prisma.invoice.findMany({
      where: {
        status:  { in: ['UNPAID', 'PARTIAL'] },
        balance: { gt: 0 },
        OR: [
          { dueDate: { gte: new Date(Date.now() - 30 * 86400000) } },
          { dueDate: null },
        ],
      },
      orderBy: { balance: 'desc' },
      take: 15,
    }),

    // Past clients (completed/in-progress/confirmed projects in last year)
    prisma.project.findMany({
      where: {
        status:    { in: ['COMPLETED', 'IN_PROGRESS', 'CONFIRMED'] },
        createdAt: { gte: oneYearAgo },
      },
      select: { id: true, name: true, clientName: true, status: true, value: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),

    // Quotes pending (close the deal)
    prisma.project.findMany({
      where: {
        status:    'QUOTE',
        createdAt: { gte: threeMonthsAgo },
      },
      select: { name: true, clientName: true, value: true },
      orderBy: { value: 'desc' },
      take: 15,
    }),
  ])

  if (users.length === 0) return { created: 0, skipped: 0, reason: 'no eligible users' }

  // ── Build priority task pool ──────────────────────────────────────────
  const p1: PoolTask[] = []   // Invoice follow-up  (highest)
  const p2: PoolTask[] = []   // Client renewal
  const p3: PoolTask[] = []   // New leads / BD
  const p4: PoolTask[] = []   // Content marketing

  // P1 — Overdue invoices (call + email + whatsapp)
  for (const inv of overdueInvoices) {
    const days = inv.dueDate
      ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
      : 45
    p1.push({ title: makeInvoiceCallTask(inv.customerName, inv.balance, inv.invoiceNumber, days), category: 'متابعة الفواتير وتحصيل المستحقات', priority: 'HIGH' })
    p1.push({ title: makeInvoiceWhatsAppTask(inv.customerName, inv.balance, inv.invoiceNumber), category: 'متابعة الفواتير وتحصيل المستحقات', priority: 'HIGH' })
    if (inv.balance > 5000) {
      p1.push({ title: makeInvoiceEmailTask(inv.customerName, inv.balance, inv.invoiceNumber), category: 'متابعة الفواتير وتحصيل المستحقات', priority: 'HIGH' })
    }
  }

  // P1 — Pending invoices (email + whatsapp)
  for (const inv of pendingInvoices.slice(0, 8)) {
    p1.push({ title: makeInvoiceEmailTask(inv.customerName, inv.balance, inv.invoiceNumber), category: 'متابعة الفواتير وتحصيل المستحقات', priority: 'HIGH' })
    p1.push({ title: makeInvoiceWhatsAppTask(inv.customerName, inv.balance, inv.invoiceNumber), category: 'متابعة الفواتير وتحصيل المستحقات', priority: 'HIGH' })
  }

  // P2 — Past client renewal (renewal call + check-in + upsell + referral)
  const uniqueClients = [...new Map(completedProjects.map(p => [p.clientName, p])).values()]
  for (const proj of uniqueClients.slice(0, 15)) {
    p2.push({ title: makeClientRenewalCall(proj.clientName, proj.name), category: 'تجديد علاقات العملاء وإغلاق الصفقات', priority: 'HIGH' })
    p2.push({ title: makeClientCheckIn(proj.clientName), category: 'تجديد علاقات العملاء وإغلاق الصفقات', priority: 'HIGH' })
    p2.push({ title: makeReferralOutreach(proj.clientName, proj.name), category: 'تجديد علاقات العملاء وإغلاق الصفقات', priority: 'HIGH' })
    p2.push({ title: makeUpsellCall(proj.clientName, proj.name), category: 'تجديد علاقات العملاء وإغلاق الصفقات', priority: 'HIGH' })
  }

  // P2 — Quote follow-up (close the deal)
  for (const q of quoteProjects.slice(0, 10)) {
    p2.push({ title: makeProposalFollowUp(q.clientName, q.name), category: 'تجديد علاقات العملاء وإغلاق الصفقات', priority: 'HIGH' })
    p2.push({ title: makeClientCheckIn(q.clientName), category: 'تجديد علاقات العملاء وإغلاق الصفقات', priority: 'HIGH' })
  }

  // P3 — New lead acquisition
  // Generate enough to cover the team (users × 3 tasks each minimum)
  const p3Target = Math.max(users.length * 3, 40)
  const bdFns = [makeVenueOutreach, makeCorporateOutreach, makeGovernmentTender, makeAgencyPartnership, makeLinkedInProspecting, makeExhibitionPresence, makeDirectCall]
  for (let i = 0; i < p3Target; i++) {
    p3.push({ title: bdFns[i % bdFns.length](), category: 'اكتساب عملاء جدد وتطوير الأعمال', priority: 'MEDIUM' })
  }

  // P4 — Content & credibility
  for (const proj of completedProjects.slice(0, 8)) {
    p4.push({ title: makeCaseStudy(proj.name, proj.clientName), category: 'تسويق احترافي وبناء المصداقية', priority: 'MEDIUM' })
    p4.push({ title: makeTestimonialRequest(proj.clientName, proj.name), category: 'تسويق احترافي وبناء المصداقية', priority: 'MEDIUM' })
    p4.push({ title: makeLinkedInPost(proj.name, proj.clientName), category: 'تسويق احترافي وبناء المصداقية', priority: 'MEDIUM' })
  }
  if (completedProjects.length > 0) {
    p4.push({ title: makeNewsletterTask(completedProjects[0].name), category: 'تسويق احترافي وبناء المصداقية', priority: 'MEDIUM' })
  }

  // Shuffle within each tier for variety
  shuffle(p1); shuffle(p2); shuffle(p3); shuffle(p4)

  // Full pool: P1 → P2 → P3 → P4
  const taskPool: PoolTask[] = [...p1, ...p2, ...p3, ...p4]

  // ── Assign up to DAILY_TARGET tasks per user ──────────────────────────
  let created = 0, skipped = 0
  let poolIdx = 0

  for (const user of users) {
    const openCount = await prisma.task.count({
      where: { assignedToId: user.id, status: 'PENDING', taskDate: today },
    })
    const needed = Math.max(0, DAILY_TARGET - openCount)
    if (needed === 0) { skipped++; continue }

    for (let j = 0; j < needed; j++) {
      // Get next task — generate fresh BD task if pool exhausted
      const task: PoolTask = poolIdx < taskPool.length
        ? taskPool[poolIdx]
        : generateBdTask()
      poolIdx++

      await prisma.task.create({
        data: {
          title:        task.title,
          status:       'PENDING',
          priority:     task.priority,
          taskDate:     today,
          assignedToId: user.id,
          createdById:  user.id,
          description:  `[${task.category}] — مهمة مولّدة بواسطة الوكيل الذكي بناءً على بيانات النظام الحالية`,
          notes:        task.category,
        },
      })
      created++
    }
  }

  return { created, skipped }
}

// ── Create a specific task for one or all employees ──────────────────────────
export async function createSpecificTask(params: {
  title:         string
  description?:  string
  employeeName?: string | null
}) {
  const today    = todayUAE()
  const baseWhere = {
    role: { not: 'ADMIN' as const },
    NOT: [
      { email: { contains: 'infosahab', mode: 'insensitive' as const } },
      { name:  { contains: 'infosahab', mode: 'insensitive' as const } },
    ],
  }

  const users = params.employeeName
    ? await prisma.user.findMany({
        where: { ...baseWhere, name: { contains: params.employeeName, mode: 'insensitive' } },
        select: { id: true, name: true },
      })
    : await prisma.user.findMany({ where: baseWhere, select: { id: true, name: true } })

  if (users.length === 0) return { created: 0, names: [] as string[] }

  const names: string[] = []
  for (const user of users) {
    await prisma.task.create({
      data: {
        title:        params.title,
        description:  params.description ?? 'مهمة مُسندة بواسطة الوكيل الذكي',
        status:       'PENDING',
        taskDate:     today,
        assignedToId: user.id,
        createdById:  user.id,
      },
    })
    names.push(user.name)
  }
  return { created: names.length, names }
}

// ── Get all eligible employees ───────────────────────────────────────────────
export async function getEligibleUsers() {
  return prisma.user.findMany({
    where: {
      role: { not: 'ADMIN' },
      NOT: [
        { email: { contains: 'infosahab', mode: 'insensitive' } },
        { name:  { contains: 'infosahab', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  })
}

// ── Team performance monitor ─────────────────────────────────────────────────
export async function teamPerformanceMonitor() {
  const today = todayUAE()
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'ADMIN' },
      NOT: [
        { email: { contains: 'infosahab', mode: 'insensitive' } },
        { name:  { contains: 'infosahab', mode: 'insensitive' } },
      ],
    },
  })

  const reports = []
  for (const user of users) {
    const total   = await prisma.task.count({ where: { assignedToId: user.id, taskDate: today } })
    const done    = await prisma.task.count({ where: { assignedToId: user.id, taskDate: today, status: 'DONE' } })
    const pending = total - done
    reports.push({
      userId:   user.id,
      userName: user.name,
      total, done, pending,
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
    })
  }
  return reports
}
