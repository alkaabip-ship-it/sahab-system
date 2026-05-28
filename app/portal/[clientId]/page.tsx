'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const STATUS_LABEL: Record<string, { ar: string; color: string }> = {
  QUOTE:       { ar: 'عرض سعر',     color: '#6366f1' },
  CONFIRMED:   { ar: 'مؤكد',        color: '#f59e0b' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', color: '#3b82f6' },
  DONE:        { ar: 'مكتمل',       color: '#10b981' },
  CANCELLED:   { ar: 'ملغي',        color: '#ef4444' },
}

const INV_STATUS: Record<string, { ar: string; bg: string; text: string }> = {
  PAID:    { ar: 'مدفوع',      bg: '#d1fae5', text: '#065f46' },
  UNPAID:  { ar: 'غير مدفوع', bg: '#fee2e2', text: '#991b1b' },
  PARTIAL: { ar: 'جزئي',       bg: '#fef3c7', text: '#92400e' },
  VOID:    { ar: 'ملغي',       bg: '#f1f5f9', text: '#64748b' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('ar-AE', { maximumFractionDigits: 0 }).format(n)
}

export default function ClientPortal() {
  const { clientId } = useParams<{ clientId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/portal/${clientId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('حدث خطأ في الاتصال'))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 14 }}>جاري تحميل بيانات مشروعك...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#f87171', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>المشروع غير موجود</p>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>تحقق من الرابط أو تواصل مع فريق سحاب</p>
      </div>
    </div>
  )

  const st = STATUS_LABEL[data.status] || { ar: data.status, color: '#94a3b8' }
  const execDate = data.executionDate ? new Date(data.executionDate).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#e2e8f0' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        .card { background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; animation: fadeUp .4s ease both; }
        .kpi { background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 18px; text-align: center; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>بوابة العميل — سحاب لإدارة الفعاليات</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{data.name}</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>كود المشروع: {data.code}</p>
          </div>
          <span style={{ background: `${st.color}22`, color: st.color, border: `1px solid ${st.color}44`, borderRadius: 24, padding: '6px 18px', fontSize: 13, fontWeight: 700 }}>
            {st.ar}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>

        {/* Progress */}
        <div className="card" style={{ marginBottom: 20, animationDelay: '.05s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🚀 تقدم المشروع</h2>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{data.progressPct}%</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${data.progressPct}%`, background: 'linear-gradient(to left, #3b82f6, #60a5fa)', borderRadius: 5, transition: 'width 1s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['QUOTE', 'CONFIRMED', 'IN_PROGRESS', 'DONE'].map((s, i) => {
              const done = ['QUOTE', 'CONFIRMED', 'IN_PROGRESS', 'DONE'].indexOf(data.status) >= i
              return (
                <span key={s} style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: done ? `${STATUS_LABEL[s]?.color}22` : 'rgba(255,255,255,0.03)', color: done ? STATUS_LABEL[s]?.color : '#475569', border: `1px solid ${done ? STATUS_LABEL[s]?.color + '44' : 'transparent'}` }}>
                  {STATUS_LABEL[s]?.ar}
                </span>
              )
            })}
          </div>
          {execDate && <p style={{ fontSize: 12, color: '#64748b', marginTop: 12, marginBottom: 0 }}>📅 تاريخ الفعالية: {execDate}</p>}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'قيمة المشروع', value: fmt(data.value), sub: 'درهم', color: '#6366f1' },
            { label: 'المبلغ المدفوع', value: fmt(data.totalPaid), sub: 'درهم', color: '#10b981' },
            { label: 'الرصيد المتبقي', value: fmt(data.totalBalance), sub: 'درهم', color: data.totalBalance > 0 ? '#f59e0b' : '#10b981' },
          ].map((k, i) => (
            <div key={i} className="kpi" style={{ animationDelay: `${.1 + i * .05}s` }}>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, margin: '0 0 8px', letterSpacing: .5 }}>{k.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
              <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0' }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Invoices */}
        {data.invoices?.length > 0 && (
          <div className="card" style={{ animationDelay: '.2s' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>🧾 الفواتير</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.invoices.map((inv: any) => {
                const is = INV_STATUS[inv.status] || { ar: inv.status, bg: '#1e293b', text: '#94a3b8' }
                return (
                  <div key={inv.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>{inv.invoiceNumber}</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                        {new Date(inv.invoiceDate).toLocaleDateString('ar-AE')}
                        {inv.dueDate ? ` · الاستحقاق: ${new Date(inv.dueDate).toLocaleDateString('ar-AE')}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{fmt(inv.amount)} د.إ</p>
                        {inv.balance > 0 && <p style={{ fontSize: 10, color: '#f59e0b', margin: 0 }}>متبقي: {fmt(inv.balance)}</p>}
                      </div>
                      <span style={{ background: is.bg, color: is.text, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{is.ar}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32, color: '#334155', fontSize: 12 }}>
          <p>سحاب لإدارة الفعاليات — الإمارات العربية المتحدة</p>
          <p>للاستفسارات تواصل معنا عبر البريد الإلكتروني أو الهاتف</p>
        </div>
      </div>
    </div>
  )
}
