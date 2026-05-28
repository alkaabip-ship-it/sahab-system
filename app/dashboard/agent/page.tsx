'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  HiCpuChip, HiExclamationTriangle, HiCheckCircle,
  HiBell, HiClipboardDocumentList, HiBuildingOffice2,
  HiArrowPath, HiPaperAirplane, HiXMark, HiChevronUp,
  HiEnvelope, HiLink, HiLinkSlash, HiClipboard,
  HiPaperClip, HiDocument,
  HiMicrophone, HiStopCircle,
} from 'react-icons/hi2'

// ── Types ─────────────────────────────────────────────────────────────
interface AgentConfig {
  id: string
  is_active: boolean
  interval_minutes: number
  last_run: string | null
}

interface AgentRun {
  id: string
  started_at: string
  completed_at: string | null
  perception: string
  reasoning: string
  actions: unknown
  outcome: string
}

interface AgentAlert {
  id: string
  type: string
  severity: string
  title: string
  message: string
  project_id: string | null
  created_at: string
}

interface Margin {
  project_id:     string
  project_name:   string
  client_name:    string
  status:         string
  margin_percent: number
  revenue:        number
  cost:           number
  profit:         number
  display_date:   string
}

interface Financials {
  totalRevenue:  number
  totalCosts:    number
  netProfit:     number
  profitMargin:  number
  avgMargin:     number
  period:        string
}

interface StatusData {
  config: AgentConfig
  runs: AgentRun[]
  alerts: AgentAlert[]
  minutesSinceRun: number | null
  metrics: {
    alertsToday: number
    pendingTasks: number
    projectCount: number
    cyclesRun: number
  }
  margins: Margin[]
  financials: Financials | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  thinking?: boolean
}

interface GmailEmail {
  id:             string
  threadId:       string
  from:           string
  subject:        string
  date:           string
  messageId:      string
  priority:       'عاجل' | 'متوسط' | 'معلومات'
  category:       string
  summary:        string
  suggestedReply: string
}

interface GmailData {
  connected: boolean
  gmailEmail: string | null
  lastSync: string | null
  urgent: number
  medium: number
  info: number
  emails: GmailEmail[]
}

// ── Helpers ───────────────────────────────────────────────────────────
function severityColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200'
    case 'DANGER':   return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'WARNING':  return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:         return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

function marginBarColor(m: number) {
  if (m >= 20) return 'bg-emerald-500'
  if (m >= 15) return 'bg-yellow-400'
  if (m >= 10) return 'bg-orange-400'
  return 'bg-red-500'
}

function marginTextColor(m: number) {
  if (m >= 20) return 'text-emerald-700'
  if (m >= 15) return 'text-yellow-700'
  if (m >= 10) return 'text-orange-700'
  return 'text-red-700'
}

// ── Main Component ────────────────────────────────────────────────────
export default function AgentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  // Gmail
  const [gmailData, setGmailData]         = useState<GmailData | null>(null)
  const [gmailLoading, setGmailLoading]   = useState(false)
  const [gmailExpanded, setGmailExpanded] = useState<string | null>(null)
  const [copied, setCopied]               = useState<string | null>(null)
  const [gmailError, setGmailError]       = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts]         = useState<Record<string, string>>({})
  const [sending, setSending]                 = useState<string | null>(null)
  const [sentIds, setSentIds]                 = useState<Set<string>>(new Set())
  const [sendingChecklist, setSendingChecklist] = useState<string | null>(null)
  const [checklistSentIds, setChecklistSentIds] = useState<Set<string>>(new Set())

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  // File attachment
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Voice input
  const [isRecording, setIsRecording]   = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef  = useRef<any>(null)
  const voicePrefixRef  = useRef('')

  // Check voice support
  useEffect(() => {
    setVoiceSupported(!!(
      (typeof window !== 'undefined') &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    ))
  }, [])

  // Admin guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user as { role?: string })?.role !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  // Gmail: handle callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gmailStatus = params.get('gmail')
    if (gmailStatus === 'connected') {
      fetchGmail()
      setGmailError(null)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (gmailStatus === 'no_refresh_token') {
      setGmailError('لم تُعطَ صلاحية الوصول الدائم. تأكد من الضغط على "السماح" في شاشة Google وأن التطبيق معتمد. حاول مرة أخرى.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (gmailStatus === 'error') {
      setGmailError('حدث خطأ أثناء ربط Gmail. تحقق من إعدادات Google Cloud Console (Redirect URI + Test Users).')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Load Gmail status on mount
  useEffect(() => { fetchGmail() }, [])

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/status')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 60000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Handlers ────────────────────────────────────────────────────────
  async function handleRunNow() {
    setRunning(true)
    try {
      await fetch('/api/agent/run', { method: 'POST' })
      await fetchStatus()
    } finally {
      setRunning(false)
    }
  }

  async function handleToggleActive() {
    if (!data) return
    setTogglingActive(true)
    try {
      await fetch('/api/agent/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !data.config.is_active }),
      })
      await fetchStatus()
    } finally {
      setTogglingActive(false)
    }
  }

  async function handleAcknowledge(id: string) {
    setAcknowledging(id)
    try {
      await fetch('/api/agent/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await fetchStatus()
    } finally {
      setAcknowledging(null)
    }
  }

  async function fetchGmail() {
    setGmailLoading(true)
    try {
      const res = await fetch('/api/agent/gmail/emails')
      if (res.ok) setGmailData(await res.json())
    } catch { /**/ } finally { setGmailLoading(false) }
  }

  async function disconnectGmail() {
    await fetch('/api/agent/gmail', { method: 'DELETE' })
    setGmailData({ connected: false, gmailEmail: null, lastSync: null, urgent: 0, medium: 0, info: 0, emails: [] })
  }

  function copyReply(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  // Initialize draft when expanding an email
  function getDraft(email: GmailEmail): string {
    if (replyDrafts[email.id] !== undefined) return replyDrafts[email.id]
    return email.suggestedReply
  }

  async function sendReply(email: GmailEmail) {
    const body = getDraft(email)
    if (!body.trim()) return
    setSending(email.id)
    try {
      const res = await fetch('/api/agent/gmail/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId:  email.threadId,
          to:        email.from,
          subject:   email.subject,
          body,
          inReplyTo: email.messageId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setSentIds(prev => new Set(prev).add(email.id))
        setGmailExpanded(null)
      } else {
        alert('فشل الإرسال: ' + (data.error ?? 'خطأ غير معروف'))
      }
    } catch { alert('خطأ في الاتصال بالخادم') }
    finally   { setSending(null) }
  }

  async function sendChecklist(email: GmailEmail) {
    setSendingChecklist(email.id)
    try {
      const res = await fetch('/api/agent/gmail/send-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:        email.from,
          subject:   email.subject,
          threadId:  email.threadId,
          inReplyTo: email.messageId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setChecklistSentIds(prev => new Set(prev).add(email.id))
      } else {
        alert('فشل الإرسال: ' + (data.error ?? 'خطأ غير معروف'))
      }
    } catch { alert('خطأ في الاتصال') }
    finally   { setSendingChecklist(null) }
  }

  // ── Voice ───────────────────────────────────────────────────────────
  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    // Save existing input as prefix so voice appends to it
    voicePrefixRef.current = chatInput.trim() ? chatInput.trim() + ' ' : ''

    const recognition = new SR()
    recognition.lang         = 'ar-AE'
    recognition.continuous   = true
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setChatInput(voicePrefixRef.current + transcript)
    }

    recognition.onend   = () => setIsRecording(false)
    recognition.onerror = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  async function handleChat(e: React.FormEvent) {
    e.preventDefault()
    if ((!chatInput.trim() && !attachedFile) || chatLoading) return
    // Stop recording if still active
    if (isRecording) stopVoice()

    const userMsg = chatInput.trim()
    const file    = attachedFile

    // Display message — show file name if attached
    const displayMsg = file
      ? (userMsg ? `📎 ${file.name}\n${userMsg}` : `📎 ${file.name}`)
      : userMsg

    setChatInput('')
    setAttachedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    setMessages(prev => [...prev, { role: 'user', content: displayMsg }])
    setChatLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: true }])

    try {
      let res: Response
      if (file) {
        const form = new FormData()
        form.append('message', userMsg)
        form.append('file', file)
        res = await fetch('/api/agent/chat', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMsg }),
        })
      }

      if (!res.body) throw new Error('No body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      // Replace thinking indicator with streaming text
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '', thinking: false }
        return updated
      })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        const captured = fullText
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: captured, thinking: false }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'حدث خطأ، يرجى المحاولة مرة أخرى.', thinking: false }
        return updated
      })
    } finally {
      setChatLoading(false)
    }
  }

  // ── Loading / guard ──────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500">
          <HiArrowPath className="animate-spin" size={24} />
          <span>جاري التحميل...</span>
        </div>
      </div>
    )
  }

  if (!session || (session.user as { role?: string })?.role !== 'ADMIN') {
    return null
  }

  const criticalAlerts = data?.alerts.filter(a => a.severity === 'CRITICAL') ?? []
  const isActive = data?.config.is_active ?? true

  return (
    <div className="space-y-5 pb-10" dir="rtl">

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-sky-500' : 'bg-slate-400'}`}>
            <HiCpuChip className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">الوكيل الذكي — سحاب</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-xs text-slate-500">
                {isActive ? 'نشط' : 'موقوف'}
                {data?.minutesSinceRun !== null && data?.minutesSinceRun !== undefined
                  ? ` — آخر دورة منذ ${data.minutesSinceRun} دقيقة`
                  : ' — لم تُنفَّذ دورة بعد'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleToggleActive}
            disabled={togglingActive}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              isActive
                ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            {togglingActive ? '...' : isActive ? 'إيقاف الوكيل' : 'تفعيل الوكيل'}
          </button>
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 transition-all disabled:opacity-60"
          >
            <HiArrowPath className={running ? 'animate-spin' : ''} size={16} />
            {running ? 'جاري التشغيل...' : 'تشغيل الآن'}
          </button>
        </div>
      </div>

      {/* ── Critical Alert Banner ────────────────────────────────────── */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <HiExclamationTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-800 mb-2">
                {criticalAlerts.length} تنبيه حرج يحتاج انتباهك
              </p>
              <div className="space-y-2">
                {criticalAlerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2 border border-red-100">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-red-800 truncate">{alert.title}</p>
                      {alert.message && <p className="text-xs text-red-600 mt-0.5 truncate">{alert.message}</p>}
                    </div>
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledging === alert.id}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-60"
                    >
                      <HiCheckCircle size={14} />
                      تأكيد
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Metric Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'تنبيهات',
            value: data?.metrics.alertsToday ?? 0,
            icon: <HiBell size={20} />,
            color: 'text-red-500',
            bg: 'bg-red-50',
          },
          {
            label: 'مهام معلقة',
            value: data?.metrics.pendingTasks ?? 0,
            icon: <HiClipboardDocumentList size={20} />,
            color: 'text-orange-500',
            bg: 'bg-orange-50',
          },
          {
            label: 'المشاريع',
            value: data?.metrics.projectCount ?? 0,
            icon: <HiBuildingOffice2 size={20} />,
            color: 'text-sky-500',
            bg: 'bg-sky-50',
          },
          {
            label: 'دورات منفَّذة',
            value: data?.metrics.cyclesRun ?? 0,
            icon: <HiCpuChip size={20} />,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
          },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
            <div className={`w-10 h-10 ${card.bg} ${card.color} rounded-xl flex items-center justify-center mb-3`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-slate-800">{card.value}</p>
            <p className="text-xs text-slate-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Financial Summary (last 12 months) ──────────────────────── */}
      {data?.financials && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
            <p className="text-xs text-slate-400 mb-1">إجمالي الإيرادات</p>
            <p className="text-lg font-bold text-slate-800">{data.financials.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-400">د.إ · بدون ضريبة · {data.financials.period}</p>
          </div>
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
            <p className="text-xs text-slate-400 mb-1">إجمالي التكاليف</p>
            <p className="text-lg font-bold text-red-500">{data.financials.totalCosts.toLocaleString()}</p>
            <p className="text-xs text-slate-400">د.إ · بدون ضريبة · {data.financials.period}</p>
          </div>
          <div className={`rounded-2xl border shadow-sm p-4 ${data.financials.netProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs mb-1 ${data.financials.netProfit >= 0 ? 'text-green-500' : 'text-red-400'}`}>صافي الربح</p>
            <p className={`text-lg font-bold ${data.financials.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {data.financials.netProfit.toLocaleString()}
            </p>
            <p className={`text-xs ${data.financials.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>د.إ</p>
          </div>
          <div className={`rounded-2xl border shadow-sm p-4 ${(data.financials.avgMargin ?? data.financials.profitMargin) >= 20 ? 'bg-emerald-50 border-emerald-100' : (data.financials.avgMargin ?? data.financials.profitMargin) >= 10 ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
            <p className="text-xs text-slate-400 mb-1">متوسط الهامش</p>
            <p className={`text-lg font-bold ${marginTextColor(data.financials.avgMargin ?? data.financials.profitMargin)}`}>
              {(data.financials.avgMargin ?? data.financials.profitMargin).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">آخر 10 مشاريع</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Project Margins Table ──────────────────────────────────── */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">هوامش ربح المشاريع</h2>
            <span className="text-xs text-slate-400">
              {data?.margins?.length ?? 0} مشروع
            </span>
          </div>
          {!data?.margins || data.margins.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              لا توجد مشاريع بأرقام
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {data.margins.map(m => (
                <div key={m.project_id} className="space-y-1.5 border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.project_name}</p>
                      <p className="text-xs text-slate-400 truncate">{m.client_name} · {m.display_date}</p>
                    </div>
                    <span className={`text-base font-bold flex-shrink-0 ${marginTextColor(m.margin_percent)}`}>
                      {m.margin_percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${marginBarColor(m.margin_percent)}`}
                      style={{ width: `${Math.min(100, Math.max(0, m.margin_percent))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>إيراد: <span className="font-medium text-slate-700">{m.revenue.toLocaleString()}</span> د.إ</span>
                    <span>تكلفة: <span className="font-medium text-red-500">{m.cost.toLocaleString()}</span> د.إ</span>
                    <span className={m.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                      ربح: {m.profit.toLocaleString()} د.إ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Action Log ────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <h2 className="text-base font-bold text-slate-800 mb-4">سجل دورات الوكيل</h2>
          {!data?.runs || data.runs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              لا توجد دورات سابقة
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {data.runs.map(run => (
                <div key={run.id} className="border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono text-slate-400">
                      {new Date(run.started_at).toLocaleString('ar-AE')}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                      {run.outcome?.includes('أدوات') ? run.outcome : 'اكتملت'}
                    </span>
                  </div>
                  {run.perception && (
                    <p className="text-xs text-slate-600 leading-relaxed">{run.perception}</p>
                  )}
                  {run.reasoning && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{run.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Unacknowledged Alerts List ──────────────────────────────── */}
      {data?.alerts && data.alerts.filter(a => a.severity !== 'CRITICAL').length > 0 && (
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <h2 className="text-base font-bold text-slate-800 mb-4">التنبيهات النشطة</h2>
          <div className="space-y-2">
            {data.alerts
              .filter(a => a.severity !== 'CRITICAL')
              .map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border ${severityColor(alert.severity)}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    {alert.message && <p className="text-xs mt-0.5 opacity-80 truncate">{alert.message}</p>}
                    <p className="text-xs opacity-60 mt-0.5">
                      {new Date(alert.created_at).toLocaleString('ar-AE')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledging === alert.id}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/10 transition-colors disabled:opacity-60"
                    title="إغلاق"
                  >
                    <HiXMark size={16} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Gmail Section ───────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
              <HiEnvelope className="text-red-500" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">العملاء المحتملون — Gmail</h2>
              {gmailData?.gmailEmail && (
                <p className="text-xs text-slate-400">{gmailData.gmailEmail}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gmailData?.connected ? (
              <>
                <button onClick={fetchGmail} disabled={gmailLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all disabled:opacity-60">
                  <HiArrowPath className={gmailLoading ? 'animate-spin' : ''} size={13} />
                  تحديث
                </button>
                <button onClick={disconnectGmail}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all">
                  <HiLinkSlash size={13} />
                  فصل الحساب
                </button>
              </>
            ) : (
              <a href="/api/agent/gmail"
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition-all">
                <HiLink size={15} />
                ربط Gmail
              </a>
            )}
          </div>
        </div>

        {/* Error message */}
        {gmailError && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <HiExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={16} />
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">{gmailError}</p>
              <p className="text-xs text-red-500 mt-1">
                تأكد من: ١) إضافة <strong>info@sahabm.com</strong> كـ Test User في Google Cloud Console
                ٢) إضافة <strong>https://sahab-system.vercel.app/api/agent/gmail/callback</strong> كـ Authorized Redirect URI
              </p>
            </div>
            <button onClick={() => setGmailError(null)} className="text-red-400 hover:text-red-600">
              <HiXMark size={14} />
            </button>
          </div>
        )}

        {!gmailData?.connected ? (
          <div className="text-center py-10 text-slate-400">
            <HiEnvelope className="mx-auto mb-2 text-slate-300" size={36} />
            <p className="text-sm font-medium text-slate-500 mb-1">Gmail غير مرتبط</p>
            <p className="text-xs">اضغط "ربط Gmail" للسماح للوكيل بقراءة إيميلاتك وتقديم مقترحات الرد</p>
          </div>
        ) : gmailLoading ? (
          <div className="flex items-center justify-center py-10">
            <HiArrowPath className="animate-spin text-sky-500" size={24} />
          </div>
        ) : (
          <>
            {/* Summary chips */}
            {(() => {
              const leads = gmailData.emails.filter(e => e.category === 'عميل محتمل')
              const urgentLeads  = leads.filter(e => e.priority === 'عاجل').length
              const mediumLeads  = leads.filter(e => e.priority === 'متوسط').length
              return (
                <div className="flex gap-2 mb-4 flex-wrap items-center">
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                    🎯 {leads.length} عميل محتمل
                  </span>
                  {urgentLeads > 0 && (
                    <span className="px-3 py-1 bg-red-50 text-red-500 text-xs rounded-full">
                      🔴 {urgentLeads} عاجل
                    </span>
                  )}
                  {mediumLeads > 0 && (
                    <span className="px-3 py-1 bg-yellow-50 text-yellow-600 text-xs rounded-full">
                      🟡 {mediumLeads} متوسط
                    </span>
                  )}
                  {gmailData.lastSync && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs rounded-full me-auto">
                      آخر تحديث: {new Date(gmailData.lastSync).toLocaleTimeString('ar-AE')}
                    </span>
                  )}
                </div>
              )
            })()}

            {/* Email list — potential clients only */}
            {gmailData.emails.filter(e => e.category === 'عميل محتمل').length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">لا يوجد عملاء محتملون في البريد الحالي</p>
            ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {gmailData.emails.filter(e => e.category === 'عميل محتمل').map(email => {
                const isExpanded = gmailExpanded === email.id
                const priorityStyle =
                  email.priority === 'عاجل'     ? 'border-red-200 bg-red-50/40'  :
                  email.priority === 'متوسط'    ? 'border-yellow-200 bg-yellow-50/40' :
                                                   'border-slate-100 bg-white'
                const priorityDot =
                  email.priority === 'عاجل'  ? 'bg-red-500'    :
                  email.priority === 'متوسط' ? 'bg-yellow-400' : 'bg-blue-400'
                return (
                  <div key={email.id} className={`border rounded-xl overflow-hidden transition-all ${priorityStyle}`}>
                    <button
                      onClick={() => setGmailExpanded(isExpanded ? null : email.id)}
                      className="w-full text-right p-3 flex items-start gap-3 hover:bg-black/5 transition-colors"
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityDot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 truncate">{email.subject}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                            email.category === 'عميل محتمل'
                              ? 'bg-red-500 text-white border border-red-600'
                              : 'bg-white border border-slate-200 text-slate-500'
                          }`}>{email.category}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{email.from}</p>
                        {email.summary && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{email.summary}</p>
                        )}
                      </div>
                      <span className="text-slate-400 flex-shrink-0 mt-1">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-100 mt-1">
                        <div className="flex items-center justify-between mt-3 mb-2">
                          <p className="text-xs font-semibold text-slate-500">✉️ مسودة الرد — يمكنك التعديل قبل الإرسال:</p>
                          {sentIds.has(email.id) && (
                            <span className="text-xs text-green-600 font-medium">✓ تم الإرسال</span>
                          )}
                        </div>
                        <textarea
                          rows={5}
                          value={getDraft(email)}
                          onChange={e => setReplyDrafts(prev => ({ ...prev, [email.id]: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white"
                          dir="auto"
                          placeholder="اكتب ردك هنا..."
                        />
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Send reply button */}
                          <button
                            onClick={() => sendReply(email)}
                            disabled={sending === email.id || sentIds.has(email.id)}
                            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-lg transition-all font-medium"
                          >
                            <HiPaperAirplane size={13} />
                            {sending === email.id ? 'جاري الإرسال...' : sentIds.has(email.id) ? '✓ أُرسل' : 'إرسال الرد'}
                          </button>

                          {/* Send checklist button */}
                          <button
                            onClick={() => sendChecklist(email)}
                            disabled={sendingChecklist === email.id || checklistSentIds.has(email.id)}
                            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg transition-all font-medium disabled:opacity-60 ${
                              email.category === 'عميل محتمل'
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            📋 {sendingChecklist === email.id ? 'جاري الإرسال...' : checklistSentIds.has(email.id) ? '✓ أُرسلت القائمة' : 'إرسال قائمة الخدمات'}
                          </button>

                          {/* Copy button */}
                          <button
                            onClick={() => copyReply(email.id, getDraft(email))}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all font-medium"
                          >
                            <HiClipboard size={13} />
                            {copied === email.id ? '✓ تم النسخ' : 'نسخ'}
                          </button>

                          {/* Reset draft */}
                          {replyDrafts[email.id] !== undefined && replyDrafts[email.id] !== email.suggestedReply && (
                            <button
                              onClick={() => setReplyDrafts(prev => ({ ...prev, [email.id]: email.suggestedReply }))}
                              className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
                            >
                              إعادة تعيين
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </>
        )}
      </div>

      {/* ── Chat Box ────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col" style={{ minHeight: '400px' }}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center">
            <HiCpuChip className="text-white" size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">تحدث مع الوكيل</p>
            <p className="text-xs text-slate-500">اسأل عن المشاريع، الهوامش، المهام...</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '360px' }}>
          {messages.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <HiCpuChip className="mx-auto mb-2 text-slate-300" size={32} />
              ابدأ محادثة مع الوكيل الذكي
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-500 text-white rounded-tl-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tr-sm'
                }`}
              >
                {msg.thinking ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <HiChevronUp className="animate-bounce" size={14} />
                    <span className="text-xs">جاري التفكير...</span>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleChat} className="p-4 border-t border-slate-100">
          {/* File preview badge */}
          {attachedFile && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 text-xs text-sky-700 font-medium max-w-[280px]">
                <HiDocument size={14} className="flex-shrink-0" />
                <span className="truncate">{attachedFile.name}</span>
                <span className="text-sky-400 flex-shrink-0">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <HiXMark size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.csv,.txt,.json,.md"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.size > 10 * 1024 * 1024) {
                  alert('حجم الملف كبير جداً (الحد الأقصى 10 MB)')
                  return
                }
                setAttachedFile(f)
              }}
            />
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={chatLoading}
              title="إرفاق ملف (صورة، PDF، CSV...)"
              className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all flex-shrink-0 ${
                attachedFile
                  ? 'bg-sky-500 border-sky-500 text-white'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-100 bg-slate-50'
              } disabled:opacity-50`}
            >
              <HiPaperClip size={18} />
            </button>

            {/* Mic button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={isRecording ? stopVoice : startVoice}
                disabled={chatLoading}
                title={isRecording ? 'إيقاف التسجيل' : 'تحدث بالصوت (عربي)'}
                className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all flex-shrink-0 disabled:opacity-50 ${
                  isRecording
                    ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-200 animate-pulse'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-100 bg-slate-50'
                }`}
              >
                {isRecording ? <HiStopCircle size={18} /> : <HiMicrophone size={18} />}
              </button>
            )}

            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={
                isRecording
                  ? '🔴 جاري الاستماع... تحدث الآن'
                  : attachedFile
                  ? 'أضف تعليقاً على الملف (اختياري)...'
                  : 'اسأل عن أي شيء، أو استخدم الميكروفون...'
              }
              disabled={chatLoading}
              className={`flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60 ${
                isRecording
                  ? 'border-red-300 bg-red-50 text-slate-700 ring-2 ring-red-200'
                  : 'border-slate-200 bg-slate-50'
              }`}
            />
            <button
              type="submit"
              disabled={chatLoading || (!chatInput.trim() && !attachedFile)}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 transition-all disabled:opacity-50"
            >
              <HiPaperAirplane size={16} />
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
