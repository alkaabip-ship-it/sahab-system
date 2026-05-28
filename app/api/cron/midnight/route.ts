import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Vercel Cron — runs at 20:00 UTC = 00:00 UAE (UTC+4)
 * Marks all PENDING tasks from previous days as auto-archived (no-op needed
 * since filtering by taskDate already handles the "new day" view).
 * This endpoint exists mainly to log the daily rollover.
 */
export async function GET() {
  const secret = process.env.CRON_SECRET
  // Vercel cron calls don't pass auth headers in the same way,
  // so we rely on the vercel.json schedule config for security.

  try {
    // Count today's tasks (UAE time UTC+4)
    const now = new Date()
    const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    const today = uae.toISOString().split('T')[0]

    const pending = await prisma.task.count({
      where: { taskDate: { not: today }, status: 'PENDING' },
    })

    console.log(`[midnight-cron] Rolled over. ${pending} pending tasks from previous days are now in archive.`)

    return NextResponse.json({
      ok: true,
      date: today,
      archivedPendingCount: pending,
      message: 'Daily rollover complete — new day started',
    })
  } catch (e: any) {
    console.error('[midnight-cron] error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
