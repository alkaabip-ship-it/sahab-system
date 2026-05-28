import { prisma } from '@/lib/prisma'

function todayUAE(): string {
  return new Date(Date.now() + 4 * 3600000).toISOString().split('T')[0]
}

const COMPANY = 'سحاب للفعاليات والمعارض'
const IG      = '@sahabm.ae'     // Instagram handle

// ── Task builders — each returns one Instagram/marketing task ──────────
// ctx: real project name + client name from DB
function makeInstagramPost(project: string, client: string): string {
  return `أنشئ منشور Instagram يستعرض مشروع "${project}" مع ${client} — أبرز الإبداع والتنفيذ واستخدم الهاشتاق المناسب على حساب ${IG}`
}
function makeInstagramStory(project: string): string {
  return `صمّم 3 Stories لـ Instagram تعرض كواليس تجهيز "${project}" مع موسيقى ونص تشويقي يرفع التفاعل على ${IG}`
}
function makeWebsitePortfolio(project: string, client: string): string {
  return `أضف مشروع "${project}" (${client}) إلى صفحة Portfolio في الموقع الرسمي لـ ${COMPANY} بصور وبيانات كاملة`
}
function makeClientTestimonial(client: string): string {
  return `تواصل مع ${client} واطلب تقييماً أو شهادة عن تجربتهم مع ${COMPANY} لنشره على ${IG} والموقع`
}
function makePricePromotion(): string {
  const offers = [
    `أعدّ بوست Instagram يبرز باقات ${COMPANY} بأسعار تنافسية مع CTA "احصل على عرض مجاني"`,
    `صمّم إنفوجرافيك لـ Instagram يوضح باقات ${COMPANY} بأسعار مناسبة لجميع الميزانيات`,
    `أنشئ Story على Instagram تعرض عروض ${COMPANY} الموسمية مع رابط للتواصل المباشر`,
  ]
  return offers[Math.floor(Math.random() * offers.length)]
}
function makeReelIdea(project: string): string {
  return `اقترح فكرة Reel 30 ثانية يستعرض قبل وبعد تجهيز "${project}" — مناسب للنشر على Instagram Reels وTikTok`
}
function makeHashtagResearch(): string {
  return `ابحث عن 20 هاشتاق شائع في مجال الفعاليات والمعارض بالإمارات وأضفهم للقائمة المرجعية لـ ${IG}`
}
function makeCompetitorAnalysis(): string {
  return `راقب حسابات منافسي ${COMPANY} على Instagram وأعدّ تقريراً بـ3 أفكار محتوى يمكن الإلهام منها`
}
function makeEngagementTask(): string {
  return `تفاعل مع آخر 20 منشور في هاشتاق #فعاليات_الإمارات و#معارض_الإمارات على Instagram باسم ${IG}`
}

// ── Main: assign marketing tasks ─────────────────────────────────────
export async function employeeTaskManager() {
  const today = todayUAE()

  // Exclude infosahab + admin
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'ADMIN' },
      NOT: [
        { email: { contains: 'infosahab', mode: 'insensitive' } },
        { name:  { contains: 'infosahab', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
  })

  if (users.length === 0) return { created: 0, skipped: 0, reason: 'no eligible users' }

  // Last 12 months — completed or in-progress projects
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const completedProjects = await prisma.project.findMany({
    where: {
      status:    { in: ['COMPLETED', 'IN_PROGRESS', 'CONFIRMED'] },
      createdAt: { gte: oneYearAgo },
    },
    select: { id: true, name: true, clientName: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Build a diverse task pool based on real data
  const taskPool: string[] = []

  for (const p of completedProjects.slice(0, 8)) {
    taskPool.push(makeInstagramPost(p.name, p.clientName))
    taskPool.push(makeInstagramStory(p.name))
    taskPool.push(makeWebsitePortfolio(p.name, p.clientName))
    taskPool.push(makeClientTestimonial(p.clientName))
    taskPool.push(makeReelIdea(p.name))
  }

  // Add general marketing tasks (not project-specific)
  taskPool.push(makePricePromotion())
  taskPool.push(makePricePromotion())
  taskPool.push(makeHashtagResearch())
  taskPool.push(makeCompetitorAnalysis())
  taskPool.push(makeEngagementTask())

  // Shuffle
  for (let i = taskPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [taskPool[i], taskPool[j]] = [taskPool[j], taskPool[i]]
  }

  let created = 0, skipped = 0
  const poolLen = taskPool.length

  // Spread users evenly across the pool so each gets a distinct task
  // e.g. 2 users, pool=40 → user0 gets pool[0], user1 gets pool[20]
  const step = poolLen > 0 ? Math.floor(poolLen / users.length) : 1

  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const openCount = await prisma.task.count({
      where: { assignedToId: user.id, status: 'PENDING', taskDate: today },
    })
    if (openCount >= 5) { skipped++; continue }

    const idx   = poolLen > 0 ? (i * step) % poolLen : 0
    const title = taskPool[idx] ?? makePricePromotion()

    await prisma.task.create({
      data: {
        title,
        status:       'PENDING',
        taskDate:     today,
        assignedToId: user.id,
        createdById:  user.id,
        description:  `مهمة تسويقية وترويجية — مولّدة تلقائياً بواسطة الوكيل الذكي`,
      },
    })
    created++
  }

  return { created, skipped }
}

// ── Create a specific task for one or all employees ─────────────────
export async function createSpecificTask(params: {
  title:        string
  description?: string
  employeeName?: string | null   // null = assign to all eligible users
}) {
  const today = todayUAE()

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
    : await prisma.user.findMany({
        where: baseWhere,
        select: { id: true, name: true },
      })

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

// ── Get all eligible employees (for intent extraction) ───────────────
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

// ── Team performance ─────────────────────────────────────────────────
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
