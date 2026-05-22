import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'رمز التفويض مفقود' }, { status: 400 })
  }

  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const redirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/api/zoho/callback'

  try {
    const response = await axios.post(
      'https://accounts.zoho.com/oauth/v2/token',
      null,
      {
        params: {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
      }
    )

    const { refresh_token } = response.data

    return NextResponse.json({
      message: 'تم الحصول على Refresh Token. يرجى إضافته إلى ZOHO_REFRESH_TOKEN في ملف .env.local',
      refresh_token,
    })
  } catch (error: any) {
    console.error('Zoho callback error:', error)
    return NextResponse.json(
      { error: 'فشل في الحصول على التوثيق من Zoho' },
      { status: 500 }
    )
  }
}
