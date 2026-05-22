'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStatusColor } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { HiCalendarDays, HiCheckCircle, HiExclamationTriangle, HiClipboardDocumentList, HiDocumentChartBar, HiArrowTrendingUp, HiArrowTrendingDown } from 'react-icons/hi2'
import Pagination from '@/components/Pagination'

function formatNum(n: number) {
  return new Intl.NumberFormat('ar-AE').format(Math.round(n))
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function monthsBetween(from: string, to: string) {
  const f = new Date(from), t = new Date(to)
  return Math.max(0.5, (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1)
}

export default function ProjectsPage() {
  const { t, lang } = useTranslation()
  const isAr = lang === 'ar'
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]     = useState('')
  const [overhead, setOverhead] = useState<number | null>(null)
  const [activePreset, setActivePreset] = useState<number>(0)
  const [page,  setPage]  = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20

  // default: all time
  const today = toDateStr(new Date())
  const defaultFrom = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 10); return toDateStr(d) })()
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo,   setDateTo]   = useState(today)

  const PRESETS = [
    { value: 1,  label: isAr ? 'شهر'    : '1M' },
    { value: 3,  label: isAr ? '3 أشهر' : '3M' },
    { value: 6,  label: isAr ? '6 أشهر' : '6M' },
    { value: 12, label: isAr ? 'سنة'    : '1Y' },
    { value: 0,  label: isAr ? 'الكل'   : 'All' },
  ]

  function applyPreset(months: number) {
    setActivePreset(months)
    const to = new Date()
    const from = new Date()
    if (months > 0) from.setMonth(from.getMonth() - months)
    else from.setFullYear(from.getFullYear() - 10)
    setDateFrom(toDateStr(from))
    setDateTo(toDateStr(to))
  }

  const STATUS_OPTIONS = [
    { value: '', label: t.status.allStatuses },
    { value: 'QUOTE',       label: t.status.QUOTE },
    { value: 'CONFIRMED',   label: t.status.CONFIRMED },
    { value: 'IN_PROGRESS', label: t.status.IN_PROGRESS },
    { value: 'COMPLETED',   label: t.status.COMPLETED },
    { value: 'CLOSED',      label: t.status.CLOSED },
  ]

  function fetchProjects(p = page) {
    setLoading(true)
    fetch(`/api/projects?page=${p}&limit=${LIMIT}`)
      .then((r) => r.json())
      .then((res) => {
        setProjects(Array.isArray(res.data) ? res.data : [])
        setTotal(res.total ?? 0)
        setPages(res.pages ?? 1)
        setPage(res.page ?? 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchProjects(1)
    fetch('/api/admin')
      .then((r) => r.json())
      .then((d) => setOverhead(d.totalMonthlyOverhead ?? 0))
      .catch(() => {})
  }, [])

  function handlePage(p: number) {
    setPage(p)
    fetchProjects(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = projects.filter((p) => {
    const matchStatus = !statusFilter || p.status === statusFilter
    const matchSearch = !search || p.name.includes(search) || p.clientName.includes(search) || p.code.includes(search)
    const pDate = new Date(p.executionDate || p.createdAt)
    const matchDate = (!dateFrom || pDate >= new Date(dateFrom)) && (!dateTo || pDate <= new Date(dateTo + 'T23:59:59'))
    return matchStatus && matchSearch && matchDate
  })

  const totalRevenue = filtered.reduce((s, p) => s + (p.revenueExVat ?? p.value / 1.05), 0)
  const totalCosts   = filtered.reduce((s, p) => s + (p.costsExVat  ?? p.costs / 1.05), 0)
  const totalProfit  = filtered.reduce((s, p) => s + p.profit, 0)
  const vatCollected = filtered.reduce((s, p) => s + (p.value - (p.revenueExVat ?? p.value / 1.05)), 0)
  const vatPaid      = filtered.reduce((s, p) => s + ((p.costs ?? 0) - (p.costsExVat ?? (p.costs ?? 0) / 1.05)), 0)
  const netVat       = vatCollected - vatPaid
  const avgMargin    = filtered.length > 0 ? filtered.reduce((s, p) => s + p.margin, 0) / filtered.length : 0

  const periodMonths   = dateFrom && dateTo ? monthsBetween(dateFrom, dateTo) : null
  const periodOverhead = overhead !== null && periodMonths !== null ? overhead * periodMonths : null
  const netProfit      = periodOverhead !== null ? totalProfit - periodOverhead : totalProfit
  const coveragePct    = periodOverhead !== null && periodOverhead > 0 ? Math.round((totalProfit / periodOverhead) * 100) : null

  const formatDateDisplay = (s: string) =>
    s ? new Intl.DateTimeFormat(isAr ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(s)) : ''

  const periodLabel = dateFrom && dateTo
    ? `${formatDateDisplay(dateFrom)} — ${formatDateDisplay(dateTo)}`
    : (isAr ? 'الكل' : 'All')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">{t.projects.title}</h2>
        <Link href="/dashboard/projects/new" className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-all">
          {t.projects.newProject}
        </Link>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Quick presets */}
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((o) => (
              <button key={o.value} onClick={() => applyPreset(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activePreset === o.value
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* From date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">{isAr ? 'من' : 'From'}</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(-1) }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
          </div>

          {/* To date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">{isAr ? 'إلى' : 'To'}</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(-1) }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
          </div>

          {/* Period summary */}
          <span className="text-xs text-slate-400 me-auto">
            <HiCalendarDays size={14} className="inline-block" /> {filtered.length} {isAr ? 'مشروع' : 'projects'}
            {periodMonths !== null && ` · ${Math.round(periodMonths)} ${isAr ? 'شهر' : 'mo'}`}
          </span>
        </div>
      </div>

      {/* P&L Statement */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiDocumentChartBar size={16} className="text-slate-500" />
              <h3 className="font-bold text-slate-700 text-sm">
                {isAr ? 'قائمة الأرباح والخسائر' : 'Profit & Loss Statement'}
              </h3>
              <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                {filtered.length} {isAr ? 'مشروع' : 'projects'}
              </span>
            </div>
            <span className="text-xs text-slate-400">{periodLabel}</span>
          </div>

          <div className="divide-y divide-slate-50">
            {/* Revenue */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <HiArrowTrendingUp size={15} className="text-sky-400" />
                <span className="text-sm text-slate-600">{isAr ? 'الإيرادات (بدون ضريبة)' : 'Revenue (ex VAT)'}</span>
              </div>
              <span className="font-semibold text-slate-800 tabular-nums">
                {formatNum(totalRevenue)} <span className="text-xs font-normal text-slate-400">{t.common.aed}</span>
              </span>
            </div>

            {/* Direct Costs */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <HiArrowTrendingDown size={15} className="text-red-400" />
                <span className="text-sm text-slate-600">{isAr ? 'التكاليف المباشرة (بدون ضريبة)' : 'Direct Costs (ex VAT)'}</span>
              </div>
              <span className="font-semibold text-red-500 tabular-nums">
                ({formatNum(totalCosts)}) <span className="text-xs font-normal text-red-300">{t.common.aed}</span>
              </span>
            </div>

            {/* Gross Profit */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">
                  {isAr ? '= إجمالي الربح الخام' : '= Gross Profit'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${avgMargin >= 30 ? 'bg-green-100 text-green-700' : avgMargin >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {avgMargin.toFixed(1)}%
                </span>
              </div>
              <span className={`font-bold text-base tabular-nums ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {totalProfit < 0 ? `(${formatNum(Math.abs(totalProfit))})` : formatNum(totalProfit)}
                {' '}<span className="text-xs font-normal">{t.common.aed}</span>
              </span>
            </div>

            {/* Fixed Expenses row — only if overhead is configured */}
            {periodOverhead !== null && overhead !== null && overhead > 0 && (
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <HiArrowTrendingDown size={15} className="text-orange-400" />
                  <span className="text-sm text-slate-600">{isAr ? 'المصاريف الثابتة للفترة' : 'Fixed Expenses'}</span>
                  <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                    {Math.round(periodMonths ?? 0)} {isAr ? 'شهر' : 'mo'} × {formatNum(overhead)} {t.common.aed}
                  </span>
                </div>
                <span className="font-semibold text-orange-500 tabular-nums">
                  ({formatNum(periodOverhead)}) <span className="text-xs font-normal text-orange-300">{t.common.aed}</span>
                </span>
              </div>
            )}

            {/* Net Profit — only if overhead is configured */}
            {periodOverhead !== null && overhead !== null && overhead > 0 && (
              <div className={`flex items-center justify-between px-5 py-4 ${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2.5">
                  {netProfit >= 0
                    ? <HiCheckCircle size={22} className="text-green-500" />
                    : <HiExclamationTriangle size={22} className="text-red-500" />}
                  <div>
                    <p className={`font-bold text-base ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {isAr ? 'صافي الربح' : 'Net Profit'}
                    </p>
                    {coveragePct !== null && (
                      <p className={`text-xs ${netProfit >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        {isAr
                          ? `يغطي ${coveragePct}% من المصاريف الثابتة`
                          : `${coveragePct}% of fixed expenses covered`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <p className={`font-bold text-2xl tabular-nums ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {netProfit < 0 ? `(${formatNum(Math.abs(netProfit))})` : formatNum(netProfit)}
                    {' '}<span className="text-sm font-normal">{t.common.aed}</span>
                  </p>
                  {netProfit < 0 && (
                    <p className="text-xs text-red-400 mt-0.5">
                      {isAr ? 'عجز' : 'Deficit'}: {formatNum(Math.abs(netProfit))} {t.common.aed}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* VAT footer row */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50/60 border-t border-amber-100">
              <span className="text-xs text-amber-600 font-medium">
                {isAr ? 'ضريبة القيمة المضافة الصافي' : 'Net VAT payable'}
              </span>
              <span className="text-xs font-semibold text-amber-700 tabular-nums">
                {formatNum(netVat)} {t.common.aed}
                <span className="text-amber-400 font-normal ms-1.5">
                  ({isAr ? 'محصّل' : 'collected'} {formatNum(vatCollected)} − {isAr ? 'مدفوع' : 'paid'} {formatNum(vatPaid)})
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3">
        <input type="text" placeholder={t.projects.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <HiClipboardDocumentList size={48} className="mx-auto mb-3 text-slate-300" />
            <p>{isAr ? `لا توجد مشاريع في الفترة: ${periodLabel}` : `No projects in: ${periodLabel}`}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[t.projects.code, t.projects.name, t.projects.client, t.projects.value, t.projects.cost, t.projects.profit, t.projects.margin, t.projects.status, t.common.actions].map((h) => (
                    <th key={h} className="text-right px-4 py-3 font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.clientName}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{formatNum(p.revenueExVat ?? p.value / 1.05)} <span className="text-xs text-slate-400">{t.common.aed}</span></td>
                    <td className="px-4 py-3 text-slate-600">{formatNum(p.costsExVat ?? p.costs / 1.05)} <span className="text-xs text-slate-400">{t.common.aed}</span></td>
                    <td className="px-4 py-3">
                      <span className={p.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                        {formatNum(p.profit)} <span className="text-xs font-normal opacity-70">{t.common.aed}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${p.margin >= 30 ? 'text-green-600' : p.margin >= 20 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(p.status)}`}>
                        {t.status[p.status as keyof typeof t.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/projects/${p.id}`} className="text-sky-500 hover:text-sky-600 text-xs font-medium">{t.common.details}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Pagination page={page} pages={pages} total={total} limit={LIMIT} onPage={handlePage} isRtl={isAr} />
        )}
      </div>
    </div>
  )
}
