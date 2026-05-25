import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SIGNATURE = {
  ar: '\n\n--\nسحاب لإدارة التسويق والفعاليات\ninfo@sahabm.com\n0562522325',
  en: '\n\n--\nSahab Marketing & Events Management\ninfo@sahabm.com\n0562522325',
}

const COMPANY = {
  ar: 'سحاب لإدارة التسويق والفعاليات',
  en: 'Sahab Marketing & Events Management',
}

const TEMPLATES = {
  rfq: {
    ar: { label: 'طلب عروض أسعار (مناقصة)', prompt: (p: string, d: string) =>
      `اكتب إيميلاً رسمياً باللغة العربية لطلب عرض سعر (مناقصة) لمشروع فعالية في الإمارات.
اسم المشروع: ${p || 'فعالية قادمة'}، الوصف: ${d || 'تجهيزات فعالية'}
الشركة المرسلة: ${COMPANY.ar}
يتضمن: تحية رسمية، وصف المشروع، طلب عرض السعر، الموعد النهائي للرد (3 أيام).
لا تضع توقيعاً في النهاية. اجعله قصيراً ومهنياً.` },
    en: { label: 'Request for Quotation (RFQ)', prompt: (p: string, d: string) =>
      `Write a formal English email requesting a price quotation (RFQ) for an event project in UAE.
Project: ${p || 'Upcoming Event'}, Details: ${d || 'Event equipment and setup'}
Sender: ${COMPANY.en}
Include: formal greeting, project description, RFQ request, 3-day reply deadline.
Do not add a signature at the end. Keep it professional and concise.` },
  },
  invitation: {
    ar: { label: 'دعوة للمشاركة في مشروع', prompt: (p: string, d: string) =>
      `اكتب إيميلاً رسمياً باللغة العربية لدعوة مورد للمشاركة في مشروع فعالية.
المشروع: ${p || 'فعالية قادمة'}، التفاصيل: ${d || 'تفاصيل تُحدد لاحقاً'}
الشركة: ${COMPANY.ar}. لا تضع توقيعاً.` },
    en: { label: 'Project Participation Invitation', prompt: (p: string, d: string) =>
      `Write a formal English email inviting a vendor to participate in an event project.
Project: ${p || 'Upcoming Event'}, Details: ${d || 'To be confirmed'}
Company: ${COMPANY.en}. No signature needed.` },
  },
  promotional: {
    ar: { label: 'رسالة ترويجية للعملاء', prompt: (p: string, d: string) =>
      `اكتب رسالة تسويقية احترافية باللغة العربية لعملاء شركة فعاليات في الإمارات.
الموضوع: ${d || 'خدماتنا المتميزة'}، الشركة: ${COMPANY.ar}
اجعلها جذابة وتبرز خدمات التنظيم والتجهيز. لا توقيع.` },
    en: { label: 'Promotional Message', prompt: (p: string, d: string) =>
      `Write a professional English promotional email for event management clients in UAE.
Subject: ${d || 'Our premium services'}, Company: ${COMPANY.en}
Make it engaging, highlighting event organization and setup services. No signature.` },
  },
  followup: {
    ar: { label: 'متابعة مشروع سابق', prompt: (p: string, d: string) =>
      `اكتب إيميل متابعة مهني باللغة العربية لعميل سبق التعامل معه.
المشروع: ${p || 'مشروع سابق'}، الهدف: ${d || 'الاطمئنان والعرض لمشاريع جديدة'}
الشركة: ${COMPANY.ar}. لا توقيع.` },
    en: { label: 'Follow-up Email', prompt: (p: string, d: string) =>
      `Write a professional English follow-up email to a previous client.
Project: ${p || 'Previous project'}, Goal: ${d || 'Check-in and offer new projects'}
Company: ${COMPANY.en}. No signature.` },
  },
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { template, projectName, description, language = 'ar' } = await req.json()
  const lang = language === 'en' ? 'en' : 'ar'
  const tpl = TEMPLATES[template as keyof typeof TEMPLATES]
  if (!tpl) return NextResponse.json({ error: 'قالب غير معروف' }, { status: 400 })

  const systemPrompt = lang === 'en'
    ? 'You are a professional business email writer. You MUST write ONLY in English, regardless of any Arabic text in the user input. Never switch to Arabic under any circumstance.'
    : 'أنت كاتب رسائل أعمال محترف. اكتب الرسالة باللغة العربية الفصحى فقط.'

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: tpl[lang].prompt(projectName || '', description || '') }],
    })

    const rawText = (message.content[0] as any).text
    const lines = rawText.split('\n').filter((l: string) => l.trim())

    let subject = `${tpl[lang].label} — ${lang === 'ar' ? 'سحاب' : 'Sahab'}`
    let body = rawText

    const subjectLine = lines.find((l: string) =>
      /^(\*{0,2})(الموضوع|Subject|RE:|موضوع)[\s:*]+/i.test(l)
    )
    if (subjectLine) {
      subject = subjectLine.replace(/^(\*{0,2})(الموضوع|Subject|RE:|موضوع)[\s:*]+(\*{0,2})/i, '').trim()
      body = lines.filter((l: string) => l !== subjectLine).join('\n')
    }

    // Append company signature
    body = body + SIGNATURE[lang]

    return NextResponse.json({ subject, body })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    templates: Object.entries(TEMPLATES).flatMap(([k, v]) => [
      { key: k, label: v.ar.label, lang: 'ar' },
      { key: k, label: v.en.label, lang: 'en' },
    ]),
  })
}
