'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { useSession } from 'next-auth/react'
import {
  HiListBullet, HiPlus, HiTrash,
  HiCheckCircle, HiPencilSquare, HiCheck,
  HiChevronLeft, HiChevronRight, HiCalendarDays,
} from 'react-icons/hi2'

/* ─── Types ──────────────────────────────────────────────────────── */
interface TaskUser { id: string; name: string; email?: string }
interface Task {
  id:          string
  title:       string
  notes:       string | null
  status:      string
  taskDate:    string | null
  assignedTo:  TaskUser | null
  createdBy:   TaskUser | null
  createdAt:   string
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function todayUAE(): string {
  const now = new Date()
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000)
  return uae.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDateAR(dateStr: string, isRTL: boolean): string {
  const today = todayUAE()
  const yesterday = addDays(today, -1)
  if (dateStr === today)     return isRTL ? 'اليوم' : 'Today'
  if (dateStr === yesterday) return isRTL ? 'أمس'   : 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function TasksPage() {
  const { lang } = useTranslation()
  const isRTL   = lang === 'ar'
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const [date,     setDate]     = useState(todayUAE())
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [users,    setUsers]    = useState<TaskUser[]>([])
  const [loading,  setLoading]  = useState(true)

  const [newTitle,      setNewTitle]      = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [adding,        setAdding]        = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [editNotes,  setEditNotes]  = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  const isToday = date === todayUAE()

  /* ── Load tasks for selected date ── */
  const load = useCallback(async (d: string) => {
    setLoading(true)
    const res = await fetch(`/api/tasks?date=${d}`)
    const data = await res.json()
    setTasks(data.tasks || [])
    setLoading(false)
  }, [])

  useEffect(() => { load(date) }, [date, load])

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []))
  }, [isAdmin])

  /* ── Navigation ── */
  function goDay(n: number) {
    const next = addDays(date, n)
    if (next > todayUAE()) return   // can't go to future
    setDate(next)
  }

  /* ── Add task (today only) ── */
  async function add() {
    if (!newTitle.trim() || adding || !isToday) return
    setAdding(true)
    const res = await fetch('/api/tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: newTitle.trim(), assignedToId: newAssignedTo || undefined }),
    })
    const task = await res.json()
    setTasks(prev => [...prev, task])
    setNewTitle('')
    setNewAssignedTo('')
    setAdding(false)
    inputRef.current?.focus()
  }

  /* ── Toggle done ── */
  async function toggleDone(task: Task) {
    const s = task.status === 'DONE' ? 'PENDING' : 'DONE'
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: s } : t))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ status: s }),
    })
  }

  /* ── Notes ── */
  async function saveNotes(taskId: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: notesDraft } : t))
    setEditNotes(null)
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ notes: notesDraft }),
    })
  }

  /* ── Delete ── */
  async function del(id: string) {
    if (!confirm(isRTL ? 'حذف هذه المهمة؟' : 'Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  /* ── Group by user (admin) ── */
  const grouped = isAdmin
    ? tasks.reduce<Record<string, { user: TaskUser; tasks: Task[] }>>((acc, t) => {
        const uid  = t.assignedTo?.id   || '__none__'
        const name = t.assignedTo?.name || (isRTL ? 'غير مُعيَّن' : 'Unassigned')
        if (!acc[uid]) acc[uid] = { user: { id: uid, name }, tasks: [] }
        acc[uid].tasks.push(t)
        return acc
      }, {})
    : {}

  const pending = tasks.filter(t => t.status === 'PENDING').length
  const done    = tasks.filter(t => t.status === 'DONE').length

  /* ─── Render ─── */
  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
          <HiListBullet size={22} className="text-sky-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{isRTL ? 'مهام الفريق' : 'Team Tasks'}</h2>
          <p className="text-sm text-slate-400">
            <span className="text-amber-500 font-semibold">{pending}</span>{' '}
            {isRTL ? 'قيد التنفيذ' : 'pending'}&nbsp;·&nbsp;
            <span className="text-emerald-500 font-semibold">{done}</span>{' '}
            {isRTL ? 'منجزة' : 'done'}
          </p>
        </div>
      </div>

      {/* ── Date Navigator ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
        {/* Prev */}
        <button onClick={() => goDay(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all flex-shrink-0">
          {isRTL ? <HiChevronRight size={18} /> : <HiChevronLeft size={18} />}
        </button>

        {/* Date display + picker */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <HiCalendarDays size={16} className={isToday ? 'text-sky-500' : 'text-slate-400'} />
          <span className={`font-semibold text-sm ${isToday ? 'text-sky-600' : 'text-slate-600'}`}>
            {formatDateAR(date, isRTL)}
          </span>
          {/* Hidden date input for calendar picker */}
          <label className="cursor-pointer">
            <input type="date" value={date} max={todayUAE()}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="sr-only" />
            <span className="text-xs text-slate-300 hover:text-slate-500 transition-colors underline underline-offset-2">
              {isRTL ? 'تغيير' : 'change'}
            </span>
          </label>
        </div>

        {/* Next — disabled on today */}
        <button onClick={() => goDay(1)} disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
          {isRTL ? <HiChevronLeft size={18} /> : <HiChevronRight size={18} />}
        </button>
      </div>

      {/* ── Inline Add (today only) ── */}
      {isToday && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex gap-3 items-center">
            {isAdmin && (
              <select value={newAssignedTo} onChange={e => setNewAssignedTo(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 flex-shrink-0"
                style={{ minWidth: 130 }}>
                <option value="">{isRTL ? 'نفسي' : 'Myself'}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <input ref={inputRef} value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder={isRTL ? 'اكتب المهمة واضغط Enter أو +' : 'Type task and press Enter or +'}
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
            <button onClick={add} disabled={!newTitle.trim() || adding}
              className="flex-shrink-0 w-10 h-10 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all">
              {adding
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <HiPlus size={20} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Archive notice (past days) ── */}
      {!isToday && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
          <HiCalendarDays size={16} />
          {isRTL ? 'عرض الأرشيف — لا يمكن التعديل على الأيام السابقة' : 'Archive view — past days are read-only'}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── ADMIN: grouped by user ── */}
      {!loading && isAdmin && (
        <div className="space-y-6">
          {Object.keys(grouped).length === 0 && <EmptyState isRTL={isRTL} isToday={isToday} />}
          {Object.values(grouped).map(group => (
            <div key={group.user.id}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-7 h-7 bg-sky-100 rounded-full flex items-center justify-center text-xs font-bold text-sky-600">
                  {group.user.name.charAt(0)}
                </div>
                <span className="font-semibold text-slate-700 text-sm">{group.user.name}</span>
                <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                  {group.tasks.filter(t => t.status === 'PENDING').length}{' '}
                  {isRTL ? 'متبقية' : 'pending'} · {group.tasks.filter(t => t.status === 'DONE').length}{' '}
                  {isRTL ? 'منجزة' : 'done'}
                </span>
              </div>
              <div className="space-y-2">
                {group.tasks.map(task => (
                  <TaskCard key={task.id} task={task} isAdmin={isAdmin} isRTL={isRTL}
                    readonly={!isToday}
                    editNotes={editNotes} notesDraft={notesDraft}
                    onToggle={toggleDone} onDelete={del}
                    onStartEdit={t => { setEditNotes(t.id); setNotesDraft(t.notes || '') }}
                    onNotesChange={setNotesDraft}
                    onSaveNotes={saveNotes}
                    onCancelNotes={() => setEditNotes(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── USER: own tasks ── */}
      {!loading && !isAdmin && (
        <div className="space-y-2">
          {tasks.length === 0 && <EmptyState isRTL={isRTL} isToday={isToday} />}
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} isAdmin={isAdmin} isRTL={isRTL}
              readonly={!isToday}
              editNotes={editNotes} notesDraft={notesDraft}
              onToggle={toggleDone} onDelete={del}
              onStartEdit={t => { setEditNotes(t.id); setNotesDraft(t.notes || '') }}
              onNotesChange={setNotesDraft}
              onSaveNotes={saveNotes}
              onCancelNotes={() => setEditNotes(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Task Card ──────────────────────────────────────────────────── */
function TaskCard({ task, isAdmin, isRTL, readonly, editNotes, notesDraft, onToggle, onDelete, onStartEdit, onNotesChange, onSaveNotes, onCancelNotes }: {
  task: Task; isAdmin: boolean; isRTL: boolean; readonly: boolean
  editNotes: string | null; notesDraft: string
  onToggle: (t: Task) => void; onDelete: (id: string) => void
  onStartEdit: (t: Task) => void; onNotesChange: (v: string) => void
  onSaveNotes: (id: string) => void; onCancelNotes: () => void
}) {
  const done = task.status === 'DONE'

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${
      done ? 'border-emerald-100' : 'border-slate-100'
    }`}>
      <div className="p-3 flex items-start gap-3">

        {/* Checkmark */}
        <button onClick={() => !readonly && onToggle(task)} disabled={readonly}
          className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            done
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : readonly ? 'border-slate-200 cursor-not-allowed' : 'border-slate-300 hover:border-emerald-400'
          }`}>
          {done && <HiCheck size={12} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </p>

          {/* Notes */}
          {!readonly && editNotes === task.id ? (
            <div className="mt-2 space-y-2">
              <textarea value={notesDraft} onChange={e => onNotesChange(e.target.value)} rows={2} autoFocus
                placeholder={isRTL ? 'اكتب ملاحظتك...' : 'Write your note...'}
                className="w-full px-3 py-2 border border-sky-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none bg-sky-50" />
              <div className="flex gap-2">
                <button onClick={() => onSaveNotes(task.id)}
                  className="px-3 py-1 bg-sky-500 text-white text-xs font-semibold rounded-lg hover:bg-sky-600">
                  {isRTL ? 'حفظ' : 'Save'}
                </button>
                <button onClick={onCancelNotes}
                  className="px-3 py-1 border border-slate-200 text-slate-500 text-xs rounded-lg">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : task.notes ? (
            <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex gap-2 items-start">
              <span className="text-amber-400 text-xs flex-shrink-0">📝</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{task.notes}</p>
                {!readonly && (
                  <button onClick={() => onStartEdit(task)}
                    className="text-[10px] text-amber-500 hover:text-amber-700 mt-1 font-semibold">
                    {isRTL ? 'تعديل' : 'Edit'}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Actions — hidden in readonly/archive mode */}
        {!readonly && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {editNotes !== task.id && (
              <button onClick={() => onStartEdit(task)}
                className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all">
                <HiPencilSquare size={14} />
              </button>
            )}
            <button onClick={() => onDelete(task.id)}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
              <HiTrash size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Empty State ────────────────────────────────────────────────── */
function EmptyState({ isRTL, isToday }: { isRTL: boolean; isToday: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <HiCheckCircle size={44} className="text-slate-200 mx-auto mb-3" />
      <p className="text-slate-400 font-medium">
        {isToday
          ? (isRTL ? 'لا توجد مهام لهذا اليوم' : 'No tasks today')
          : (isRTL ? 'لا توجد مهام مؤرشفة لهذا اليوم' : 'No archived tasks for this day')}
      </p>
    </div>
  )
}
