import { prisma } from './prisma'

export async function generateProjectCode(): Promise<string> {
  const lastProject = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  })

  if (!lastProject) {
    return 'PRJ-001'
  }

  const match = lastProject.code.match(/PRJ-(\d+)/)
  if (!match) {
    return 'PRJ-001'
  }

  const nextNum = parseInt(match[1]) + 1
  return `PRJ-${nextNum.toString().padStart(3, '0')}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('ar-AE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export async function calculateSupplierRecommendation(
  supplierId: string
): Promise<string> {
  const evaluations = await prisma.supplierEvaluation.findMany({
    where: { supplierId },
  })

  const issues = await prisma.projectIssue.findMany({
    where: { supplierId },
  })

  if (evaluations.length === 0) {
    return 'UNDER_REVIEW'
  }

  let excellentCount = 0
  let goodCount = 0
  let poorCount = 0
  let noRepeatCount = 0

  for (const ev of evaluations) {
    if (ev.performance === 'EXCELLENT') excellentCount++
    else if (ev.performance === 'GOOD') goodCount++
    else if (ev.performance === 'POOR') poorCount++
    if (!ev.repeatBusiness) noRepeatCount++
  }

  const total = evaluations.length
  let score =
    (excellentCount * 3 + goodCount * 2 + poorCount * 1) / total

  score -= noRepeatCount * 0.5

  const issueCount = issues.length
  if (issueCount > 5) score -= 1
  else if (issueCount > 3) score -= 0.5

  if (score >= 2.5 && issueCount <= 2) return 'PRIMARY'
  if (score >= 2 && issueCount <= 3) return 'BACKUP'
  if (score >= 1.5 || issueCount <= 5) return 'UNDER_REVIEW'
  return 'SUSPENDED'
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    QUOTE: 'عرض سعر',
    CONFIRMED: 'مؤكد',
    IN_PROGRESS: 'قيد التنفيذ',
    COMPLETED: 'مكتمل',
    CLOSED: 'مغلق',
    PAID: 'مدفوع',
    UNPAID: 'غير مدفوع',
    PARTIAL: 'مدفوع جزئياً',
    OPEN: 'مفتوح',
    PRIMARY: 'رئيسي',
    BACKUP: 'احتياطي',
    UNDER_REVIEW: 'قيد المراجعة',
    SUSPENDED: 'موقوف',
    EXCELLENT: 'ممتاز',
    GOOD: 'جيد',
    POOR: 'ضعيف',
    DELAY: 'تأخير',
    QUALITY: 'جودة',
    EXTRA_COST: 'تكلفة إضافية',
    MATERIAL_SHORTAGE: 'نقص مواد',
    OTHER: 'أخرى',
    MINOR: 'بسيط',
    MEDIUM: 'متوسط',
    MAJOR: 'كبير',
    SCREENS: 'شاشات وعروض',
    AUDIO: 'صوتيات',
    LIGHTING: 'إضاءة',
    PRINTING: 'طباعة',
    CARPET: 'سجاد',
    CARPENTRY: 'نجارة',
    FLOWERS: 'ورود وزهور',
    HOSPITALITY: 'ضيافة',
    PHOTOGRAPHY: 'تصوير فوتوغرافي',
    VIDEO: 'تصوير فيديو',
    LABOR: 'عمالة',
    TRANSPORT: 'نقل',
  }
  return map[status] || status
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    QUOTE: 'bg-gray-100 text-gray-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-500',
    PAID: 'bg-green-100 text-green-700',
    UNPAID: 'bg-red-100 text-red-700',
    PARTIAL: 'bg-yellow-100 text-yellow-700',
    OPEN: 'bg-red-100 text-red-700',
    PRIMARY: 'bg-green-100 text-green-700',
    BACKUP: 'bg-blue-100 text-blue-700',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
    SUSPENDED: 'bg-red-100 text-red-700',
    EXCELLENT: 'bg-green-100 text-green-700',
    GOOD: 'bg-blue-100 text-blue-700',
    POOR: 'bg-red-100 text-red-700',
    MINOR: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    MAJOR: 'bg-red-100 text-red-700',
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}
