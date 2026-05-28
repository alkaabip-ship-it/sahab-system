'use client'

import { useState, useRef, useEffect } from 'react'
import { HiCamera, HiArrowUpTray, HiSparkles, HiCheckCircle, HiDocumentText, HiBanknotes, HiChartBarSquare } from 'react-icons/hi2'
import { usePermissions } from '@/lib/PermissionsContext'
import { useTranslation } from '@/lib/i18n/LanguageContext'

type Step = 'upload' | 'analyzing' | 'review' | 'type' | 'saving' | 'done'
type BillType = 'supplier' | 'expense'

export default function UploadBillPage() {
  const { lang } = useTranslation()
  const isRTL = lang === 'ar'

  const [step, setStep]             = useState<Step>('upload')
  const [imageUrl, setImageUrl]     = useState<string | null>(null)
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [aiData, setAiData]         = useState<any>(null)
  const [billType, setBillType]     = useState<BillType | null>(null)
  const [projects, setProjects]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedProject,  setSelectedProject]  = useState('')
  const [selectedCategory, setSelectedCategory] = useState('other')
  const [msg, setMsg]               = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm]             = useState<any>({})
  const [analysis, setAnalysis]         = useState<string | null>(null)
  const [analyzing, setAnalyzing]       = useState(false)
  const [companyAnalysis, setCompanyAnalysis] = useState<string | null>(null)
  const [companySummary, setCompanySummary]   = useState<any>(null)
  const [loadingCompany, setLoadingCompany]   = useState(false)
  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/projects?limit=100').then(r => r.json()).then(d => {
      const list = Array.isArray(d.data) ? d.data : []
      list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setProjects(list)
    })
    fetch('/api/ai/create-expense').then(r => r.json()).then(d => setCategories(d.categories || []))
  }, [])

  function handleFile(file: File) {
    setImageFile(file)
    setImageUrl(URL.createObjectURL(file))
    analyzeImage(file)
  }

  async function analyzeImage(file: File) {
    setStep('analyzing')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST', body: fd })
      const d = await res.json()
      if (d.success) {
        setAiData(d.data)
        setForm(d.data)
        setStep('review')
      } else {
        setMsg({ type: 'error', text: d.error || (isRTL ? 'فشل التحليل' : 'Analysis failed') })
        setStep('upload')
      }
    } catch {
      setMsg({ type: 'error', text: isRTL ? 'حدث خطأ في الاتصال' : 'Connection error' })
      setStep('upload')
    }
  }

  async function handleSave() {
    setStep('saving')
    setMsg(null)
    try {
      const project = projects.find(p => p.id === selectedProject)
      let res: Response
      if (billType === 'supplier') {
        res = await fetch('/api/ai/create-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, projectId: selectedProject || null, projectCode: project?.code || null }),
        })
      } else {
        const fd = new FormData()
        fd.append('description',   form.description   || '')
        fd.append('amount',        String(form.amount || 0))
        fd.append('vatAmount',     String(form.vatAmount || 0))
        fd.append('date',          form.date          || '')
        fd.append('category',      selectedCategory)
        fd.append('invoiceNumber', form.invoiceNumber || '')
        fd.append('supplierName',  form.supplierName  || '')
        if (imageFile) fd.append('receipt', imageFile)
        res = await fetch('/api/ai/create-expense', { method: 'POST', body: fd })
      }
      const d = await res.json()
      if (res.ok) {
        setMsg({
          type: 'success',
          text: billType === 'supplier'
            ? (isRTL ? '✓ تم إنشاء الفاتورة في Zoho Books' : '✓ Bill created in Zoho Books')
            : (isRTL ? '✓ تم تسجيل المصروف في Zoho Books' : '✓ Expense recorded in Zoho Books'),
        })
        setStep('done')
      } else {
        setMsg({ type: 'error', text: d.error || (isRTL ? 'فشل الحفظ' : 'Save failed') })
        setStep('type')
      }
    } catch {
      setMsg({ type: 'error', text: isRTL ? 'حدث خطأ في الاتصال' : 'Connection error' })
      setStep('type')
    }
  }

  async function runCompanyAnalysis() {
    setLoadingCompany(true)
    try {
      const res = await fetch('/api/ai/company-analysis')
      const d = await res.json()
      setCompanyAnalysis(d.analysis || null)
      setCompanySummary(d.summary || null)
    } catch {}
    setLoadingCompany(false)
  }

  async function runFinancialAnalysis() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/analyze-financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: form.supplierName, amount: form.totalAmount || form.amount, projectId: selectedProject || null }),
      })
      const d = await res.json()
      if (d.analysis) setAnalysis(d.analysis)
    } catch {}
    setAnalyzing(false)
  }

  function reset() {
    setStep('upload'); setImageUrl(null); setImageFile(null)
    setAiData(null); setForm({}); setBillType(null)
    setSelectedProject(''); setMsg(null); setAnalysis(null)
  }

  const perms = usePermissions()
  const formatNum = (n: number) => new Intl.NumberFormat('en-AE').format(Math.round(n))

  // ── Inline translations (page-specific) ──
  const tx = {
    title:          isRTL ? 'رفع فاتورة بالذكاء الاصطناعي' : 'AI Bill Upload',
    uploadHint:     isRTL ? 'صوّر الفاتورة أو ارفع صورة منها، الذكاء الاصطناعي سيستخرج البيانات تلقائياً' : 'Take a photo or upload an image of the bill — AI will extract data automatically',
    camera:         isRTL ? 'تصوير' : 'Camera',
    uploadFile:     isRTL ? 'رفع ملف' : 'Upload File',
    analyzing:      isRTL ? 'Claude يحلل الفاتورة...' : 'Claude is analyzing the bill...',
    extractedData:  isRTL ? 'بيانات استخرجها Claude' : 'Data extracted by Claude',
    reviewEdit:     isRTL ? 'تحقق وعدّل إذا لزم' : 'Review and edit if needed',
    supplier:       isRTL ? 'المورد' : 'Supplier',
    supplierTRN:    isRTL ? 'TRN المورد' : 'Supplier TRN',
    buyerTRN:       isRTL ? 'TRN المشتري' : 'Buyer TRN',
    amountExVat:    isRTL ? 'المبلغ (بدون ض)' : 'Amount (ex. VAT)',
    vatLabel:       (rate: number) => isRTL ? `الضريبة ${rate}%` : `VAT ${rate}%`,
    total:          isRTL ? 'الإجمالي' : 'Total',
    date:           isRTL ? 'التاريخ' : 'Date',
    invoiceNum:     isRTL ? 'رقم الفاتورة' : 'Invoice No.',
    supplierName:   isRTL ? 'اسم المورد' : 'Supplier Name',
    amountExVatFull:isRTL ? 'المبلغ (بدون ضريبة)' : 'Amount (excl. VAT)',
    description:    isRTL ? 'الوصف' : 'Description',
    smartAnalysis:  isRTL ? 'تحليل مالي ذكي' : 'Smart Financial Analysis',
    analyze:        isRTL ? 'تحليل' : 'Analyze',
    analyzing2:     isRTL ? 'جاري التحليل...' : 'Analyzing...',
    analysisHint:   isRTL ? 'اضغط "تحليل" ليشرح الذكاء الاصطناعي وضع هذا المورد وأثر الفاتورة على الشركة' : 'Click Analyze for AI insights on this supplier and the bill\'s impact',
    nextChooseType: isRTL ? 'التالي — اختر نوع الفاتورة' : 'Next — Choose Bill Type',
    chooseType:     isRTL ? 'ما نوع هذه الفاتورة؟' : 'What type is this bill?',
    supplierBill:   isRTL ? 'فاتورة مورد' : 'Supplier Bill',
    supplierBillSub:isRTL ? 'تُرفع في Zoho Books تلقائياً' : 'Auto-uploaded to Zoho Books',
    companyExp:     isRTL ? 'مصروف شركة' : 'Company Expense',
    companyExpSub:  isRTL ? 'بتي كاش / مصاريف إدارية' : 'Petty cash / admin expenses',
    linkProject:    isRTL ? 'ربط بمشروع (اختياري)' : 'Link to Project (optional)',
    noProject:      isRTL ? '— بدون مشروع —' : '— No project —',
    expenseCategory:isRTL ? 'فئة المصروف في Zoho Books' : 'Expense Category in Zoho Books',
    expenseCatHint: isRTL ? 'سيُنشأ المصروف في Zoho Books تحت هذه الفئة مع حساب البتي كاش' : 'Expense will be created in Zoho Books under this category with petty cash account',
    saveBill:       isRTL ? 'حفظ الفاتورة' : 'Save Bill',
    saving:         isRTL ? 'جاري الحفظ...' : 'Saving...',
    done:           isRTL ? 'تم بنجاح!' : 'Done!',
    uploadAnother:  isRTL ? 'رفع فاتورة أخرى' : 'Upload Another Bill',
    // Company analysis
    companyStatus:  (year: number) => isRTL ? `تحليل وضع الشركة — ${year}` : `Company Status — ${year}`,
    margin:         isRTL ? 'هامش' : 'Margin',
    revenue:        isRTL ? 'الإيرادات' : 'Revenue',
    netProfit:      isRTL ? 'صافي الربح' : 'Net Profit',
    pendingBills:   isRTL ? 'فواتير معلقة' : 'Pending Bills',
    bill:           isRTL ? 'فاتورة' : 'bill(s)',
    activeProjects: isRTL ? 'مشاريع نشطة' : 'Active Projects',
    project:        isRTL ? 'مشروع' : 'project(s)',
    analyzing3:     isRTL ? 'Claude يحلل وضع الشركة...' : 'Claude is analyzing company status...',
    analyzeNow:     isRTL ? 'تحليل وضع الشركة الآن' : 'Analyze Company Status Now',
    aed:            'AED',
  }

  return (
    <div className="max-w-3xl space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <HiSparkles className="text-purple-500" size={24} />
        {tx.title}
      </h2>

      {/* Company Analysis */}
      {perms.viewFinancials && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <HiChartBarSquare size={16} className="text-emerald-400" />
              {tx.companyStatus(companySummary?.currentYear ?? new Date().getFullYear())}
            </p>
            {companySummary && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companySummary.yearMargin >= 20 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {tx.margin} {companySummary.yearMargin}%
              </span>
            )}
          </div>

          {companySummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-0.5">{tx.revenue}</p>
                <p className="text-sm font-bold text-white">{formatNum(companySummary.yearRevenue)}</p>
                <p className="text-xs text-slate-500">{tx.aed}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-0.5">{tx.netProfit}</p>
                <p className={`text-sm font-bold ${companySummary.yearProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {formatNum(Math.abs(companySummary.yearProfit))}
                </p>
                <p className="text-xs text-slate-500">{tx.aed}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-0.5">{tx.pendingBills}</p>
                <p className="text-sm font-bold text-orange-300">{formatNum(companySummary.unpaidTotal)}</p>
                <p className="text-xs text-slate-500">{companySummary.unpaidCount} {tx.bill}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-0.5">{tx.activeProjects}</p>
                <p className="text-sm font-bold text-blue-300">{companySummary.activeProjects}</p>
                <p className="text-xs text-slate-500">{tx.project}</p>
              </div>
            </div>
          )}

          {loadingCompany ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm border-t border-white/10 pt-4">
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              {tx.analyzing3}
            </div>
          ) : companyAnalysis ? (
            <div className="text-sm text-slate-200 whitespace-pre-line leading-relaxed border-t border-white/10 pt-4">
              {companyAnalysis}
            </div>
          ) : (
            <div className="border-t border-white/10 pt-4">
              <button onClick={runCompanyAnalysis}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-sm font-medium rounded-lg transition-all border border-emerald-500/30">
                <HiSparkles size={15} /> {tx.analyzeNow}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-10 text-center space-y-4">
          {msg && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{msg.text}</div>}
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
            <HiSparkles size={32} className="text-purple-500" />
          </div>
          <p className="text-slate-500 text-sm">{tx.uploadHint}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-all">
              <HiCamera size={20} /> {tx.camera}
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all">
              <HiArrowUpTray size={20} /> {tx.uploadFile}
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {/* Step 2: Analyzing */}
      {step === 'analyzing' && (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center space-y-4">
          {imageUrl && <img src={imageUrl} className="w-48 h-48 object-cover rounded-xl mx-auto shadow" alt="bill" />}
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600 font-medium">{tx.analyzing}</p>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            {imageUrl && <img src={imageUrl} className="w-32 h-32 object-cover rounded-xl shadow flex-shrink-0" alt="bill" />}
            <div className="flex-1 bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                <HiSparkles size={14} /> {tx.extractedData}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                <span className="text-slate-400">{tx.supplier}:</span>          <span className="font-medium">{form.supplierName || '—'}</span>
                <span className="text-slate-400">{tx.supplierTRN}:</span>       <span className="font-mono font-medium text-blue-700">{form.supplierTRN || '—'}</span>
                <span className="text-slate-400">{tx.buyerTRN}:</span>          <span className="font-mono font-medium text-blue-700">{form.buyerTRN || '—'}</span>
                <span className="text-slate-400">{tx.amountExVat}:</span>       <span className="font-medium">{form.amount} {form.currency || 'AED'}</span>
                <span className="text-slate-400">{tx.vatLabel(form.vatRate || 5)}:</span><span className="font-medium text-orange-600">{form.vatAmount || 0} AED</span>
                <span className="text-slate-400">{tx.total}:</span>             <span className="font-bold text-green-700">{form.totalAmount} AED</span>
                <span className="text-slate-400">{tx.date}:</span>              <span className="font-medium">{form.date || '—'}</span>
                <span className="text-slate-400">{tx.invoiceNum}:</span>        <span className="font-medium">{form.invoiceNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700">{tx.reviewEdit}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{tx.supplierName}</label>
                <input value={form.supplierName || ''} onChange={e => setForm((p: any) => ({ ...p, supplierName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{tx.invoiceNum}</label>
                <input value={form.invoiceNumber || ''} onChange={e => setForm((p: any) => ({ ...p, invoiceNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{tx.amountExVatFull}</label>
                <input type="number" value={form.amount || ''} onChange={e => setForm((p: any) => ({ ...p, amount: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{tx.date}</label>
                <input type="date" value={form.date || ''} onChange={e => setForm((p: any) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">{tx.description}</label>
              <input value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>

          {/* Financial Analysis */}
          {perms.viewFinancials && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <HiChartBarSquare size={16} className="text-emerald-500" /> {tx.smartAnalysis}
                </p>
                <button onClick={runFinancialAnalysis} disabled={analyzing}
                  className="text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-200 text-white rounded-lg transition-all flex items-center gap-1.5">
                  {analyzing
                    ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> {tx.analyzing2}</>
                    : <><HiSparkles size={12} /> {tx.analyze}</>}
                </button>
              </div>
              {analysis ? (
                <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  {analysis}
                </div>
              ) : (
                <p className="text-xs text-slate-400">{tx.analysisHint}</p>
              )}
            </div>
          )}

          <button onClick={() => setStep('type')}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            {tx.nextChooseType}
          </button>
        </div>
      )}

      {/* Step 4: Choose Type */}
      {step === 'type' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-700">{tx.chooseType}</p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setBillType('supplier')}
              className={`p-5 rounded-xl border-2 text-start transition-all ${billType === 'supplier' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}>
              <HiDocumentText size={28} className="text-purple-500 mb-2" />
              <p className="font-semibold text-slate-800">{tx.supplierBill}</p>
              <p className="text-xs text-slate-400 mt-1">{tx.supplierBillSub}</p>
            </button>
            <button onClick={() => setBillType('expense')}
              className={`p-5 rounded-xl border-2 text-start transition-all ${billType === 'expense' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}>
              <HiBanknotes size={28} className="text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-800">{tx.companyExp}</p>
              <p className="text-xs text-slate-400 mt-1">{tx.companyExpSub}</p>
            </button>
          </div>

          {billType === 'supplier' && (
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <label className="text-sm font-medium text-slate-700 mb-2 block">{tx.linkProject}</label>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                <option value="">{tx.noProject}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
          )}

          {billType === 'expense' && (
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <label className="text-sm font-medium text-slate-700 mb-2 block">{tx.expenseCategory}</label>
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                {categories.map((c: any) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-2">{tx.expenseCatHint}</p>
            </div>
          )}

          {msg && (
            <div className={`p-3 rounded-lg text-sm ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {msg.text}
            </div>
          )}

          {billType && (
            <button onClick={handleSave}
              className={`w-full py-3 font-medium rounded-xl text-white transition-all ${billType === 'supplier' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {tx.saveBill}
            </button>
          )}
        </div>
      )}

      {/* Step 5: Saving */}
      {step === 'saving' && (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 font-medium">{tx.saving}</p>
        </div>
      )}

      {/* Step 6: Done */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center space-y-4">
          <HiCheckCircle size={56} className="text-green-500 mx-auto" />
          <p className="text-lg font-bold text-slate-800">{tx.done}</p>
          {msg && <p className="text-sm text-green-700">{msg.text}</p>}
          <button onClick={reset}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            {tx.uploadAnother}
          </button>
        </div>
      )}
    </div>
  )
}
