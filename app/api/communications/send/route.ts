import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'info@sahabm.com',
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const fd = await req.formData()
  const contacts = JSON.parse(fd.get('contacts') as string)
  const subject  = fd.get('subject') as string
  const body     = fd.get('body') as string

  if (!contacts?.length || !subject || !body) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  }

  if (!process.env.SMTP_PASS) {
    return NextResponse.json({ error: 'إعدادات البريد غير مكتملة' }, { status: 500 })
  }

  const transporter = createTransporter()
  const fromAddress = process.env.SMTP_USER || 'info@sahabm.com'
  const results: { name: string; success: boolean; error?: string }[] = []

  for (const contact of contacts) {
    try {
      await transporter.sendMail({
        from: `"Sahab Events & Exhibitions" <${fromAddress}>`,
        to: `"${contact.name}" <${contact.email}>`,
        subject,
        html: body,
      })
      results.push({ name: contact.name, success: true })
    } catch (err: any) {
      console.error(`[MAIL] Failed to send to ${contact.email}:`, err.message)
      results.push({ name: contact.name, success: false, error: err.message })
    }
  }

  const sent   = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  return NextResponse.json({ sent, failed, results })
}
