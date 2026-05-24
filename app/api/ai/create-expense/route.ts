import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessToken } from '@/lib/zoho'
import axios from 'axios'
import FormData from 'form-data'

const ZOHO_BASE = 'https://www.zohoapis.com/books/v3'
const PETTY_CASH_ACCOUNT_ID = '4104018000000000361'

const EXPENSE_ACCOUNTS: Record<string, string> = {
  'travel':       '4104018000000000418',
  'salary':       '4104018000000000445',
  'it':           '4104018000000000427',
  'government':   '4104018000000113025',
  'meals':        '4104018000000000448',
  'office':       '4104018000000000430',
  'advertising':  '4104018000000000424',
  'auto':         '4104018000000000421',
  'printing':     '4104018000000000436',
  'other':        '4104018000000000418',
}

export async function GET() {
  return NextResponse.json({
    categories: [
      { key: 'travel',      label: 'مصاريف سفر' },
      { key: 'meals',       label: 'وجبات وضيافة' },
      { key: 'office',      label: 'مستلزمات مكتبية' },
      { key: 'printing',    label: 'طباعة وقرطاسية' },
      { key: 'it',          label: 'تقنية واتصالات' },
      { key: 'advertising', label: 'تسويق وإعلان' },
      { key: 'government',  label: 'رسوم حكومية' },
      { key: 'auto',        label: 'مصاريف سيارات' },
      { key: 'salary',      label: 'رواتب وأجور' },
      { key: 'other',       label: 'أخرى' },
    ]
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  // Accept multipart/form-data to include the receipt image
  const formData = await req.formData()
  const description   = formData.get('description') as string
  const amount        = formData.get('amount') as string
  const vatAmount     = formData.get('vatAmount') as string | null
  const date          = formData.get('date') as string | null
  const category      = formData.get('category') as string | null
  const invoiceNumber = formData.get('invoiceNumber') as string | null
  const supplierName  = formData.get('supplierName') as string | null
  const receiptFile   = formData.get('receipt') as File | null

  if (!amount || !description) {
    return NextResponse.json({ error: 'المبلغ والوصف مطلوبان' }, { status: 400 })
  }

  const accountId = EXPENSE_ACCOUNTS[category || 'other']

  try {
    const dbOrg = await prisma.setting.findUnique({ where: { key: 'ZOHO_ORGANIZATION_ID' } })
    const orgId = dbOrg?.value || process.env.ZOHO_ORGANIZATION_ID
    const token = await getAccessToken()

    // Create expense in Zoho Books
    const zohoPayload: any = {
      account_id: accountId,
      paid_through_account_id: PETTY_CASH_ACCOUNT_ID,
      date: date || new Date().toISOString().split('T')[0],
      amount: parseFloat(amount),
      description: `${description}${invoiceNumber ? ` | رقم: ${invoiceNumber}` : ''}${supplierName ? ` | المورد: ${supplierName}` : ''}`,
      is_inclusive_tax: false,
    }

    if (vatAmount && parseFloat(vatAmount) > 0) {
      zohoPayload.tax_amount = parseFloat(vatAmount)
    }

    const createRes = await axios.post(`${ZOHO_BASE}/expenses`, zohoPayload, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: orgId },
    })

    const zohoExpense = createRes.data.expense
    if (!zohoExpense) throw new Error(createRes.data.message || 'فشل إنشاء المصروف في Zoho')

    // Attach receipt image if provided
    if (receiptFile) {
      try {
        const bytes = await receiptFile.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const receiptForm = new FormData()
        receiptForm.append('receipt', buffer, {
          filename: receiptFile.name || 'receipt.jpg',
          contentType: receiptFile.type || 'image/jpeg',
        })

        await axios.post(
          `${ZOHO_BASE}/expenses/${zohoExpense.expense_id}/receipt`,
          receiptForm,
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${token}`,
              ...receiptForm.getHeaders(),
            },
            params: { organization_id: orgId },
          }
        )
      } catch (receiptErr: any) {
        // Don't fail if receipt upload fails — expense is already created
        console.warn('Receipt upload failed:', receiptErr?.response?.data || receiptErr.message)
      }
    }

    return NextResponse.json({ success: true, zohoExpenseId: zohoExpense.expense_id })
  } catch (err: any) {
    console.error(err?.response?.data || err.message)
    return NextResponse.json(
      { error: err?.response?.data?.message || err.message || 'فشل إنشاء المصروف' },
      { status: 500 }
    )
  }
}
