'use client'

import { useState } from 'react'
import { getStatusColor } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { usePermissions } from '@/lib/PermissionsContext'
import {
  HiArrowTrendingUp, HiArrowTrendingDown, HiLink,
  HiBriefcase, HiChartBarSquare,
} from 'react-icons/hi2'

function formatNum(n: number) { return new Intl.NumberFormat('ar-AE').format(Math.round(n)) }
function formatDate(d: string | null, lang: string) {
  if (!d) return '-'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right px-4 py-3 text-slate-600 font-semibold">{children}</th>
}

export default function ReportsPage() {
  const { t, lang } = useTranslation()
  const perms = usePermissions()
  const fmt = (n: number) => !perms.viewFinancials ? '••••••' : formatNum(n)
  const [selectedReport, setSelectedReport] = useState('project-profitability')
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const REPORT_TYPES = [
    { id: 'project-profitability', label: t.reports.projectProfitability,  desc: t.reports.projectProfitabilityDesc,  icon: <HiArrowTrendingUp size={18} /> },
    { id: 'unlinked-bills',        label: t.reports.unlinkedBills,          desc: t.reports.unlinkedBillsDesc,          icon: <HiLink size={18} /> },
    { id: 'unpaid-bills',          label: t.reports.unpaidBills,            desc: t.reports.unpaidBillsDesc,            icon: <HiChartBarSquare size={18} /> },
    { id: 'top-suppliers',         label: t.reports.topSuppliers,           desc: t.reports.topSuppliersDesc,           icon: <HiBriefcase size={18} /> },
    { id: 'low-profit-projects',   label: t.reports.lowProfitProjects,      desc: t.reports.lowProfitProjectsDesc,      icon: <HiArrowTrendingDown size={18} /> },
    { id: 'supplier-totals',       label: t.reports.supplierTotals,         desc: t.reports.supplierTotalsDesc,         icon: <HiBriefcase size={18} /> },
  ]

  async function loadReport(type: string) {
    setSelectedReport(type)
    setLoading(true)
    setLoaded(false)
    const res = await fetch(`/api/reports?type=${type}`)
    setData(await res.json())
    setLoading(false)
    setLoaded(true)
  }

  function renderTable() {
    if (!data) return null
    const aed = <span className="text-xs text-slate-400 font-normal">{t.common.aed}</span>

    if (selectedReport === 'project-profitability' || (selectedReport === 'low-profit-projects')) {
      const rows = selectedReport === 'low-profit-projects' ? (data.projects || []) : data
      if (!rows.length) return <p className="text-center py-8 text-green-600">✓ {t.common.noData}</p>
      return (
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.projects.code}</th>
            <Th>{t.reports.project}</Th>
            <th className="hidden md:table-cell text-right px-4 py-3 text-slate-600 font-semibold">{t.reports.client}</th>
            <th className="hidden md:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.reports.revenue}</th>
            <th className="hidden md:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.reports.cost}</th>
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.reports.profit}</th>
            <Th>{t.reports.margin}</Th>
            <Th>{t.reports.status}</Th>
          </tr></thead>
          <tbody>
            {rows.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{p.code}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{p.name}</td>
                <td className="hidden md:table-cell px-4 py-3 text-slate-500">{p.clientName}</td>
                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">{fmt(p.revenueExVat ?? p.value / 1.05)} {aed}</td>
                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">{fmt(p.costsExVat ?? p.costs / 1.05)} {aed}</td>
                <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap"><span className={p.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{fmt(p.profit)} {aed}</span></td>
                <td className="px-4 py-3"><span className={`font-semibold ${p.margin >= 30 ? 'text-green-600' : p.margin >= 20 ? 'text-yellow-600' : 'text-red-500'}`}>{!perms.viewFinancials ? '••••••' : `${p.margin.toFixed(1)}%`}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(p.status)}`}>{t.status[p.status as keyof typeof t.status] ?? p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (selectedReport === 'unlinked-bills' || selectedReport === 'unpaid-bills') {
      const rows = Array.isArray(data) ? data : []
      const showProject = selectedReport === 'unpaid-bills'
      if (!rows.length) return <p className="text-center py-8 text-green-600">✓ {t.common.noData}</p>
      return (
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.bills.billNumber}</th>
            <Th>{t.reports.supplier}</Th>
            {showProject && <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold">{t.reports.project}</th>}
            <Th>{t.bills.amount}</Th>
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.bills.date}</th>
            <th className="hidden md:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.bills.dueDate}</th>
            <Th>{t.bills.status}</Th>
          </tr></thead>
          <tbody>
            {rows.map((b: any) => (
              <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{b.billNumber}</td>
                <td className="px-4 py-3 text-slate-700">{b.supplier?.name || '-'}</td>
                {showProject && <td className="hidden sm:table-cell px-4 py-3 text-xs text-slate-500">{b.project?.code || <span className="text-orange-400">-</span>}</td>}
                <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(b.amount)} {aed}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(b.billDate, lang)}</td>
                <td className="hidden md:table-cell px-4 py-3 text-xs">{b.dueDate ? <span className={new Date(b.dueDate) < new Date() && b.status !== 'PAID' ? 'text-red-500 font-medium' : 'text-slate-500'}>{formatDate(b.dueDate, lang)}</span> : '-'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(b.status)}`}>{t.status[b.status as keyof typeof t.status] ?? b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (selectedReport === 'top-suppliers') {
      if (!data.length) return <p className="text-center py-8 text-slate-400">{t.suppliers.noSuppliers}</p>
      return (
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold">#</th>
            <Th>{t.reports.supplier}</Th>
            <th className="hidden md:table-cell text-right px-4 py-3 text-slate-600 font-semibold">{t.reports.service}</th>
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold">{t.reports.deals}</th>
            <Th>{t.reports.total}</Th>
            <Th>{t.suppliers.recommendation}</Th>
          </tr></thead>
          <tbody>
            {data.map((s: any, i: number) => (
              <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="hidden sm:table-cell px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500">{t.serviceType[s.serviceType as keyof typeof t.serviceType] ?? s.serviceType}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-center">{s.dealCount}</td>
                <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(s.totalAmount)} <span className="text-xs font-normal text-slate-400">{t.common.aed}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(s.recommendation)}`}>{t.recommendation[s.recommendation as keyof typeof t.recommendation] ?? s.recommendation}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (selectedReport === 'supplier-totals') {
      if (!data.length) return <p className="text-center py-8 text-slate-400">{t.suppliers.noSuppliers}</p>
      return (
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            <Th>{t.reports.supplier}</Th>
            <th className="hidden md:table-cell text-right px-4 py-3 text-slate-600 font-semibold">{t.reports.service}</th>
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold">{t.reports.deals}</th>
            <Th>{t.reports.total}</Th>
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.reports.paid}</th>
            <th className="hidden sm:table-cell text-right px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{t.reports.unpaid}</th>
            <Th>{t.suppliers.recommendation}</Th>
          </tr></thead>
          <tbody>
            {data.map((s: any) => (
              <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500">{t.serviceType[s.serviceType as keyof typeof t.serviceType] ?? s.serviceType}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-center">{s.dealCount}</td>
                <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(s.totalAmount)} <span className="text-xs font-normal text-slate-400">{t.common.aed}</span></td>
                <td className="hidden sm:table-cell px-4 py-3 text-green-600 whitespace-nowrap">{fmt(s.paidAmount)} <span className="text-xs opacity-70">{t.common.aed}</span></td>
                <td className="hidden sm:table-cell px-4 py-3 text-red-500 whitespace-nowrap">{fmt(s.unpaidAmount)} <span className="text-xs opacity-70">{t.common.aed}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(s.recommendation)}`}>{t.recommendation[s.recommendation as keyof typeof t.recommendation] ?? s.recommendation}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">{t.reports.title}</h2>

      {/* Report type grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {REPORT_TYPES.map((r) => (
          <button key={r.id} onClick={() => loadReport(r.id)}
            className={`p-4 rounded-xl border text-right transition-all ${selectedReport === r.id ? 'border-sky-400 bg-sky-50' : 'border-slate-100 bg-white hover:border-sky-200'}`}>
            <p className="mb-1 text-sky-500">{r.icon}</p>
            <p className="text-sm font-semibold text-slate-800">{r.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !loaded ? (
          <div className="text-center py-16 text-slate-400">
            <HiChartBarSquare size={48} className="mx-auto mb-3 text-slate-300" />
            <p>{t.reports.noData}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">{renderTable()}</div>
        )}
      </div>
    </div>
  )
}
