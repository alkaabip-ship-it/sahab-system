'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'

export default function SettingsPage() {
  const { t } = useTranslation()
  const [threshold, setThreshold]       = useState('20')
  const [codeSource, setCodeSource]     = useState('custom_field')
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')

  // Zoho state
  const [zoho, setZoho] = useState({
    ZOHO_ORGANIZATION_ID: '',
    ZOHO_ACCESS_TOKEN: '',
  })
  const [showToken, setShowToken] = useState(false)
  const [savingZoho, setSavingZoho]   = useState(false)
  const [zohoMsg, setZohoMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loadingZoho, setLoadingZoho] = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [syncMsg, setSyncMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testing, setTesting]         = useState(false)
  const [testResult, setTestResult]   = useState<{ ok: boolean; message: string; orgName?: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/zoho')
      .then(r => r.json())
      .then(data => { setZoho(data); setLoadingZoho(false) })
      .catch(() => setLoadingZoho(false))
  }, [])

  async function handleSaveSettings() {
    setSavingThreshold(true)
    try {
      await fetch('/api/projects', { method: 'GET' })
      setSaveMsg(t.settings.savedMsg)
      setTimeout(() => setSaveMsg(''), 3000)
    } finally {
      setSavingThreshold(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/zoho/sync', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setSyncMsg({ type: 'success', text: `✓ ${d.message}` })
      } else {
        setSyncMsg({ type: 'error', text: d.error || 'فشلت المزامنة' })
      }
    } catch {
      setSyncMsg({ type: 'error', text: 'حدث خطأ في الاتصال' })
    } finally {
      setSyncing(false)
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/zoho/test')
      const d   = await res.json()
      setTestResult({ ok: d.ok, message: d.message, orgName: d.orgName })
    } catch {
      setTestResult({ ok: false, message: 'حدث خطأ في الاتصال' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveZoho() {
    setSavingZoho(true)
    setZohoMsg(null)
    try {
      const res = await fetch('/api/settings/zoho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoho),
      })
      if (res.ok) {
        setZohoMsg({ type: 'success', text: 'تم حفظ بيانات Zoho بنجاح ✓' })
      } else {
        const d = await res.json()
        setZohoMsg({ type: 'error', text: d.error || 'فشل الحفظ' })
      }
    } catch {
      setZohoMsg({ type: 'error', text: 'حدث خطأ في الاتصال' })
    } finally {
      setSavingZoho(false)
      setTimeout(() => setZohoMsg(null), 4000)
    }
  }

  return (
    <div className="max-w-2xl w-full space-y-6">
      <h2 className="text-xl font-bold text-slate-800">{t.settings.title}</h2>

      {/* App Settings */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center text-sky-600">⚙</span>
          {t.settings.appSettings}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.settings.lowProfitThreshold}</label>
            <p className="text-xs text-slate-400 mb-2">{t.settings.lowProfitDesc}</p>
            <div className="flex items-center gap-3">
              <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="0" max="100"
                className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              <span className="text-slate-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.settings.codeSource}</label>
            <p className="text-xs text-slate-400 mb-2">{t.settings.codeSourceDesc}</p>
            <select value={codeSource} onChange={(e) => setCodeSource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
              <option value="custom_field">{t.settings.customField}</option>
              <option value="reference">{t.settings.reference}</option>
              <option value="notes">{t.settings.notes}</option>
            </select>
          </div>
        </div>
        {saveMsg && <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{saveMsg}</div>}
        <button onClick={handleSaveSettings} disabled={savingThreshold}
          className="mt-4 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white text-sm font-medium rounded-lg transition-all">
          {savingThreshold ? t.common.saving : t.settings.saveSettings}
        </button>
      </div>

      {/* Zoho Books API */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 text-xs font-bold">Z</span>
            إعدادات Zoho Books API
          </h3>
          {/* Connection status badge */}
          {testResult && (
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${testResult.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {testResult.ok ? `✓ متصل${testResult.orgName ? ` · ${testResult.orgName}` : ''}` : '✗ غير متصل'}
            </span>
          )}
        </div>

        {/* Status chips */}
        <div className="flex gap-3 mb-5 p-3 bg-slate-50 rounded-xl">
          {[
            { label: 'Organization ID', filled: !!zoho.ZOHO_ORGANIZATION_ID },
            { label: 'Access Token',    filled: !!zoho.ZOHO_ACCESS_TOKEN },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${f.filled ? 'bg-green-500 text-white' : 'bg-red-400 text-white'}`}>
                {f.filled ? '✓' : '✗'}
              </span>
              <span className={f.filled ? 'text-slate-600' : 'text-red-500 font-medium'}>{f.label}</span>
            </div>
          ))}
        </div>

        {loadingZoho ? (
          <p className="text-sm text-slate-400">جاري التحميل...</p>
        ) : (
          <div className="space-y-4">

            {/* Organization ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Organization ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={zoho.ZOHO_ORGANIZATION_ID}
                onChange={e => setZoho(p => ({ ...p, ZOHO_ORGANIZATION_ID: e.target.value }))}
                placeholder="مثال: 811046696"
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 ${!zoho.ZOHO_ORGANIZATION_ID ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
              />
            </div>

            {/* Access Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Access Token <span className="text-red-400">*</span>
                <span className="text-slate-400 font-normal mr-2">— احصل عليه من Zoho API Console</span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={zoho.ZOHO_ACCESS_TOKEN}
                  onChange={e => setZoho(p => ({ ...p, ZOHO_ACCESS_TOKEN: e.target.value }))}
                  placeholder="1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxx"
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 pr-20 ${!zoho.ZOHO_ACCESS_TOKEN ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}
                />
                <button type="button" onClick={() => setShowToken(p => !p)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                  {showToken ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                للحصول على Access Token: افتح{' '}
                <button onClick={() => window.open('https://api-console.zoho.com/', '_blank')} className="text-orange-600 underline font-medium">
                  Zoho API Console ↗
                </button>{' '}
                ← Self Client ← Generate Code ← النطاق: <span className="font-mono bg-slate-100 px-1 rounded">ZohoBooks.fullaccess.all</span>
              </p>
            </div>

            {zohoMsg && (
              <div className={`p-3 rounded-lg text-sm ${zohoMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {zohoMsg.text}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={handleSaveZoho} disabled={savingZoho}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-lg transition-all">
                {savingZoho ? '⏳ جاري الحفظ...' : '💾 حفظ'}
              </button>
              <button onClick={handleTestConnection} disabled={testing}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-all">
                {testing ? '⏳ جاري الاختبار...' : '🔌 اختبر الاتصال'}
              </button>
              <button onClick={handleSync} disabled={syncing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2">
                {syncing ? <><span className="animate-spin inline-block">↻</span> جاري المزامنة...</> : <>↻ مزامنة مع Zoho</>}
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${testResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {testResult.message}
              </div>
            )}
            {syncMsg && (
              <div className={`p-3 rounded-lg text-sm ${syncMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {syncMsg.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* System info */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">ℹ</span>
          {t.settings.systemInfo}
        </h3>
        <div className="space-y-2 text-sm">
          {[
            [t.settings.appName, t.settings.appNameValue],
            [t.settings.version, '0.1.0'],
            [t.settings.database, 'PostgreSQL (local)'],
            [t.settings.environment, process.env.NODE_ENV || 'development'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Default credentials */}
      <div className="bg-slate-800 rounded-xl p-5 text-white">
        <h3 className="font-semibold mb-3">{t.settings.defaultCredentials}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="bg-sky-500 text-white text-xs px-2 py-0.5 rounded">{t.settings.admin}</span>
            <span className="font-mono text-slate-300">admin@sahab.ae</span>
            <span className="text-slate-400">|</span>
            <span className="font-mono text-slate-300">sahab2024</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded">{t.settings.ops}</span>
            <span className="font-mono text-slate-300">infosahab@sahab.ae</span>
            <span className="text-slate-400">|</span>
            <span className="font-mono text-slate-300">doaa123</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">{t.settings.changePasswordNote}</p>
      </div>
    </div>
  )
}
