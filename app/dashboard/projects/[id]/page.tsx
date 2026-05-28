'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStatusLabel, getStatusColor } from '@/lib/utils'
import { HiPencil, HiTrash } from 'react-icons/hi2'

function formatNum(n: number) {
  return new Intl.NumberFormat('ar-AE').format(Math.round(n))
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('ar-AE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(d))
}

const STATUS_OPTIONS = [
  { value: 'QUOTE',       label: 'عرض سعر' },
  { value: 'CONFIRMED',   label: 'مؤكد' },
  { value: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { value: 'COMPLETED',   label: 'مكتمل' },
  { value: 'CLOSED',      label: 'مغلق' },
]

type Tab = 'bills' | 'suppliers'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject]               = useState<any>(null)
  const [loading, setLoading]               = useState(true)
  const [tab, setTab]                       = useState<Tab>('bills')
  const [editing, setEditing]               = useState(false)
  const [editForm, setEditForm]             = useState<any>({})
  const [saving, setSaving]                 = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [unlinkingBill, setUnlinkingBill]   = useState<string | null>(null)

  // Bill search & link
  const [billSearchName,    setBillSearchName]    = useState('')
  const [billSearchAmount,  setBillSearchAmount]  = useState('')
  const [billSearchResults, setBillSearchResults] = useState<any[]>([])
  const [billSearchLoading, setBillSearchLoading] = useState(false)
  const [billSearchDone,    setBillSearchDone]    = useState(false)
  const [linkingBillId,     setLinkingBillId]     = useState<string | null>(null)

  async function loadProject() {
    const res = await fetch(`/api/projects/${id}`)
    const data = await res.json()
    if (res.ok) {
      setProject(data)
      setEditForm({
        name:          data.name,
        clientName:    data.clientName,
        value:         data.value,
        status:        data.status,
        executionDate: data.executionDate ? data.executionDate.slice(0, 10) : '',
      })
    }
    setLoading(false)
  }

  useEffect(() => { loadProject() }, [id])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) { await loadProject(); setEditing(false) }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/projects')
    } else {
      const data = await res.json()
      alert(data.error || 'خطأ في الحذف')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function searchBills() {
    if (!billSearchName.trim() && !billSearchAmount.trim()) return
    setBillSearchLoading(true)
    setBillSearchDone(false)
    const params = new URLSearchParams()
    if (billSearchName.trim()) params.set('search', billSearchName.trim())
    if (billSearchAmount.trim()) {
      const amt = parseFloat(billSearchAmount)
      if (!isNaN(amt)) {
        // ±10% tolerance
        params.set('minAmount', String(Math.floor(amt * 0.9)))
        params.set('maxAmount', String(Math.ceil(amt * 1.1)))
      }
    }
    const res  = await fetch(`/api/bills?${params.toString()}&limit=20`)
    const data = await res.json()
    // Exclude bills already linked to THIS project
    const results = (data.data || []).filter((b: any) => b.projectId !== id)
    setBillSearchResults(results)
    setBillSearchLoading(false)
    setBillSearchDone(true)
  }

  async function handleLinkBill(billId: string) {
    setLinkingBillId(billId)
    await fetch(`/api/bills/${billId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id, isLinked: true }),
    })
    await loadProject()
    // Remove from search results
    setBillSearchResults(prev => prev.filter(b => b.id !== billId))
    setLinkingBillId(null)
  }

  async function handleUnlinkBill(billId: string) {
    setUnlinkingBill(billId)
    await fetch(`/api/bills/${billId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: null }),
    })
    await loadProject()
    setUnlinkingBill(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">المشروع غير موجود</p>
        <Link href="/dashboard/projects" className="text-sky-500 mt-2 inline-block">
          العودة للمشاريع
        </Link>
      </div>
    )
  }

  const TABS = [
    { id: 'bills',     label: `الفواتير (${project.bills?.length || 0})` },
    { id: 'suppliers', label: `الموردون (${project.suppliers?.length || 0})` },
  ]

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/dashboard/projects" className="text-slate-400 hover:text-slate-600">
          المشاريع
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600 font-medium">{project.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full text-xl font-bold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={editForm.clientName}
                    onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                    placeholder="اسم العميل"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full"
                  />
                  <input
                    type="number"
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                    placeholder="القيمة"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full"
                  />
                  <input
                    type="date"
                    value={editForm.executionDate}
                    onChange={(e) => setEditForm({ ...editForm, executionDate: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full"
                  />
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white w-full"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-all"
                  >
                    {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm rounded-lg transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-slate-800">{project.name}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(project.status)}`}>
                    {getStatusLabel(project.status)}
                  </span>
                </div>
                <p className="text-slate-500 text-sm">
                  العميل: <strong>{project.clientName}</strong> | الكود:{' '}
                  <strong className="font-mono">{project.code}</strong>
                </p>
                {project.executionDate && (
                  <p className="text-slate-400 text-xs mt-1">
                    تاريخ التنفيذ: {formatDate(project.executionDate)}
                  </p>
                )}
              </>
            )}
          </div>

          {!editing && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="text-sm px-3 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
              >
                <HiPencil size={14} className="inline-block" /> تعديل
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm px-3 py-2 border border-red-200 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                >
                  <HiTrash size={14} className="inline-block" /> حذف
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-red-600 font-medium">تأكيد الحذف؟</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded font-medium disabled:opacity-50"
                  >
                    {deleting ? '...' : 'نعم'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 border border-slate-200 text-slate-500 hover:bg-white rounded"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KPIs */}
        {!editing && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">الإيراد (بدون ضريبة)</p>
                <p className="text-lg font-bold text-slate-800">
                  {formatNum(project.revenueExVat)}
                  <span className="text-xs font-normal text-slate-400 mr-1">د.إ</span>
                </p>
                <p className="text-xs text-slate-300">شامل: {formatNum(project.value)} د.إ</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">التكاليف (بدون ضريبة)</p>
                <p className="text-lg font-bold text-slate-800">
                  {formatNum(project.costsExVat)}
                  <span className="text-xs font-normal text-slate-400 mr-1">د.إ</span>
                </p>
                <p className="text-xs text-slate-300">شامل: {formatNum(project.costs)} د.إ</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">الربح الحقيقي</p>
                <p className={`text-lg font-bold ${project.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatNum(project.profit)}
                  <span className="text-xs font-normal opacity-70 mr-1">د.إ</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">نسبة الربح</p>
                <p className={`text-lg font-bold ${
                  project.margin >= 30 ? 'text-green-600' : project.margin >= 20 ? 'text-yellow-600' : 'text-red-500'
                }`}>
                  {project.margin.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* VAT breakdown */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="text-center">
                <p className="text-xs text-amber-600 mb-1">ضريبة محصّلة من العميل</p>
                <p className="text-base font-bold text-amber-700">
                  {formatNum(project.vatCollected)}
                  <span className="text-xs font-normal mr-1">د.إ</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-amber-600 mb-1">ضريبة مدفوعة للموردين</p>
                <p className="text-base font-bold text-amber-700">
                  {formatNum(project.vatPaid)}
                  <span className="text-xs font-normal mr-1">د.إ</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-amber-600 mb-1">صافي الضريبة المستحقة</p>
                <p className={`text-base font-bold ${project.netVat >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatNum(project.netVat)}
                  <span className="text-xs font-normal mr-1">د.إ</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`px-5 py-3 text-sm font-medium transition-all ${
                tab === t.id
                  ? 'border-b-2 border-sky-500 text-sky-600 bg-sky-50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Bills Tab */}
          {tab === 'bills' && (
            <div className="space-y-5">

              {/* ── Search & Link Section ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-600">🔍 بحث وربط فاتورة بالمشروع</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="اسم المورد أو رقم الفاتورة..."
                    value={billSearchName}
                    onChange={e => setBillSearchName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchBills()}
                    className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                  />
                  <input
                    type="number"
                    placeholder="المبلغ (د.إ)..."
                    value={billSearchAmount}
                    onChange={e => setBillSearchAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchBills()}
                    className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                  />
                  <button
                    onClick={searchBills}
                    disabled={billSearchLoading || (!billSearchName.trim() && !billSearchAmount.trim())}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-all disabled:opacity-40 whitespace-nowrap"
                  >
                    {billSearchLoading ? '...' : 'بحث'}
                  </button>
                </div>

                {/* Search results */}
                {billSearchDone && (
                  billSearchResults.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">لا توجد نتائج مطابقة</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {billSearchResults.map((b: any) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-2 gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-slate-700">{b.supplier?.name || '—'}</span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-xs text-slate-400 font-mono">{b.billNumber}</span>
                            {b.projectId && (
                              <span className="mr-2 text-xs text-amber-500">مرتبطة بمشروع آخر</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
                              {formatNum(b.amount)} <span className="text-xs font-normal text-slate-400">د.إ</span>
                            </span>
                            <button
                              onClick={() => handleLinkBill(b.id)}
                              disabled={linkingBillId === b.id}
                              className="text-xs px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all disabled:opacity-40 whitespace-nowrap"
                            >
                              {linkingBillId === b.id ? '...' : '⛓ ربط'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* ── Linked Bills Table ── */}
              {project.bills?.length === 0 ? (
                <p className="text-center text-slate-400 py-8">لا توجد فواتير مرتبطة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="hidden sm:table-cell text-right pb-2 whitespace-nowrap">رقم الفاتورة</th>
                        <th className="text-right pb-2">المورد</th>
                        <th className="text-right pb-2 whitespace-nowrap">المبلغ</th>
                        <th className="hidden sm:table-cell text-right pb-2 whitespace-nowrap">التاريخ</th>
                        <th className="text-right pb-2">الحالة</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.bills.map((b: any) => (
                        <tr key={b.id} className="border-b border-slate-50 group">
                          <td className="hidden sm:table-cell py-2 font-mono text-xs text-slate-500 whitespace-nowrap">{b.billNumber}</td>
                          <td className="py-2 text-slate-700">{b.supplier?.name || '-'}</td>
                          <td className="py-2 font-medium text-slate-800 whitespace-nowrap">
                            {formatNum(b.amount)}{' '}
                            <span className="text-xs text-slate-400">د.إ</span>
                          </td>
                          <td className="hidden sm:table-cell py-2 text-slate-500 text-xs whitespace-nowrap">{formatDate(b.billDate)}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(b.status)}`}>
                              {getStatusLabel(b.status)}
                            </span>
                          </td>
                          <td className="py-2 text-left">
                            <button
                              onClick={() => handleUnlinkBill(b.id)}
                              disabled={unlinkingBill === b.id}
                              title="فك الارتباط بالمشروع"
                              className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-300 px-2 py-0.5 rounded transition-all disabled:opacity-30"
                            >
                              {unlinkingBill === b.id ? '...' : '⛓ فك'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Suppliers Tab */}
          {tab === 'suppliers' && (
            <div>
              {project.suppliers?.length === 0 ? (
                <p className="text-center text-slate-400 py-8">لا يوجد موردون مرتبطون</p>
              ) : (
                <div className="space-y-3">
                  {project.suppliers.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                      <div>
                        <Link
                          href={`/dashboard/suppliers/${s.id}`}
                          className="font-medium text-slate-800 hover:text-sky-600"
                        >
                          {s.name}
                        </Link>
                        <p className="text-xs text-slate-400">{getStatusLabel(s.serviceType)}</p>
                      </div>
                      <p className="font-semibold text-slate-700">
                        {formatNum(s.totalAmount)}{' '}
                        <span className="text-xs font-normal text-slate-400">د.إ</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
