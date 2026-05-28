'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  HiUsers, HiPlus, HiTrash, HiPencil, HiCheckCircle,
  HiEyeSlash, HiClock, HiDevicePhoneMobile, HiComputerDesktop,
  HiGlobeAlt,
} from 'react-icons/hi2'
import { Permissions, DEFAULT_VIEWER_PERMISSIONS, ADMIN_PERMISSIONS } from '@/lib/permissions'

type User = { id: string; name: string; email: string; role: string; permissions: string | null; createdAt: string }
type LoginLog = {
  id: string
  createdAt: string
  ip: string | null
  userAgent: string | null
  user: { id: string; name: string; email: string; role: string }
}

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

/** Detect device type from user-agent string */
function getDeviceIcon(ua: string | null) {
  if (!ua) return <HiGlobeAlt size={15} className="text-slate-400" />
  const u = ua.toLowerCase()
  if (/mobile|iphone|android|ipad/.test(u)) return <HiDevicePhoneMobile size={15} className="text-sky-500" />
  return <HiComputerDesktop size={15} className="text-slate-500" />
}

/** Shorten/describe user-agent */
function describeUA(ua: string | null): string {
  if (!ua) return 'غير معروف'
  const u = ua.toLowerCase()
  if (u.includes('iphone'))  return 'iPhone'
  if (u.includes('ipad'))    return 'iPad'
  if (u.includes('android')) return 'Android'
  if (u.includes('mac'))     return 'Mac'
  if (u.includes('windows')) return 'Windows'
  if (u.includes('linux'))   return 'Linux'
  return 'متصفح'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ar-AE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users')

  // --- Users state ---
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

  // --- Login logs state ---
  const [logs, setLogs]           = useState<LoginLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [filterUser, setFilterUser]   = useState<string>('all')

  useEffect(() => {
    if (session && (session.user as any).role !== 'ADMIN') router.replace('/dashboard')
  }, [session])

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    if (activeTab === 'logs') loadLogs()
  }, [activeTab])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/users').then(r => r.json())
    setUsers(res.users || [])
    setLoading(false)
  }

  async function loadLogs(userId?: string) {
    setLogsLoading(true)
    const url = userId && userId !== 'all'
      ? `/api/users/login-logs?userId=${userId}`
      : '/api/users/login-logs'
    const res = await fetch(url).then(r => r.json())
    setLogs(res.logs || [])
    setLogsLoading(false)
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

  // Group logs by day
  const groupedLogs: Record<string, LoginLog[]> = {}
  logs.forEach(log => {
    const day = new Date(log.createdAt).toLocaleDateString('ar-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    if (!groupedLogs[day]) groupedLogs[day] = []
    groupedLogs[day].push(log)
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <HiUsers size={24} className="text-sky-500" /> إدارة المستخدمين
        </h2>
        {activeTab === 'users' && (
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-all">
            <HiPlus size={18} /> مستخدم جديد
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'users' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2"><HiUsers size={16} /> المستخدمون</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'logs' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2"><HiClock size={16} /> سجل الدخول</span>
        </button>
      </div>

      {/* ── USERS TAB ── */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">الاسم</th>
                    <th className="hidden sm:table-cell text-right px-4 py-3 font-semibold text-slate-600">الإيميل</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">الدور</th>
                    <th className="hidden md:table-cell text-right px-4 py-3 font-semibold text-slate-600">الأرقام المالية</th>
                    <th className="hidden md:table-cell text-right px-4 py-3 font-semibold text-slate-600">التبويبات</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const p = parsePerms(u.permissions, u.role)
                    const visibleTabs = u.role === 'ADMIN' ? 'الكل' : Object.entries(p.tabs).filter(([, v]) => v).map(([k]) => TAB_LABELS[k]).join('، ')
                    return (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                            {u.role === 'ADMIN' ? 'مدير' : 'مستخدم'}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3">
                          {p.viewFinancials
                            ? <span className="flex items-center gap-1 text-green-600 text-xs"><HiCheckCircle size={14} /> مرئية</span>
                            : <span className="flex items-center gap-1 text-red-400 text-xs"><HiEyeSlash size={14} /> مخفية</span>}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={visibleTabs}>{visibleTabs}</td>
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
            </div>
          )}
        </div>
      )}

      {/* ── LOGIN LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600 font-medium">تصفية حسب المستخدم:</label>
            <select
              value={filterUser}
              onChange={e => {
                setFilterUser(e.target.value)
                loadLogs(e.target.value)
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="all">جميع المستخدمين</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              onClick={() => loadLogs(filterUser)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-all"
            >
              تحديث
            </button>
            {logs.length > 0 && (
              <span className="text-xs text-slate-400 mr-auto">{logs.length} سجل</span>
            )}
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
              <HiClock size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">لا توجد سجلات دخول بعد</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedLogs).map(([day, dayLogs]) => (
                <div key={day} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Day header */}
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{day}</span>
                    <span className="text-xs text-slate-300">•</span>
                    <span className="text-xs text-slate-400">{dayLogs.length} دخول</span>
                  </div>
                  {/* Log rows */}
                  <div className="divide-y divide-slate-50">
                    {dayLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                        {/* Avatar */}
                        <div className="w-9 h-9 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sky-600 font-bold text-sm">
                            {log.user.name?.charAt(0) || '؟'}
                          </span>
                        </div>

                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{log.user.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              log.user.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {log.user.role === 'ADMIN' ? 'مدير' : 'مستخدم'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-400">{log.user.email}</span>
                            {log.ip && (
                              <span className="text-xs text-slate-300 font-mono">{log.ip}</span>
                            )}
                          </div>
                        </div>

                        {/* Device + time */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            {getDeviceIcon(log.userAgent)}
                            <span className="text-xs text-slate-500">{describeUA(log.userAgent)}</span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(log.createdAt).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
