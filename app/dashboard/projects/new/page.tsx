'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/LanguageContext'

export default function NewProjectPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', clientName: '', value: '', executionDate: '', status: 'QUOTE', code: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const STATUS_OPTIONS = [
    { value: 'QUOTE',       label: t.status.QUOTE },
    { value: 'CONFIRMED',   label: t.status.CONFIRMED },
    { value: 'IN_PROGRESS', label: t.status.IN_PROGRESS },
    { value: 'COMPLETED',   label: t.status.COMPLETED },
    { value: 'CLOSED',      label: t.status.CLOSED },
  ]

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, clientName: form.clientName, value: parseFloat(form.value), executionDate: form.executionDate || null, status: form.status, code: form.code || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t.common.error); setLoading(false); return }
      router.push(`/dashboard/projects/${data.id}`)
    } catch {
      setError(t.common.error)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/projects" className="text-slate-400 hover:text-slate-600 text-sm">
          ← {t.nav.projects}
        </Link>
        <span className="text-slate-300">/</span>
        <h2 className="text-xl font-bold text-slate-800">{t.projects.newProject}</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.projects.projectName} <span className="text-red-500">*</span></label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.projects.clientName} <span className="text-red-500">*</span></label>
            <input type="text" name="clientName" value={form.clientName} onChange={handleChange} required
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.projects.projectValue} ({t.common.aed}) <span className="text-red-500">*</span>
            </label>
            <input type="number" name="value" value={form.value} onChange={handleChange} required min="0" step="0.01"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.projects.executionDate}</label>
            <input type="date" name="executionDate" value={form.executionDate} onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.projects.status}</label>
            <select name="status" value={form.status} onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm bg-white">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.projects.projectCode}
              <span className="text-xs font-normal text-slate-400 mx-2">({t.projects.autoGenerate})</span>
            </label>
            <input type="text" name="code" value={form.code} onChange={handleChange} placeholder="PRJ-001"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-mono" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-semibold rounded-lg transition-all text-sm">
              {loading ? t.projects.creating : t.projects.createProject}
            </button>
            <Link href="/dashboard/projects"
              className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-all text-sm font-medium">
              {t.common.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
