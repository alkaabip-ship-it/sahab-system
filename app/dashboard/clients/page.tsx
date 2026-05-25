'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { HiUsers, HiTrophy, HiCurrencyDollar } from 'react-icons/hi2'

function formatNum(n: number) {
  return new Intl.NumberFormat('ar-AE').format(Math.round(n))
}

function formatDate(d: string | null, lang: string) {
  if (!d || new Date(d).getFullYear() === 1970) return '-'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-AE', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(d))
}

function Avatar({ name }: { name: string }) {
  const colors = ['bg-sky-100 text-sky-700', 'bg-purple-100 text-purple-700', 'bg-green-100 text-green-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${colors[idx]}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function ClientsPage() {
  const { t, lang } = useTranslation()
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort]     = useState<'total' | 'paid' | 'activity' | 'balance'>('total')

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-center py-24 text-slate-400"><HiUsers size={48} className="mx-auto mb-3 text-slate-300" /><p>{t.common.error}</p></div>
  }

  const { clients, topByActivity, topByPaid } = data

  const sorted = [...clients]
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'paid')     return b.invoicePaid - a.invoicePaid
      if (sort === 'activity') return (b.invoiceCount + b.projectCount) - (a.invoiceCount + a.projectCount)
      if (sort === 'balance')  return b.invoiceBalance - a.invoiceBalance
      return b.invoiceTotal - a.invoiceTotal
    })

  const totalInvoiced = clients.reduce((s: number, c: any) => s + c.invoiceTotal, 0)
  const totalPaid     = clients.reduce((s: number, c: any) => s + c.invoicePaid, 0)
  const totalBalance  = clients.reduce((s: number, c: any) => s + c.invoiceBalance, 0)

  const isAr = lang === 'ar'

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800">{isAr ? 'العملاء' : 'Clients'}</h2>

      {/* Top 3 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total summary */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 card-hover animate-fade-up delay-100">
          <p className="text-xs text-slate-400 mb-1">{isAr ? 'إجمالي الفواتير المُصدرة' : 'Total Invoiced'}</p>
          <p className="text-2xl font-bold text-slate-800">{formatNum(totalInvoiced)}</p>
          <p className="text-xs text-slate-400">{t.common.aed} · {clients.length} {isAr ? 'عميل' : 'clients'}</p>
          <div className="mt-3 flex gap-4 text-xs">
            <span className="text-green-600">✓ {isAr ? 'مدفوع' : 'Paid'}: {formatNum(totalPaid)}</span>
            <span className="text-red-500">⏳ {isAr ? 'متبقي' : 'Balance'}: {formatNum(totalBalance)}</span>
          </div>
        </div>

        {/* Most active client */}
        {topByActivity && (
          <div className="bg-sky-50 rounded-xl border border-sky-100 shadow-sm p-5 card-hover animate-fade-up delay-200">
            <p className="text-xs text-sky-500 mb-2 font-medium flex items-center gap-1"><HiTrophy size={14} /> {isAr ? 'أكثر عميل تعاملاً' : 'Most Active Client'}</p>
            <div className="flex items-center gap-3">
              <Avatar name={topByActivity.name} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{topByActivity.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {topByActivity.invoiceCount} {isAr ? 'فاتورة' : 'invoices'}
                  {topByActivity.projectCount > 0 && ` · ${topByActivity.projectCount} ${isAr ? 'مشروع' : 'projects'}`}
                </p>
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-sky-700">
              {formatNum(topByActivity.invoiceTotal)} <span className="text-xs font-normal text-sky-400">{t.common.aed}</span>
            </div>
          </div>
        )}

        {/* Top payer */}
        {topByPaid && (
          <div className="bg-green-50 rounded-xl border border-green-100 shadow-sm p-5 card-hover animate-fade-up delay-300">
            <p className="text-xs text-green-600 mb-2 font-medium flex items-center gap-1"><HiCurrencyDollar size={14} /> {isAr ? 'أكثر عميل دفعاً' : 'Top Payer'}</p>
            <div className="flex items-center gap-3">
              <Avatar name={topByPaid.name} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{topByPaid.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr ? 'دفع' : 'Paid'} {Math.round(topByPaid.invoiceTotal > 0 ? (topByPaid.invoicePaid / topByPaid.invoiceTotal) * 100 : 0)}%
                </p>
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-green-700">
              {formatNum(topByPaid.invoicePaid)} <span className="text-xs font-normal text-green-400">{t.common.aed}</span>
            </div>
          </div>
        )}
      </div>

      {/* Filters & sort */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={isAr ? 'بحث باسم العميل...' : 'Search client name...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <div className="flex gap-1">
          {([
            { key: 'total',    label: isAr ? 'الإجمالي'   : 'Total' },
            { key: 'paid',     label: isAr ? 'المدفوع'    : 'Paid' },
            { key: 'balance',  label: isAr ? 'المتبقي'    : 'Balance' },
            { key: 'activity', label: isAr ? 'التعاملات'  : 'Activity' },
          ] as { key: typeof sort; label: string }[]).map(o => (
            <button key={o.key} onClick={() => setSort(o.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sort === o.key ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clients table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <HiUsers size={48} className="mx-auto mb-3 text-slate-300" />
            <p>{isAr ? 'لا يوجد عملاء' : 'No clients found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="hidden sm:table-cell text-right px-4 py-3 font-semibold text-slate-600">#</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">{isAr ? 'العميل' : 'Client'}</th>
                  <th className="hidden lg:table-cell text-right px-4 py-3 font-semibold text-slate-600">{isAr ? 'التواصل' : 'Contact'}</th>
                  <th className="hidden md:table-cell text-right px-4 py-3 font-semibold text-slate-600">{isAr ? 'الفواتير' : 'Invoices'}</th>
                  <th className="hidden md:table-cell text-right px-4 py-3 font-semibold text-slate-600">{isAr ? 'المشاريع' : 'Projects'}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">{isAr ? 'إجمالي الفواتير' : 'Total Invoiced'}</th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">{isAr ? 'المدفوع' : 'Paid'}</th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">{isAr ? 'المتبقي' : 'Balance'}</th>
                  <th className="hidden md:table-cell text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">{isAr ? 'نسبة السداد' : 'Pay Rate'}</th>
                  <th className="hidden md:table-cell text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">{isAr ? 'آخر نشاط' : 'Last Activity'}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c: any, i: number) => {
                  const payRate = c.invoiceTotal > 0 ? (c.invoicePaid / c.invoiceTotal) * 100 : 0
                  return (
                    <tr key={c.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                            {c.company && c.company !== c.name && (
                              <p className="text-xs text-slate-400">{c.company}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3">
                        <div className="text-xs text-slate-500 space-y-0.5">
                          {c.phone && <p>📞 {c.phone}</p>}
                          {c.email && <p>✉ {c.email}</p>}
                          {!c.phone && !c.email && <p className="text-slate-300">—</p>}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-center">
                        <span className="text-slate-700 font-medium">{c.invoiceCount}</span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-center">
                        <span className="text-slate-500">{c.projectCount || '-'}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                        {formatNum(c.invoiceTotal)} <span className="text-xs font-normal text-slate-400">{t.common.aed}</span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-green-600 font-medium whitespace-nowrap">
                        {formatNum(c.invoicePaid)} <span className="text-xs font-normal opacity-70">{t.common.aed}</span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap">
                        <span className={c.invoiceBalance > 0 ? 'text-red-500 font-medium' : 'text-slate-400'}>
                          {c.invoiceBalance > 0 ? formatNum(c.invoiceBalance) : '–'}{' '}
                          {c.invoiceBalance > 0 && <span className="text-xs font-normal opacity-70">{t.common.aed}</span>}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[48px]">
                            <div className={`h-full rounded-full progress-bar ${payRate >= 90 ? 'bg-green-400' : payRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(payRate, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${payRate >= 90 ? 'text-green-600' : payRate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {Math.round(payRate)}%
                          </span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(c.lastActivity, lang)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-400 text-center">
        {sorted.length} {isAr ? 'عميل' : 'clients'}
        {search && ` · ${isAr ? 'نتيجة بحث' : 'search results'}`}
      </p>
    </div>
  )
}
