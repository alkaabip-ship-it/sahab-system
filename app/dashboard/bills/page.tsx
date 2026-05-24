'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStatusColor } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { HiDocumentText } from 'react-icons/hi2'
import Pagination from '@/components/Pagination'

type BillTab = 'all' | 'unlinked' | 'unpaid'

function formatNum(n: number) { return new Intl.NumberFormat('ar-AE').format(Math.round(n)) }
function formatDate(d: string | null, lang: string) {
  if (!d) return '-'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))
}

function StatusPicker({ billId, current, onChanged, t }: { billId: string; current: string; onChanged: () => void; t: any }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)

  const STATUS_OPTIONS = [
    { value: 'PAID',    label: t.status.PAID,    color: 'text-green-600 bg-green-50 border-green-200' },
    { value: 'PARTIAL', label: t.status.PARTIAL,  color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    { value: 'UNPAID',  label: t.status.UNPAID,   color: 'text-red-500 bg-red-50 border-red-200' },
  ]

  async function changeStatus(status: string) {
    if (status === current) { setOpen(false); return }
    setSaving(true)
    await fetch(`/api/bills/${billId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setSaving(false)
    setOpen(false)
    onChanged()
  }

  const cur = STATUS_OPTIONS.find(s => s.value === current)

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={saving}
        className={`text-xs px-2 py-1 rounded-full font-medium border transition-all flex items-center gap-1 ${cur?.color ?? 'bg-slate-100 text-slate-600 border-slate-200'} ${saving ? 'opacity-50' : 'hover:opacity-80'}`}>
        {saving ? '...' : cur?.label ?? current}
        <span className="opacity-50">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute start-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[110px]">
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => changeStatus(s.value)}
                className={`w-full text-right px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 flex items-center gap-2 ${s.value === current ? 'bg-slate-50 text-sky-600' : 'text-slate-700'}`}>
                <span className={`w-2 h-2 rounded-full ${s.value === 'PAID' ? 'bg-green-500' : s.value === 'PARTIAL' ? 'bg-yellow-500' : 'bg-red-400'}`} />
                {s.label}
                {s.value === current && <span className="me-auto text-sky-500">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function BillsPage() {
  const { t, lang } = useTranslation()
  const [tab, setTab]     = useState<BillTab>('all')
  const [bills, setBills] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [officeProject, setOfficeProject] = useState<any>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Record<string, string>>({})
  const [page,  setPage]  = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 25

  const TABS = [
    { id: 'all',      label: t.common.all },
    { id: 'unlinked', label: t.bills.unlinked },
    { id: 'unpaid',   label: t.bills.unlinked === 'Unlinked' ? 'Unpaid' : 'غير المدفوعة' },
  ]

  async function loadBills(currentTab: BillTab, p = 1) {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
    if (currentTab === 'unlinked') params.set('unlinked', 'true')
    if (currentTab === 'unpaid')   params.set('unpaid', 'true')
    const res = await fetch(`/api/bills?${params}`).then(r => r.json())
    setBills(Array.isArray(res.data) ? res.data : [])
    setTotal(res.total ?? 0)
    setPages(res.pages ?? 1)
    setPage(res.page ?? 1)
    setLoading(false)
  }

  function handlePage(p: number) {
    setPage(p)
    loadBills(tab, p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    fetch('/api/projects?limit=100').then(r => r.json()).then(async (d) => {
      const all = Array.isArray(d.data) ? d.data : []
      let office = all.find((p: any) => p.name === 'مصاريف المكتب') || null
      if (!office) {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'مصاريف المكتب', clientName: 'سحاب', value: 1, status: 'IN_PROGRESS' }),
        })
        if (res.ok) office = await res.json()
      }
      setOfficeProject(office)
      const filtered = all.filter((p: any) => p.name !== 'مصاريف المكتب')
      filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setProjects(filtered)
    })
  }, [])
  useEffect(() => { loadBills(tab, 1) }, [tab])

  useEffect(() => {
    fetch('/api/sync/bills', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.deleted > 0) loadBills(tab, 1) })
      .catch(() => {})
  }, [])

  async function handleLink(billId: string) {
    const projectId = selectedProject[billId]
    if (!projectId) return
    setLinkingId(billId)
    const res = await fetch(`/api/bills/${billId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
    if (res.ok) await loadBills(tab)
    setLinkingId(null)
  }

  const totalAmount = bills.reduce((s, b) => s + b.amount, 0)

  const tabLabels: Record<BillTab, string> = {
    all:      t.common.all,
    unlinked: t.bills.unlinked,
    unpaid:   t.status.UNPAID,
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">{t.bills.title}</h2>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {(['all', 'unlinked', 'unpaid'] as BillTab[]).map((id) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-6 py-3 text-sm font-medium transition-all ${tab === id ? 'border-b-2 border-sky-500 text-sky-600 bg-sky-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {tabLabels[id]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-16 text-slate-400"><HiDocumentText size={48} className="mx-auto mb-3 text-slate-300" /><p>{t.bills.noBills}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[t.bills.billNumber, t.bills.supplier, t.bills.project, t.bills.amount, t.bills.date, t.bills.dueDate, t.bills.status].map(h => (
                    <th key={h} className="text-right px-4 py-3 font-semibold text-slate-600">{h}</th>
                  ))}
                  {tab === 'unlinked' && <th className="text-right px-4 py-3 font-semibold text-slate-600">{t.projects.bills}</th>}
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.billNumber}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {b.supplier ? <Link href={`/dashboard/suppliers/${b.supplier.id}`} className="hover:text-sky-600">{b.supplier.name}</Link> : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {b.project ? <Link href={`/dashboard/projects/${b.project.id}`} className="text-sky-600 hover:text-sky-700 text-xs font-medium">{b.project.code}</Link>
                        : <span className="text-orange-400 text-xs">{t.bills.unlinked}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{formatNum(b.amount)} <span className="text-xs font-normal text-slate-400">{t.common.aed}</span></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(b.billDate, lang)}</td>
                    <td className="px-4 py-3 text-xs">
                      {b.dueDate ? <span className={new Date(b.dueDate) < new Date() && b.status !== 'PAID' ? 'text-red-500 font-medium' : 'text-slate-500'}>{formatDate(b.dueDate, lang)}</span> : '-'}
                    </td>
                    <td className="px-4 py-3"><StatusPicker billId={b.id} current={b.status} onChanged={() => loadBills(tab)} t={t} /></td>
                    {tab === 'unlinked' && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select value={selectedProject[b.id] || ''} onChange={(e) => setSelectedProject({ ...selectedProject, [b.id]: e.target.value })}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500">
                            <option value="">— اختر مشروع —</option>
                            {officeProject && <option value={officeProject.id}>🏢 مصاريف المكتب</option>}
                            {officeProject && <option disabled>──────────</option>}
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                          </select>
                          <button onClick={() => handleLink(b.id)} disabled={!selectedProject[b.id] || linkingId === b.id}
                            className="text-xs px-2 py-1 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-200 text-white rounded transition-all">
                            {linkingId === b.id ? '...' : t.common.save}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Pagination page={page} pages={pages} total={total} limit={LIMIT} onPage={handlePage} isRtl={lang === 'ar'} />
        )}
      </div>

      {!loading && bills.length > 0 && (
        <p className="text-sm text-slate-400 text-center">
          {total} {t.bills.billsCount} · {t.bills.total}: {formatNum(totalAmount)} {t.common.aed}
        </p>
      )}
    </div>
  )
}
