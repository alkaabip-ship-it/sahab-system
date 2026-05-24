'use client'

import { useEffect, useRef, useState } from 'react'
import {
  HiEnvelope, HiSparkles, HiBuildingOffice2, HiUsers,
  HiCheckCircle, HiXCircle, HiPaperAirplane, HiPaperClip, HiTrash, HiPhoto,
} from 'react-icons/hi2'
import { useTranslation } from '@/lib/i18n/LanguageContext'

type Tab      = 'supplier' | 'client'
type EmailLang = 'ar' | 'en'
type Contact  = { id: string; zohoId: string; name: string; email: string; serviceType?: string | null }

const TEMPLATES_AR = [
  { key: 'rfq',         label: 'طلب عروض أسعار'  },
  { key: 'invitation',  label: 'دعوة للمشاركة'    },
  { key: 'promotional', label: 'رسالة ترويجية'    },
  { key: 'followup',    label: 'متابعة عميل'      },
]
const TEMPLATES_EN = [
  { key: 'rfq',         label: 'Request for Quotation'  },
  { key: 'invitation',  label: 'Participation Invitation' },
  { key: 'promotional', label: 'Promotional Message'    },
  { key: 'followup',    label: 'Follow-up Email'        },
]

const MAX_FILE_BYTES = 2 * 1024 * 1024

export default function CommunicationsPage() {
  const { t, lang: uiLang } = useTranslation()
  const isRTL = uiLang === 'ar'

  const [tab,          setTab]          = useState<Tab>('supplier')
  const [contacts,     setContacts]     = useState<Contact[]>([])
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [emailLang,    setEmailLang]    = useState<EmailLang>('ar')   // language for the email CONTENT
  const [template,     setTemplate]     = useState('rfq')
  const [projectName,  setProjectName]  = useState('')
  const [description,  setDescription]  = useState('')
  const [subject,      setSubject]      = useState('')
  const [attachments,  setAttachments]  = useState<File[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [sending,      setSending]      = useState(false)
  const [result,       setResult]       = useState<{ sent: number; failed: number; results: any[] } | null>(null)
  const [search,       setSearch]       = useState('')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [fileError,    setFileError]    = useState<string | null>(null)

  const editorRef   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef  = useRef<HTMLInputElement>(null)

  // Service labels — use app UI language
  const SERVICE_LABELS: Record<string, string> = {
    ALL:         isRTL ? 'كل الخدمات'    : 'All Services',
    SCREENS:     isRTL ? 'شاشات'         : 'Screens',
    AUDIO:       isRTL ? 'صوتيات'        : 'Audio',
    LIGHTING:    isRTL ? 'إضاءة'         : 'Lighting',
    PRINTING:    isRTL ? 'طباعة'         : 'Printing',
    CARPET:      isRTL ? 'سجاد'          : 'Carpet',
    CARPENTRY:   isRTL ? 'نجارة'         : 'Carpentry',
    FLOWERS:     isRTL ? 'زهور'          : 'Flowers',
    PHOTOGRAPHY: isRTL ? 'تصوير'         : 'Photography',
    VIDEO:       isRTL ? 'فيديو'         : 'Video',
    TRANSPORT:   isRTL ? 'نقل'           : 'Transport',
    LABOR:       isRTL ? 'عمالة'         : 'Labor',
    HOSPITALITY: isRTL ? 'ضيافة'         : 'Hospitality',
    OTHER:       isRTL ? 'أخرى'          : 'Other',
  }

  useEffect(() => {
    setContacts([]); setSelected(new Set()); setSearch(''); setResult(null)
    setLoadingContacts(true)
    fetch(`/api/communications/contacts?type=${tab === 'supplier' ? 'supplier' : 'client'}`)
      .then(r => r.json())
      .then(d => { setContacts(d.contacts || []); setLoadingContacts(false) })
      .catch(() => setLoadingContacts(false))
    setTemplate(tab === 'supplier' ? 'rfq' : 'promotional')
    setServiceFilter('ALL')
  }, [tab])

  const serviceTypes = ['ALL', ...Array.from(new Set(contacts.map(c => c.serviceType).filter(Boolean) as string[]))]

  const filtered = contacts.filter(c => {
    const matchSearch  = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    const matchService = tab !== 'supplier' || serviceFilter === 'ALL' || c.serviceType === serviceFilter
    return matchSearch && matchService
  })

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(c => c.id)))
  }
  function toggle(id: string) {
    const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s)
  }

  function execFmt(cmd: string, val?: string) {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
  }
  function getBody()           { return editorRef.current?.innerHTML || '' }
  function setBody(html: string) { if (editorRef.current) editorRef.current.innerHTML = html }

  async function generate() {
    setGenerating(true); setResult(null)
    const res = await fetch('/api/communications/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, projectName, description, language: emailLang }),
    })
    const d = await res.json()
    if (d.subject) setSubject(d.subject)
    if (d.body)    setBody(d.body.replace(/\n/g, '<br>'))
    setGenerating(false)
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    setFileError(null)
    const valid: File[] = []
    const errors: string[] = []
    Array.from(files).forEach(f => {
      if (f.size > MAX_FILE_BYTES) errors.push(`${f.name} ${isRTL ? 'أكبر من 2 ميقا' : '> 2 MB'}`)
      else valid.push(f)
    })
    if (errors.length) setFileError(errors.join(' • '))
    setAttachments(prev => [...prev, ...valid])
  }

  function removeFile(i: number) { setAttachments(prev => prev.filter((_, idx) => idx !== i)) }

  async function send() {
    const body = getBody()
    if (!selected.size || !subject || !body) return
    setSending(true); setResult(null)
    const selectedContacts = contacts.filter(c => selected.has(c.id))
    const fd = new FormData()
    fd.append('contacts',    JSON.stringify(selectedContacts))
    fd.append('subject',     subject)
    fd.append('body',        body)
    fd.append('contactType', tab)
    attachments.forEach(f => fd.append('attachments', f))
    const res = await fetch('/api/communications/send', { method: 'POST', body: fd })
    const d   = await res.json()
    setResult(d); setSending(false)
  }

  const templates = emailLang === 'ar' ? TEMPLATES_AR : TEMPLATES_EN

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <HiEnvelope size={24} className="text-sky-500" />
        {isRTL ? 'التواصل مع العملاء والموردين' : 'Client & Supplier Communications'}
      </h2>

      {/* Tabs + Email Language toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Supplier / Client tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setTab('supplier')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'supplier' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <HiBuildingOffice2 size={16} /> {t.nav.suppliers}
          </button>
          <button onClick={() => setTab('client')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'client' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <HiUsers size={16} /> {t.nav.clients}
          </button>
        </div>

        {/* Email language (separate from app UI language) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{isRTL ? 'لغة الإيميل:' : 'Email language:'}</span>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-sm font-medium">
            <button onClick={() => setEmailLang('ar')}
              className={`px-4 py-1.5 rounded-lg transition-all ${emailLang === 'ar' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
              عربي 🇦🇪
            </button>
            <button onClick={() => setEmailLang('en')}
              className={`px-4 py-1.5 rounded-lg transition-all ${emailLang === 'en' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
              English 🇬🇧
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Contacts list ── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={isRTL ? 'بحث...' : 'Search...'}
                className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <button onClick={toggleAll} className="text-xs text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap">
                {selected.size === filtered.length && filtered.length > 0
                  ? (isRTL ? 'إلغاء الكل' : 'Deselect All')
                  : (isRTL ? 'تحديد الكل' : 'Select All')}
              </button>
            </div>
            {tab === 'supplier' && (
              <select value={serviceFilter} onChange={e => { setServiceFilter(e.target.value); setSelected(new Set()) }}
                className="w-full text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white">
                {serviceTypes.map(s => <option key={s} value={s}>{SERVICE_LABELS[s] ?? s}</option>)}
              </select>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-80">
            {loadingContacts ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                {tab === 'supplier'
                  ? (isRTL ? 'لا يوجد موردون بإيميل' : 'No suppliers with email')
                  : (isRTL ? 'لا يوجد عملاء في Zoho' : 'No clients in Zoho')}
              </p>
            ) : filtered.map(c => (
              <label key={c.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${selected.has(c.id) ? 'bg-sky-50' : ''}`}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 accent-sky-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-400 truncate">{c.email}</p>
                </div>
                {tab === 'supplier' && c.serviceType && c.serviceType !== 'OTHER' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                    {SERVICE_LABELS[c.serviceType] ?? c.serviceType}
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
            <p className="text-xs text-slate-500">
              {selected.size} {isRTL ? 'مختار من' : 'selected of'} {contacts.length}
            </p>
          </div>
        </div>

        {/* ── Right: Compose ── */}
        <div className="space-y-4">

          {/* AI Generator */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <HiSparkles size={16} className="text-purple-500" />
              {isRTL ? 'توليد النص بالذكاء الاصطناعي' : 'AI Text Generation'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{isRTL ? 'القالب' : 'Template'}</label>
                <select value={template} onChange={e => setTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  {templates.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{isRTL ? 'اسم المشروع' : 'Project Name'}</label>
                <input value={projectName} onChange={e => setProjectName(e.target.value)}
                  placeholder={isRTL ? 'اختياري...' : 'Optional...'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            </div>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder={isRTL ? 'وصف إضافي...' : 'Additional details...'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            <button onClick={generate} disabled={generating}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2">
              {generating
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{isRTL ? 'جاري التوليد...' : 'Generating...'}</>
                : <><HiSparkles size={16} />{isRTL ? 'توليد النص' : 'Generate'}</>}
            </button>
          </div>

          {/* Email Compose */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <HiEnvelope size={16} className="text-sky-500" />
              {isRTL ? 'محتوى الإيميل' : 'Email Content'}
            </p>

            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder={isRTL ? 'الموضوع' : 'Subject'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />

            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex-wrap">
              {[
                { cmd: 'bold',      icon: 'B', cls: 'font-bold'  },
                { cmd: 'italic',    icon: 'I', cls: 'italic'     },
                { cmd: 'underline', icon: 'U', cls: 'underline'  },
              ].map(b => (
                <button key={b.cmd} onMouseDown={e => { e.preventDefault(); execFmt(b.cmd) }}
                  className={`w-7 h-7 rounded text-sm hover:bg-slate-200 transition-colors ${b.cls}`}>
                  {b.icon}
                </button>
              ))}
              <div className="w-px h-5 bg-slate-300 mx-1" />
              <button onMouseDown={e => { e.preventDefault(); execFmt('insertUnorderedList') }}
                className="px-2 h-7 rounded text-xs hover:bg-slate-200 transition-colors">
                {isRTL ? '• قائمة' : '• List'}
              </button>
              <button onMouseDown={e => { e.preventDefault(); execFmt('insertOrderedList') }}
                className="px-2 h-7 rounded text-xs hover:bg-slate-200 transition-colors">
                {isRTL ? '1. مرقّمة' : '1. Numbered'}
              </button>
              <div className="w-px h-5 bg-slate-300 mx-1" />
              {['16px','20px','24px'].map(size => (
                <button key={size} onMouseDown={e => { e.preventDefault(); execFmt('fontSize', size === '16px' ? '3' : size === '20px' ? '4' : '5') }}
                  className="px-1.5 h-7 rounded text-xs hover:bg-slate-200 transition-colors" style={{ fontSize: '11px' }}>
                  {size.replace('px','')}
                </button>
              ))}
              <div className="w-px h-5 bg-slate-300 mx-1" />
              <button onMouseDown={e => { e.preventDefault(); execFmt('justifyRight') }}
                className="px-2 h-7 rounded text-xs hover:bg-slate-200 transition-colors">⇐</button>
              <button onMouseDown={e => { e.preventDefault(); execFmt('justifyLeft') }}
                className="px-2 h-7 rounded text-xs hover:bg-slate-200 transition-colors">⇒</button>
              <div className="w-px h-5 bg-slate-300 mx-1" />
              <button onMouseDown={e => { e.preventDefault(); imgInputRef.current?.click() }}
                className="flex items-center gap-1 px-2 h-7 rounded text-xs hover:bg-slate-200 transition-colors">
                <HiPhoto size={14} /> {isRTL ? 'صورة' : 'Image'}
              </button>
              <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const img = new Image()
                    img.onload = () => {
                      const MAX_W = 480
                      const scale = Math.min(1, MAX_W / img.width)
                      const canvas = document.createElement('canvas')
                      canvas.width  = img.width  * scale
                      canvas.height = img.height * scale
                      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
                      editorRef.current?.focus()
                      document.execCommand('insertHTML', false, `<img src="${dataUrl}" style="max-width:100%;border-radius:8px;margin:4px 0" />`)
                    }
                    img.src = reader.result as string
                  }
                  reader.readAsDataURL(file)
                  e.target.value = ''
                }}
              />
            </div>

            {/* Editable body */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              dir={emailLang === 'ar' ? 'rtl' : 'ltr'}
              className="min-h-[180px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 overflow-y-auto"
              style={{ maxHeight: 280 }}
            />

            {/* Attachments */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                  <HiPaperClip size={14} /> {isRTL ? 'إرفاق ملف (max 2MB)' : 'Attach file (max 2MB)'}
                </button>
                <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xlsx"
                  className="hidden" onChange={e => handleFiles(e.target.files)} />
              </div>
              {fileError && <p className="text-xs text-red-500 mb-1">{fileError}</p>}
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-lg">
                      <HiPaperClip size={12} className="text-slate-400" />
                      <span className="flex-1 truncate text-slate-600">{f.name}</span>
                      <span className="text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600">
                        <HiTrash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Send button */}
          <button onClick={send} disabled={sending || !selected.size || !subject || !getBody()}
            className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-200 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
            {sending
              ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />{isRTL ? 'جاري الإرسال...' : 'Sending...'}</>
              : <><HiPaperAirplane size={18} />{isRTL ? `إرسال إلى ${selected.size} جهة اتصال` : `Send to ${selected.size} contact(s)`}</>}
          </button>

          {/* Results */}
          {result && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-2">
              <div className="flex gap-4 mb-2">
                <span className="flex items-center gap-1 text-green-600 font-semibold text-sm">
                  <HiCheckCircle size={18} /> {result.sent} {isRTL ? 'تم الإرسال' : 'sent'}
                </span>
                {result.failed > 0 && (
                  <span className="flex items-center gap-1 text-red-500 font-semibold text-sm">
                    <HiXCircle size={18} /> {result.failed} {isRTL ? 'فشل' : 'failed'}
                  </span>
                )}
              </div>
              {result.results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {r.success ? <HiCheckCircle size={14} /> : <HiXCircle size={14} />}
                  <span className="font-medium">{r.name}</span>
                  {r.error && <span className="text-red-500 ms-auto">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
