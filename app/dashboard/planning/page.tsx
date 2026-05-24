'use client'
import { useEffect, useState } from 'react'
import {
  HiPlus, HiTrash, HiPrinter, HiBookmarkSquare,
  HiFolderOpen, HiXMark, HiCheck, HiPencilSquare,
} from 'react-icons/hi2'
import { useTranslation } from '@/lib/i18n/LanguageContext'

interface Supplier { id: string; name: string; serviceType: string; dealCount?: number }
interface Item     { id: string; supplierId: string; name: string; serviceType: string; quote: number }
interface Plan     { id: string; name: string; saleValue: number; items: string; updatedAt: string }

export default function PlanningPage() {
  const { t, lang } = useTranslation()
  const p = t.planning
  const isRTL = lang === 'ar'

  const [projectName,   setProjectName]   = useState('')
  const [saleValue,     setSaleValue]     = useState<number | ''>('')
  const [suppliers,     setSuppliers]     = useState<Supplier[]>([])
  const [selId,         setSelId]         = useState('')
  const [quoteInput,    setQuoteInput]    = useState<number | ''>('')
  const [items,         setItems]         = useState<Item[]>([])
  const [plans,         setPlans]         = useState<Plan[]>([])
  const [showPlans,     setShowPlans]     = useState(false)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [savedMsg,      setSavedMsg]      = useState(false)

  // Derived financials
  const sale     = typeof saleValue === 'number' ? saleValue : 0
  const expenses = items.reduce((s, i) => s + i.quote, 0)
  const profit   = sale - expenses
  const margin   = sale > 0 ? (profit / sale) * 100 : 0
  const selectedSupplier = suppliers.find(s => s.id === selId)

  function fmt(n: number) {
    return n.toLocaleString(isRTL ? 'ar-AE' : 'en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  useEffect(() => {
    fetch('/api/suppliers?limit=200').then(r => r.json()).then(d => {
      const list: Supplier[] = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
      list.sort((a, b) => (b.dealCount ?? 0) - (a.dealCount ?? 0))
      setSuppliers(list)
      if (list.length) setSelId(list[0].id)
    })
  }, [])

  function loadPlans() {
    fetch('/api/planning').then(r => r.json()).then(d => setPlans(Array.isArray(d) ? d : []))
  }
  useEffect(() => { loadPlans() }, [])

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

  async function handleSave() {
    if (!projectName.trim()) return alert(isRTL ? 'أدخل اسم التخطيط أولاً' : 'Please enter a plan name first')
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

  function loadPlan(plan: Plan) {
    setProjectName(plan.name)
    setSaleValue(plan.saleValue)
    setItems(JSON.parse(plan.items))
    setCurrentPlanId(plan.id)
    setShowPlans(false)
  }

  function newPlan() {
    setProjectName('')
    setSaleValue('')
    setItems([])
    setCurrentPlanId(null)
  }

  async function deletePlan(id: string) {
    if (!confirm(isRTL ? 'حذف هذا التخطيط؟' : 'Delete this plan?')) return
    await fetch(`/api/planning/${id}`, { method: 'DELETE' })
    loadPlans()
    if (currentPlanId === id) newPlan()
  }

  // Margin color helper
  const mc = margin >= 20 ? 'emerald' : margin >= 10 ? 'amber' : 'red'
  const marginLabel = margin >= 20 ? p.excellent : margin >= 10 ? p.acceptable : p.low

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #planning-print, #planning-print * { visibility: visible !important; }
          #planning-print { position: fixed; top: 0; left: 0; width: 100%; padding: 40px; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ── Action bar ── */}
        <div className="flex items-center justify-between flex-wrap gap-2 no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={newPlan}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            >
              <HiPencilSquare size={16} /> {p.newPlan}
            </button>
            <button
              onClick={() => { loadPlans(); setShowPlans(v => !v) }}
              className={`flex items-center gap-1.5 border px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                showPlans ? 'bg-sky-50 border-sky-300 text-sky-700' : 'border-sky-200 text-sky-600 hover:bg-sky-50'
              }`}
            >
              <HiFolderOpen size={16} />
              {p.savedPlans}
              {plans.length > 0 && (
                <span className="bg-sky-100 text-sky-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{plans.length}</span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all text-white shadow-sm ${
                savedMsg ? 'bg-emerald-500' : saving ? 'bg-sky-400' : 'bg-sky-500 hover:bg-sky-600'
              }`}
            >
              {savedMsg
                ? <><HiCheck size={16} /> {p.saved}</>
                : <><HiBookmarkSquare size={16} /> {currentPlanId ? p.saveChanges : p.savePlan}</>
              }
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              <HiPrinter size={16} /> PDF
            </button>
          </div>
        </div>

        {/* ── Editing banner ── */}
        {currentPlanId && (
          <div className="no-print flex items-center gap-2 text-sm bg-sky-50 border border-sky-100 rounded-xl px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
            <span className="text-sky-500">{p.editingPlan}</span>
            <span className="font-semibold text-sky-700">{projectName}</span>
          </div>
        )}

        {/* ── Saved plans drawer ── */}
        {showPlans && (
          <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/80">
              <span className="font-semibold text-slate-700 text-sm">{p.savedPlans}</span>
              <button onClick={() => setShowPlans(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
                <HiXMark size={18} />
              </button>
            </div>
            {plans.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-12">{p.noSavedPlans}</p>
            ) : (
              <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                {plans.map(pl => {
                  const plItems = JSON.parse(pl.items) as Item[]
                  const plExp   = plItems.reduce((s, i) => s + i.quote, 0)
                  const plProf  = pl.saleValue - plExp
                  const isOpen  = currentPlanId === pl.id
                  return (
                    <div key={pl.id} className={`flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 ${isOpen ? 'bg-sky-50/40' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 text-sm truncate">{pl.name}</p>
                          {isOpen && (
                            <span className="text-xs bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                              {p.currentlyOpen}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{fmtDate(pl.updatedAt)}</span>
                          <span>·</span>
                          <span>{p.saleCard}: {fmt(pl.saleValue)} {p.currency}</span>
                          <span>·</span>
                          <span className={plProf >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                            {p.profitCard}: {fmt(plProf)} {p.currency}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => loadPlan(pl)}
                          className="text-xs bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-lg font-medium transition"
                        >
                          {p.openBtn}
                        </button>
                        <button
                          onClick={() => deletePlan(pl.id)}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
                        >
                          <HiTrash size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ PRINTABLE AREA ══════════════ */}
        <div id="planning-print" className="space-y-4">

          {/* Print header */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold text-slate-800">{projectName || p.title}</h1>
            <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE')}</p>
          </div>

          {/* ── Project Name + Sale Value (same card, two columns) ── */}
          <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {p.projectName}
                </label>
                <input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder={p.projectNamePlaceholder}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent placeholder:text-slate-300 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {p.saleValue} ({p.currency})
                </label>
                <input
                  type="number"
                  value={saleValue}
                  onChange={e => setSaleValue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent placeholder:text-slate-300 transition"
                />
              </div>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

            {/* Sale */}
            <div className="bg-gradient-to-br from-sky-50 to-sky-100/60 border border-sky-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-sky-500 uppercase tracking-wider">{p.saleCard}</p>
              <p className="text-2xl font-bold text-sky-700 leading-none tabular-nums">{fmt(sale)}</p>
              <p className="text-xs text-sky-400 font-medium">{p.currency}</p>
            </div>

            {/* Expenses */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">{p.expensesCard}</p>
              <p className="text-2xl font-bold text-amber-700 leading-none tabular-nums">{fmt(expenses)}</p>
              <p className="text-xs text-amber-400 font-medium">{p.currency}</p>
            </div>

            {/* Profit */}
            <div className={`bg-gradient-to-br border rounded-2xl p-4 space-y-2 ${
              profit >= 0 ? 'from-emerald-50 to-emerald-100/60 border-emerald-100' : 'from-red-50 to-red-100/60 border-red-100'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {p.profitCard}
              </p>
              <p className={`text-2xl font-bold leading-none tabular-nums ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmt(profit)}
              </p>
              <p className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.currency}</p>
            </div>

            {/* Margin */}
            <div className={`bg-gradient-to-br border rounded-2xl p-4 space-y-2 ${
              mc === 'emerald' ? 'from-emerald-50 to-emerald-100/60 border-emerald-100'
              : mc === 'amber'  ? 'from-amber-50 to-amber-100/60 border-amber-100'
              : 'from-red-50 to-red-100/60 border-red-100'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${
                mc === 'emerald' ? 'text-emerald-500' : mc === 'amber' ? 'text-amber-500' : 'text-red-500'
              }`}>
                {p.marginCard}
              </p>
              <p className={`text-2xl font-bold leading-none tabular-nums ${
                mc === 'emerald' ? 'text-emerald-700' : mc === 'amber' ? 'text-amber-700' : 'text-red-700'
              }`}>
                {margin.toFixed(1)}%
              </p>
              <p className={`text-xs font-semibold ${
                mc === 'emerald' ? 'text-emerald-500' : mc === 'amber' ? 'text-amber-500' : 'text-red-500'
              }`}>
                {marginLabel}
              </p>
            </div>

          </div>

          {/* ── Add supplier form ── */}
          <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{p.addSupplierTitle}</h2>
            <div className="flex flex-col md:flex-row gap-3 items-end">

              {/* Supplier select */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">{p.supplierLabel}</label>
                <select
                  value={selId}
                  onChange={e => setSelId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                >
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Service type (auto) */}
              <div className="w-full md:w-48 flex-shrink-0">
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">{p.serviceTypeLabel}</label>
                <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-500 min-h-[42px] flex items-center">
                  {selectedSupplier?.serviceType || <span className="text-slate-300">—</span>}
                </div>
              </div>

              {/* Quote amount */}
              <div className="w-full md:w-44 flex-shrink-0">
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">{p.quoteLabel} ({p.currency})</label>
                <input
                  type="number"
                  value={quoteInput}
                  onChange={e => setQuoteInput(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent placeholder:text-slate-300 transition"
                />
              </div>

              {/* Add button */}
              <button
                onClick={addItem}
                disabled={!selId || !quoteInput}
                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm flex-shrink-0"
              >
                <HiPlus size={18} /> {p.addBtn}
              </button>

            </div>
          </div>

          {/* ── Items table ── */}
          {items.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

              {/* Table header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-700 text-sm">{p.tableTitle}</h2>
                <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                  {items.length} {p.suppliersCount}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                      <th className="px-5 py-3 text-start font-semibold w-10">{p.colNum}</th>
                      <th className="px-5 py-3 text-start font-semibold">{p.colSupplier}</th>
                      <th className="px-5 py-3 text-start font-semibold">{p.colService}</th>
                      <th className="px-5 py-3 text-end font-semibold">{p.colQuote}</th>
                      <th className="px-3 py-3 no-print w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                        <td className="px-5 py-3.5 text-slate-400 text-xs tabular-nums">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">{item.name}</td>
                        <td className="px-5 py-3.5">
                          <span className="bg-sky-50 text-sky-600 text-xs px-2.5 py-1 rounded-full font-medium border border-sky-100">
                            {item.serviceType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-end font-semibold text-slate-700 tabular-nums">
                          {fmt(item.quote)}
                          <span className="text-slate-400 font-normal text-xs ms-1">{p.currency}</span>
                        </td>
                        <td className="px-3 py-3.5 no-print">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-slate-200 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100"
                          >
                            <HiTrash size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={3} className="px-5 py-4 font-bold text-slate-700">{p.total}</td>
                      <td className="px-5 py-4 text-end font-bold text-slate-800 text-base tabular-nums">
                        {fmt(expenses)}
                        <span className="text-slate-500 font-semibold text-xs ms-1">{p.currency}</span>
                      </td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          ) : (
            <div className="no-print rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-slate-500 text-sm font-medium max-w-xs mx-auto leading-relaxed">{p.noItems}</p>
            </div>
          )}

          {/* Print footer */}
          <div className="hidden print:block mt-10 pt-4 border-t border-slate-200 text-xs text-slate-400">
            {p.printFooter} · {new Date().toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE')}
          </div>

        </div>
      </div>
    </>
  )
}
