'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY:  'شهرياً',
  ANNUAL:   'سنوياً',
  BIANNUAL: 'كل سنتين',
}

const EXPENSE_ICONS: Record<string, string> = {
  RENT:      '🏢',
  UTILITIES: '💧',
  RESIDENCY: '🪪',
  LICENSE:   '📋',
  TELECOM:   '📡',
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

function daysLabel(iso: string | null | undefined): { text: string; color: string } | null {
  if (!iso) return null
  const diff = Math.floor((new Date(iso).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff < 0)  return { text: `منتهية منذ ${Math.abs(diff)} يوم`, color: 'text-red-600' }
  if (diff === 0) return { text: 'تنتهي اليوم!', color: 'text-red-600' }
  if (diff <= 30) return { text: `تنتهي خلال ${diff} يوم`, color: 'text-red-500' }
  if (diff <= 90) return { text: `تنتهي خلال ${diff} يوم`, color: 'text-amber-500' }
  return { text: `تنتهي في ${new Date(iso).toLocaleDateString('ar-AE')}`, color: 'text-slate-400' }
}

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
        <p className="text-4xl mb-3">⚠️</p>
        <p>{t.admin.loadError}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg">
          {t.common.retry}
        </button>
      </div>
    )
  }

  const { employees, expenses, monthlySalaries, monthlyExpenses, totalMonthlyOverhead, warnings } = data
  const PERIOD_LABEL_T: Record<string, string> = { MONTHLY: t.admin.periodMonthly, ANNUAL: t.admin.periodAnnual, BIANNUAL: t.admin.periodBiannual }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-bold text-slate-800">{t.admin.title}</h2>

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
              <span>{w.expired ? '🚨' : w.daysLeft <= 30 ? '🔴' : '⚠️'}</span>
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
          <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">📊</span>
          {t.admin.fixedExpensesTitle}
        </h3>
        <div className="space-y-5">
          {expenses.map((exp: any) => {
            const label = daysLabel(exp.expiryDate)
            return (
              <div key={exp.key} className="border border-slate-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{EXPENSE_ICONS[exp.key] ?? '💼'}</span>
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
          <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">👥</span>
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
          <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">📅</span>
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
