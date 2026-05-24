import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const clientId = process.env.ZOHO_CLIENT_ID
  const redirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/api/zoho/callback'

  if (!clientId) {
    return NextResponse.json(
      { error: 'ZOHO_CLIENT_ID غير محدد' },
      { status: 400 }
    )
  }

  const scopes = 'ZohoBooks.fullaccess.all,ZohoCRM.modules.Leads.CREATE,ZohoCRM.modules.Leads.READ'
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=${encodeURIComponent(scopes)}&client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline`

  return NextResponse.redirect(authUrl)
}
