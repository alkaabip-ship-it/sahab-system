'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStatusColor } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import {
  HiClipboardDocumentList, HiBolt, HiBriefcase, HiBanknotes,
  HiArrowTrendingUp, HiAdjustmentsHorizontal, HiBell,
  HiExclamationCircle, HiExclamationTriangle,
} from 'react-icons/hi2'

function KPICard({ title, value, sub, color, icon, delay = '' }: { title: string; value: string; sub?: string; color: string; icon: React.ReactNode; delay?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start gap-4 card-hover animate-fade-up ${delay}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 hover:scale-110 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-1 font-medium">{title}</p>
        <p className="text-xl font-bold text-slate-800 leading-none kpi-value">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError(t.common.error); setLoading(false) })

    fetch('/api/admin')
      .then((r) => r.json())
      .then((d) => { if (d.warnings) setWarnings(d.warnings) })
      .catch(() => {})
  }, [])

  const formatNum = (n: number) => new Intl.NumberFormat('ar-AE').format(Math.round(n))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500">{t.common.loading}</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <div className="flex items-center justify-center h-64"><p className="text-red-500">{error || t.common.error}</p></div>
  }

  return (
    <div className="space-y-6">
      {/* Expiry Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-600 flex items-center gap-1.5"><HiBell size={16} /> {t.dashboard.expiryWarnings}</p>
          {warnings.map((w: any, i: number) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
              w.expired || w.daysLeft <= 0 ? 'bg-red-50 border-red-200 text-red-800'
              : w.daysLeft <= 30 ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span>{w.expired ? <HiExclamationCircle size={18} className="text-red-600" /> : w.daysLeft <= 30 ? <HiExclamationCircle size={18} className="text-orange-500" /> : <HiExclamationTriangle size={18} className="text-amber-500" />}</span>
              <span className="flex-1 font-medium">{w.label}</span>
              <span className="text-xs">
                {w.expired ? t.dashboard.expiredDaysAgo(Math.abs(w.daysLeft))
                  : w.daysLeft === 0 ? t.dashboard.expiresToday
                  : t.dashboard.expiresInDays(w.daysLeft)}
              </span>
              <a href="/dashboard/admin" className={`text-xs underline ${w.expired || w.daysLeft <= 30 ? 'text-red-600' : 'text-amber-700'}`}>
                {t.dashboard.renew}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title={t.dashboard.totalProjects}  value={String(data.totalProjects)}                       icon={<HiClipboardDocumentList size={24} className="text-blue-500" />}   color="bg-blue-50"   delay="delay-100" />
        <KPICard title={t.dashboard.activeProjects}  value={String(data.activeProjects)}                      icon={<HiBolt size={24} className="text-yellow-500" />}                   color="bg-yellow-50" delay="delay-150" />
        <KPICard title={t.dashboard.totalValue}      value={`${formatNum(data.totalValue)} ${t.common.aed}`}  icon={<HiBriefcase size={24} className="text-sky-500" />}                 color="bg-sky-50"    delay="delay-200" />
        <KPICard title={t.dashboard.totalCosts}      value={`${formatNum(data.totalCosts)} ${t.common.aed}`}  icon={<HiBanknotes size={24} className="text-orange-500" />}              color="bg-orange-50" delay="delay-250" />
        <KPICard title={t.dashboard.netProfit}       value={`${formatNum(data.totalProfit)} ${t.common.aed}`} icon={<HiArrowTrendingUp size={24} className={data.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'} />} color={data.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50'} delay="delay-300" />
        <KPICard title={t.dashboard.avgMargin}       value={`${data.avgProfitMargin.toFixed(1)}%`}            icon={<HiAdjustmentsHorizontal size={24} className={data.avgProfitMargin >= 20 ? 'text-green-500' : 'text-red-500'} />} color={data.avgProfitMargin >= 20 ? 'bg-green-50' : 'bg-red-50'} delay="delay-350" />
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unpaid bills */}
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-5 card-hover animate-fade-up delay-400">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">{t.dashboard.unpaidBills}</h3>
            <Link href="/dashboard/bills" className="text-sm text-sky-500 hover:text-sky-600">{t.common.all}</Link>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">{data.unpaidBillsCount}</p>
              <p className="text-xs text-slate-500 mt-1">{t.bills.billsCount}</p>
            </div>
            <div className="h-12 w-px bg-slate-100" />
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{formatNum(data.unpaidBillsAmount)}</p>
              <p className="text-xs text-slate-500 mt-1">{t.common.aed}</p>
            </div>
          </div>
        </div>

        {/* Low profit projects */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-5 card-hover animate-fade-up delay-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">
              {t.dashboard.lowProfitProjects}
              <span className="text-xs font-normal text-slate-400 mx-2">({t.reports.belowThreshold(data.threshold)})</span>
            </h3>
            <Link href="/dashboard/reports" className="text-sm text-sky-500 hover:text-sky-600">{t.nav.reports}</Link>
          </div>
          {data.lowProfitProjects.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-2">✓ {t.common.noData}</p>
          ) : (
            <div className="space-y-2">
              {data.lowProfitProjects.slice(0, 3).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <Link href={`/dashboard/projects/${p.id}`} className="text-slate-700 hover:text-sky-600 font-medium truncate">
                    {p.name}
                  </Link>
                  <span className="text-red-500 font-semibold mx-2 flex-shrink-0">{p.margin.toFixed(1)}%</span>
                </div>
              ))}
              {data.lowProfitProjects.length > 3 && (
                <p className="text-xs text-slate-400">+{data.lowProfitProjects.length - 3}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top suppliers */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 card-hover animate-fade-up delay-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">{t.dashboard.topSuppliers}</h3>
            <Link href="/dashboard/suppliers" className="text-sm text-sky-500 hover:text-sky-600">{t.common.all}</Link>
          </div>
          {data.topSuppliers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t.suppliers.noSuppliers}</p>
          ) : (
            <div className="space-y-3">
              {data.topSuppliers.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/dashboard/suppliers/${s.id}`} className="text-sm font-medium text-slate-700 hover:text-sky-600 truncate block">{s.name}</Link>
                    <p className="text-xs text-slate-400">{s.dealCount} {t.dashboard.deals}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-700">{formatNum(s.totalAmount)}</p>
                    <p className="text-xs text-slate-400">{t.common.aed}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getStatusColor(s.recommendation)}`}>
                    {t.recommendation[s.recommendation as keyof typeof t.recommendation] ?? s.recommendation}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Second supplier panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">{t.dashboard.topSuppliers}</h3>
            <Link href="/dashboard/suppliers" className="text-sm text-sky-500 hover:text-sky-600">{t.common.all}</Link>
          </div>
          {data.problematicSuppliers.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">{t.suppliers.noSuppliers}</p>
          ) : (
            <div className="space-y-3">
              {data.problematicSuppliers.slice(0, 5).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <Link href={`/dashboard/suppliers/${s.id}`} className="text-sm font-medium text-slate-700 hover:text-sky-600 truncate block">{s.name}</Link>
                    <p className="text-xs text-slate-400">{t.serviceType[s.serviceType as keyof typeof t.serviceType] ?? s.serviceType}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mx-2 ${getStatusColor(s.recommendation)}`}>
                    {t.recommendation[s.recommendation as keyof typeof t.recommendation] ?? s.recommendation}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
