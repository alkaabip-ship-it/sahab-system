import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Always fetch fresh data — never serve a cached response
export const dynamic = 'force-dynamic'

// Ensure the table exists (safe to call on every request — CREATE IF NOT EXISTS is a no-op)
async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS event_management_events (
      id         TEXT PRIMARY KEY,
      data       JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

// GET — load all events
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    await ensureTable()
    const rows = await prisma.$queryRawUnsafe<{ id: string; data: unknown }[]>(
      `SELECT id, data FROM event_management_events ORDER BY created_at ASC`
    )
    const events = rows.map((r) => ({ id: r.id, ...(r.data as object) }))
    return NextResponse.json({ events })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT — upsert a single event (full data replacement)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const event = await req.json()
    if (!event?.id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

    const { id, ...data } = event

    await prisma.$executeRawUnsafe(
      `INSERT INTO event_management_events (id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE
         SET data = $2::jsonb, updated_at = NOW()`,
      id,
      JSON.stringify(data)
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remove an event by id
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

    await prisma.$executeRawUnsafe(
      `DELETE FROM event_management_events WHERE id = $1`, id
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
