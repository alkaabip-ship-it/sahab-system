import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS permissions TEXT`
  return NextResponse.json({ ok: true })
}
