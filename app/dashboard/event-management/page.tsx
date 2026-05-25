'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════════════ */
interface CargoItem {
  id: string; name: string; truck: string; qty: number
  loaded: boolean; unloaded: boolean
}
interface TaskNote { author: string; text: string; timestamp: string }
interface SetupTask {
  id: string; name: string; owner: string; priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'progress' | 'done'; progress: number; hasIssue: boolean; notes: TaskNote[]
}
interface SafetyCheck { id: string; name: string; checked: boolean }
interface ShowCue { id: string; time: string; duration: string; label: string; target: string; active: boolean; completed: boolean }
interface Issue { id: string; title: string; severity: 'high' | 'medium'; section: string; status: 'unresolved' | 'resolved' }
interface LogEntry { id: string; time: string; msg: string; phase: string }
interface EventData {
  id: string; name: string; client: string; venue: string; date: string; crewOwners: string[]
  loadingChecklist: CargoItem[]
  sectionSetup: Record<string, SetupTask[]>
  execution: { unlocked: boolean; safetyChecks: SafetyCheck[]; cues: ShowCue[] }
  issues: Issue[]; activityLog: LogEntry[]
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS & FACTORIES
═══════════════════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'sahab_event_mgmt_v1'
const DEPTS = ['Stage', 'AV', 'Lighting', 'Decor', 'Catering', 'Security']
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const clock = () => new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })

function makeEvent(name = 'New Event', client = '', venue = '', date = ''): EventData {
  return {
    id: uid(), name, client, venue, date,
    crewOwners: ['Ahmed', 'Sara', 'Khaled', 'Dana', 'Ali'],
    loadingChecklist: [
      { id: uid(), name: 'Stage Deck Panels',  truck: 'Truck 1', qty: 24, loaded: false, unloaded: false },
      { id: uid(), name: 'LED Screen Modules', truck: 'Truck 1', qty: 16, loaded: false, unloaded: false },
      { id: uid(), name: 'Audio Line Array',   truck: 'Truck 2', qty: 8,  loaded: false, unloaded: false },
      { id: uid(), name: 'Lighting Rigs',      truck: 'Truck 2', qty: 12, loaded: false, unloaded: false },
      { id: uid(), name: 'Trussing & Rigging', truck: 'Truck 3', qty: 30, loaded: false, unloaded: false },
    ],
    sectionSetup: Object.fromEntries(DEPTS.map(d => [d, []])),
    execution: {
      unlocked: false,
      safetyChecks: [
        { id: uid(), name: 'Stage Load Capacity Verified', checked: false },
        { id: uid(), name: 'Emergency Exits Clear',        checked: false },
        { id: uid(), name: 'Power Distribution Checked',   checked: false },
        { id: uid(), name: 'Audio System Test Passed',     checked: false },
        { id: uid(), name: 'Lighting Rig Safety Locks',    checked: false },
      ],
      cues: [],
    },
    issues: [], activityLog: [],
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE STYLES (glassmorphism palette)
═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg:      'hsl(224 25% 6%)',
  surface: 'rgba(13,17,30,0.65)',
  border:  'rgba(255,255,255,0.08)',
  borderH: 'rgba(255,255,255,0.15)',
  textP:   'hsl(210 40% 98%)',
  textS:   'hsl(215 20% 70%)',
  textM:   'hsl(215 15% 45%)',
  load:    'hsl(188 100% 50%)',
  unload:  'hsl(263 90% 65%)',
  setup:   'hsl(325 90% 60%)',
  exec:    'hsl(45 100% 50%)',
  success: 'hsl(145 80% 50%)',
  warning: 'hsl(32 95% 55%)',
  danger:  'hsl(355 90% 60%)',
}

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, ...extra
})
const btn = (bg: string, color = 'white', extra?: React.CSSProperties): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 7, padding: '8px 16px',
  fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', ...extra
})
const input = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '8px 12px', color: C.textP, fontSize: 13, outline: 'none', width: '100%', ...extra
})
const pill = (color: string, active: boolean): React.CSSProperties => ({
  background: active ? `${color}22` : 'transparent', color: active ? color : C.textM,
  border: 'none', borderRadius: 4, padding: '3px 9px', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
})

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function EventManagementPage() {
  const { lang } = useTranslation()
  const isRTL = lang === 'ar'

  // ── State ────────────────────────────────────────────────────────────────
  const [now, setNow] = useState(0)   // 0 = not mounted yet (avoids SSR/client mismatch)
  const [events,       setEvents]       = useState<EventData[]>([])
  const [activeId,     setActiveId]     = useState<string | null>(null)
  const [phase,        setPhase]        = useState<'overview'|'loading'|'unloading'|'setup'|'execution'>('overview')
  const [dept,         setDept]         = useState(DEPTS[0])
  const [panelTab,     setPanelTab]     = useState<'issues'|'activity'>('issues')
  const [showModal,    setShowModal]    = useState(false)
  const [editEv,       setEditEv]       = useState<EventData | null>(null)
  const [commentOpen,  setCommentOpen]  = useState<Record<string,boolean>>({})

  // form
  const [fName, setFName] = useState(''); const [fClient, setFClient] = useState('')
  const [fVenue,setFVenue]= useState(''); const [fDate,   setFDate]   = useState('')
  // task
  const [nTaskName,  setNTaskName]  = useState('')
  const [nTaskPri,   setNTaskPri]   = useState<'high'|'medium'|'low'>('medium')
  const [nTaskOwner, setNTaskOwner] = useState('')
  const [commentInputs, setCommentInputs] = useState<Record<string,{author:string,text:string}>>({})
  // cue
  const [nCueTime,setNCueTime]=useState(''); const [nCueDur,setNCueDur]=useState('')
  const [nCueLabel,setNCueLabel]=useState(''); const [nCueTarget,setNCueTarget]=useState('')
  // new cargo item
  const [nCargoName, setNCargoName] = useState('')
  const [nCargoTruck, setNCargoTruck] = useState('Truck 1')
  const [nCargoQty,  setNCargoQty]  = useState('1')
  // crew management
  const [showCrewMgr, setShowCrewMgr] = useState(false)
  const [newCrewName, setNewCrewName] = useState('')

  // ── Tick every second for countdown (client-only) ────────────────────────
  useEffect(() => {
    setNow(Date.now())                              // first paint
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Load from DB on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/event-management')
      .then(r => r.json())
      .then(d => {
        if (d.events && d.events.length > 0) {
          setEvents(d.events)
          // restore last active id from localStorage (UI preference only)
          const saved = localStorage.getItem(STORAGE_KEY + '_activeId')
          const valid = d.events.find((e: EventData) => e.id === saved)
          setActiveId(valid ? saved : d.events[0].id)
        }
        // no events in DB → empty state, user creates first one
      })
      .catch(() => {/* network error — keep empty */})
  }, [])

  // ── Save active-event preference locally (not data) ───────────────────────
  useEffect(() => {
    if (activeId) localStorage.setItem(STORAGE_KEY + '_activeId', activeId)
  }, [activeId])

  // ── Save a single event to DB (called after every mutation) ──────────────
  function saveEventToDB(event: EventData) {
    fetch('/api/event-management', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {/* silent — UI already updated */})
  }

  const ev = events.find(e => e.id === activeId) || null

  // ── Updaters ─────────────────────────────────────────────────────────────
  function upd(fn: (e: EventData) => EventData) {
    setEvents(prev => {
      const next = prev.map(e => {
        if (e.id !== activeId) return e
        const updated = fn(e)
        saveEventToDB(updated)   // persist to shared DB
        return updated
      })
      return next
    })
  }
  function addLog(msg: string, ph: string) {
    upd(e => ({ ...e, activityLog: [{ id: uid(), time: clock(), msg, phase: ph }, ...e.activityLog].slice(0,60) }))
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  const m = (() => {
    if (!ev) return { lPct:0, uPct:0, sPct:0, lCount:0, uCount:0, sCount:0, totalS:0, issues:0 }
    const lCount = ev.loadingChecklist.filter(i=>i.loaded).length
    const lTotal = ev.loadingChecklist.length
    const lPct = lTotal ? Math.round(lCount/lTotal*100) : 0
    const uCount = ev.loadingChecklist.filter(i=>i.unloaded).length
    const uTotal = ev.loadingChecklist.filter(i=>i.loaded).length
    const uPct = uTotal ? Math.round(uCount/uTotal*100) : 0
    const allTasks = DEPTS.flatMap(d=>ev.sectionSetup[d]||[])
    const sCount = allTasks.filter(t=>t.status==='done').length
    const totalS = allTasks.length
    const sPct = totalS ? Math.round(sCount/totalS*100) : 0
    const issues = ev.issues.filter(i=>i.status==='unresolved').length
    return { lPct, uPct, sPct, lCount, uCount, sCount, totalS, issues, lTotal, uTotal }
  })()

  const countdown = (() => {
    if (!ev?.date || now === 0) return '--:--:--'
    const diff = new Date(ev.date).getTime() - now
    if (diff <= 0) return isRTL ? '🎉 يوم الفعالية' : '🎉 EVENT DAY'
    const d  = Math.floor(diff / 86400000)
    const h  = Math.floor((diff % 86400000) / 3600000)
    const mn = Math.floor((diff % 3600000) / 60000)
    const sc = Math.floor((diff % 60000) / 1000)
    const hh = String(h).padStart(2,'0')
    const mm = String(mn).padStart(2,'0')
    const ss = String(sc).padStart(2,'0')
    // Always show seconds so user can see it ticking
    if (d > 0) return `${d}d  ${hh}:${mm}:${ss}`
    return `${hh}:${mm}:${ss}`
  })()

  // ── Event CRUD ────────────────────────────────────────────────────────────
  function saveEvent() {
    if (!fName.trim()) return
    if (editEv) {
      const updated = { ...editEv, name:fName, client:fClient, venue:fVenue, date:fDate }
      setEvents(p => p.map(e => e.id===editEv.id ? updated : e))
      saveEventToDB(updated)
    } else {
      const n = makeEvent(fName, fClient, fVenue, fDate)
      setEvents(p => [...p, n])
      setActiveId(n.id)
      saveEventToDB(n)
    }
    setShowModal(false)
  }
  function openCreate() { setEditEv(null); setFName(''); setFClient(''); setFVenue(''); setFDate(''); setShowModal(true) }
  function openEdit(e: EventData) { setEditEv(e); setFName(e.name); setFClient(e.client); setFVenue(e.venue); setFDate(e.date); setShowModal(true) }
  function delEvent(id: string) {
    if (!confirm(isRTL ? 'حذف هذه الفعالية؟' : 'Delete this event?')) return
    const rem = events.filter(e=>e.id!==id)
    setEvents(rem)
    if (activeId===id) setActiveId(rem[0]?.id||null)
    // delete from DB
    fetch('/api/event-management', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  // ── Cargo CRUD ────────────────────────────────────────────────────────────
  function addCargoItem() {
    if (!nCargoName.trim()) return
    const item: CargoItem = { id: uid(), name: nCargoName, truck: nCargoTruck, qty: parseInt(nCargoQty)||1, loaded: false, unloaded: false }
    upd(e => ({ ...e, loadingChecklist: [...e.loadingChecklist, item] }))
    setNCargoName(''); setNCargoQty('1')
    addLog(`📦 Added cargo: "${nCargoName}"`, 'load')
  }
  function delCargoItem(id: string) {
    upd(e => ({ ...e, loadingChecklist: e.loadingChecklist.filter(i => i.id !== id) }))
  }

  // ── Crew ─────────────────────────────────────────────────────────────────
  function addCrewMember() {
    if (!newCrewName.trim() || !ev) return
    if (ev.crewOwners.includes(newCrewName.trim())) return
    upd(e => ({ ...e, crewOwners: [...e.crewOwners, newCrewName.trim()] }))
    setNewCrewName('')
  }
  function removeCrewMember(name: string) {
    upd(e => ({ ...e, crewOwners: e.crewOwners.filter(o => o !== name) }))
  }

  // ── Loading / Unloading ───────────────────────────────────────────────────
  function toggleLoaded(id: string) {
    if (!ev) return
    const item = ev.loadingChecklist.find(i=>i.id===id); if (!item) return
    upd(e => ({...e, loadingChecklist: e.loadingChecklist.map(i => i.id===id ? {...i, loaded: !i.loaded} : i)}))
    addLog(`${item.loaded ? '↩ Unloaded' : '✓ Loaded'}: ${item.name}`, 'load')
  }
  function toggleUnloaded(id: string) {
    if (!ev) return
    const item = ev.loadingChecklist.find(i=>i.id===id); if (!item) return
    upd(e => ({...e, loadingChecklist: e.loadingChecklist.map(i => i.id===id ? {...i, unloaded: !i.unloaded} : i)}))
    addLog(`${item.unloaded ? '↩ Re-loaded' : '✓ Unloaded at venue'}: ${item.name}`, 'unload')
  }

  // ── Tasks ────────────────────────────────────────────────────────────────
  function addTask() {
    if (!nTaskName.trim() || !ev) return
    const t: SetupTask = { id: uid(), name: nTaskName, owner: nTaskOwner || ev.crewOwners[0] || 'Team',
      priority: nTaskPri, status: 'pending', progress: 0, hasIssue: false, notes: [] }
    upd(e => ({...e, sectionSetup: {...e.sectionSetup, [dept]: [...(e.sectionSetup[dept]||[]), t]}}))
    setNTaskName(''); addLog(`Task added: "${nTaskName}" in ${dept}`, 'setup')
  }
  function taskStatus(tid: string, s: SetupTask['status']) {
    upd(e => ({...e, sectionSetup: {...e.sectionSetup, [dept]: (e.sectionSetup[dept]||[]).map(t => t.id===tid ? {...t, status:s} : t)}}))
  }
  function taskProgress(tid: string, p: number) {
    upd(e => ({...e, sectionSetup: {...e.sectionSetup, [dept]: (e.sectionSetup[dept]||[]).map(t => t.id===tid ? {...t, progress:p} : t)}}))
  }
  function flagIssue(tid: string) {
    if (!ev) return
    const task = (ev.sectionSetup[dept]||[]).find(t=>t.id===tid); if (!task) return
    const nowBlocked = !task.hasIssue
    upd(e => ({...e, sectionSetup: {...e.sectionSetup, [dept]: (e.sectionSetup[dept]||[]).map(t => t.id===tid ? {...t, hasIssue: nowBlocked} : t)}}))
    if (nowBlocked) {
      upd(e => ({...e, issues: [...e.issues, { id: uid(), title: `Blocker: ${task.name}`, severity: task.priority==='high'?'high':'medium', section: dept, status: 'unresolved' }]}))
      addLog(`⚠️ Blocked: "${task.name}" in ${dept}`, 'issue')
    }
  }
  function delTask(tid: string) {
    upd(e => ({...e, sectionSetup: {...e.sectionSetup, [dept]: (e.sectionSetup[dept]||[]).filter(t=>t.id!==tid)}}))
  }
  function addComment(tid: string) {
    const ci = commentInputs[tid]; if (!ci?.text?.trim() || !ev) return
    upd(e => ({...e, sectionSetup: {...e.sectionSetup, [dept]: (e.sectionSetup[dept]||[]).map(t => t.id===tid ? {...t, notes:[...t.notes,{author:ci.author||ev.crewOwners[0]||'Team',text:ci.text,timestamp:clock()}]} : t)}}))
    setCommentInputs(p => ({...p, [tid]: {...p[tid], text:''}}))
    setCommentOpen(p => ({...p, [tid]: true}))
  }

  // ── Execution ─────────────────────────────────────────────────────────────
  function toggleSafety(cid: string) {
    upd(e => ({...e, execution: {...e.execution, safetyChecks: e.execution.safetyChecks.map(c => c.id===cid ? {...c, checked:!c.checked} : c)}}))
    addLog('Safety check toggled', 'exec')
  }
  function unlock() { upd(e => ({...e, execution:{...e.execution, unlocked:true}})); addLog('🚀 Show Control Console UNLOCKED', 'exec') }
  function addCue() {
    if (!nCueLabel.trim()||!nCueTime.trim()) return
    const c: ShowCue = { id: uid(), time: nCueTime, duration: nCueDur||'5 min', label: nCueLabel, target: nCueTarget||'All Crew', active: true, completed: false }
    upd(e => ({...e, execution:{...e.execution, cues:[...e.execution.cues, c]}}))
    addLog(`Cue added: "${nCueLabel}"`, 'exec')
    setNCueTime(''); setNCueDur(''); setNCueLabel(''); setNCueTarget('')
  }
  function fireCue(cid: string) {
    if (!ev) return
    const cue = ev.execution.cues.find(c=>c.id===cid); if (!cue) return
    upd(e => ({...e, execution:{...e.execution, cues: e.execution.cues.map(c => c.id===cid ? {...c, completed:true, active:false} : c)}}))
    addLog(`🔥 Cue fired: "${cue.label}"`, 'exec')
  }
  function delCue(cid: string) { upd(e => ({...e, execution:{...e.execution, cues: e.execution.cues.filter(c=>c.id!==cid)}})) }
  function resolveIssue(iid: string) {
    upd(e => ({...e, issues: e.issues.map(i => i.id===iid ? {...i, status:'resolved'} : i)}))
    addLog('✅ Issue resolved', 'issue')
  }

  const overall = Math.round((m.lPct + m.uPct + m.sPct) / 3)

  const PHASES = [
    { key:'overview',   labelEn:'Overview',       labelAr:'نظرة عامة',      color:C.textP  },
    { key:'loading',    labelEn:'Loading',         labelAr:'التحميل',        color:C.load   },
    { key:'unloading',  labelEn:'Unloading',       labelAr:'التفريغ',        color:C.unload },
    { key:'setup',      labelEn:'Section Setup',   labelAr:'إعداد الأقسام',  color:C.setup  },
    { key:'execution',  labelEn:'Execution',       labelAr:'التنفيذ المباشر', color:C.exec  },
  ]

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ background: C.bg, color: C.textP, fontFamily:"'Inter',sans-serif", height:'calc(100vh - 65px)', display:'flex', flexDirection:'column', margin:'-24px', overflow:'hidden' }}>

      {/* ── Pipeline Nav ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', background:'rgba(11,14,25,0.95)', borderBottom:`1px solid ${C.border}`, height:44, flexShrink:0 }}>
        {/* Event selector */}
        <div style={{ display:'flex', alignItems:'center', padding:'0 12px', borderRight:`1px solid ${C.border}`, gap:6, flexShrink:0 }}>
          {events.length > 0 ? (
            <select value={activeId||''} onChange={e=>setActiveId(e.target.value)}
              style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:6, padding:'3px 8px', fontSize:11, color:C.textP, cursor:'pointer', maxWidth:160, outline:'none' }}>
              {events.map(e=><option key={e.id} value={e.id} style={{background:'#0f172a'}}>{e.name}</option>)}
            </select>
          ) : <span style={{fontSize:11, color:C.textM}}>{isRTL?'لا فعاليات':'No events'}</span>}
          <button onClick={openCreate} style={btn(C.load,'black',{padding:'3px 9px',fontSize:11})}>+</button>
        </div>

        {/* Phase tabs */}
        {PHASES.map((p,i) => (
          <button key={p.key} onClick={()=>setPhase(p.key as any)}
            style={{ flex:1, background: phase===p.key ? `${p.color}11` : 'transparent',
              color: phase===p.key ? p.color : C.textM, border:'none',
              borderRight: i<PHASES.length-1 ? `1px solid ${C.border}` : 'none',
              borderBottom: phase===p.key ? `2px solid ${p.color}` : '2px solid transparent',
              fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.8,
              cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <span style={{ width:16, height:16, border:'1px solid currentColor', borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700 }}>{i}</span>
            <span style={{display:'none'}} className="md:inline">{isRTL ? p.labelAr : p.labelEn}</span>
            <span style={{fontSize:9}}>{isRTL ? p.labelAr : p.labelEn}</span>
          </button>
        ))}

        {/* Master progress */}
        <div style={{ display:'flex', alignItems:'center', padding:'0 12px', gap:8, flexShrink:0, borderLeft:`1px solid ${C.border}` }}>
          <div style={{ width:70, height:5, background:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${overall}%`, background:`linear-gradient(to right,${C.load},${C.setup})`, transition:'width .5s' }}/>
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:C.load }}>{overall}%</span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── Left Sidebar ─────────────────────────────────────────────── */}
        <div style={{ width:230, background:'rgba(11,14,25,0.4)', borderRight:`1px solid ${C.border}`, overflowY:'auto', padding:16, flexShrink:0, display:'flex', flexDirection:'column', gap:14 }}>
          {ev ? (
            <>
              {/* Event info */}
              <div style={card({ borderLeft:`3px solid ${C.load}` })}>
                <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:C.textM, marginBottom:8 }}>{isRTL?'الفعالية الحالية':'Active Event'}</div>
                <div style={{ fontWeight:700, fontSize:'1rem', lineHeight:1.25, marginBottom:10 }}>{ev.name}</div>
                {ev.client && <div style={{ fontSize:11, color:C.textS, marginBottom:3 }}>👤 {ev.client}</div>}
                {ev.venue  && <div style={{ fontSize:11, color:C.textS, marginBottom:3 }}>📍 {ev.venue}</div>}
                {ev.date   && <div style={{ fontSize:11, color:C.textS, marginBottom:3 }}>📅 {ev.date}</div>}
                <div style={{ display:'flex', gap:6, marginTop:10 }}>
                  <button onClick={()=>openEdit(ev)} style={{ flex:1, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:5, padding:'4px', fontSize:11, color:C.textS, cursor:'pointer' }}>✏️ {isRTL?'تعديل':'Edit'}</button>
                  <button onClick={()=>delEvent(ev.id)} style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:5, padding:'4px 7px', fontSize:11, color:C.danger, cursor:'pointer' }}>🗑️</button>
                </div>
              </div>

              {/* Countdown */}
              <div style={card({ borderLeft:`3px solid ${C.exec}` })}>
                <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:C.textM, marginBottom:6 }}>{isRTL?'العد التنازلي':'Countdown'}</div>
                <div style={{ fontWeight:800, fontSize:'1.4rem', color:C.exec, fontFamily:'monospace', letterSpacing:1 }}>{countdown}</div>
              </div>

              {/* Metrics */}
              <div style={card()}>
                <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:C.textM, marginBottom:12 }}>{isRTL?'التقدم':'Progress'}</div>
                {[
                  { label:isRTL?'التحميل':'Loading',  val:`${m.lCount}/${(m as any).lTotal||ev.loadingChecklist.length}`, pct:m.lPct, color:C.load    },
                  { label:isRTL?'التفريغ':'Unloading', val:`${m.uCount}/${(m as any).uTotal||0}`,                          pct:m.uPct, color:C.unload  },
                  { label:isRTL?'الإعداد':'Setup',     val:`${m.sCount}/${m.totalS}`,                                       pct:m.sPct, color:C.setup   },
                ].map(row=>(
                  <div key={row.label} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:C.textS }}>{row.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:row.color }}>{row.val}</span>
                    </div>
                    <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${row.pct}%`, background:row.color, transition:'width .4s' }}/>
                    </div>
                  </div>
                ))}
                {m.issues>0 && <div style={{ fontSize:11, color:C.danger, fontWeight:600, marginTop:4 }}>⚠️ {m.issues} {isRTL?'مشكلة':'issue(s)'}</div>}
              </div>

              {/* Crew management */}
              <div style={card()}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showCrewMgr ? 12 : 0 }}>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:C.textM }}>👥 {isRTL?'أعضاء الفريق':'Crew'} ({ev.crewOwners.length})</div>
                  <button onClick={()=>setShowCrewMgr(p=>!p)} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textM, fontSize:12 }}>{showCrewMgr?'▲':'▼'}</button>
                </div>
                {showCrewMgr && (
                  <>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                      {ev.crewOwners.map(o=>(
                        <span key={o} style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.06)', border:`1px solid ${C.border}`, borderRadius:20, padding:'3px 8px', fontSize:11 }}>
                          {o}
                          <button onClick={()=>removeCrewMember(o)} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textM, fontSize:10, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <input value={newCrewName} onChange={e=>setNewCrewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCrewMember()}
                        placeholder={isRTL?'اسم العضو...':'Member name...'}
                        style={{ ...input(), fontSize:11, padding:'5px 8px' }} />
                      <button onClick={addCrewMember} style={btn(C.setup,undefined,{fontSize:11,padding:'5px 10px'})}>+</button>
                    </div>
                  </>
                )}
              </div>

              {/* Other events */}
              {events.length > 1 && (
                <div>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:C.textM, marginBottom:8 }}>{isRTL?'الفعاليات':'Events'}</div>
                  {events.map(e=>(
                    <button key={e.id} onClick={()=>setActiveId(e.id)} style={{ width:'100%', textAlign:'left', background: e.id===activeId?'rgba(255,255,255,0.06)':'transparent', border:`1px solid ${e.id===activeId?'rgba(255,255,255,0.12)':'transparent'}`, borderRadius:6, padding:'7px 10px', marginBottom:4, cursor:'pointer', color: e.id===activeId ? C.textP : C.textM, fontSize:12, fontWeight:600 }}>
                      {e.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign:'center', paddingTop:40 }}>
              <div style={{ fontSize:'2rem', marginBottom:12 }}>🎪</div>
              <div style={{ fontSize:12, color:C.textM, marginBottom:16 }}>{isRTL?'لا توجد فعاليات':'No events yet'}</div>
              <button onClick={openCreate} style={btn(C.load,'black',{fontSize:12,padding:'8px 14px'})}>{isRTL?'+ فعالية جديدة':'+ New Event'}</button>
            </div>
          )}
        </div>

        {/* ── Main Content ──────────────────────────────────────────────── */}
        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          {!ev ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, opacity:.6 }}>
              <div style={{ fontSize:'4rem' }}>🎪</div>
              <div style={{ fontSize:'1.3rem', fontWeight:700 }}>{isRTL?'ابدأ بإنشاء فعالية':'Create your first event'}</div>
              <button onClick={openCreate} style={btn(C.load,'black')}>{isRTL?'+ فعالية جديدة':'+ New Event'}</button>
            </div>
          ) : phase==='overview' ? (
            // ── OVERVIEW ──────────────────────────────────────────────────
            <div>
              <div style={{ marginBottom:24 }}>
                <h2 style={{ fontWeight:700, fontSize:'1.6rem', marginBottom:4 }}>{isRTL?'نظرة عامة':'Overview'}</h2>
                <p style={{ color:C.textS, fontSize:13 }}>{ev.name} — {ev.venue||'–'}</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:18, marginBottom:24 }}>
                {[
                  { key:'loading',   titleEn:'Loading Phase',   titleAr:'مرحلة التحميل',   pct:m.lPct, color:C.load,   icon:'🚚', desc:`${m.lCount} of ${(m as any).lTotal||ev.loadingChecklist.length} items loaded` },
                  { key:'unloading', titleEn:'Unloading Phase',  titleAr:'مرحلة التفريغ',   pct:m.uPct, color:C.unload, icon:'📦', desc:`${m.uCount} items received at venue` },
                  { key:'setup',     titleEn:'Section Setup',    titleAr:'إعداد الأقسام',   pct:m.sPct, color:C.setup,  icon:'🔧', desc:`${m.sCount}/${m.totalS} tasks completed` },
                  { key:'execution', titleEn:'Execution',        titleAr:'التنفيذ المباشر', pct: ev.execution.unlocked?100:0, color:C.exec, icon:'🎬', desc: ev.execution.unlocked?'Console unlocked':'Awaiting setup completion' },
                ].map(d=>(
                  <div key={d.key} onClick={()=>setPhase(d.key as any)} style={card({ cursor:'pointer', transition:'all .2s', ':hover':{ transform:'translateY(-3px)' } } as any)}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                      <span style={{ fontWeight:600, fontSize:'1rem', color: d.color }}>{isRTL ? d.titleAr : d.titleEn}</span>
                      <span style={{ fontSize:'1.4rem' }}>{d.icon}</span>
                    </div>
                    <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden', marginBottom:10 }}>
                      <div style={{ height:'100%', width:`${d.pct}%`, background:d.color, transition:'width .5s', borderRadius:3 }}/>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:C.textS }}>
                      <span>{d.desc}</span>
                      <span style={{ fontWeight:700, color: d.color }}>{d.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Issues summary */}
              {m.issues > 0 && (
                <div style={{ ...card(), borderColor:'rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.03)' }}>
                  <div style={{ fontWeight:700, color:C.danger, marginBottom:10 }}>⚠️ {m.issues} {isRTL?'مشاكل نشطة':'Active Issues'}</div>
                  {ev.issues.filter(i=>i.status==='unresolved').slice(0,3).map(i=>(
                    <div key={i.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderTop:`1px solid rgba(255,255,255,0.04)` }}>
                      <span style={{ fontSize:13 }}>{i.title}</span>
                      <button onClick={e=>{e.stopPropagation();resolveIssue(i.id)}} style={btn(C.success,undefined,{fontSize:11,padding:'4px 10px'})}>{isRTL?'حل':'Resolve'}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : phase==='loading' ? (
            // ── LOADING ────────────────────────────────────────────────────
            <div>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontWeight:700, fontSize:'1.5rem', color:C.load, marginBottom:4 }}>{isRTL?'مرحلة التحميل':'Loading Phase'}</h2>
                <p style={{ color:C.textS, fontSize:13 }}>{isRTL?'تتبع تحميل المعدات في الشاحنات':'Track equipment loading onto trucks'}</p>
              </div>
              {/* Add cargo form */}
              <div style={{ ...card({ marginBottom:18, borderStyle:'dashed' }), background:'rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize:11, color:C.textM, marginBottom:8, fontWeight:600 }}>+ {isRTL?'إضافة معدة جديدة':'Add New Item'}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <input value={nCargoName} onChange={e=>setNCargoName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCargoItem()}
                    placeholder={isRTL?'اسم المعدة...':'Equipment name...'}
                    style={{ ...input(), flex:'1 1 160px', minWidth:120 }} />
                  <input value={nCargoTruck} onChange={e=>setNCargoTruck(e.target.value)} placeholder="Truck 1"
                    style={{ ...input(), flex:'0 0 80px' }} />
                  <input type="number" value={nCargoQty} onChange={e=>setNCargoQty(e.target.value)} min={1}
                    style={{ ...input(), flex:'0 0 60px' }} />
                  <button onClick={addCargoItem} style={btn(C.load,'black',{padding:'8px 16px'})}>{isRTL?'إضافة':'Add'}</button>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {ev.loadingChecklist.map(item=>(
                  <div key={item.id} style={{ ...card(), display:'flex', alignItems:'center', gap:16, borderColor: item.loaded ? `${C.load}33` : C.border, background: item.loaded ? `${C.load}08` : C.surface, transition:'all .2s' }}>
                    {/* Checkbox */}
                    <div onClick={()=>toggleLoaded(item.id)} style={{ width:22, height:22, border:`2px solid ${item.loaded ? C.load : C.textM}`, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: item.loaded ? `${C.load}22` : 'transparent', transition:'all .2s', cursor:'pointer' }}>
                      {item.loaded && <span style={{ color:C.load, fontSize:14, fontWeight:700 }}>✓</span>}
                    </div>
                    <div style={{ flex:1, cursor:'pointer' }} onClick={()=>toggleLoaded(item.id)}>
                      <div style={{ fontWeight:600, fontSize:13, textDecoration: item.loaded ? 'line-through' : 'none', color: item.loaded ? C.textM : C.textP }}>{item.name}</div>
                      <div style={{ fontSize:11, color:C.textM, marginTop:2 }}>{item.truck} · Qty: {item.qty}</div>
                    </div>
                    <span style={{ padding:'3px 8px', borderRadius:4, fontSize:10, fontWeight:700, background: item.loaded ? `${C.load}22` : 'rgba(255,255,255,0.05)', color: item.loaded ? C.load : C.textM }}>
                      {item.loaded ? (isRTL?'محمّل':'Loaded') : (isRTL?'قيد الانتظار':'Pending')}
                    </span>
                    <button onClick={()=>delCargoItem(item.id)} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textM, fontSize:12, padding:4, borderRadius:4 }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>

          ) : phase==='unloading' ? (
            // ── UNLOADING ──────────────────────────────────────────────────
            <div>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontWeight:700, fontSize:'1.5rem', color:C.unload, marginBottom:4 }}>{isRTL?'مرحلة التفريغ':'Unloading Phase'}</h2>
                <p style={{ color:C.textS, fontSize:13 }}>{isRTL?'تأكيد استلام المعدات في الموقع':'Confirm equipment received at venue'}</p>
              </div>
              {ev.loadingChecklist.filter(i=>i.loaded).length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 20px', color:C.textM }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📭</div>
                  <div style={{ fontSize:13 }}>{isRTL?'لا توجد عناصر محملة بعد — أكمل مرحلة التحميل أولاً':'No loaded items yet — complete Loading phase first'}</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {ev.loadingChecklist.filter(i=>i.loaded).map(item=>(
                    <div key={item.id} onClick={()=>toggleUnloaded(item.id)}
                      style={{ ...card(), display:'flex', alignItems:'center', gap:16, cursor:'pointer', borderColor: item.unloaded ? `${C.unload}33` : C.border, background: item.unloaded ? `${C.unload}08` : C.surface, transition:'all .2s' }}>
                      <div style={{ width:22, height:22, border:`2px solid ${item.unloaded ? C.unload : C.textM}`, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: item.unloaded ? `${C.unload}22` : 'transparent', transition:'all .2s' }}>
                        {item.unloaded && <span style={{ color:C.unload, fontSize:14, fontWeight:700 }}>✓</span>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13, textDecoration: item.unloaded ? 'line-through' : 'none', color: item.unloaded ? C.textM : C.textP }}>{item.name}</div>
                        <div style={{ fontSize:11, color:C.textM, marginTop:2 }}>{item.truck} · Qty: {item.qty}</div>
                      </div>
                      <span style={{ padding:'3px 8px', borderRadius:4, fontSize:10, fontWeight:700, background: item.unloaded ? `${C.unload}22` : 'rgba(255,255,255,0.05)', color: item.unloaded ? C.unload : C.textM }}>
                        {item.unloaded ? (isRTL?'مستلَم':'Received') : (isRTL?'قيد الانتظار':'Pending')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : phase==='setup' ? (
            // ── SECTION SETUP ──────────────────────────────────────────────
            <div>
              <div style={{ marginBottom:16 }}>
                <h2 style={{ fontWeight:700, fontSize:'1.5rem', color:C.setup, marginBottom:4 }}>{isRTL?'إعداد الأقسام':'Section Setup'}</h2>
              </div>
              {/* Dept tabs */}
              <div style={{ display:'flex', gap:6, borderBottom:`1px solid ${C.border}`, paddingBottom:1, marginBottom:18, flexWrap:'wrap' }}>
                {DEPTS.map(d=>(
                  <button key={d} onClick={()=>setDept(d)} style={{ background:'transparent', border:'none', borderBottom: dept===d ? `2px solid ${C.setup}` : '2px solid transparent', padding:'10px 14px', fontWeight:600, fontSize:12, color: dept===d ? C.setup : C.textM, cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', gap:6 }}>
                    {d}
                    {(() => { const tasks = ev.sectionSetup[d]||[]; if(!tasks.length) return null; const done = tasks.filter(t=>t.status==='done').length; return <span style={{ fontSize:9, background: done===tasks.length?`${C.success}22`:'rgba(255,255,255,0.06)', color: done===tasks.length?C.success:C.textM, borderRadius:10, padding:'1px 5px' }}>{done}/{tasks.length}</span> })()}
                  </button>
                ))}
              </div>
              {/* Add task */}
              <div style={{ ...card({ marginBottom:18, borderStyle:'dashed' }), background:'rgba(0,0,0,0.15)' }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <input value={nTaskName} onChange={e=>setNTaskName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}
                    placeholder={isRTL?'اسم المهمة...':'Task name...'}
                    style={{ ...input(), flex:'1 1 180px', minWidth:120 }} />
                  <select value={nTaskPri} onChange={e=>setNTaskPri(e.target.value as any)}
                    style={{ ...input(), flex:'0 0 100px', cursor:'pointer' }}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={nTaskOwner} onChange={e=>setNTaskOwner(e.target.value)}
                    style={{ ...input(), flex:'0 0 110px', cursor:'pointer' }}>
                    {ev.crewOwners.map(o=><option key={o} value={o} style={{background:'#0f172a'}}>{o}</option>)}
                  </select>
                  <button onClick={addTask} style={btn(C.setup,undefined,{padding:'8px 18px'})}>{isRTL?'إضافة':'Add'}</button>
                </div>
              </div>
              {/* Tasks */}
              {(ev.sectionSetup[dept]||[]).length === 0 ? (
                <div style={{ textAlign:'center', padding:'50px 20px', color:C.textM }}>
                  <div style={{ fontSize:'2rem', marginBottom:10 }}>📭</div>
                  <div style={{ fontSize:13 }}>{isRTL?'لا مهام في هذا القسم بعد':'No tasks in this section yet'}</div>
                </div>
              ) : (ev.sectionSetup[dept]||[]).map(task=>(
                <div key={task.id} style={{ ...card({ marginBottom:12, borderLeft: task.hasIssue ? `3px solid ${C.danger}` : `3px solid transparent` }), background: task.hasIssue ? `rgba(239,68,68,0.03)` : C.surface }}>
                  {/* Task top */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <span style={{ fontWeight:600, fontSize:13, flex:1, textDecoration:task.status==='done'?'line-through':'none', color:task.status==='done'?C.textM:C.textP }}>{task.name}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <span style={{ padding:'2px 7px', borderRadius:4, fontSize:9, fontWeight:700, background: task.priority==='high'?'rgba(239,68,68,0.15)':task.priority==='medium'?'rgba(251,146,60,0.15)':'rgba(56,189,248,0.15)', color: task.priority==='high'?C.danger:task.priority==='medium'?C.warning:C.load }}>
                        {task.priority}
                      </span>
                      <button onClick={()=>delTask(task.id)} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textM, fontSize:12, padding:'2px', borderRadius:3 }}>🗑️</button>
                    </div>
                  </div>
                  {/* Progress slider */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.textS, marginBottom:4 }}>
                      <span>{isRTL?'التقدم':'Progress'}</span>
                      <span style={{ fontWeight:700, color:C.setup }}>{task.progress}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={task.progress}
                      onChange={e=>taskProgress(task.id, +e.target.value)}
                      style={{ width:'100%', accentColor:C.setup, cursor:'pointer', height:4 }} />
                  </div>
                  {/* Bottom bar */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:8, borderTop:`1px solid rgba(255,255,255,0.04)` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>{task.owner.substring(0,2)}</div>
                      <span style={{ fontSize:11, color:C.textS }}>{task.owner}</span>
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <button onClick={()=>flagIssue(task.id)} style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:4, border:`1px solid ${task.hasIssue?'transparent':C.danger+'44'}`, background: task.hasIssue ? C.danger : `${C.danger}11`, color: task.hasIssue ? 'white' : C.danger, cursor:'pointer' }}>
                        ⚠️ {task.hasIssue?(isRTL?'محظور':'Blocked'):(isRTL?'حظر':'Blocker')}
                      </button>
                      {/* Status group */}
                      <div style={{ display:'flex', background:'rgba(0,0,0,0.2)', borderRadius:5, padding:2, border:`1px solid ${C.border}` }}>
                        {(['pending','progress','done'] as const).map(s=>(
                          <button key={s} onClick={()=>taskStatus(task.id,s)} style={pill(s==='done'?C.success:s==='progress'?C.warning:C.textP, task.status===s)}>
                            {s==='pending'?(isRTL?'انتظار':'Wait'):s==='progress'?(isRTL?'جار':'Run'):(isRTL?'تم':'Done')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Comments toggle */}
                  <div style={{ marginTop:8 }}>
                    <button onClick={()=>setCommentOpen(p=>({...p,[task.id]:!p[task.id]}))}
                      style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textM, fontSize:11, padding:0 }}>
                      💬 {isRTL?'السجل':'Crew Log'} ({task.notes.length}) {commentOpen[task.id]?'▼':'▶'}
                    </button>
                    {commentOpen[task.id] && (
                      <div style={{ marginTop:8, padding:10, background:'rgba(0,0,0,0.25)', borderRadius:8, border:`1px solid ${C.border}` }}>
                        {task.notes.length === 0 ? (
                          <div style={{ fontSize:11, color:C.textM, textAlign:'center', padding:'8px 0' }}>{isRTL?'لا تعليقات بعد':'No logs yet'}</div>
                        ) : (
                          <div style={{ maxHeight:100, overflowY:'auto', marginBottom:8, display:'flex', flexDirection:'column', gap:5 }}>
                            {task.notes.map((n,i)=>(
                              <div key={i} style={{ background:'rgba(255,255,255,0.03)', borderRadius:5, padding:'5px 8px', fontSize:11 }}>
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                                  <span style={{ color:C.load, fontWeight:700 }}>{n.author}</span>
                                  <span style={{ color:C.textM, fontSize:10 }}>{n.timestamp}</span>
                                </div>
                                <div style={{ color:C.textP }}>{n.text}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display:'flex', gap:6 }}>
                          <select value={commentInputs[task.id]?.author||ev.crewOwners[0]||''}
                            onChange={e=>setCommentInputs(p=>({...p,[task.id]:{...p[task.id],author:e.target.value}}))}
                            style={{ ...input(), flex:'0 0 90px', fontSize:11, padding:'5px 6px' }}>
                            {ev.crewOwners.map(o=><option key={o} value={o} style={{background:'#0f172a'}}>{o}</option>)}
                          </select>
                          <input value={commentInputs[task.id]?.text||''}
                            onChange={e=>setCommentInputs(p=>({...p,[task.id]:{...p[task.id],text:e.target.value}}))}
                            onKeyDown={e=>e.key==='Enter'&&addComment(task.id)}
                            placeholder={isRTL?'ملاحظة...':'Log update...'}
                            style={{ ...input(), flex:1, fontSize:11, padding:'5px 8px' }} />
                          <button onClick={()=>addComment(task.id)} style={btn(C.setup+'33',C.setup,{fontSize:11,padding:'5px 10px',border:`1px solid ${C.setup}44`})}>{isRTL?'إضافة':'Log'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

          ) : (
            // ── EXECUTION ──────────────────────────────────────────────────
            <div>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontWeight:700, fontSize:'1.5rem', color:C.exec, marginBottom:4 }}>{isRTL?'التنفيذ المباشر':'Live Execution'}</h2>
                <p style={{ color:C.textS, fontSize:13 }}>{isRTL?'وحدة التحكم في العرض المباشر':'Show control console'}</p>
              </div>
              {!ev.execution.unlocked ? (
                <div style={{ ...card(), textAlign:'center', padding:'50px 20px', border:`1px dashed ${C.border}` }}>
                  <div style={{ fontSize:'3rem', marginBottom:16 }}>🔒</div>
                  <h3 style={{ fontWeight:700, fontSize:'1.2rem', marginBottom:12 }}>{isRTL?'وحدة التحكم مقفلة':'Console Locked'}</h3>
                  <p style={{ color:C.textS, fontSize:13, marginBottom:20 }}>{isRTL?'يجب اكتمال جميع المراحل السابقة لإلغاء القفل':'All previous phases must be complete to unlock'}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxWidth:280, margin:'0 auto 24px' }}>
                    {[
                      { label:isRTL?'التحميل':'Loading',   pct:m.lPct, color:C.load },
                      { label:isRTL?'التفريغ':'Unloading', pct:m.uPct, color:C.unload },
                      { label:isRTL?'الإعداد':'Setup',     pct:m.sPct, color:C.setup },
                    ].map(r=>(
                      <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                        <span style={{ color:C.textS }}>{r.label}</span>
                        <span style={{ fontWeight:700, color: r.pct===100?C.success:C.danger }}>{r.pct===100?'✓ Complete':`${r.pct}%`}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={unlock} disabled={m.lPct<100||m.uPct<100||m.sPct<100}
                    style={{ background: m.lPct===100&&m.uPct===100&&m.sPct===100 ? `linear-gradient(135deg,${C.exec},${C.warning})` : 'rgba(255,255,255,0.05)', color: m.lPct===100&&m.uPct===100&&m.sPct===100 ? 'black' : C.textM, border:'none', borderRadius:8, padding:'12px 24px', fontWeight:700, fontSize:13, cursor: m.lPct===100&&m.uPct===100&&m.sPct===100 ? 'pointer' : 'not-allowed', textTransform:'uppercase', letterSpacing:.5, transition:'all .3s' }}>
                    {m.lPct===100&&m.uPct===100&&m.sPct===100 ? (isRTL?'إطلاق وحدة التحكم':'Launch Show Console') : (isRTL?'العمليات متوقفة':'Operations Blocked')}
                  </button>
                  {/* Force unlock */}
                  <div style={{ marginTop:12 }}>
                    <button onClick={unlock} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textM, fontSize:11, textDecoration:'underline' }}>
                      {isRTL?'إلغاء القفل قسراً':'Force unlock anyway'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                  {/* Live banner */}
                  <div style={{ ...card({ border:`1px solid ${C.exec}44` }), background:`${C.exec}08`, display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:12, height:12, background:C.danger, borderRadius:'50%', animation:'pulse 1.5s infinite', flexShrink:0 }}/>
                    <div>
                      <div style={{ fontWeight:700, color:C.exec }}>{isRTL?'العرض نشط — تحكم مباشر':'SHOW LIVE — Direct Control'}</div>
                      <div style={{ fontSize:12, color:C.textS }}>{ev.name}</div>
                    </div>
                  </div>

                  {/* Safety checks */}
                  <div style={card()}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:14 }}>🛡️ {isRTL?'فحوصات السلامة قبل العرض':'Pre-Show Safety Checks'}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {ev.execution.safetyChecks.map(ch=>(
                        <div key={ch.id} onClick={()=>toggleSafety(ch.id)}
                          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background: ch.checked?`${C.success}08`:'rgba(255,255,255,0.02)', border:`1px solid ${ch.checked?C.success+'33':C.border}`, borderRadius:8, cursor:'pointer', transition:'all .2s' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            <div style={{ width:18, height:18, border:`2px solid ${ch.checked?C.success:C.textM}`, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', background: ch.checked?`${C.success}22`:'transparent' }}>
                              {ch.checked && <span style={{ color:C.success, fontSize:11, fontWeight:700 }}>✓</span>}
                            </div>
                            <span style={{ fontSize:13, textDecoration:ch.checked?'line-through':'none', color:ch.checked?C.textM:C.textP }}>{ch.name}</span>
                          </div>
                          <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700, background: ch.checked?`${C.success}22`:`${C.warning}22`, color: ch.checked?C.success:C.warning }}>{ch.checked?(isRTL?'ناجح':'Passed'):(isRTL?'تحقق':'Verify')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cue sheet */}
                  <div style={card()}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:14 }}>🎬 {isRTL?'جدول الإشارات':'Cue Sheet'}</div>
                    {/* Add cue */}
                    <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                      <input value={nCueTime} onChange={e=>setNCueTime(e.target.value)} placeholder="20:00" style={{ ...input(), flex:'0 0 70px' }}/>
                      <input value={nCueDur} onChange={e=>setNCueDur(e.target.value)} placeholder="5 min" style={{ ...input(), flex:'0 0 70px' }}/>
                      <input value={nCueLabel} onChange={e=>setNCueLabel(e.target.value)} placeholder={isRTL?'اسم الإشارة':'Cue label'} style={{ ...input(), flex:'1 1 130px' }}/>
                      <input value={nCueTarget} onChange={e=>setNCueTarget(e.target.value)} placeholder="All Crew" style={{ ...input(), flex:'1 1 100px' }}/>
                      <button onClick={addCue} style={btn(C.exec,'black',{padding:'8px 16px'})}>{isRTL?'إضافة':'Add'}</button>
                    </div>
                    {ev.execution.cues.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'30px 20px', color:C.textM, fontSize:13 }}>🎬 {isRTL?'لا إشارات بعد — أضف إشارة أعلاه':'No cues yet — add one above'}</div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {ev.execution.cues.map(cue=>(
                          <div key={cue.id} style={{ ...card({ padding:'12px 16px' }), display:'flex', alignItems:'center', gap:14, borderColor: cue.active&&!cue.completed ? `${C.exec}55` : cue.completed ? 'transparent' : C.border, background: cue.active&&!cue.completed ? `${C.exec}06` : cue.completed ? 'rgba(255,255,255,0.01)' : C.surface, opacity: cue.completed ? 0.5 : 1, transition:'all .2s' }}>
                            <div style={{ flexShrink:0 }}>
                              <div style={{ fontWeight:700, fontSize:13, color: cue.active&&!cue.completed?C.exec:C.textS }}>{cue.time}</div>
                              <div style={{ fontSize:10, color:C.textM }}>{cue.duration}</div>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:600, fontSize:13 }}>{cue.label}</div>
                              <div style={{ fontSize:11, color:C.textS }}>{cue.target}</div>
                            </div>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              {!cue.completed ? (
                                <button onClick={()=>fireCue(cue.id)} style={btn(cue.active?C.exec:'rgba(255,255,255,0.05)',cue.active?'black':C.textS,{fontSize:11,padding:'5px 10px'})}>
                                  {cue.active ? '🔥 Fire' : 'Queued'}
                                </button>
                              ) : (
                                <span style={{ color:C.success, fontWeight:700, fontSize:12 }}>✓ {isRTL?'أُطلق':'Fired'}</span>
                              )}
                              <button onClick={()=>delCue(cue.id)} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textM, fontSize:12 }}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right Panel ───────────────────────────────────────────────── */}
        <div style={{ width:280, background:'rgba(9,11,20,0.4)', borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ display:'flex', background:'rgba(0,0,0,0.15)', borderBottom:`1px solid ${C.border}` }}>
            <button onClick={()=>setPanelTab('issues')} style={{ flex:1, background:'transparent', border:'none', padding:'12px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, cursor:'pointer', color: panelTab==='issues'?C.textP:C.textM, borderBottom: panelTab==='issues'?`2px solid ${C.danger}`:'2px solid transparent', transition:'all .2s' }}>
              {isRTL?'المشاكل':'Issues'}
              {m.issues>0 && <span style={{ background:C.danger, color:'white', borderRadius:10, padding:'1px 5px', fontSize:9, marginLeft:4 }}>{m.issues}</span>}
            </button>
            <button onClick={()=>setPanelTab('activity')} style={{ flex:1, background:'transparent', border:'none', padding:'12px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, cursor:'pointer', color: panelTab==='activity'?C.textP:C.textM, borderBottom: panelTab==='activity'?`2px solid ${C.load}`:'2px solid transparent', transition:'all .2s' }}>
              {isRTL?'السجل':'Activity'}
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:14 }}>
            {panelTab==='issues' ? (
              ev ? (
                ev.issues.filter(i=>i.status==='unresolved').length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 10px', color:C.textM }}>
                    <div style={{ fontSize:'1.8rem', marginBottom:8 }}>🟢</div>
                    <div style={{ fontSize:12 }}>{isRTL?'لا مشاكل نشطة — الأنظمة تعمل':'No active issues — all clear'}</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {ev.issues.filter(i=>i.status==='unresolved').map(iss=>(
                      <div key={iss.id} style={{ background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:7 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontWeight:600, fontSize:12 }}>{iss.title}</span>
                          <span style={{ padding:'2px 6px', borderRadius:4, fontSize:9, fontWeight:700, background: iss.severity==='high'?'rgba(239,68,68,0.15)':'rgba(251,146,60,0.15)', color: iss.severity==='high'?C.danger:C.warning }}>{iss.severity}</span>
                        </div>
                        <div style={{ fontSize:11, color:C.textS }}>{isRTL?'القسم:':'Section:'} {iss.section}</div>
                        <button onClick={()=>resolveIssue(iss.id)} style={btn(C.success,undefined,{fontSize:11,padding:'4px 10px',alignSelf:'flex-end'})}>{isRTL?'حل المشكلة':'Resolve'}</button>
                      </div>
                    ))}
                  </div>
                )
              ) : null
            ) : (
              ev ? (
                ev.activityLog.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 10px', color:C.textM }}>
                    <div style={{ fontSize:'1.8rem', marginBottom:8 }}>💬</div>
                    <div style={{ fontSize:12 }}>{isRTL?'لا سجلات بعد':'No logs yet'}</div>
                  </div>
                ) : (
                  <div style={{ position:'relative', paddingLeft:18 }}>
                    <div style={{ position:'absolute', left:5, top:0, bottom:0, width:1, background:C.border }}/>
                    {ev.activityLog.map(log=>(
                      <div key={log.id} style={{ position:'relative', marginBottom:14 }}>
                        <div style={{ position:'absolute', left:-17, top:4, width:9, height:9, borderRadius:'50%', background: log.phase==='load'?C.load:log.phase==='unload'?C.unload:log.phase==='exec'?C.exec:log.phase==='issue'?C.danger:C.setup, border:`2px solid ${C.bg}` }}/>
                        <div style={{ fontSize:10, color:C.textM, marginBottom:2 }}>{log.time}</div>
                        <div style={{ fontSize:12, color:C.textS }}>{log.msg}</div>
                      </div>
                    ))}
                  </div>
                )
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* ── Event Modal ──────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(4,6,12,0.75)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ ...card(), width:'100%', maxWidth:500, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(15,23,42,0.9)', boxShadow:'0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:12 }}>
              <h3 style={{ fontWeight:700, fontSize:'1.1rem' }}>{editEv ? (isRTL?'تعديل الفعالية':'Edit Event') : (isRTL?'فعالية جديدة':'New Event')}</h3>
              <button onClick={()=>setShowModal(false)} style={{ background:'transparent', border:'none', color:C.textM, fontSize:'1.5rem', cursor:'pointer', lineHeight:1 }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:12, color:C.textM, display:'block', marginBottom:6 }}>{isRTL?'اسم الفعالية *':'Event Name *'}</label>
                <input value={fName} onChange={e=>setFName(e.target.value)} placeholder={isRTL?'أدخل اسم الفعالية...':'Enter event name...'} style={input()} />
              </div>
              <div>
                <label style={{ fontSize:12, color:C.textM, display:'block', marginBottom:6 }}>{isRTL?'العميل':'Client'}</label>
                <input value={fClient} onChange={e=>setFClient(e.target.value)} placeholder={isRTL?'اسم العميل...':'Client name...'} style={input()} />
              </div>
              <div>
                <label style={{ fontSize:12, color:C.textM, display:'block', marginBottom:6 }}>{isRTL?'الموقع':'Venue'}</label>
                <input value={fVenue} onChange={e=>setFVenue(e.target.value)} placeholder={isRTL?'اسم القاعة أو المكان...':'Hall or venue name...'} style={input()} />
              </div>
              <div>
                <label style={{ fontSize:12, color:C.textM, display:'block', marginBottom:6 }}>{isRTL?'تاريخ الفعالية':'Event Date'}</label>
                <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={input()} />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button onClick={saveEvent} style={btn(C.load,'black',{flex:1})}>{editEv?(isRTL?'حفظ التغييرات':'Save Changes'):(isRTL?'إنشاء الفعالية':'Create Event')}</button>
                <button onClick={()=>setShowModal(false)} style={btn('rgba(255,255,255,0.05)',C.textS,{border:`1px solid ${C.border}`})}>{isRTL?'إلغاء':'Cancel'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
