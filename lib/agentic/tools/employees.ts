// @ts-nocheck
/**
 * employees.ts — Professional task engine for Sahab team
 *
 * Task Priority Order:
 *  1. INVOICE_FOLLOWUP  — collect overdue / unpaid invoices (revenue in hand)
 *  2. CLIENT_RENEWAL    — re-engage past clients before they go to competitors
 *  3. NEW_LEADS         — professional BD: venues, corporates, govt, agencies
 *  4. CONTENT_MARKETING — professional content: case studies, LinkedIn, newsletter
 */

import { prisma } from '@/lib/prisma'

function todayUAE(): string {
  return new Date(Date.now() + 4 * 3600000).toISOString().split('T')[0]
}

const COMPANY = 'سحاب للفعاليات والمعارض'

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 1 — Invoice Follow-up (تحصيل الفواتير)
// Real unpaid invoices → call/email client to collect
// ─────────────────────────────────────────────────────────────────────────────
function makeInvoiceCallTask(clientName: string, balance: number, invoiceNumber: string, daysOverdue: number): string {
  const urgency = daysOverdue > 60 ? '🔴 عاجل جداً' : daysOverdue > 30 ? '🟠 عاجل' : '🟡 متابعة'
  return `${urgency} — اتصل بـ "${clientName}" اليوم ومتابعة تسديد الفاتورة رقم ${invoiceNumber} بمبلغ ${Math.round(balance).toLocaleString()} د.إ (متأخرة ${daysOverdue} يوم) — سجّل نتيجة المكالمة وموعد الدفع المتفق عليه`
}

function makeInvoiceEmailTask(clientName: string, balance: number, invoiceNumber: string): string {
  return `أرسل بريداً رسمياً لـ "${clientName}" بشأن الرصيد المستحق ${Math.round(balance).toLocaleString()} د.إ (فاتورة ${invoiceNumber}) — اذكر الجدول الزمني للسداد وعرض تسهيلات إذا لزم`
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 2 — Past Client Re-engagement (تجديد العلاقات)
// Clients with completed projects → renew relationship before they forget us
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

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 3 — New Leads (اكتساب عملاء جدد)
// Professional BD methods: venues, corporate, government, agencies
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

function makeReferralOutreach(clientName: string, lastProject: string): string {
  return `اتصل بـ "${clientName}" واطلب منهم إحالة شركاء أعمال أو معارف يحتاجون تنظيم فعاليات — ذكّرهم بنجاح "${lastProject}" كمرجع`
}

function makeExhibitionPresence(): string {
  const events = [
    'فعاليات ومعارض الأعمال في دبي وورلد ترايد سنتر',
    'معارض قطاعية وتجارية في أبوظبي ناشيونال إكزيبيشن سنتر',
    'فعاليات غرف التجارة في الإمارات',
  ]
  return `ابحث عن ${events[Math.floor(Math.random() * events.length)]} خلال الشهرين القادمين وسجّل ${COMPANY} كمشارك أو راعٍ — فرصة تشبيك مهني مباشر مع صناع القرار`
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY 4 — Professional Content Marketing
// Case studies, LinkedIn, newsletter — builds credibility and inbound leads
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: Build priority-ordered task pool from real DB data
// ─────────────────────────────────────────────────────────────────────────────
export async function employeeTaskManager() {
  const today      = todayUAE()
  const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  // ── Parallel DB fetch ──────────────────────────────────────────────────
  const [users, overdueInvoices, pendingInvoices, completedProjects, quoteProjects] = await Promise.all([
    // Eligible team members
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
      take: 15,
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
      take: 10,
    }),

    // Past clients (completed/in-progress projects in last year)
    prisma.project.findMany({
      where: {
        status:    { in: ['COMPLETED', 'IN_PROGRESS', 'CONFIRMED'] },
        createdAt: { gte: oneYearAgo },
      },
      select: { id: true, name: true, clientName: true, status: true, value: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),

    // Quotes pending (potential to close)
    prisma.project.findMany({
      where: {
        status:    'QUOTE',
        createdAt: { gte: threeMonthsAgo },
      },
      select: { name: true, clientName: true, value: true },
      orderBy: { value: 'desc' },
      take: 10,
    }),
  ])

  if (users.length === 0) return { created: 0, skipped: 0, reason: 'no eligible users' }

  // ── Build priority task pool ──────────────────────────────────────────

  const p1: string[] = []  // Invoice follow-up (highest priority)
  const p2: string[] = []  // Client renewal
  const p3: string[] = []  // New leads / BD
  const p4: string[] = []  // Content marketing

  // P1 — Overdue invoices (call first)
  for (const inv of overdueInvoices) {
    const days = inv.dueDate
      ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
      : 45
    p1.push(makeInvoiceCallTask(inv.customerName, inv.balance, inv.invoiceNumber, days))
    if (inv.balance > 5000) {
      p1.push(makeInvoiceEmailTask(inv.customerName, inv.balance, inv.invoiceNumber))
    }
  }

  // P1 — Pending invoices (email follow-up)
  for (const inv of pendingInvoices.slice(0, 5)) {
    p1.push(makeInvoiceEmailTask(inv.customerName, inv.balance, inv.invoiceNumber))
  }

  // P2 — Past client renewal
  const uniqueClients = [...new Map(completedProjects.map(p => [p.clientName, p])).values()]
  for (const proj of uniqueClients.slice(0, 10)) {
    p2.push(makeClientRenewalCall(proj.clientName, proj.name))
    p2.push(makeReferralOutreach(proj.clientName, proj.name))
  }

  // P2 — Quote follow-up (close the deal)
  for (const q of quoteProjects.slice(0, 5)) {
    p2.push(makeProposalFollowUp(q.clientName, q.name))
    p2.push(makeClientCheckIn(q.clientName))
  }

  // P3 — New lead acquisition (professional methods)
  for (let i = 0; i < 8; i++) p3.push(makeVenueOutreach())
  for (let i = 0; i < 6; i++) p3.push(makeCorporateOutreach())
  for (let i = 0; i < 4; i++) p3.push(makeGovernmentTender())
  for (let i = 0; i < 4; i++) p3.push(makeAgencyPartnership())
  for (let i = 0; i < 4; i++) p3.push(makeLinkedInProspecting())
  for (let i = 0; i < 3; i++) p3.push(makeExhibitionPresence())

  // P4 — Content & credibility
  for (const proj of completedProjects.slice(0, 5)) {
    p4.push(makeCaseStudy(proj.name, proj.clientName))
    p4.push(makeTestimonialRequest(proj.clientName, proj.name))
    p4.push(makeLinkedInPost(proj.name, proj.clientName))
  }
  if (completedProjects.length > 0) {
    p4.push(makeNewsletterTask(completedProjects[0].name))
  }

  // Shuffle within each priority tier
  shuffle(p1); shuffle(p2); shuffle(p3); shuffle(p4)

  // Full pool: 40% P1 | 30% P2 | 20% P3 | 10% P4
  const taskPool: string[] = [...p1, ...p2, ...p3, ...p4]

  if (taskPool.length === 0) {
    // Fallback to BD tasks if DB is empty
    taskPool.push(makeVenueOutreach(), makeCorporateOutreach(), makeAgencyPartnership())
  }

  // ── Assign one task per user ──────────────────────────────────────────
  let created = 0, skipped = 0

  for (let i = 0; i < users.length; i++) {
    const user = users[i]

    const openCount = await prisma.task.count({
      where: { assignedToId: user.id, status: 'PENDING', taskDate: today },
    })
    if (openCount >= 5) { skipped++; continue }

    // Give each user a different task from the pool
    const taskIndex = i % taskPool.length
    const title     = taskPool[taskIndex]

    // Determine category label
    const category =
      i < p1.length           ? 'متابعة الفواتير وتحصيل المستحقات' :
      i < p1.length + p2.length ? 'تجديد علاقات العملاء وإغلاق الصفقات' :
      i < p1.length + p2.length + p3.length ? 'اكتساب عملاء جدد وتطوير الأعمال' :
      'تسويق احترافي وبناء المصداقية'

    await prisma.task.create({
      data: {
        title,
        status:      'PENDING',
        priority:    i < p1.length ? 'HIGH' : i < p1.length + p2.length ? 'HIGH' : 'MEDIUM',
        taskDate:    today,
        assignedToId: user.id,
        createdById:  user.id,
        description: `[${category}] — مهمة مولّدة بواسطة الوكيل الذكي بناءً على بيانات النظام الحالية`,
        notes:       category,
      },
    })
    created++
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
