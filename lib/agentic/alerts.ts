import { prisma } from '@/lib/prisma'

export type AlertSeverity = 'INFO' | 'WARNING' | 'DANGER' | 'CRITICAL'
export type AlertType     = 'FINANCIAL_LOSS' | 'LOW_MARGIN' | 'DELAYED_TASKS' | 'URGENT_EMAIL' | 'SYSTEM'

export async function createAlert(params: {
  type:      AlertType
  severity:  AlertSeverity
  title:     string
  message?:  string
  projectId?: string
}) {
  // Avoid duplicate alerts — check if same type+project in last 2h
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000)
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM agent_alerts
    WHERE type = ${params.type}
      AND COALESCE(project_id, '') = COALESCE(${params.projectId ?? ''}, '')
      AND created_at > ${twoHoursAgo}
    LIMIT 1
  `.catch(() => [])

  if (existing.length > 0) return null

  await prisma.$executeRaw`
    INSERT INTO agent_alerts (id, type, severity, title, message, project_id)
    VALUES (gen_random_uuid()::text, ${params.type}, ${params.severity}, ${params.title}, ${params.message ?? ''}, ${params.projectId ?? null})
  `
  return true
}

export async function getUnacknowledgedAlerts() {
  return prisma.$queryRaw<Array<{
    id: string; type: string; severity: string; title: string
    message: string; project_id: string | null; created_at: Date
  }>>`
    SELECT * FROM agent_alerts
    WHERE acknowledged_at IS NULL
    ORDER BY created_at DESC
    LIMIT 20
  `.catch(() => [])
}

export async function acknowledgeAlert(id: string) {
  await prisma.$executeRaw`
    UPDATE agent_alerts SET acknowledged_at = NOW(), is_read = true WHERE id = ${id}
  `
}
