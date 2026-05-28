// @ts-nocheck
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fullSync } from '@/lib/zoho'

export const maxDuration = 300 // 5 minutes — Vercel Pro

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const result = await fullSync()

    return NextResponse.json({
      success: true,
      vendors: result.vendors,
      bills: result.bills,
      linked: result.linked,
      message: `تمت المزامنة بنجاح: ${result.vendors} مورد، ${result.bills} فاتورة، ${result.linked} مرتبطة`,
    })
  } catch (error: any) {
    console.error('Zoho sync error:', error)

    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'FULL',
        status: 'FAILED',
        message: error?.message || 'خطأ غير معروف',
        itemsSynced: 0,
      },
    })

    return NextResponse.json(
      { error: error?.message || 'فشل في المزامنة مع Zoho Books' },
      { status: 500 }
    )
  }
}
