import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fullSync } from '@/lib/zoho'

export const maxDuration = 300 // 5 minutes

// Called automatically by Vercel Cron every 3 hours.
// Protected by CRON_SECRET env variable — Vercel injects the header automatically.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  // Allow Vercel Cron (passes secret automatically) or manual trigger with correct secret
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date()

  try {
    const result = await fullSync()

    console.log(
      `[Cron] Zoho sync completed — vendors: ${result.vendors}, bills: ${result.bills}, linked: ${result.linked}`
    )

    return NextResponse.json({
      success: true,
      vendors: result.vendors,
      bills: result.bills,
      linked: result.linked,
      duration: `${((Date.now() - startedAt.getTime()) / 1000).toFixed(1)}s`,
    })
  } catch (error: any) {
    console.error('[Cron] Zoho sync failed:', error)

    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'FULL',
        status: 'FAILED',
        message: `[Auto-cron] ${error?.message || 'خطأ غير معروف'}`,
        itemsSynced: 0,
      },
    })

    return NextResponse.json(
      { error: error?.message || 'Sync failed' },
      { status: 500 }
    )
  }
}
