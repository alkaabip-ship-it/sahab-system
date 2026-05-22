'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface UploadResult {
  added: number
  updated: number
  linked?: number
  unlinked?: number
  skipped?: number
  voided?: number
  total: number
  error?: string
}

function FileZone({
  accept,
  onFile,
  loading,
  selectedName,
}: {
  accept: string
  onFile: (file: File) => void
  loading: boolean
  selectedName: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File) { onFile(file) }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
        dragging ? 'border-sky-400 bg-sky-50' : selectedName ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50'
      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) handleFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {selectedName ? (
        <div className="flex items-center justify-center gap-2 text-green-700">
          <span className="text-2xl">✓</span>
          <span className="text-sm font-medium max-w-[220px] truncate">{selectedName}</span>
        </div>
      ) : (
        <div className="text-slate-400">
          <div className="text-3xl mb-2">📎</div>
          <p className="text-sm">اسحب الملف هنا أو اضغط للاختيار</p>
          <p className="text-xs mt-1 text-slate-300">CSV فقط</p>
        </div>
      )}
    </div>
  )
}

function ResultBadge({ result, type }: { result: UploadResult; type: 'vendors' | 'bills' | 'invoices' }) {
  if (result.error) {
    return (
      <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-600 text-sm">✗ {result.error}</p>
      </div>
    )
  }
  return (
    <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
      <p className="text-green-700 font-semibold text-sm">✓ تم الرفع — {result.total} سجل</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white rounded-lg px-3 py-1.5 flex justify-between">
          <span className="text-slate-500">جديد</span>
          <span className="font-bold text-green-600">{result.added}</span>
        </div>
        <div className="bg-white rounded-lg px-3 py-1.5 flex justify-between">
          <span className="text-slate-500">محدّث</span>
          <span className="font-bold text-sky-600">{result.updated}</span>
        </div>
        {result.skipped !== undefined && result.skipped > 0 && (
          <div className="bg-white rounded-lg px-3 py-1.5 flex justify-between">
            <span className="text-slate-500">متجاوز</span>
            <span className="font-bold text-slate-400">{result.skipped}</span>
          </div>
        )}
        {(type === 'bills' || type === 'invoices') && (
          <>
            <div className="bg-white rounded-lg px-3 py-1.5 flex justify-between">
              <span className="text-slate-500">مرتبط بمشروع</span>
              <span className="font-bold text-green-600">{result.linked ?? 0}</span>
            </div>
            <div className="bg-white rounded-lg px-3 py-1.5 flex justify-between">
              <span className="text-slate-500">غير مرتبط</span>
              <span className="font-bold text-amber-600">{result.unlinked ?? 0}</span>
            </div>
            {type === 'invoices' && (result.voided ?? 0) > 0 && (
              <div className="bg-white rounded-lg px-3 py-1.5 flex justify-between col-span-2">
                <span className="text-slate-500">ملغية (Void) — تم تجاهلها</span>
                <span className="font-bold text-slate-400">{result.voided}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

async function uploadFile(endpoint: string, file: File): Promise<UploadResult> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(endpoint, { method: 'POST', body: fd })
  return res.json()
}

export default function UploadPage() {
  const [vendorFile, setVendorFile]       = useState<File | null>(null)
  const [billFile, setBillFile]           = useState<File | null>(null)
  const [invoiceFile, setInvoiceFile]     = useState<File | null>(null)
  const [vendorLoading, setVendorLoading]   = useState(false)
  const [billLoading, setBillLoading]       = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [vendorResult, setVendorResult]     = useState<UploadResult | null>(null)
  const [billResult, setBillResult]         = useState<UploadResult | null>(null)
  const [invoiceResult, setInvoiceResult]   = useState<UploadResult | null>(null)

  async function runUpload(
    file: File | null,
    endpoint: string,
    setLoading: (v: boolean) => void,
    setResult: (r: UploadResult) => void
  ) {
    if (!file) return
    setLoading(true)
    try {
      const r = await uploadFile(endpoint, file)
      setResult(r)
    } catch {
      setResult({ error: 'خطأ في الاتصال بالخادم', added: 0, updated: 0, total: 0 })
    } finally {
      setLoading(false)
    }
  }

  const bothLoading = vendorLoading || billLoading || invoiceLoading
  const hasFiles = vendorFile || billFile || invoiceFile

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">رفع بيانات من Zoho Books</h2>
        <p className="text-slate-500 text-sm mt-1">صدّر ملفات CSV من Zoho وارفعها لتحديث الموردين والفواتير تلقائياً</p>
      </div>

      {/* Export guide */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-5">
        <h3 className="font-semibold text-sky-800 mb-3">💡 كيف تصدّر من Zoho Books؟</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-sky-700 mb-1">🏢 الموردون</p>
            <ol className="space-y-0.5 text-sky-600 text-xs list-decimal list-inside">
              <li>Purchases → Vendors</li>
              <li>⋮ → Export Vendors</li>
              <li>CSV → Download</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-sky-700 mb-1">🧾 فواتير الموردين</p>
            <ol className="space-y-0.5 text-sky-600 text-xs list-decimal list-inside">
              <li>Purchases → Bills</li>
              <li>Export → CSV</li>
              <li>Download</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-sky-700 mb-1">📄 فواتير العملاء</p>
            <ol className="space-y-0.5 text-sky-600 text-xs list-decimal list-inside">
              <li>Sales → Invoices</li>
              <li>Export → CSV</li>
              <li>Download</li>
            </ol>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-sky-200 text-xs text-sky-600">
          <strong>الربط التلقائي:</strong> النظام يربط الفواتير بالمشاريع عبر <strong>Customer Name</strong> — تأكد أن اسم العميل في المشاريع يطابق اسمه في Zoho Books.
        </div>
      </div>

      {/* Upload cards */}
      <div className="grid md:grid-cols-3 gap-5">

        {/* Vendors */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">🏢</div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">ملف الموردين</p>
              <p className="text-xs text-slate-400">Vendors.csv</p>
            </div>
          </div>
          <FileZone
            accept=".csv"
            onFile={setVendorFile}
            loading={vendorLoading}
            selectedName={vendorFile?.name ?? ''}
          />
          <button
            onClick={() => runUpload(vendorFile, '/api/upload/vendors', setVendorLoading, setVendorResult)}
            disabled={!vendorFile || vendorLoading}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-lg transition-all text-sm"
          >
            {vendorLoading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>جاري الرفع...</span>
              : 'رفع الموردين'}
          </button>
          {vendorResult && <ResultBadge result={vendorResult} type="vendors" />}
        </div>

        {/* Bills */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">🧾</div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">فواتير الموردين</p>
              <p className="text-xs text-slate-400">Bill.csv</p>
            </div>
          </div>
          <FileZone
            accept=".csv"
            onFile={setBillFile}
            loading={billLoading}
            selectedName={billFile?.name ?? ''}
          />
          <button
            onClick={() => runUpload(billFile, '/api/upload/bills', setBillLoading, setBillResult)}
            disabled={!billFile || billLoading}
            className="w-full py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-lg transition-all text-sm"
          >
            {billLoading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>جاري الرفع...</span>
              : 'رفع فواتير الموردين'}
          </button>
          {billResult && <ResultBadge result={billResult} type="bills" />}
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">📄</div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">فواتير العملاء</p>
              <p className="text-xs text-slate-400">Invoice.csv</p>
            </div>
          </div>
          <FileZone
            accept=".csv"
            onFile={setInvoiceFile}
            loading={invoiceLoading}
            selectedName={invoiceFile?.name ?? ''}
          />
          <button
            onClick={() => runUpload(invoiceFile, '/api/upload/invoices', setInvoiceLoading, setInvoiceResult)}
            disabled={!invoiceFile || invoiceLoading}
            className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-lg transition-all text-sm"
          >
            {invoiceLoading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>جاري الرفع...</span>
              : 'رفع فواتير العملاء'}
          </button>
          {invoiceResult && <ResultBadge result={invoiceResult} type="invoices" />}
        </div>
      </div>

      {/* Upload all */}
      {hasFiles && (
        <button
          onClick={async () => {
            await Promise.all([
              vendorFile  ? runUpload(vendorFile,  '/api/upload/vendors',   setVendorLoading,  setVendorResult)  : Promise.resolve(),
              billFile    ? runUpload(billFile,    '/api/upload/bills',     setBillLoading,    setBillResult)    : Promise.resolve(),
              invoiceFile ? runUpload(invoiceFile, '/api/upload/invoices',  setInvoiceLoading, setInvoiceResult) : Promise.resolve(),
            ])
          }}
          disabled={bothLoading}
          className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {bothLoading
            ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>جاري رفع الملفات...</>
            : <><span>⬆</span> رفع جميع الملفات</>}
        </button>
      )}

      {/* Unlinked bills hint */}
      {billResult && !billResult.error && (billResult.unlinked ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 font-medium text-sm mb-1">
            ⚠️ {billResult.unlinked} فاتورة غير مرتبطة بمشروع
          </p>
          <p className="text-amber-600 text-xs mb-3">
            النظام يربط الفواتير تلقائياً عبر اسم العميل. إذا لم يتطابق، ارفع الملف مجدداً بعد
            إضافة المشاريع بنفس اسم العميل الموجود في Zoho Books، أو ارتبطها يدوياً.
          </p>
          <Link
            href="/dashboard/bills"
            className="inline-flex items-center gap-2 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg transition-all font-medium"
          >
            🧾 اذهب إلى الفواتير غير المرتبطة
          </Link>
        </div>
      )}

      {/* Column reference */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-700 mb-4 text-sm">📌 الأعمدة المعروفة تلقائياً من Zoho Books</h3>
        <div className="grid md:grid-cols-3 gap-6 text-xs">
          <div>
            <p className="font-medium text-slate-600 mb-2">Vendors.csv</p>
            <div className="space-y-1.5 font-mono text-slate-500">
              {[
                ['Contact ID',    'معرّف المورد (لتجنب التكرار)'],
                ['Contact Name',  'اسم المورد ✓'],
                ['EmailID',       'البريد الإلكتروني'],
                ['Phone',         'الهاتف'],
                ['MobilePhone',   'الجوال'],
                ['Notes',         'يُستخدم لتحديد نوع الخدمة'],
                ['Status',        'Active فقط يُستورد'],
              ].map(([col, desc]) => (
                <div key={col} className="flex gap-2">
                  <span className="text-sky-600 w-28 flex-shrink-0">{col}</span>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-600 mb-2">Bill.csv</p>
            <div className="space-y-1.5 font-mono text-slate-500">
              {[
                ['Bill ID',       'معرّف الفاتورة (لتجنب التكرار)'],
                ['Bill Number',   'رقم الفاتورة ✓'],
                ['Vendor Name',   'اسم المورد ✓'],
                ['Total',         'المبلغ الإجمالي ✓'],
                ['Bill Date',     'تاريخ الفاتورة ✓'],
                ['Due Date',      'تاريخ الاستحقاق'],
                ['Bill Status',   'Paid → مدفوع، Overdue → غير مدفوع'],
                ['Customer Name', '→ ربط تلقائي بالمشروع ✓'],
                ['Vendor Notes',  'يُفحص عن PRJ-XXX'],
              ].map(([col, desc]) => (
                <div key={col} className="flex gap-2">
                  <span className="text-green-600 w-28 flex-shrink-0">{col}</span>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-600 mb-2">Invoice.csv</p>
            <div className="space-y-1.5 font-mono text-slate-500">
              {[
                ['Invoice ID',     'معرّف الفاتورة (لتجنب التكرار)'],
                ['Invoice Number', 'رقم الفاتورة ✓'],
                ['Customer Name',  '→ ربط تلقائي بالمشروع ✓'],
                ['Invoice Date',   'تاريخ الفاتورة ✓'],
                ['Due Date',       'تاريخ الاستحقاق'],
                ['Total',          'المبلغ الإجمالي ✓'],
                ['Balance',        'الرصيد المتبقي'],
                ['Invoice Status', 'Paid/Closed → مدفوع، Void → يُتجاهل'],
                ['Project Name',   '→ ربط تلقائي بالمشروع'],
                ['Notes',          'ملاحظات'],
              ].map(([col, desc]) => (
                <div key={col} className="flex gap-2">
                  <span className="text-purple-600 w-28 flex-shrink-0">{col}</span>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
