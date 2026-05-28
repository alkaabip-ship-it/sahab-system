import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUnacknowledgedAlerts, acknowledgeAlert } from '@/lib/agentic/alerts'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const alerts = await getUnacknowledgedAlerts()
  return NextResponse.json({ alerts })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string })?.role !== 'ADMIN')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const { id } = await req.json()
  await acknowledgeAlert(id)
  return NextResponse.json({ ok: true })
}
