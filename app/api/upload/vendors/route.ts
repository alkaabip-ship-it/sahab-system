// @ts-nocheck
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'

// Zoho Books Vendors.csv actual columns
// Contact ID, Contact Name, Company Name, Display Name, EmailID, Phone, MobilePhone, Notes, Status ...

function detectServiceType(name: string, notes: string): string {
  const text = (name + ' ' + notes).toLowerCase()
  if (text.includes('screen') || text.includes('led') || text.includes('display') || text.includes('شاشة') || text.includes('عرض')) return 'SCREENS'
  if (text.includes('audio') || text.includes('sound') || text.includes('speaker') || text.includes('صوت')) return 'AUDIO'
  if (text.includes('light') || text.includes('إضاءة') || text.includes('ضوء') || text.includes('neon')) return 'LIGHTING'
  if (text.includes('print') || text.includes('banner') || text.includes('طباعة') || text.includes('signage')) return 'PRINTING'
  if (text.includes('carpet') || text.includes('سجاد') || text.includes('flooring')) return 'CARPET'
  if (text.includes('furniture') || text.includes('carpent') || text.includes('wood') || text.includes('نجارة') || text.includes('أثاث') || text.includes('chair') || text.includes('table')) return 'CARPENTRY'
  if (text.includes('flower') || text.includes('floral') || text.includes('ورود') || text.includes('زهور') || text.includes('plant') || text.includes('flora')) return 'FLOWERS'
  if (text.includes('photo') || text.includes('camera') || text.includes('تصوير فوتو')) return 'PHOTOGRAPHY'
  if (text.includes('video') || text.includes('film') || text.includes('production') || text.includes('فيديو')) return 'VIDEO'
  if (text.includes('transport') || text.includes('نقل') || text.includes('shipping') || text.includes('delivery') || text.includes('logistics')) return 'TRANSPORT'
  if (text.includes('labor') || text.includes('worker') || text.includes('عمالة') || text.includes('عمال') || text.includes('staff') || text.includes('manpower')) return 'LABOR'
  if (text.includes('catering') || text.includes('hospitality') || text.includes('ضيافة') || text.includes('food') || text.includes('beverage')) return 'HOSPITALITY'
  if (text.includes('advertis') || text.includes('marketing') || text.includes('media') || text.includes('إعلان')) return 'PRINTING'
  if (text.includes('event') || text.includes('wedding') || text.includes('فعالية')) return 'OTHER'
  return 'OTHER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'لم يتم رفع ملف' }, { status: 400 })

    const text = await file.text()

    const { data, errors } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (data.length === 0) {
      return NextResponse.json({ error: 'الملف فارغ أو غير صالح' }, { status: 400 })
    }

    const headers = Object.keys(data[0])

    // Detect Zoho column names (handle both Vendors.csv and Contacts.csv)
    const nameCol    = headers.find(h => ['Contact Name', 'Display Name', 'Vendor Name', 'اسم المورد'].includes(h)) || null
    const emailCol   = headers.find(h => ['EmailID', 'Email', 'البريد الإلكتروني'].includes(h)) || null
    const phoneCol   = headers.find(h => ['Phone', 'الهاتف'].includes(h)) || null
    const mobileCol  = headers.find(h => ['MobilePhone', 'Mobile', 'الجوال'].includes(h)) || null
    const notesCol   = headers.find(h => ['Notes', 'ملاحظات'].includes(h)) || null
    const statusCol  = headers.find(h => ['Status', 'الحالة'].includes(h)) || null
    const zohoIdCol  = headers.find(h => ['Contact ID', 'معرف جهة الاتصال'].includes(h)) || null

    if (!nameCol) {
      return NextResponse.json({
        error: `لم يتم التعرف على عمود الاسم. الأعمدة المتوفرة: ${headers.slice(0, 10).join(', ')}`,
      }, { status: 400 })
    }

    let added = 0
    let updated = 0
    let skipped = 0

    for (const row of data) {
      const name = row[nameCol]?.trim()
      if (!name) { skipped++; continue }

      // Skip non-active (if status column exists)
      const status = statusCol ? row[statusCol]?.trim() : 'Active'
      if (status && status !== 'Active' && status !== '') { skipped++; continue }

      const email    = emailCol  ? row[emailCol]?.trim()  || null : null
      const phone    = phoneCol  ? row[phoneCol]?.trim()  || null :
                       mobileCol ? row[mobileCol]?.trim() || null : null
      const notes    = notesCol  ? row[notesCol]?.trim()  || ''   : ''
      const zohoId   = zohoIdCol ? row[zohoIdCol]?.trim() || null : null

      const serviceType = detectServiceType(name, notes)

      // Try find by zohoId first, then by name
      let existing = zohoId
        ? await prisma.supplier.findUnique({ where: { zohoId } })
        : null

      if (!existing) {
        existing = await prisma.supplier.findFirst({ where: { name } })
      }

      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            zohoId: zohoId || existing.zohoId,
            email: email || existing.email,
            phone: phone || existing.phone,
            serviceType,
            updatedAt: new Date(),
          },
        })
        updated++
      } else {
        await prisma.supplier.create({
          data: { zohoId, name, email, phone, serviceType, recommendation: 'UNDER_REVIEW' },
        })
        added++
      }
    }

    await prisma.zohoSyncLog.create({
      data: {
        syncType: 'VENDORS_CSV',
        status: 'SUCCESS',
        message: `موردون: ${added} جديد، ${updated} محدّث، ${skipped} متجاوز`,
        itemsSynced: added + updated,
      },
    })

    return NextResponse.json({ added, updated, skipped, total: data.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في معالجة الملف' }, { status: 500 })
  }
}
