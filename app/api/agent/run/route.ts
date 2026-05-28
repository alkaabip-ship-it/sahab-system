import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runAgentCycle } from '@/lib/agentic/engine'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  try {
    const result = await runAgentCycle()
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
