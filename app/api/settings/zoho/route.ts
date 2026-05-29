// @ts-nocheck
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const KEYS = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_ORGANIZATION_ID']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const settings = await prisma.setting.findMany({ where: { key: { in: KEYS } } })
  const data: Record<string, string> = {}
  for (const k of KEYS) {
    const found = settings.find(s => s.key === k)
    data[k] = found?.value || ''
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await req.json()

  for (const key of KEYS) {
    const value = (body[key] ?? '').trim()
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { id: key, key, value },
    })
  }

  return NextResponse.json({ success: true })
}
