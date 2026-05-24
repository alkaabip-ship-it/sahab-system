'use client'
import { useEffect, useRef, useState } from 'react'
import { HiPlus, HiTrash, HiPrinter, HiBookmarkSquare, HiFolderOpen, HiXMark, HiCheck, HiPencilSquare } from 'react-icons/hi2'

interface Supplier  { id: string; name: string; serviceType: string; dealCount?: number }
interface Item      { id: string; supplierId: string; name: string; serviceType: string; quote: number }
interface Plan      { id: string; name: string; saleValue: number; items: string; updatedAt: string }

function fmt(n: number) {
  return n.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ar-AE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PlanningPage() {
  const [projectName, setProjectName] = useState('')
  const [saleValue,   setSaleValue]   = useState<number | ''>('')
  const [suppliers,   setSuppliers]   = useState<Supplier[]>([])
  const [selId,       setSelId]       = useState('')
  const [quoteInput,  setQuoteInput]  = useState<number | ''>('')
  const [items,       setItems]       = useState<Item[]>([])

  // saved plans
  const [plans,       setPlans]       = useState<Plan[]>([])
  const [showPlans,   setShowPlans]   = useState(false)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [savedMsg,    setSavedMsg]    = useState(false)

  // load suppliers
  useEffect(() => {
    fetch('/api/suppliers?limit=200')
      .then(r => r.json())
      .then(d => {
        const list: Supplier[] = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        list.sort((a, b) => (b.dealCount ?? 0) - (a.dealCount ?? 0))
        setSuppliers(list)
        if (list.length) setSelId(list[0].id)
      })
  }, [])

  // load saved plans list
  function loadPlans() {
    fetch('/api/planning').then(r => r.json()).then(d => setPlans(Array.isArray(d) ? d : []))
  }
  useEffect(() => { loadPlans() }, [])

  const sale     = typeof saleValue === 'number' ? saleValue : 0
  const expenses = items.reduce((s, i) => s + i.quote, 0)
  const profit   = sale - expenses
  const margin   = sale > 0 ? (profit / sale) * 100 : 0

  function addItem() {
    if (!selId || !quoteInput) return
    const sup = suppliers.find(s => s.id === selId)
    if (!sup) return
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      supplierId: sup.id,
      name: sup.name,
      serviceType: sup.serviceType,
      quote: typeof quoteInput === 'number' ? quoteInput : 0,
    }])
    setQuoteInput('')
  }

  function removeItem(id: string) { setItems(prev => prev.filter(i => i.id !== id)) }

  // Save / Update plan
  async function handleSave() {
    if (!projectName.trim()) return alert('أدخل اسم التخطيط أولاً')
    setSaving(true)
    const body = { name: projectName, saleValue: sale, items }

    const res = currentPlanId
      ? await fetch(`/api/planning/${currentPlanId}`, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/planning',                  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    if (res.ok) {
      const plan = await res.json()
      if (!currentPlanId) setCurrentPlanId(plan.id)
      loadPlans()
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    }
    setSaving(false)
  }

  // Load a plan
  function loadPlan(plan: Plan) {
    setProjectName(plan.name)
    setSaleValue(plan.saleValue)
    setItems(JSON.parse(plan.items))
    setCurrentPlanId(plan.id)
    setShowPlans(false)
  }

  // New plan (clear)
  function newPlan() {
    setProjectName('')
    setSaleValue('')
    setItems([])
    setCurrentPlanId(null)
  }

  // Delete plan
  async function deletePlan(id: string) {
    if (!confirm('حذف هذا التخطيط؟')) return
    await fetch(`/api/planning/${id}`, { method: 'DELETE' })
    loadPlans()
    if (currentPlanId === id) newPlan()
  }

  const selectedSupplier = suppliers.find(s => s.id === selId)

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #planning-print, #planning-print * { visibility: visible !important; }
          #planning-print { position: fixed; top: 0; left: 0; width: 100%; padding: 32px; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-5 p-2">

        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 no-print">
          <h1 className="text-2xl font-bold text-slate-800">التخطيط للمشاريع</h1>
          <div className="flex items-center gap-2">
            <button onClick={newPlan}
              className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition">
              <HiPencilSquare size={17} /> تخطيط جديد
            </button>
            <button onClick={() => { loadPlans(); setShowPlans(true) }}
              className="flex items-center gap-1.5 border border-sky-300 text-sky-600 hover:bg-sky-50 px-4 py-2 rounded-lg text-sm font-medium transition">
              <HiFolderOpen size={17} /> التخطيطات المحفوظة {plans.length > 0 && <span className="bg-sky-100 text-sky-700 text-xs px-1.5 py-0.5 rounded-full">{plans.length}</span>}
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition text-white ${savedMsg ? 'bg-emerald-500' : 'bg-sky-500 hover:bg-sky-600'}`}>
              {savedMsg ? <><HiCheck size={17} /> تم الحفظ</> : <><HiBookmarkSquare size={17} /> {currentPlanId ? 'حفظ التغييرات' : 'حفظ التخطيط'}</>}
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <HiPrinter size={17} /> PDF
            </button>
          </div>
        </div>

        {/* Current plan indicator */}
        {currentPlanId && (
          <div className="no-print flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
            <HiCheck size={16} />
            تعديل على: <span className="font-semibold">{projectName}</span>
          </div>
        )}

        {/* Saved plans drawer */}
        {showPlans && (
          <div className="no-print bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">التخطيطات المحفوظة</h2>
              <button onClick={() => setShowPlans(false)} className="text-slate-400 hover:text-slate-600"><HiXMark size={20} /></button>
            </div>
            {plans.length === 0
              ? <p className="text-center text-slate-400 text-sm py-8">لا توجد تخطيطات محفوظة بعد</p>
              : <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {plans.map(p => {
                    const pItems = JSON.parse(p.items) as Item[]
                    const pExp   = pItems.reduce((s, i) => s + i.quote, 0)
                    const pProf  = p.saleValue - pExp
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {fmtDate(p.updatedAt)} · بيع: {fmt(p.saleValue)} · ربح: <span className={pProf >= 0 ? 'text-emerald-600' : 'text-red-500'}>{fmt(pProf)}</span> د.إ
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mr-3">
                          <button onClick={() => loadPlan(p)}
                            className="text-xs bg-sky-50 text-sky-600 hover:bg-sky-100 px-3 py-1.5 rounded-lg font-medium transition">
                            فتح
                          </button>
                          <button onClick={() => deletePlan(p.id)} className="text-red-400 hover:text-red-600 transition p-1">
                            <HiTrash size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}

        {/* Printable area */}
        <div id="planning-print">

          {/* Print header */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold text-slate-800 text-right">{projectName || 'تخطيط المشروع'}</h1>
            <p className="text-slate-500 text-sm text-right">{new Date().toLocaleDateString('ar-AE')}</p>
          </div>

          {/* Project name */}
          <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <label className="block text-sm font-semibold text-slate-600 mb-2">اسم المشروع</label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="أدخل اسم المشروع..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-right text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>

          {/* Sale value */}
          <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <label className="block text-sm font-semibold text-slate-600 mb-2">قيمة البيع (د.إ)</label>
            <input type="number" value={saleValue} onChange={e => setSaleValue(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-right text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-right">
              <p className="text-xs text-sky-500 font-medium mb-1">قيمة البيع</p>
              <p className="text-xl font-bold text-sky-700">{fmt(sale)}</p>
              <p className="text-xs text-sky-400">د.إ</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-right">
              <p className="text-xs text-amber-500 font-medium mb-1">المصاريف المتوقعة</p>
              <p className="text-xl font-bold text-amber-700">{fmt(expenses)}</p>
              <p className="text-xs text-amber-400">د.إ</p>
            </div>
            <div className={`${profit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} border rounded-2xl p-4 text-right`}>
              <p className={`text-xs font-medium mb-1 ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>الأرباح المتوقعة</p>
              <p className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(profit)}</p>
              <p className={`text-xs ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>د.إ</p>
            </div>
            <div className={`${margin >= 20 ? 'bg-emerald-50 border-emerald-100' : margin >= 10 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'} border rounded-2xl p-4 text-right`}>
              <p className={`text-xs font-medium mb-1 ${margin >= 20 ? 'text-emerald-500' : margin >= 10 ? 'text-amber-500' : 'text-red-500'}`}>هامش الربح</p>
              <p className={`text-xl font-bold ${margin >= 20 ? 'text-emerald-700' : margin >= 10 ? 'text-amber-700' : 'text-red-700'}`}>{margin.toFixed(1)}%</p>
              <p className={`text-xs ${margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-red-400'}`}>{margin >= 20 ? 'ممتاز' : margin >= 10 ? 'مقبول' : 'منخفض'}</p>
            </div>
          </div>

          {/* Add supplier */}
          <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-600 mb-4">إضافة مورد وعرض سعره</h2>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">المورد</label>
                <select value={selId} onChange={e => setSelId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="w-full md:w-52">
                <label className="block text-xs text-slate-500 mb-1">نوع الخدمة</label>
                <input readOnly value={selectedSupplier?.serviceType || ''}
                  className="w-full border border-slate-100 bg-slate-50 rounded-xl px-3 py-2.5 text-right text-sm text-slate-500" />
              </div>
              <div className="w-full md:w-44">
                <label className="block text-xs text-slate-500 mb-1">عرض السعر (د.إ)</label>
                <input type="number" value={quoteInput} onChange={e => setQuoteInput(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  onKeyDown={e => e.key === 'Enter' && addItem()} />
              </div>
              <div className="flex items-end">
                <button onClick={addItem} disabled={!selId || !quoteInput}
                  className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
                  <HiPlus size={18} /> إضافة
                </button>
              </div>
            </div>
          </div>

          {/* Items table */}
          {items.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-700">الموردون وعروض الأسعار</h2>
              </div>
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">#</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">المورد</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">نوع الخدمة</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">عرض السعر (د.إ)</th>
                    <th className="px-4 py-3 no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3"><span className="bg-sky-50 text-sky-700 text-xs px-2 py-1 rounded-full">{item.serviceType}</span></td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{fmt(item.quote)}</td>
                      <td className="px-4 py-3 no-print">
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 transition"><HiTrash size={17} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">الإجمالي</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{fmt(expenses)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="no-print bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
              أضف موردين وعروض أسعارهم لعرض الملخص المالي
            </div>
          )}

          {/* Print footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400 text-right">
            سحاب لإدارة الفعاليات · {new Date().toLocaleDateString('ar-AE')}
          </div>

        </div>
      </div>
    </>
  )
}
