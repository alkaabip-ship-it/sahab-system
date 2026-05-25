'use client'

import { useState, useRef } from 'react'
import { HiBuildingOffice2, HiArrowUpTray, HiLightBulb } from 'react-icons/hi2'

interface UploadResult {
  added: number
  updated: number
  skipped?: number
  total: number
  error?: string
}

function FileZone({
  onFile,
  loading,
  selectedName,
}: {
  onFile: (file: File) => void
  loading: boolean
  selectedName: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
        dragging ? 'border-sky-400 bg-sky-50' : selectedName ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50'
      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {selectedName ? (
        <div className="flex items-center justify-center gap-2 text-green-700">
          <span className="text-3xl">✓</span>
          <span className="text-sm font-medium max-w-[240px] truncate">{selectedName}</span>
        </div>
      ) : (
        <div className="text-slate-400">
          <div className="text-4xl mb-3">📎</div>
          <p className="text-sm font-medium">اسحب ملف Vendors.csv هنا أو اضغط للاختيار</p>
          <p className="text-xs mt-1 text-slate-300">CSV فقط</p>
        </div>
      )}
    </div>
  )
}

export default function UploadVendorsPage() {
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<UploadResult | null>(null)

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/vendors', { method: 'POST', body: fd })
      const r: UploadResult = await res.json()
      setResult(r)
    } catch {
      setResult({ error: 'خطأ في الاتصال بالخادم', added: 0, updated: 0, total: 0 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <HiBuildingOffice2 size={22} className="text-blue-500" />
          رفع الموردين — CSV
        </h2>
        <p className="text-slate-500 text-sm mt-1">صدّر Vendors.csv من Zoho Books وارفعه لتحديث قائمة الموردين</p>
      </div>

      {/* How to export */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-sky-700 mb-2 flex items-center gap-1">
          <HiLightBulb size={14} /> كيف تصدّر الموردين من Zoho Books؟
        </p>
        <ol className="text-xs text-sky-600 space-y-1 list-decimal list-inside">
          <li>افتح Zoho Books ← <strong>Purchases</strong> ← <strong>Vendors</strong></li>
          <li>اضغط ⋮ (ثلاث نقاط) ← <strong>Export Vendors</strong></li>
          <li>اختر <strong>CSV</strong> ثم <strong>Download</strong></li>
        </ol>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
        <FileZone onFile={setFile} loading={loading} selectedName={file?.name ?? ''} />

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {loading
            ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري الرفع...</>
            : <><HiArrowUpTray size={18} /> رفع الموردين</>}
        </button>

        {/* Result */}
        {result && (
          result.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              ✗ {result.error}
            </div>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
              <p className="text-green-700 font-semibold">✓ تم الرفع — {result.total} مورد</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.added}</p>
                  <p className="text-xs text-slate-500 mt-1">جديد</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-sky-600">{result.updated}</p>
                  <p className="text-xs text-slate-500 mt-1">محدّث</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-400">{result.skipped ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">متجاوز</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Column reference */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-3">الأعمدة المقروءة من Vendors.csv</p>
        <div className="space-y-1.5 text-xs font-mono">
          {[
            ['Contact ID',   'معرّف المورد (لمنع التكرار)'],
            ['Contact Name', 'اسم المورد ✓'],
            ['EmailID',      'البريد الإلكتروني'],
            ['Phone',        'الهاتف'],
            ['MobilePhone',  'الجوال'],
            ['Notes',        'يُستخدم لتحديد نوع الخدمة تلقائياً'],
            ['Status',       'يُستورد Active فقط'],
          ].map(([col, desc]) => (
            <div key={col} className="flex gap-2">
              <span className="text-sky-600 w-32 flex-shrink-0">{col}</span>
              <span className="text-slate-400">{desc}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
