import { prisma } from './prisma'

const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/token'

/**
 * Gets a valid Zoho CRM access token.
 * Uses the same refresh token as Zoho Books — the OAuth app must have been
 * authorized with CRM scopes (ZohoCRM.modules.Leads.CREATE,READ).
 * Cached separately from the Books token so they don't interfere.
 */
export async function getCRMAccessToken(): Promise<string> {
  const [tokenRow, expiresRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ZOHO_CRM_ACCESS_TOKEN' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CRM_TOKEN_EXPIRES_AT' } }),
  ])

  const now = Date.now()
  const expiresAt = parseInt(expiresRow?.value || '0')

  if (tokenRow?.value && expiresAt > now + 60_000) {
    return tokenRow.value
  }

  // Read credentials from DB first, fall back to env
  const [dbRefresh, dbClientId, dbClientSecret] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ZOHO_REFRESH_TOKEN' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_ID' } }),
    prisma.setting.findUnique({ where: { key: 'ZOHO_CLIENT_SECRET' } }),
  ])

  const refreshToken = dbRefresh?.value || process.env.ZOHO_REFRESH_TOKEN
  const clientId     = dbClientId?.value || process.env.ZOHO_CLIENT_ID
  const clientSecret = dbClientSecret?.value || process.env.ZOHO_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('بيانات اعتماد Zoho غير مكتملة — أضفها في صفحة الإعدادات')
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'refresh_token',
  })

  const res = await fetch(`${ZOHO_AUTH_URL}?${params}`, { method: 'POST' })
  const data = await res.json()

  const { access_token, expires_in, error } = data

  if (!access_token) {
    throw new Error(
      `Zoho CRM رفض التوثيق: ${error || JSON.stringify(data)}. ` +
      'تأكد من إعادة ربط Zoho بصلاحيات CRM من صفحة الإعدادات.'
    )
  }

  await Promise.all([
    prisma.setting.upsert({
      where:  { key: 'ZOHO_CRM_ACCESS_TOKEN' },
      update: { value: access_token },
      create: { key: 'ZOHO_CRM_ACCESS_TOKEN', value: access_token },
    }),
    prisma.setting.upsert({
      where:  { key: 'ZOHO_CRM_TOKEN_EXPIRES_AT' },
      update: { value: String(now + (expires_in ?? 3600) * 1000) },
      create: { key: 'ZOHO_CRM_TOKEN_EXPIRES_AT', value: String(now + (expires_in ?? 3600) * 1000) },
    }),
  ])

  return access_token
}
