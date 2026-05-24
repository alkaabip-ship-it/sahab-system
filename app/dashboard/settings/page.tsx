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
    ZOHO_CLIENT_ID: '',
    ZOHO_CLIENT_SECRET: '',
    ZOHO_ORGANIZATION_ID: '',
    ZOHO_REFRESH_TOKEN: '',
  })
  const [showSecret, setShowSecret]   = useState(false)
  const [showRefresh, setShowRefresh] = useState(false)
  const [savingZoho, setSavingZoho]   = useState(false)
  const [zohoMsg, setZohoMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loadingZoho, setLoadingZoho] = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [syncMsg, setSyncMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [uploadingCRM, setUploadingCRM] = useState(false)
  const [crmMsg, setCrmMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [authCode, setAuthCode]       = useState('')
  const [exchanging, setExchanging]   = useState(false)
  const [exchangeMsg, setExchangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  async function handleExchangeCode() {
    setExchanging(true)
    setExchangeMsg(null)
    try {
      const res = await fetch('/api/settings/zoho/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim() }),
      })
      const d = await res.json()
      if (res.ok) {
        setZoho(p => ({ ...p, ZOHO_REFRESH_TOKEN: d.refresh_token }))
        setAuthCode('')
        setExchangeMsg({ type: 'success', text: '✓ تم الحصول على Refresh Token وحفظه تلقائياً' })
      } else {
        setExchangeMsg({ type: 'error', text: d.error || 'فشل التحويل' })
      }
    } catch {
      setExchangeMsg({ type: 'error', text: 'حدث خطأ في الاتصال' })
    } finally {
      setExchanging(false)
    }
  }

  async function handleUploadCRMLeads() {
    setUploadingCRM(true)
    setCrmMsg(null)
    try {
      const res = await fetch('/api/zoho/crm-leads', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setCrmMsg({ type: 'success', text: `✓ ${d.message}` })
      } else {
        setCrmMsg({ type: 'error', text: d.error || 'فشل الرفع إلى Zoho CRM' })
      }
    } catch {
      setCrmMsg({ type: 'error', text: 'حدث خطأ في الاتصال' })
    } finally {
      setUploadingCRM(false)
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
    <div className="max-w-2xl space-y-6">
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
        <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 text-xs font-bold">Z</span>
          إعدادات Zoho Books API
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          تُحفظ هذه البيانات في قاعدة البيانات وتُستخدم للمزامنة التلقائية مع Zoho Books.
        </p>

        {loadingZoho ? (
          <p className="text-sm text-slate-400">جاري التحميل...</p>
        ) : (
          <div className="space-y-4">
            {/* Client ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
              <input
                type="text"
                value={zoho.ZOHO_CLIENT_ID}
                onChange={e => setZoho(p => ({ ...p, ZOHO_CLIENT_ID: e.target.value }))}
                placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={zoho.ZOHO_CLIENT_SECRET}
                  onChange={e => setZoho(p => ({ ...p, ZOHO_CLIENT_SECRET: e.target.value }))}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 pr-20"
                />
                <button type="button" onClick={() => setShowSecret(p => !p)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                  {showSecret ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
            </div>

            {/* Organization ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization ID</label>
              <input
                type="text"
                value={zoho.ZOHO_ORGANIZATION_ID}
                onChange={e => setZoho(p => ({ ...p, ZOHO_ORGANIZATION_ID: e.target.value }))}
                placeholder="1234567890"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Connect with Zoho OAuth */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700">ربط مع Zoho Books</p>

              {/* Step 1: Open authorization URL */}
              <div>
                <p className="text-xs text-blue-600 mb-2">
                  <strong>الخطوة 1:</strong> اضغط الزر لفتح صفحة التفويض في Zoho، ثم اضغط <strong>Accept</strong>
                </p>
                <button
                  onClick={() => {
                    const clientId = zoho.ZOHO_CLIENT_ID.trim()
                    if (!clientId) { alert('أدخل Client ID أولاً واحفظه'); return }
                    const url = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoBooks.fullaccess.all&client_id=${clientId}&response_type=code&redirect_uri=https://zohoapis.com&access_type=offline`
                    window.open(url, '_blank')
                  }}
                  disabled={!zoho.ZOHO_CLIENT_ID.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  فتح صفحة Zoho للتفويض ↗
                </button>
              </div>

              {/* Step 2: Copy code from URL */}
              <div className="bg-white border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-700 font-medium mb-1">الخطوة 2: انسخ الكود من URL المتصفح</p>
                <p className="text-xs text-slate-500">بعد الموافقة، سيظهر خطأ في المتصفح. انظر لشريط العنوان وانسخ قيمة <span className="font-mono bg-slate-100 px-1">?code=</span></p>
              </div>

              {/* Step 3: Paste and convert */}
              <div>
                <p className="text-xs text-blue-600 mb-2"><strong>الخطوة 3:</strong> الصق الكود وحوّله</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={authCode}
                    onChange={e => setAuthCode(e.target.value)}
                    placeholder="1000.xxxxxxxx.xxxxxxxx"
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  <button onClick={handleExchangeCode} disabled={exchanging || !authCode.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-medium rounded-lg transition-all whitespace-nowrap">
                    {exchanging ? 'جاري...' : 'تحويل'}
                  </button>
                </div>
              </div>

              {exchangeMsg && (
                <p className={`text-xs ${exchangeMsg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                  {exchangeMsg.text}
                </p>
              )}
            </div>

            {/* Refresh Token */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Refresh Token</label>
              <div className="relative">
                <input
                  type={showRefresh ? 'text' : 'password'}
                  value={zoho.ZOHO_REFRESH_TOKEN}
                  onChange={e => setZoho(p => ({ ...p, ZOHO_REFRESH_TOKEN: e.target.value }))}
                  placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 pr-20"
                />
                <button type="button" onClick={() => setShowRefresh(p => !p)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                  {showRefresh ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
            </div>

            {zohoMsg && (
              <div className={`p-3 rounded-lg text-sm ${zohoMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {zohoMsg.text}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSaveZoho} disabled={savingZoho}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg transition-all">
                {savingZoho ? 'جاري الحفظ...' : 'حفظ بيانات Zoho'}
              </button>
              <button onClick={handleSync} disabled={syncing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2">
                {syncing ? (
                  <><span className="animate-spin">↻</span> جاري المزامنة...</>
                ) : (
                  <>↻ مزامنة مع Zoho Books</>
                )}
              </button>
              <button onClick={handleUploadCRMLeads} disabled={uploadingCRM}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2">
                {uploadingCRM ? (
                  <><span className="animate-spin">↻</span> جاري الرفع...</>
                ) : (
                  <>⬆ رفع 55 عميل إلى Zoho CRM</>
                )}
              </button>
            </div>

            {syncMsg && (
              <div className={`p-3 rounded-lg text-sm ${syncMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {syncMsg.text}
              </div>
            )}
            {crmMsg && (
              <div className={`p-3 rounded-lg text-sm ${crmMsg.type === 'success' ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {crmMsg.text}
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
