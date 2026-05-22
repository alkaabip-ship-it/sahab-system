'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStatusLabel, getStatusColor } from '@/lib/utils'
import { HiPencil, HiTrash } from 'react-icons/hi2'

const SERVICE_TYPES = [
  { value: 'SCREENS',     label: 'شاشات وعروض' },
  { value: 'AUDIO',       label: 'صوتيات' },
  { value: 'LIGHTING',    label: 'إضاءة' },
  { value: 'PRINTING',    label: 'طباعة' },
  { value: 'CARPET',      label: 'سجاد' },
  { value: 'CARPENTRY',   label: 'نجارة وأثاث' },
  { value: 'FLOWERS',     label: 'ورود وزهور' },
  { value: 'HOSPITALITY', label: 'ضيافة' },
  { value: 'PHOTOGRAPHY', label: 'تصوير فوتوغرافي' },
  { value: 'VIDEO',       label: 'تصوير فيديو' },
  { value: 'LABOR',       label: 'عمالة' },
  { value: 'TRANSPORT',   label: 'نقل' },
  { value: 'OTHER',       label: 'أخرى' },
]

function formatNum(n: number) {
  return new Intl.NumberFormat('ar-AE').format(Math.round(n))
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('ar-AE', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(d))
}

type Tab = 'overview' | 'bills'

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [supplier, setSupplier]             = useState<any>(null)
  const [loading, setLoading]               = useState(true)
  const [tab, setTab]                       = useState<Tab>('overview')
  const [editing, setEditing]               = useState(false)
  const [editForm, setEditForm]             = useState<any>({})
  const [saving, setSaving]                 = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [deletingBill, setDeletingBill]     = useState<string | null>(null)

  async function loadSupplier() {
    const res = await fetch(`/api/suppliers/${id}`)
    const data = await res.json()
    setSupplier(data)
    setEditForm({
      name:           data.name        ?? '',
      phone:          data.phone       ?? '',
      email:          data.email       ?? '',
      serviceType:    data.serviceType ?? 'OTHER',
      recommendation: data.recommendation ?? 'UNDER_REVIEW',
    })
    setLoading(false)
  }

  useEffect(() => { loadSupplier() }, [id])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
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
      alert(d.error || 'خطأ في الحذف')
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
        <p className="text-slate-400">المورد غير موجود</p>
        <Link href="/dashboard/suppliers" className="text-sky-500 mt-2 inline-block">العودة للموردين</Link>
      </div>
    )
  }

  const TABS = [
    { id: 'overview', label: 'نظرة عامة' },
    { id: 'bills',    label: `الفواتير (${supplier.bills?.length || 0})` },
  ]

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/dashboard/suppliers" className="text-slate-400 hover:text-slate-600">الموردون</Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600 font-medium">{supplier.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">اسم المورد</label>
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">رقم الهاتف</label>
                    <input
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="+971 50 000 0000"
                      dir="ltr"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">البريد الإلكتروني</label>
                    <input
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="info@company.ae"
                      dir="ltr"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">نوع الخدمة</label>
                    <select
                      value={editForm.serviceType}
                      onChange={e => setEditForm({ ...editForm, serviceType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      {SERVICE_TYPES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">التوصية</label>
                    <select
                      value={editForm.recommendation}
                      onChange={e => setEditForm({ ...editForm, recommendation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="PRIMARY">رئيسي</option>
                      <option value="BACKUP">احتياطي</option>
                      <option value="UNDER_REVIEW">قيد المراجعة</option>
                      <option value="SUSPENDED">موقوف</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-all disabled:opacity-50"
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
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-slate-800">{supplier.name}</h2>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${getStatusColor(supplier.recommendation)}`}>
                    {getStatusLabel(supplier.recommendation)}
                  </span>
                </div>
                <p className="text-slate-500 text-sm">نوع الخدمة: <strong>{getStatusLabel(supplier.serviceType)}</strong></p>
                {supplier.phone && <p className="text-slate-400 text-xs mt-1">📞 {supplier.phone}</p>}
                {supplier.email && <p className="text-slate-400 text-xs">✉️ {supplier.email}</p>}
              </div>
            )}
          </div>

          {/* Actions */}
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
                  <span className="text-xs text-red-600 font-medium">حذف المورد وفواتيره؟</span>
                  <button
                    onClick={handleDeleteSupplier}
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">إجمالي التعاملات</p>
            <p className="text-lg font-bold text-slate-800">
              {formatNum(supplier.totalAmount)} <span className="text-xs font-normal text-slate-400">د.إ</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">المدفوع</p>
            <p className="text-lg font-bold text-green-600">
              {formatNum(supplier.paidAmount)} <span className="text-xs font-normal">د.إ</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">المشاريع</p>
            <p className="text-lg font-bold text-slate-800">{supplier.projectCount}</p>
          </div>
        </div>
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
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Overview */}
          {tab === 'overview' && (
            <div>
              <h4 className="font-semibold text-slate-700 mb-3">المشاريع المرتبطة</h4>
              {supplier.projects?.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">لا توجد مشاريع</p>
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

          {/* Bills */}
          {tab === 'bills' && (
            <div>
              {supplier.bills?.length === 0 ? (
                <p className="text-center text-slate-400 py-8">لا توجد فواتير</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="text-right pb-2">رقم الفاتورة</th>
                      <th className="text-right pb-2">المشروع</th>
                      <th className="text-right pb-2">المبلغ</th>
                      <th className="text-right pb-2">التاريخ</th>
                      <th className="text-right pb-2">الحالة</th>
                      <th className="pb-2"></th>
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
                            <span className="text-orange-400 text-xs">غير مرتبط</span>
                          )}
                        </td>
                        <td className="py-2 font-medium">
                          {formatNum(b.amount)} <span className="text-xs text-slate-400">د.إ</span>
                        </td>
                        <td className="py-2 text-xs text-slate-500">{formatDate(b.billDate)}</td>
                        <td className="py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(b.status)}`}>
                            {getStatusLabel(b.status)}
                          </span>
                        </td>
                        <td className="py-2 text-left">
                          <button
                            onClick={() => handleDeleteBill(b.id)}
                            disabled={deletingBill === b.id}
                            title="حذف الفاتورة"
                            className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded transition-all disabled:opacity-30"
                          >
                            {deletingBill === b.id ? '...' : 'حذف'}
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
