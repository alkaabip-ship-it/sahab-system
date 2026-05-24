import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'لم يتم إرفاق ملف' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `أنت محلل فواتير ضريبية. استخرج البيانات من هذه الفاتورة وأرجعها بصيغة JSON فقط بدون أي نص إضافي.

الصيغة المطلوبة:
{
  "supplierName": "اسم المورد أو الشركة",
  "supplierTRN": "الرقم الضريبي للمورد (TRN) - 15 رقم",
  "buyerTRN": "الرقم الضريبي للمشتري إن وجد",
  "amount": 0.00,
  "vatAmount": 0.00,
  "vatRate": 5,
  "totalAmount": 0.00,
  "date": "YYYY-MM-DD",
  "invoiceNumber": "رقم الفاتورة",
  "description": "وصف مختصر للخدمة أو المنتج",
  "currency": "AED",
  "confidence": "high|medium|low"
}

إذا لم تجد قيمة معينة، اجعلها null. الأرقام يجب أن تكون أرقام وليس نصوص. ابحث عن TRN أو Tax Registration Number أو الرقم الضريبي في الفاتورة.`,
          },
        ],
      },
    ],
  })

  const text = (message.content[0] as any).text
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: true, data: { raw: text } })
  }
}
