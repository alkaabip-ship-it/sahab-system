'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStatusLabel, getStatusColor } from '@/lib/utils'
import {
  HiComputerDesktop, HiSpeakerWave, HiLightBulb, HiDocumentDuplicate,
  HiViewColumns, HiWrench, HiSparkles, HiGift,
  HiCamera, HiFilm, HiUserGroup, HiTruck, HiCube,
  HiBuildingOffice2, HiCurrencyDollar, HiClipboardDocumentList,
} from 'react-icons/hi2'
import Pagination from '@/components/Pagination'

const SERVICE_TYPES = [
  { value: 'SCREENS',     label: 'شاشات وعروض',       icon: <HiComputerDesktop size={14} /> },
  { value: 'AUDIO',       label: 'صوتيات',             icon: <HiSpeakerWave size={14} /> },
  { value: 'LIGHTING',    label: 'إضاءة',              icon: <HiLightBulb size={14} /> },
  { value: 'PRINTING',    label: 'طباعة',              icon: <HiDocumentDuplicate size={14} /> },
  { value: 'CARPET',      label: 'سجاد',               icon: <HiViewColumns size={14} /> },
  { value: 'CARPENTRY',   label: 'نجارة وأثاث',        icon: <HiWrench size={14} /> },
  { value: 'FLOWERS',     label: 'ورود وزهور',         icon: <HiSparkles size={14} /> },
  { value: 'HOSPITALITY', label: 'ضيافة',              icon: <HiGift size={14} /> },
  { value: 'PHOTOGRAPHY', label: 'تصوير فوتوغرافي',   icon: <HiCamera size={14} /> },
  { value: 'VIDEO',       label: 'تصوير فيديو',        icon: <HiFilm size={14} /> },
  { value: 'LABOR',       label: 'عمالة',              icon: <HiUserGroup size={14} /> },
  { value: 'TRANSPORT',   label: 'نقل',                icon: <HiTruck size={14} /> },
  { value: 'OTHER',       label: 'أخرى',               icon: <HiCube size={14} /> },
]

const SERVICE_COLORS: Record<string, string> = {
  SCREENS:     'bg-blue-100 text-blue-700',
  AUDIO:       'bg-purple-100 text-purple-700',
  LIGHTING:    'bg-yellow-100 text-yellow-700',
  PRINTING:    'bg-orange-100 text-orange-700',
  CARPET:      'bg-amber-100 text-amber-700',
  CARPENTRY:   'bg-lime-100 text-lime-700',
  FLOWERS:     'bg-pink-100 text-pink-700',
  HOSPITALITY: 'bg-rose-100 text-rose-700',
  PHOTOGRAPHY: 'bg-indigo-100 text-indigo-700',
  VIDEO:       'bg-violet-100 text-violet-700',
  LABOR:       'bg-slate-100 text-slate-700',
  TRANSPORT:   'bg-cyan-100 text-cyan-700',
  OTHER:       'bg-gray-100 text-gray-700',
}

const RECOMMENDATIONS = [
  { value: '', label: 'جميع التوصيات' },
  { value: 'PRIMARY',      label: 'رئيسي' },
  { value: 'BACKUP',       label: 'احتياطي' },
  { value: 'UNDER_REVIEW', label: 'قيد المراجعة' },
  { value: 'SUSPENDED',    label: 'موقوف' },
]

function formatNum(n: number) {
  return new Intl.NumberFormat('ar-AE').format(Math.round(n))
}

function getServiceIcon(type: string) {
  return SERVICE_TYPES.find(s => s.value === type)?.icon ?? <HiCube size={14} />
}

function getServiceLabel(type: string) {
  return SERVICE_TYPES.find(s => s.value === type)?.label ?? type
}

function SupplierAvatar({ name, serviceType }: { name: string; serviceType: string }) {
  const initial = name.trim()[0] ?? '؟'
  const colorClass = SERVICE_COLORS[serviceType] ?? 'bg-slate-100 text-slate-700'
  return (
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0 ${colorClass}`}>
      {initial}
    </div>
  )
}


// ── Add Supplier Modal ────────────────────────────────────────────────────────
function AddSupplierModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', serviceType: 'OTHER' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('الاسم مطلوب'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      onAdded()
      onClose()
    } else {
      const d = await res.json()
      setError(d.error || 'خطأ في الإضافة')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">إضافة مورد جديد</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center">
          <div className="text-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-1 ${SERVICE_COLORS[form.serviceType] ?? 'bg-slate-100 text-slate-700'}`}>
              {form.name.trim()[0] || '؟'}
            </div>
            <p className="text-xs text-slate-400">{getServiceIcon(form.serviceType)} {getServiceLabel(form.serviceType)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">اسم المورد *</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: شركة النور للشاشات"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">نوع الخدمة *</label>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_TYPES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm({ ...form, serviceType: s.value })}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs transition-all ${
                    form.serviceType === s.value
                      ? 'border-sky-400 bg-sky-50 text-sky-700 font-semibold'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center justify-center">{s.icon}</span>
                  <span className="leading-tight text-center">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الهاتف</label>
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+971 50 000 0000"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">البريد الإلكتروني</label>
              <input
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="info@company.ae"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                dir="ltr"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-semibold rounded-xl transition-all text-sm"
            >
              {saving ? 'جاري الإضافة...' : 'إضافة المورد'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceFilter, setServiceFilter] = useState('')
  const [recFilter, setRecFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'deals'>('amount')
  const [cardPage, setCardPage] = useState(1)
  const CARDS_PER_PAGE = 12

  async function loadSuppliers() {
    setLoading(true)
    const res = await fetch('/api/suppliers?limit=200')
    const data = await res.json()
    setSuppliers(Array.isArray(data.data) ? data.data : [])
    setLoading(false)
  }

  useEffect(() => { loadSuppliers() }, [])

  // Reset to page 1 whenever filters change
  useEffect(() => { setCardPage(1) }, [search, serviceFilter, recFilter, sortBy])

  const filtered = suppliers
    .filter((s) => {
      const matchService = !serviceFilter || s.serviceType === serviceFilter
      const matchRec = !recFilter || s.recommendation === recFilter
      const matchSearch =
        !search ||
        s.name.includes(search) ||
        s.email?.includes(search) ||
        s.phone?.includes(search)
      return matchService && matchRec && matchSearch
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return b.totalAmount - a.totalAmount
      if (sortBy === 'deals')  return b.dealCount  - a.dealCount
      return a.name.localeCompare(b.name, 'ar')
    })

  const filteredPages = Math.ceil(filtered.length / CARDS_PER_PAGE)
  const paginated = filtered.slice((cardPage - 1) * CARDS_PER_PAGE, cardPage * CARDS_PER_PAGE)

  return (
    <div className="space-y-4">
      {showAdd && (
        <AddSupplierModal
          onClose={() => setShowAdd(false)}
          onAdded={loadSuppliers}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">الموردون</h2>
          <p className="text-sm text-slate-400 mt-0.5">{suppliers.length} مورد مسجّل</p>
          {filtered.length !== suppliers.length && (
            <p className="text-xs text-sky-500">{filtered.length} نتيجة</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span> إضافة مورد
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="بحث بالاسم أو البريد أو الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
        >
          <option value="">جميع الخدمات</option>
          {SERVICE_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={recFilter}
          onChange={(e) => setRecFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
        >
          {RECOMMENDATIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Sort buttons */}
        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
          <span className="text-xs text-slate-400 px-1">ترتيب:</span>
          {[
            { key: 'amount', label: 'الأعلى تعاملاً' },
            { key: 'deals',  label: 'الأكثر صفقات' },
            { key: 'name',   label: 'أ-ي الاسم' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key as any)}
              className={`text-xs px-2.5 py-1.5 rounded-md transition-all font-medium ${
                sortBy === key
                  ? 'bg-white text-sky-600 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-100">
          <HiBuildingOffice2 size={52} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">لا يوجد موردون</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-all"
          >
            + إضافة أول مورد
          </button>
        </div>
      ) : (
        <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/suppliers/${s.id}`}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-sky-200 transition-all block group"
            >
              {/* Top row: avatar + name + badge */}
              <div className="flex items-center gap-3 mb-4">
                <SupplierAvatar name={s.name} serviceType={s.serviceType} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate group-hover:text-sky-600 transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {getServiceIcon(s.serviceType)} {getServiceLabel(s.serviceType)}
                  </p>
                  {s.phone && (
                    <p className="text-xs text-slate-400 mt-0.5">📞 {s.phone}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 self-start ${getStatusColor(s.recommendation)}`}>
                  {getStatusLabel(s.recommendation)}
                </span>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 rounded-xl p-3 mb-3">
                <div>
                  <p className="text-lg font-bold text-slate-800">{s.dealCount}</p>
                  <p className="text-xs text-slate-400">فاتورة</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">
                    {formatNum(s.totalAmount)}
                  </p>
                  <p className="text-xs text-slate-400">د.إ إجمالي</p>
                </div>
              </div>
            </Link>
          ))}

          {/* Add card shortcut */}
          <button
            onClick={() => setShowAdd(true)}
            className="bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition-all flex flex-col items-center justify-center gap-2 p-5 min-h-[200px] text-slate-400 hover:text-sky-500"
          >
            <span className="text-4xl">+</span>
            <span className="text-sm font-medium">إضافة مورد جديد</span>
          </button>
        </div>
        <Pagination
          page={cardPage}
          pages={filteredPages}
          total={filtered.length}
          limit={CARDS_PER_PAGE}
          onPage={(p) => { setCardPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          isRtl={true}
        />
        </div>
      )}
    </div>
  )
}
