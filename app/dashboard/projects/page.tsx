'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStatusColor } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import {
  HiCalendarDays, HiClipboardDocumentList,
  HiDocumentText, HiCheckCircle, HiPlusCircle,
} from 'react-icons/hi2'
import Pagination from '@/components/Pagination'

function formatNum(n: number) {
  return new Intl.NumberFormat('ar-AE').format(Math.round(n))
}
function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function monthsBetween(from: string, to: string) {
  const f = new Date(from), t = new Date(to)
  return Math.max(0.5, (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1)
}
function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))
}

const INV_STATUS_COLOR: Record<string, string> = {
  PAID:    'bg-green-100 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  UNPAID:  'bg-red-100 text-red-600',
  VOID:    'bg-slate-100 text-slate-400',
}
const INV_STATUS_LABEL: Record<string, string> = {
  PAID: 'مدفوعة', PARTIAL: 'جزئي', UNPAID: 'غير مدفوعة', VOID: 'ملغاة',
}

// ─────────────────────────────────────────────────────────────────
// Invoices tab
// ─────────────────────────────────────────────────────────────────
function InvoicesTab() {
  const [invoices, setInvoices]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [page,  setPage]          = useState(1)
  const [pages, setPages]         = useState(1)
  const [total, setTotal]         = useState(0)
  const LIMIT = 25

  // per-invoice: project name being typed
  const [names,    setNames]    = useState<Record<string, string>>({})
  // per-invoice: creating state
  const [creating, setCreating] = useState<Record<string, boolean>>({})
  // per-invoice: done animation
  const [done,     setDone]     = useState<Record<string, boolean>>({})

  async function load(p = 1) {
    setLoading(true)
    const res = await fetch(`/api/invoices?page=${p}&limit=${LIMIT}`).then(r => r.json())
    setInvoices(Array.isArray(res.data) ? res.data : [])
    setTotal(res.total ?? 0)
    setPages(res.pages ?? 1)
    setPage(res.page ?? 1)
    setLoading(false)
  }

  useEffect(() => { load(1) }, [])

  async function createProject(inv: any) {
    const name = (names[inv.id] ?? '').trim()
    if (!name) return
    setCreating(c => ({ ...c, [inv.id]: true }))

    // 1. Create project from invoice
    const projRes = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        clientName: inv.customerName,
        value: inv.amount,
        status: inv.status === 'PAID' ? 'COMPLETED' : 'CONFIRMED',
        executionDate: inv.invoiceDate,
      }),
    })
    if (!projRes.ok) { setCreating(c => ({ ...c, [inv.id]: false })); return }
    const proj = await projRes.json()

    // 2. Link invoice → project
    await fetch(`/api/invoices/${inv.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: proj.id }),
    })

    setCreating(c => ({ ...c, [inv.id]: false }))
    setDone(d    => ({ ...d, [inv.id]: true  }))
    // Refresh list after short delay
    setTimeout(() => load(page), 800)
  }

  const unlinkedCount = invoices.filter(i => !i.projectId).length

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
      {/* Sub-header */}
      {!loading && total > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-slate-500">
            {total} فاتورة صادرة
            {unlinkedCount > 0 && (
              <span className="ms-2 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                {unlinkedCount} بدون مشروع
              </span>
            )}
          </span>
          <span className="text-xs text-slate-400">
            اكتب اسم المشروع بجانب كل فاتورة واضغط إنشاء
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <HiDocumentText size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">لا توجد فواتير صادرة</p>
          <p className="text-xs mt-1">يمكنك استيراد فواتير Zoho من قسم الرفع</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['رقم الفاتورة', 'العميل', 'المبلغ', 'التاريخ', 'الحالة', 'المشروع'].map(h => (
                  <th key={h} className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${done[inv.id] ? 'bg-green-50/50' : ''}`}>
                  {/* Invoice number */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                    {inv.invoiceNumber}
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">
                    {inv.customerName}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    {formatNum(inv.amount)}
                    <span className="text-xs font-normal text-slate-400 ms-1">د.إ</span>
                    {inv.balance > 0 && inv.status !== 'PAID' && (
                      <span className="block text-xs text-red-400 font-normal">
                        متبقي {formatNum(inv.balance)}
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(inv.invoiceDate)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${INV_STATUS_COLOR[inv.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {INV_STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>

                  {/* Project column */}
                  <td className="px-4 py-3 min-w-[260px]">
                    {done[inv.id] ? (
                      <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                        <HiCheckCircle size={16} /> تم إنشاء المشروع
                      </span>
                    ) : inv.project ? (
                      <Link
                        href={`/dashboard/projects/${inv.project.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700"
                      >
                        <span className="font-mono text-slate-400">{inv.project.code}</span>
                        <span>{inv.project.name}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="اسم المشروع..."
                          value={names[inv.id] ?? ''}
                          onChange={e => setNames(n => ({ ...n, [inv.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') createProject(inv) }}
                          className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white placeholder:text-slate-300"
                        />
                        <button
                          onClick={() => createProject(inv)}
                          disabled={!names[inv.id]?.trim() || creating[inv.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-medium rounded-lg transition-all whitespace-nowrap"
                        >
                          {creating[inv.id]
                            ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            : <HiPlusCircle size={14} />}
                          إنشاء
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} limit={LIMIT}
        onPage={p => { setPage(p); load(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        isRtl={true}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { t, lang } = useTranslation()
  const isAr = lang === 'ar'

  type MainTab = 'projects' | 'invoices'
  const [mainTab, setMainTab] = useState<MainTab>('projects')

  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch] = useState('')
  const [activePreset, setActivePreset] = useState<number>(0)
  const [page,  setPage]  = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20

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
    const to = new Date(), from = new Date()
    if (months > 0) from.setMonth(from.getMonth() - months)
    else from.setFullYear(from.getFullYear() - 10)
    setDateFrom(toDateStr(from)); setDateTo(toDateStr(to))
  }

  function fetchProjects(p = page) {
    setLoading(true)
    fetch(`/api/projects?page=${p}&limit=${LIMIT}`)
      .then(r => r.json())
      .then(res => {
        setProjects(Array.isArray(res.data) ? res.data : [])
        setTotal(res.total ?? 0); setPages(res.pages ?? 1); setPage(res.page ?? 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchProjects(1) }, [])

  function handlePage(p: number) {
    setPage(p); fetchProjects(p); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.clientName.includes(search) || p.code.includes(search)
    const pDate = new Date(p.displayDate ?? p.executionDate ?? p.createdAt)
    const matchDate = (!dateFrom || pDate >= new Date(dateFrom)) && (!dateTo || pDate <= new Date(dateTo + 'T23:59:59'))
    return matchSearch && matchDate
  })

  const totalRevenue = filtered.reduce((s, p) => s + (p.revenueExVat ?? p.value / 1.05), 0)
  const totalCosts   = filtered.reduce((s, p) => s + (p.costsExVat  ?? p.costs / 1.05), 0)
  const totalProfit  = filtered.reduce((s, p) => s + p.profit, 0)
  const vatCollected = filtered.reduce((s, p) => s + (p.value - (p.revenueExVat ?? p.value / 1.05)), 0)
  const vatPaid      = filtered.reduce((s, p) => s + ((p.costs ?? 0) - (p.costsExVat ?? (p.costs ?? 0) / 1.05)), 0)
  const netVat       = vatCollected - vatPaid
  const avgMargin    = filtered.length > 0 ? filtered.reduce((s, p) => s + p.margin, 0) / filtered.length : 0
  const periodMonths = dateFrom && dateTo ? monthsBetween(dateFrom, dateTo) : null

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
        <Link href="/dashboard/projects/new"
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-all">
          {t.projects.newProject}
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-0">
        <button
          onClick={() => setMainTab('projects')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${
            mainTab === 'projects'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <HiClipboardDocumentList size={16} />
          المشاريع
        </button>
        <button
          onClick={() => setMainTab('invoices')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${
            mainTab === 'invoices'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <HiDocumentText size={16} />
          الفواتير الصادرة
        </button>
      </div>

      {/* ── Invoices tab ── */}
      {mainTab === 'invoices' && <InvoicesTab />}

      {/* ── Projects tab ── */}
      {mainTab === 'projects' && (
        <>
          {/* Date Range Filter */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex gap-1.5 flex-wrap">
                {PRESETS.map(o => (
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">{isAr ? 'من' : 'From'}</span>
                <input type="date" value={dateFrom} max={dateTo}
                  onChange={e => { setDateFrom(e.target.value); setActivePreset(-1) }}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">{isAr ? 'إلى' : 'To'}</span>
                <input type="date" value={dateTo} min={dateFrom} max={today}
                  onChange={e => { setDateTo(e.target.value); setActivePreset(-1) }}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
              </div>
              <span className="text-xs text-slate-400 me-auto">
                <HiCalendarDays size={14} className="inline-block" /> {filtered.length} {isAr ? 'مشروع' : 'projects'}
                {periodMonths !== null && ` · ${Math.round(periodMonths)} ${isAr ? 'شهر' : 'mo'}`}
              </span>
            </div>
          </div>

          {/* Summary Cards */}
          {!loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-400 mb-1">{t.projects.totalRevenue}</p>
                <p className="text-lg font-bold text-slate-800">{formatNum(totalRevenue)}</p>
                <p className="text-xs text-slate-400">{t.common.aed} · {t.common.exVat}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-400 mb-1">{t.projects.totalCosts}</p>
                <p className="text-lg font-bold text-red-500">{formatNum(totalCosts)}</p>
                <p className="text-xs text-slate-400">{t.common.aed} · {t.common.exVat}</p>
              </div>
              <div className="bg-amber-50 rounded-xl border border-amber-100 shadow-sm p-4">
                <p className="text-xs text-amber-500 mb-1">{t.projects.vat}</p>
                <p className="text-lg font-bold text-amber-700">{formatNum(netVat)}</p>
                <p className="text-xs text-amber-400">{t.projects.vatCollected} {formatNum(vatCollected)} · {t.projects.vatPaid} {formatNum(vatPaid)}</p>
              </div>
              <div className={`rounded-xl border shadow-sm p-4 ${totalProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-xs mb-1 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-400'}`}>{t.projects.totalProfit}</p>
                <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatNum(totalProfit)}</p>
                <p className={`text-xs ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{t.common.aed} · {t.projects.avgMargin} {avgMargin.toFixed(1)}%</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3">
            <input type="text" placeholder={t.projects.searchPlaceholder} value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
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
                      {[t.projects.code, 'التاريخ', t.projects.name, t.projects.client, t.projects.value, t.projects.cost, t.projects.profit, t.projects.margin, t.projects.status, t.common.actions].map(h => (
                        <th key={h} className="text-right px-4 py-3 font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.code}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(p.displayDate)}</td>
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
        </>
      )}
    </div>
  )
}
