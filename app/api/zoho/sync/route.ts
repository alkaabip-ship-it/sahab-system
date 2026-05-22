import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fullSync } from '@/lib/zoho'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const orgId = process.env.ZOHO_ORGANIZATION_ID
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN

  if (!clientId || !clientSecret || !orgId || !refreshToken) {
    // Log the attempt even if not configured
    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'FULL',
        status: 'FAILED',
        message: 'بيانات اعتماد Zoho Books غير مكتملة في الإعدادات',
        itemsSynced: 0,
      },
    })
    return NextResponse.json(
      {
        error:
          'بيانات اعتماد Zoho Books غير مكتملة. يرجى إضافة ZOHO_CLIENT_ID و ZOHO_CLIENT_SECRET و ZOHO_ORGANIZATION_ID و ZOHO_REFRESH_TOKEN في ملف .env.local',
      },
      { status: 400 }
    )
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
