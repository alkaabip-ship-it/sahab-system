'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStatusLabel, getStatusColor } from '@/lib/utils'
import { usePermissions } from '@/lib/PermissionsContext'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { HiPencil, HiTrash } from 'react-icons/hi2'

const SERVICE_KEYS = [
  'SCREENS','AUDIO','LIGHTING','PRINTING','CARPET','CARPENTRY',
  'FLOWERS','HOSPITALITY','PHOTOGRAPHY','VIDEO','LABOR','TRANSPORT','FIREWORKS','OTHER',
]

const RECOMMENDATION_KEYS = ['PRIMARY','BACKUP','UNDER_REVIEW','SUSPENDED']

type Tab = 'overview' | 'bills'

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string
  const perms  = usePermissions()
  const { t, lang } = useTranslation()
  const isRTL = lang === 'ar'

  const [supplier,       setSupplier]       = useState<any>(null)
  const [loading,        setLoading]        = useState(true)
  const [tab,            setTab]            = useState<Tab>('overview')
  const [editing,        setEditing]        = useState(false)
  const [editForm,       setEditForm]       = useState<any>({})
  const [saving,         setSaving]         = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [deletingBill,   setDeletingBill]   = useState<string | null>(null)

  function formatNum(n: number) {
    return new Intl.NumberFormat(isRTL ? 'ar-AE' : 'en-AE').format(Math.round(n))
  }
  function formatDate(d: string | null) {
    if (!d) return '-'
    return new Intl.DateTimeFormat(isRTL ? 'ar-AE' : 'en-AE', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(d))
  }

  async function loadSupplier() {
    const res  = await fetch(`/api/suppliers/${id}`)
    const data = await res.json()
    setSupplier(data)
    setEditForm({
      name:           data.name           ?? '',
      phone:          data.phone          ?? '',
      email:          data.email          ?? '',
      serviceType:    data.serviceType    ?? 'OTHER',
      recommendation: data.recommendation ?? 'UNDER_REVIEW',
    })
    setLoading(false)
  }

  useEffect(() => { loadSupplier() }, [id])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/suppliers/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(editForm),
    })
    if (res.ok) { await loadSupplier(); setEditing(false) }
    setSaving(false)
  }

  async function handleDeleteSupplier() {
    setDeleting(true)
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/suppliers')
    } else {
      const d = await res.json()
      alert(d.error || (isRTL ? 'خطأ في الحذف' : 'Delete failed'))
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleDeleteBill(billId: string) {
    setDeletingBill(billId)
    await fetch(`/api/bills/${billId}`, { method: 'DELETE' })
    await loadSupplier()
    setDeletingBill(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">{isRTL ? 'المورد غير موجود' : 'Supplier not found'}</p>
        <Link href="/dashboard/suppliers" className="text-sky-500 mt-2 inline-block">
          {isRTL ? 'العودة للموردين' : 'Back to Suppliers'}
        </Link>
      </div>
    )
  }

  const TABS = [
    { id: 'overview', label: isRTL ? 'نظرة عامة' : 'Overview' },
    { id: 'bills',    label: `${isRTL ? 'الفواتير' : 'Bills'} (${supplier.bills?.length || 0})` },
  ]

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/dashboard/suppliers" className="text-slate-400 hover:text-slate-600">
          {t.nav.suppliers}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600 font-medium">{supplier.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">

          {/* Edit form / Display */}
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">

                  {/* Supplier name — full width */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t.suppliers.name}</label>
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t.suppliers.phone}</label>
                    <input
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="+971 50 000 0000"
                      dir="ltr"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t.suppliers.email}</label>
                    <input
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="info@company.ae"
                      dir="ltr"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* Service type */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t.suppliers.serviceType}</label>
                    <select
                      value={editForm.serviceType}
                      onChange={e => setEditForm({ ...editForm, serviceType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      {SERVICE_KEYS.map(key => (
                        <option key={key} value={key}>{(t.serviceType as any)[key] ?? key}</option>
                      ))}
                    </select>
                  </div>

                  {/* Recommendation */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t.suppliers.recommendation}</label>
                    <select
                      value={editForm.recommendation}
                      onChange={e => setEditForm({ ...editForm, recommendation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      {RECOMMENDATION_KEYS.map(key => (
                        <option key={key} value={key}>{(t.recommendation as any)[key] ?? key}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-all disabled:opacity-50"
                  >
                    {saving ? t.common.saving : t.common.save}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm rounded-lg transition-all"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>

            ) : (
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-slate-800">{supplier.name}</h2>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${getStatusColor(supplier.recommendation)}`}>
                    {getStatusLabel(supplier.recommendation)}
                  </span>
                </div>
                <p className="text-slate-500 text-sm">
                  {t.suppliers.serviceType}: <strong>{(t.serviceType as any)[supplier.serviceType] ?? supplier.serviceType}</strong>
                </p>
                {supplier.phone && <p className="text-slate-400 text-xs mt-1">📞 {supplier.phone}</p>}
                {supplier.email && <p className="text-slate-400 text-xs">✉️ {supplier.email}</p>}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!editing && (
            <div className="flex items-center gap-2 flex-shrink-0 ms-4">
              <button
                onClick={() => setEditing(true)}
                className="text-sm px-3 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-all flex items-center gap-1.5"
              >
                <HiPencil size={14} /> {t.common.edit}
              </button>

              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm px-3 py-2 border border-red-200 text-red-400 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1.5"
                >
                  <HiTrash size={14} /> {t.common.delete}
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-red-600 font-medium">
                    {isRTL ? 'حذف المورد وفواتيره؟' : 'Delete supplier and bills?'}
                  </span>
                  <button
                    onClick={handleDeleteSupplier}
                    disabled={deleting}
                    className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded font-medium disabled:opacity-50"
                  >
                    {deleting ? '...' : t.common.yes}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 border border-slate-200 text-slate-500 hover:bg-white rounded"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          {perms.viewFinancials && (
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">{t.suppliers.totalAmount}</p>
              <p className="text-lg font-bold text-slate-800">
                {formatNum(supplier.totalAmount)} <span className="text-xs font-normal text-slate-400">{t.common.aed}</span>
              </p>
            </div>
          )}
          {perms.viewFinancials && (
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">{isRTL ? 'المدفوع' : 'Paid'}</p>
              <p className="text-lg font-bold text-green-600">
                {formatNum(supplier.paidAmount)} <span className="text-xs font-normal">{t.common.aed}</span>
              </p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">{isRTL ? 'المشاريع' : 'Projects'}</p>
            <p className="text-lg font-bold text-slate-800">{supplier.projectCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {TABS.map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id as Tab)}
              className={`px-5 py-3 text-sm font-medium transition-all ${
                tab === tb.id
                  ? 'border-b-2 border-sky-500 text-sky-600 bg-sky-50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* Overview tab */}
          {tab === 'overview' && (
            <div>
              <h4 className="font-semibold text-slate-700 mb-3">
                {isRTL ? 'المشاريع المرتبطة' : 'Linked Projects'}
              </h4>
              {supplier.projects?.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">{t.common.noData}</p>
              ) : (
                <div className="space-y-2">
                  {supplier.projects?.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <Link href={`/dashboard/projects/${p.id}`} className="font-medium text-slate-700 hover:text-sky-600 text-sm">
                          {p.name}
                        </Link>
                        <p className="text-xs text-slate-400">{p.clientName}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bills tab */}
          {tab === 'bills' && (
            <div>
              {supplier.bills?.length === 0 ? (
                <p className="text-center text-slate-400 py-8">{t.bills.noBills}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="text-start pb-2">{t.bills.billNumber}</th>
                      <th className="text-start pb-2">{t.bills.project}</th>
                      {perms.viewFinancials && <th className="text-start pb-2">{t.bills.amount}</th>}
                      <th className="text-start pb-2">{t.bills.date}</th>
                      <th className="text-start pb-2">{t.bills.status}</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.bills.map((b: any) => (
                      <tr key={b.id} className="border-b border-slate-50 group">
                        <td className="py-2 font-mono text-xs text-slate-500">{b.billNumber}</td>
                        <td className="py-2 text-slate-700">
                          {b.project ? (
                            <Link href={`/dashboard/projects/${b.project.id}`} className="hover:text-sky-600">
                              {b.project.name}
                            </Link>
                          ) : (
                            <span className="text-orange-400 text-xs">{t.bills.unlinked}</span>
                          )}
                        </td>
                        {perms.viewFinancials && (
                          <td className="py-2 font-medium">
                            {formatNum(b.amount)} <span className="text-xs text-slate-400">{t.common.aed}</span>
                          </td>
                        )}
                        <td className="py-2 text-xs text-slate-500">{formatDate(b.billDate)}</td>
                        <td className="py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(b.status)}`}>
                            {getStatusLabel(b.status)}
                          </span>
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => handleDeleteBill(b.id)}
                            disabled={deletingBill === b.id}
                            className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded transition-all disabled:opacity-30"
                          >
                            {deletingBill === b.id ? '...' : t.common.delete}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
