// @ts-nocheck
import { prisma } from '@/lib/prisma'

export async function saveAgentRun(params: {
  perception: string
  reasoning:  string
  actions:    unknown[]
  outcome:    string
}) {
  const id = `run_${Date.now()}`
  await prisma.$executeRaw`
    INSERT INTO agent_runs (id, perception, reasoning, actions, outcome, completed_at)
    VALUES (${id}, ${params.perception}, ${params.reasoning}, ${JSON.stringify(params.actions)}::jsonb, ${params.outcome}, NOW())
  `
  await prisma.$executeRaw`
    UPDATE agent_config SET last_run = NOW() WHERE id = '1'
  `
  return id
}

export async function getRecentRuns(limit = 10) {
  return prisma.$queryRaw<Array<{
    id: string; started_at: Date; completed_at: Date | null
    perception: string; reasoning: string; actions: unknown; outcome: string
  }>>`
    SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ${limit}
  `.catch(() => [])
}

export async function getAgentConfig() {
  const rows = await prisma.$queryRaw<Array<{
    id: string; is_active: boolean; interval_minutes: number; last_run: Date | null
  }>>`SELECT * FROM agent_config WHERE id = '1' LIMIT 1`.catch(() => [])
  return rows[0] ?? { id: '1', is_active: true, interval_minutes: 15, last_run: null }
}

export async function setAgentActive(active: boolean) {
  await prisma.$executeRaw`UPDATE agent_config SET is_active = ${active} WHERE id = '1'`
}

export async function saveMessage(role: 'user' | 'assistant', content: string) {
  await prisma.$executeRaw`
    INSERT INTO agent_messages (id, role, content)
    VALUES (gen_random_uuid()::text, ${role}, ${content})
  `
}

export async function getRecentMessages(limit = 20) {
  return prisma.$queryRaw<Array<{ id: string; role: string; content: string; created_at: Date }>>`
    SELECT * FROM agent_messages ORDER BY created_at DESC LIMIT ${limit}
  `.then(rows => rows.reverse()).catch(() => [])
}
