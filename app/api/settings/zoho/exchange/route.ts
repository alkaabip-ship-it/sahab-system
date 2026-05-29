// @ts-nocheck
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import axios from 'axios'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Authorization Code مطلوب' }, { status: 400 })

  const [dbClientId, dbClientSecret] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_ID' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_SECRET' } }),
  ])

  const clientId     = dbClientId?.value     || process.env.ZOHO_CLIENT_ID
  const clientSecret = dbClientSecret?.value || process.env.ZOHO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Client ID و Client Secret مطلوبان أولاً' }, { status: 400 })
  }

  try {
    // Try without redirect_uri first (works for Self-Client codes)
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
      },
    })

    const { refresh_token, access_token, expires_in, error } = response.data

    if (error) {
      return NextResponse.json(
        { error: `Zoho رفض الكود: ${error} — تأكد أن الكود لم ينتهِ (مدة صلاحيته دقيقتان)` },
        { status: 400 }
      )
    }

    const now = Date.now()

    // If we got a refresh_token — ideal case, save it
    if (refresh_token) {
      await Promise.all([
        prisma.setting.upsert({
          where: { key: 'ZOHO_REFRESH_TOKEN' },
          update: { value: refresh_token },
          create: { id: 'ZOHO_REFRESH_TOKEN', key: 'ZOHO_REFRESH_TOKEN', value: refresh_token },
        }),
        access_token
          ? prisma.setting.upsert({
              where: { key: 'ZOHO_ACCESS_TOKEN' },
              update: { value: access_token },
              create: { id: 'ZOHO_ACCESS_TOKEN', key: 'ZOHO_ACCESS_TOKEN', value: access_token },
            })
          : Promise.resolve(),
        access_token && expires_in
          ? prisma.setting.upsert({
              where: { key: 'ZOHO_TOKEN_EXPIRES_AT' },
              update: { value: String(now + expires_in * 1000) },
              create: { id: 'ZOHO_TOKEN_EXPIRES_AT', key: 'ZOHO_TOKEN_EXPIRES_AT', value: String(now + expires_in * 1000) },
            })
          : Promise.resolve(),
      ])
      return NextResponse.json({ refresh_token })
    }

    // Only got access_token — save it temporarily so sync works for next hour
    if (access_token) {
      await Promise.all([
        prisma.setting.upsert({
          where: { key: 'ZOHO_ACCESS_TOKEN' },
          update: { value: access_token },
          create: { id: 'ZOHO_ACCESS_TOKEN', key: 'ZOHO_ACCESS_TOKEN', value: access_token },
        }),
        prisma.setting.upsert({
          where: { key: 'ZOHO_TOKEN_EXPIRES_AT' },
          update: { value: String(now + (expires_in ?? 3600) * 1000) },
          create: { id: 'ZOHO_TOKEN_EXPIRES_AT', key: 'ZOHO_TOKEN_EXPIRES_AT', value: String(now + (expires_in ?? 3600) * 1000) },
        }),
      ])
      return NextResponse.json({
        access_token_only: true,
        message:
          'تم حفظ Access Token مؤقتاً (صالح لمدة ساعة). للحصول على Refresh Token دائم: استخدم Self Client في https://api-console.zoho.com وأنشئ كوداً بنطاق ZohoBooks.fullaccess.all',
      })
    }

    return NextResponse.json(
      { error: 'لم يُرجع Zoho أي Token — تحقق من Client ID و Client Secret' },
      { status: 400 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.response?.data?.error || err?.message || 'فشل الاتصال بـ Zoho' },
      { status: 500 }
    )
  }
}
