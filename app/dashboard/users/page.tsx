'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HiUsers, HiPlus, HiTrash, HiPencil, HiCheckCircle, HiXCircle, HiEyeSlash } from 'react-icons/hi2'
import { Permissions, DEFAULT_VIEWER_PERMISSIONS, ADMIN_PERMISSIONS } from '@/lib/permissions'

type User = { id: string; name: string; email: string; role: string; permissions: string | null; createdAt: string }

const TAB_LABELS: Record<string, string> = {
  dashboard: 'لوحة التحكم', projects: 'المشاريع', suppliers: 'الموردون', bills: 'الفواتير',
  clients: 'العملاء', reports: 'التقارير', admin: 'الإدارة',
  uploadBill: 'رفع فاتورة AI', communications: 'التواصل', settings: 'الإعدادات',
}

function parsePerms(raw: string | null, role: string): Permissions {
  if (role === 'ADMIN') return ADMIN_PERMISSIONS
  if (!raw) return DEFAULT_VIEWER_PERMISSIONS
  try {
    const parsed = JSON.parse(raw)
    return {
      viewFinancials: parsed.viewFinancials ?? DEFAULT_VIEWER_PERMISSIONS.viewFinancials,
      tabs: { ...DEFAULT_VIEWER_PERMISSIONS.tabs, ...parsed.tabs },
    }
  } catch { return DEFAULT_VIEWER_PERMISSIONS }
}

function PermToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-sky-500' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'right-0.5' : 'left-0.5'}`} />
      </div>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<User | null>(null)
  const [adding, setAdding]     = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving]     = useState(false)

  // Form state
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('VIEWER')
  const [perms, setPerms]       = useState<Permissions>(DEFAULT_VIEWER_PERMISSIONS)

  useEffect(() => {
    if (session && (session.user as any).role !== 'ADMIN') router.replace('/dashboard')
  }, [session])

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/users').then(r => r.json())
    setUsers(res.users || [])
    setLoading(false)
  }

  function openAdd() {
    setName(''); setEmail(''); setPassword(''); setRole('VIEWER')
    setPerms(DEFAULT_VIEWER_PERMISSIONS)
    setEditing(null); setAdding(true); setMsg(null)
  }

  function openEdit(u: User) {
    setName(u.name); setEmail(u.email); setPassword(''); setRole(u.role)
    setPerms(parsePerms(u.permissions, u.role))
    setEditing(u); setAdding(true); setMsg(null)
  }

  function setTab(key: string, val: boolean) {
    setPerms(p => ({ ...p, tabs: { ...p.tabs, [key]: val } }))
  }

  async function save() {
    setSaving(true); setMsg(null)
    const body: any = { name, email, role, permissions: perms }
    if (password) body.password = password

    const url    = editing ? `/api/users/${editing.id}` : '/api/users'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json()

    if (!res.ok) { setMsg({ type: 'err', text: d.error }); setSaving(false); return }
    setMsg({ type: 'ok', text: editing ? 'تم التحديث' : 'تم إنشاء المستخدم' })
    setSaving(false); setAdding(false); loadUsers()
  }

  async function deleteUser(u: User) {
    if (!confirm(`حذف ${u.name}؟`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) return alert(d.error)
    loadUsers()
  }

  if ((session?.user as any)?.role !== 'ADMIN') return null

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <HiUsers size={24} className="text-sky-500" /> إدارة المستخدمين
        </h2>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-all">
          <HiPlus size={18} /> مستخدم جديد
        </button>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['الاسم', 'الإيميل', 'الدور', 'الأرقام المالية', 'التبويبات', ''].map(h => (
                  <th key={h} className="text-right px-4 py-3 font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const p = parsePerms(u.permissions, u.role)
                const visibleTabs = u.role === 'ADMIN' ? 'الكل' : Object.entries(p.tabs).filter(([, v]) => v).map(([k]) => TAB_LABELS[k]).join('، ')
                return (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                        {u.role === 'ADMIN' ? 'مدير' : 'مستخدم'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.viewFinancials
                        ? <span className="flex items-center gap-1 text-green-600 text-xs"><HiCheckCircle size={14} /> مرئية</span>
                        : <span className="flex items-center gap-1 text-red-400 text-xs"><HiEyeSlash size={14} /> مخفية</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={visibleTabs}>{visibleTabs}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all">
                          <HiPencil size={16} />
                        </button>
                        <button onClick={() => deleteUser(u)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <HiTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit drawer */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAdding(false)} />
          <div className="relative bg-white h-full w-full max-w-md shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">{editing ? 'تعديل المستخدم' : 'مستخدم جديد'}</h3>
            </div>
            <div className="p-6 space-y-5">
              {msg && (
                <div className={`p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {msg.text}
                </div>
              )}

              {/* Basic info */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">الاسم</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">الإيميل</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">{editing ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}</label>
                  <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">الدور</label>
                  <select value={role} onChange={e => { setRole(e.target.value); if (e.target.value === 'ADMIN') setPerms(ADMIN_PERMISSIONS) }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white">
                    <option value="VIEWER">مستخدم عادي</option>
                    <option value="ADMIN">مدير (صلاحيات كاملة)</option>
                  </select>
                </div>
              </div>

              {/* Permissions — only for VIEWER */}
              {role === 'VIEWER' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-slate-700">الصلاحيات</p>

                  {/* Financial */}
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
                      <HiEyeSlash size={14} /> الأرقام المالية
                    </p>
                    <PermToggle
                      label="يمكنه رؤية المبالغ والأرباح والتكاليف"
                      checked={perms.viewFinancials}
                      onChange={v => setPerms(p => ({ ...p, viewFinancials: v }))}
                    />
                  </div>

                  {/* Tabs */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-600 mb-1">التبويبات المرئية</p>
                    {Object.keys(perms.tabs).map(key => (
                      <PermToggle
                        key={key}
                        label={TAB_LABELS[key] ?? key}
                        checked={perms.tabs[key as keyof typeof perms.tabs]}
                        onChange={v => setTab(key, v)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-200 text-white font-medium rounded-xl transition-all">
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button onClick={() => setAdding(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all text-sm">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
