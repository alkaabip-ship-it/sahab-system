'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import {
  HiBuildingOffice2, HiBeaker, HiIdentification,
  HiClipboardDocumentList, HiSignal, HiBriefcase,
  HiChartBarSquare, HiUsers, HiCalendarDays,
  HiExclamationCircle, HiExclamationTriangle, HiCheckCircle,
  HiDocumentChartBar, HiArrowTrendingUp, HiArrowTrendingDown,
} from 'react-icons/hi2'

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY:  'شهرياً',
  ANNUAL:   'سنوياً',
  BIANNUAL: 'كل سنتين',
}

const EXPENSE_ICONS: Record<string, React.ReactNode> = {
  RENT:      <HiBuildingOffice2 size={20} />,
  UTILITIES: <HiBeaker size={20} />,
  RESIDENCY: <HiIdentification size={20} />,
  LICENSE:   <HiClipboardDocumentList size={20} />,
  TELECOM:   <HiSignal size={20} />,
}

// Keys that have an expiry date
const HAS_EXPIRY = new Set(['RENT', 'LICENSE'])

function formatNum(n: number) {
  return new Intl.NumberFormat('ar-AE').format(Math.round(n))
}

function toMonthly(amount: number, period: string) {
  if (period === 'MONTHLY')  return amount
  if (period === 'ANNUAL')   return amount / 12
  if (period === 'BIANNUAL') return amount / 24
  return 0
}

function toInputDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function monthsBetween(from: string, to: string) {
  const f = new Date(from), t = new Date(to)
  return Math.max(0.5, (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1)
}

function daysLabel(iso: string | null | undefined): { text: string; color: string } | null {
  if (!iso) return null
  const diff = Math.floor((new Date(iso).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff < 0)  return { text: `منتهية منذ ${Math.abs(diff)} يوم`, color: 'text-red-600' }
  if (diff === 0) return { text: 'تنتهي اليوم!', color: 'text-red-600' }
  if (diff <= 30) return { text: `تنتهي خلال ${diff} يوم`, color: 'text-red-500' }
  if (diff <= 90) return { text: `تنتهي خلال ${diff} يوم`, color: 'text-amber-500' }
  return { text: `تنتهي في ${new Date(iso).toLocaleDateString('ar-AE')}`, color: 'text-slate-400' }
}

const PNL_PRESETS = [
  { value: 1,  label: 'شهر'    },
  { value: 3,  label: '3 أشهر' },
  { value: 6,  label: '6 أشهر' },
  { value: 12, label: 'سنة'    },
  { value: 0,  label: 'الكل'   },
]

export default function AdminPage() {
  const { t } = useTranslation()
  const [data, setData]               = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})
  const [editExpiry, setEditExpiry]   = useState<Record<string, string>>({})
  const [savingKey, setSavingKey]     = useState('')
  const [newName, setNewName]         = useState('')
  const [newSalary, setNewSalary]     = useState('')
  const [addingEmp, setAddingEmp]     = useState(false)
  const [deletingId, setDeletingId]   = useState('')
  const [empExpiry, setEmpExpiry]     = useState<Record<string, string>>({})
  const [savingEmpId, setSavingEmpId] = useState('')

  // P&L state
  const today = toDateStr(new Date())
  const defaultFrom = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return toDateStr(d) })()
  const [pnlFrom,    setPnlFrom]    = useState(defaultFrom)
  const [pnlTo,      setPnlTo]      = useState(today)
  const [pnlPreset,  setPnlPreset]  = useState(1)
  const [pnlData,    setPnlData]    = useState<any>(null)
  const [pnlLoading, setPnlLoading] = useState(false)

  function applyPnlPreset(months: number) {
    setPnlPreset(months)
    const to   = new Date()
    const from = new Date()
    if (months > 0) from.setMonth(from.getMonth() - months)
    else from.setFullYear(from.getFullYear() - 10)
    setPnlFrom(toDateStr(from))
    setPnlTo(toDateStr(to))
  }

  async function fetchPnl(from: string, to: string) {
    setPnlLoading(true)
    try {
      const res = await fetch(`/api/admin/pnl?from=${from}&to=${to}`)
      const d   = await res.json()
      setPnlData(d)
    } finally {
      setPnlLoading(false)
    }
  }

  useEffect(() => { fetchPnl(pnlFrom, pnlTo) }, [pnlFrom, pnlTo])

  async function loadData() {
    try {
      const res = await fetch('/api/admin')
      const d = await res.json()
      if (!res.ok || !d.expenses) return
      setData(d)
      const amounts: Record<string, string> = {}
      const expiries: Record<string, string> = {}
      for (const e of d.expenses) {
        amounts[e.key] = String(e.amount)
        expiries[e.key] = toInputDate(e.expiryDate)
      }
      setEditAmounts(amounts)
      setEditExpiry(expiries)
      const ee: Record<string, string> = {}
      for (const emp of d.employees) ee[emp.id] = toInputDate(emp.residencyExpiry)
      setEmpExpiry(ee)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function saveExpense(key: string) {
    setSavingKey(key)
    await fetch(`/api/admin/expenses/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: editAmounts[key], expiryDate: editExpiry[key] || null }),
    })
    await loadData()
    setSavingKey('')
  }

  async function saveEmpExpiry(id: string) {
    setSavingEmpId(id)
    await fetch(`/api/admin/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ residencyExpiry: empExpiry[id] || null }),
    })
    await loadData()
    setSavingEmpId('')
  }

  async function addEmployee() {
    if (!newName || !newSalary) return
    setAddingEmp(true)
    await fetch('/api/admin/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, salary: newSalary }),
    })
    setNewName('')
    setNewSalary('')
    await loadData()
    setAddingEmp(false)
  }

  async function deleteEmployee(id: string) {
    setDeletingId(id)
    await fetch(`/api/admin/employees/${id}`, { method: 'DELETE' })
    await loadData()
    setDeletingId('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-24 text-slate-400">
        <HiExclamationTriangle size={48} className="mx-auto mb-3 text-slate-300" />
        <p>{t.admin.loadError}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg">
          {t.common.retry}
        </button>
      </div>
    )
  }

  const { employees, expenses, monthlySalaries, monthlyExpenses, totalMonthlyOverhead, warnings } = data
  const PERIOD_LABEL_T: Record<string, string> = { MONTHLY: t.admin.periodMonthly, ANNUAL: t.admin.periodAnnual, BIANNUAL: t.admin.periodBiannual }

  const pnlMonths  = pnlFrom && pnlTo ? monthsBetween(pnlFrom, pnlTo) : 1
  const pnlOverhead   = data ? data.totalMonthlyOverhead * pnlMonths : 0
  const pnlNetProfit  = pnlData ? pnlData.grossProfit - pnlOverhead : 0
  const pnlCoverage   = pnlOverhead > 0 ? Math.round((pnlData?.grossProfit ?? 0) / pnlOverhead * 100) : null

  const formatDateLabel = (s: string) =>
    s ? new Intl.DateTimeFormat('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(s)) : ''
  const pnlPeriodLabel = pnlFrom && pnlTo ? `${formatDateLabel(pnlFrom)} — ${formatDateLabel(pnlTo)}` : 'الكل'

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-bold text-slate-800">{t.admin.title}</h2>

      {/* ── P&L Statement ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header + date filter */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <HiDocumentChartBar size={16} className="text-slate-500" />
              <h3 className="font-bold text-slate-700 text-sm">قائمة الأرباح والخسائر</h3>
            </div>
            <span className="text-xs text-slate-400">{pnlPeriodLabel}</span>
          </div>
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {PNL_PRESETS.map((o) => (
                <button key={o.value} onClick={() => applyPnlPreset(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pnlPreset === o.value
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 ms-auto">
              <input type="date" value={pnlFrom} max={pnlTo}
                onChange={(e) => { setPnlFrom(e.target.value); setPnlPreset(-1) }}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
              <span className="text-slate-300">—</span>
              <input type="date" value={pnlTo} min={pnlFrom} max={today}
                onChange={(e) => { setPnlTo(e.target.value); setPnlPreset(-1) }}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
            </div>
          </div>
        </div>

        {pnlLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pnlData && (
          <div className="divide-y divide-slate-50">
            {/* Revenue */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <HiArrowTrendingUp size={15} className="text-sky-400" />
                <span className="text-sm text-slate-600">الإيرادات (بدون ضريبة)</span>
                <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-full">
                  {pnlData.projectCount} مشروع
                </span>
              </div>
              <span className="font-semibold text-slate-800 tabular-nums">
                {formatNum(pnlData.revenue)} <span className="text-xs font-normal text-slate-400">د.إ</span>
              </span>
            </div>

            {/* Costs */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <HiArrowTrendingDown size={15} className="text-red-400" />
                <span className="text-sm text-slate-600">التكاليف المباشرة (بدون ضريبة)</span>
              </div>
              <span className="font-semibold text-red-500 tabular-nums">
                ({formatNum(pnlData.costs)}) <span className="text-xs font-normal text-red-300">د.إ</span>
              </span>
            </div>

            {/* Gross Profit */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">= إجمالي الربح الخام</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  pnlData.margin >= 30 ? 'bg-green-100 text-green-700'
                  : pnlData.margin >= 15 ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
                }`}>{pnlData.margin.toFixed(1)}%</span>
              </div>
              <span className={`font-bold text-base tabular-nums ${pnlData.grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {pnlData.grossProfit < 0
                  ? `(${formatNum(Math.abs(pnlData.grossProfit))})`
                  : formatNum(pnlData.grossProfit)}
                {' '}<span className="text-xs font-normal">د.إ</span>
              </span>
            </div>

            {/* Fixed Expenses */}
            {data && data.totalMonthlyOverhead > 0 && (
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <HiArrowTrendingDown size={15} className="text-orange-400" />
                  <span className="text-sm text-slate-600">المصاريف الثابتة للفترة</span>
                  <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                    {Math.round(pnlMonths)} شهر × {formatNum(data.totalMonthlyOverhead)} د.إ
                  </span>
                </div>
                <span className="font-semibold text-orange-500 tabular-nums">
                  ({formatNum(pnlOverhead)}) <span className="text-xs font-normal text-orange-300">د.إ</span>
                </span>
              </div>
            )}

            {/* Net Profit */}
            {data && data.totalMonthlyOverhead > 0 && (
              <div className={`flex items-center justify-between px-5 py-4 ${pnlNetProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2.5">
                  {pnlNetProfit >= 0
                    ? <HiCheckCircle size={22} className="text-green-500" />
                    : <HiExclamationTriangle size={22} className="text-red-500" />}
                  <div>
                    <p className={`font-bold text-base ${pnlNetProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      صافي الربح
                    </p>
                    {pnlCoverage !== null && (
                      <p className={`text-xs ${pnlNetProfit >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        يغطي {pnlCoverage}% من المصاريف الثابتة
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <p className={`font-bold text-2xl tabular-nums ${pnlNetProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {pnlNetProfit < 0
                      ? `(${formatNum(Math.abs(pnlNetProfit))})`
                      : formatNum(pnlNetProfit)}
                    {' '}<span className="text-sm font-normal">د.إ</span>
                  </p>
                </div>
              </div>
            )}

            {/* VAT footer */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50/60 border-t border-amber-100">
              <span className="text-xs text-amber-600 font-medium">ضريبة القيمة المضافة الصافي المستحق</span>
              <span className="text-xs font-semibold text-amber-700 tabular-nums">
                {formatNum(pnlData.netVat)} <span className="font-normal">د.إ</span>
                <span className="text-amber-400 font-normal ms-1.5">
                  (محصّل {formatNum(pnlData.vatCollected)} − مدفوع {formatNum(pnlData.vatPaid)})
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active warnings */}
      {warnings?.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w: any, i: number) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              w.expired
                ? 'bg-red-50 border-red-200 text-red-800'
                : w.daysLeft <= 30
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span>{w.expired ? <HiExclamationCircle size={18} className="text-red-600" /> : w.daysLeft <= 30 ? <HiExclamationCircle size={18} className="text-orange-500" /> : <HiExclamationTriangle size={18} className="text-amber-500" />}</span>
              <span className="flex-1">{w.label}</span>
              <span className="text-xs font-normal">
                {w.expired
                  ? `منتهية منذ ${Math.abs(w.daysLeft)} يوم`
                  : w.daysLeft === 0
                  ? 'تنتهي اليوم!'
                  : `تنتهي خلال ${w.daysLeft} يوم`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Monthly overhead summary */}
      <div className="bg-slate-800 rounded-xl p-5 text-white">
        <p className="text-sm text-slate-400 mb-3">{t.admin.monthlyOverhead}</p>
        <p className="text-3xl font-bold">{formatNum(totalMonthlyOverhead)} <span className="text-lg font-normal text-slate-300">{t.common.aed}{t.common.perMonth}</span></p>
        <div className="mt-3 flex gap-6 text-sm text-slate-300">
          <span>{t.admin.salaries}: {formatNum(monthlySalaries)} {t.common.aed}</span>
          <span>{t.admin.fixedExpenses}: {formatNum(monthlyExpenses)} {t.common.aed}</span>
        </div>
      </div>

      {/* Fixed expenses */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600"><HiChartBarSquare size={18} /></span>
          {t.admin.fixedExpensesTitle}
        </h3>
        <div className="space-y-5">
          {expenses.map((exp: any) => {
            const label = daysLabel(exp.expiryDate)
            return (
              <div key={exp.key} className="border border-slate-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-orange-500">{EXPENSE_ICONS[exp.key] ?? <HiBriefcase size={20} />}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{exp.label}</p>
                    <p className="text-xs text-slate-400">{PERIOD_LABEL_T[exp.period]} · {formatNum(toMonthly(exp.amount, exp.period))} {t.common.aed}{t.common.perMonth}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    value={editAmounts[exp.key] ?? ''}
                    onChange={(e) => setEditAmounts((prev) => ({ ...prev, [exp.key]: e.target.value }))}
                    className="w-36 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    dir="ltr"
                    placeholder="المبلغ"
                  />
                  <span className="text-xs text-slate-400">د.إ</span>

                  {HAS_EXPIRY.has(exp.key) && (
                    <>
                      <span className="text-xs text-slate-400">{t.admin.expiryDate}:</span>
                      <input
                        type="date"
                        value={editExpiry[exp.key] ?? ''}
                        onChange={(e) => setEditExpiry((prev) => ({ ...prev, [exp.key]: e.target.value }))}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      {label && (
                        <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => saveExpense(exp.key)}
                    disabled={savingKey === exp.key}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white text-xs rounded-lg transition-all"
                  >
                    {savingKey === exp.key ? '...' : t.common.save}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Employees */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600"><HiUsers size={18} /></span>
          {t.admin.employees}
          <span className="mr-auto text-sm font-normal text-slate-500">
            {t.admin.totalSalaries}: {formatNum(monthlySalaries)} {t.common.aed}{t.common.perMonth}
          </span>
        </h3>

        {employees.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t.admin.noEmployees}</p>
        ) : (
          <div className="space-y-3 mb-4">
            {employees.map((emp: any) => {
              const label = daysLabel(emp.residencyExpiry)
              return (
                <div key={emp.id} className="border border-slate-100 rounded-xl p-3 group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <span className="flex-1 text-sm font-medium text-slate-700">{emp.name}</span>
                    <span className="text-sm text-slate-600 font-medium">{formatNum(emp.salary)}</span>
                    <span className="text-xs text-slate-400">{t.common.aed}{t.common.perMonth}</span>
                    <button
                      onClick={() => deleteEmployee(emp.id)}
                      disabled={deletingId === emp.id}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded transition-all disabled:opacity-50"
                    >
                      {deletingId === emp.id ? '...' : t.common.delete}
                    </button>
                  </div>

                  {/* Residency expiry row */}
                  <div className="flex items-center gap-2 pr-11">
                    <span className="text-xs text-slate-400">{t.admin.residencyExpiry}</span>
                    <input
                      type="date"
                      value={empExpiry[emp.id] ?? ''}
                      onChange={(e) => setEmpExpiry((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {label && (
                      <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
                    )}
                    <button
                      onClick={() => saveEmpExpiry(emp.id)}
                      disabled={savingEmpId === emp.id}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-all"
                    >
                      {savingEmpId === emp.id ? '...' : t.common.save}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add employee form */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
          <input
            type="text"
            placeholder={t.admin.employeeName}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <input
            type="number"
            placeholder={t.admin.salary}
            value={newSalary}
            onChange={(e) => setNewSalary(e.target.value)}
            dir="ltr"
            className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <span className="text-xs text-slate-400 whitespace-nowrap">د.إ</span>
          <button
            onClick={addEmployee}
            disabled={addingEmp || !newName || !newSalary}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-sm font-medium rounded-lg transition-all whitespace-nowrap"
          >
            {addingEmp ? '...' : t.admin.addEmployee}
          </button>
        </div>
      </div>

      {/* Annual breakdown */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600"><HiCalendarDays size={18} /></span>
          {t.admin.annualBreakdown}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-500">{t.admin.annualSalaries}</span>
            <span className="font-medium">{formatNum(monthlySalaries * 12)} {t.common.aed}</span>
          </div>
          {expenses.map((exp: any) => (
            <div key={exp.key} className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">{EXPENSE_ICONS[exp.key]} {exp.label}</span>
              <span className="font-medium">{formatNum(toMonthly(exp.amount, exp.period) * 12)} {t.common.aed}</span>
            </div>
          ))}
          <div className="flex justify-between py-2 font-bold text-slate-800">
            <span>{t.admin.annualTotal}</span>
            <span>{formatNum(totalMonthlyOverhead * 12)} {t.common.aed}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
