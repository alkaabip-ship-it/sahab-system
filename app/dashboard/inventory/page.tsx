'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { useSession } from 'next-auth/react'
import { HiArchiveBox, HiPlus, HiPencil, HiTrash, HiExclamationTriangle, HiCheckCircle, HiXMark } from 'react-icons/hi2'

const CATEGORIES = [
  { key: 'WOOD',       ar: 'خشب',        en: 'Wood',       color: 'bg-amber-100 text-amber-700' },
  { key: 'LIGHTING',   ar: 'إضاءة',       en: 'Lighting',   color: 'bg-yellow-100 text-yellow-700' },
  { key: 'ALUMINUM',   ar: 'ألومنيوم',    en: 'Aluminum',   color: 'bg-slate-100 text-slate-600' },
  { key: 'FABRIC',     ar: 'أقمشة',       en: 'Fabric',     color: 'bg-pink-100 text-pink-700' },
  { key: 'ELECTRICAL', ar: 'كهربائيات',   en: 'Electrical', color: 'bg-blue-100 text-blue-700' },
  { key: 'TOOLS',      ar: 'أدوات',       en: 'Tools',      color: 'bg-orange-100 text-orange-700' },
  { key: 'FURNITURE',  ar: 'أثاث',        en: 'Furniture',  color: 'bg-teal-100 text-teal-700' },
  { key: 'AUDIO',      ar: 'صوتيات',      en: 'Audio',      color: 'bg-purple-100 text-purple-700' },
  { key: 'OTHER',      ar: 'أخرى',        en: 'Other',      color: 'bg-gray-100 text-gray-600' },
]

const CONDITIONS = [
  { key: 'GOOD',    ar: 'ممتاز',    color: 'bg-green-100 text-green-700' },
  { key: 'FAIR',    ar: 'مقبول',    color: 'bg-yellow-100 text-yellow-700' },
  { key: 'DAMAGED', ar: 'تالف',     color: 'bg-red-100 text-red-700' },
]

const EMPTY = { name: '', category: 'OTHER', quantity: '', minQuantity: '', unit: 'قطعة', location: '', condition: 'GOOD', notes: '' }

export default function InventoryPage() {
  const { lang } = useTranslation()
  const isRTL = lang === 'ar'
  const { data: session } = useSession()

  const [items,     setItems]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<any | null>(null)
  const [form,      setForm]      = useState<any>(EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [search,    setSearch]    = useState('')

  async function load() {
    const res = await fetch('/api/inventory')
    const d   = await res.json()
    setItems(d.items || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openAdd() { setEditItem(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(item: any) { setEditItem(item); setForm({ ...item, quantity: String(item.quantity), minQuantity: String(item.minQuantity) }); setShowForm(true) }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const url    = editItem ? `/api/inventory/${editItem.id}` : '/api/inventory'
    const method = editItem ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    await load()
    setShowForm(false)
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm(isRTL ? 'حذف هذا العنصر؟' : 'Delete this item?')) return
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    setItems(p => p.filter(i => i.id !== id))
  }

  const filtered = items.filter(i =>
    (!catFilter || i.category === catFilter) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  )

  const lowStock = items.filter(i => i.quantity <= i.minQuantity && i.minQuantity > 0)
  const damaged  = items.filter(i => i.condition === 'DAMAGED')

  const getCat = (key: string) => CATEGORIES.find(c => c.key === key)
  const getCond = (key: string) => CONDITIONS.find(c => c.key === key)

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editItem ? (isRTL ? 'تعديل العنصر' : 'Edit Item') : (isRTL ? 'إضافة عنصر' : 'Add Item')}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl"><HiXMark size={22} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'اسم العنصر *' : 'Item Name *'}</label>
                <input value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'الفئة' : 'Category'}</label>
                <select value={form.category} onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{isRTL ? c.ar : c.en}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'الحالة' : 'Condition'}</label>
                <select value={form.condition} onChange={e => setForm((p: any) => ({ ...p, condition: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                  {CONDITIONS.map(c => <option key={c.key} value={c.key}>{c.ar}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'الكمية الحالية' : 'Current Qty'}</label>
                <input type="number" value={form.quantity} onChange={e => setForm((p: any) => ({ ...p, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'الحد الأدنى' : 'Min Qty (alert)'}</label>
                <input type="number" value={form.minQuantity} onChange={e => setForm((p: any) => ({ ...p, minQuantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'الوحدة' : 'Unit'}</label>
                <input value={form.unit} onChange={e => setForm((p: any) => ({ ...p, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'الموقع' : 'Location'}</label>
                <input value={form.location} onChange={e => setForm((p: any) => ({ ...p, location: e.target.value }))}
                  placeholder={isRTL ? 'مثال: مستودع أ' : 'e.g. Warehouse A'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <input value={form.notes} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all">
                {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center"><HiArchiveBox size={22} className="text-teal-600" /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{isRTL ? 'إدارة المخزون' : 'Inventory'}</h2>
            <p className="text-sm text-slate-400">{items.length} {isRTL ? 'عنصر مسجّل' : 'items registered'}</p>
          </div>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl text-sm flex items-center gap-2">
          <HiPlus size={18} /> {isRTL ? 'إضافة عنصر' : 'Add Item'}
        </button>
      </div>

      {/* Alerts */}
      {(lowStock.length > 0 || damaged.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lowStock.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <HiExclamationTriangle size={20} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">{isRTL ? `${lowStock.length} عنصر بمخزون منخفض` : `${lowStock.length} low stock item(s)`}</p>
                <p className="text-xs text-amber-600">{lowStock.map(i => i.name).join('، ')}</p>
              </div>
            </div>
          )}
          {damaged.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <HiExclamationTriangle size={20} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">{isRTL ? `${damaged.length} عنصر تالف` : `${damaged.length} damaged item(s)`}</p>
                <p className="text-xs text-red-600">{damaged.map(i => i.name).join('، ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? 'بحث...' : 'Search...'}
          className="flex-1 min-w-40 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">{isRTL ? 'جميع الفئات' : 'All Categories'}</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{isRTL ? c.ar : c.en}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100 text-slate-400">
          <HiArchiveBox size={52} className="mx-auto mb-3 text-slate-200" />
          <p className="font-medium">{isRTL ? 'لا توجد عناصر' : 'No items found'}</p>
          <button onClick={openAdd} className="mt-3 px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl">+ {isRTL ? 'أضف أول عنصر' : 'Add First Item'}</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[isRTL ? 'الاسم' : 'Name', isRTL ? 'الفئة' : 'Category', isRTL ? 'الكمية' : 'Qty', isRTL ? 'الحالة' : 'Condition', isRTL ? 'الموقع' : 'Location', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(item => {
                const cat  = getCat(item.category)
                const cond = getCond(item.condition)
                const isLow = item.quantity <= item.minQuantity && item.minQuantity > 0
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.name}
                      {item.notes && <p className="text-xs text-slate-400 font-normal mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${cat?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {isRTL ? cat?.ar : cat?.en}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-base ${isLow ? 'text-amber-600' : 'text-slate-800'}`}>{item.quantity}</span>
                        <span className="text-xs text-slate-400">{item.unit}</span>
                        {isLow && <HiExclamationTriangle size={14} className="text-amber-500" title="مخزون منخفض" />}
                        {item.minQuantity > 0 && <span className="text-xs text-slate-300">/ {item.minQuantity}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${cond?.color ?? 'bg-gray-100 text-gray-600'}`}>{cond?.ar}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.location || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"><HiPencil size={15} /></button>
                        <button onClick={() => del(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><HiTrash size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
