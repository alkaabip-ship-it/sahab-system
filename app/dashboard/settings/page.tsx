'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/LanguageContext'

export default function SettingsPage() {
  const { t } = useTranslation()
  const [threshold, setThreshold]       = useState('20')
  const [codeSource, setCodeSource]     = useState('custom_field')
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')

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
            [t.settings.database, 'SQLite (dev.db)'],
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
            <span className="font-mono text-slate-300">Admin@123</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded">{t.settings.ops}</span>
            <span className="font-mono text-slate-300">ops@sahab.ae</span>
            <span className="text-slate-400">|</span>
            <span className="font-mono text-slate-300">Ops@123</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">{t.settings.changePasswordNote}</p>
      </div>
    </div>
  )
}
