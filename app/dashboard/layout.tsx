'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n/LanguageContext'

function LogoBrand() {
  return (
    <div className="relative w-32 h-10 flex-shrink-0">
      <Image
        src="/logo.png"
        alt="Sahab"
        fill
        className="object-contain object-right"
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement
          if (fallback) fallback.style.opacity = '1'
        }}
      />
      <span
        style={{ opacity: 0, transition: 'opacity 0.2s' }}
        className="absolute inset-0 flex items-center text-white font-bold text-xl"
      >
        سحاب
      </span>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t, lang, toggle } = useTranslation()

  const navItems = [
    { href: '/dashboard',          label: t.nav.dashboard, icon: '◉' },
    { href: '/dashboard/projects', label: t.nav.projects,  icon: '📋' },
    { href: '/dashboard/suppliers',label: t.nav.suppliers, icon: '🏢' },
    { href: '/dashboard/bills',    label: t.nav.bills,     icon: '🧾' },
    { href: '/dashboard/clients',  label: t.nav.clients,   icon: '👥' },
    { href: '/dashboard/reports',  label: t.nav.reports,   icon: '📊' },
    { href: '/dashboard/admin',    label: t.nav.admin,     icon: '🏛️' },
    { href: '/dashboard/upload',   label: t.nav.upload,    icon: '⬆️' },
    { href: '/dashboard/settings', label: t.nav.settings,  icon: '⚙️' },
  ]

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-800 text-white flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Brand */}
        <div className={`flex items-center border-b border-slate-700 ${sidebarOpen ? 'p-4 justify-between' : 'p-3 justify-center'}`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <LogoBrand />
              <p className="text-xs text-slate-400 leading-tight">{lang === 'ar' ? 'إدارة الفعاليات' : 'Events Mgmt'}</p>
            </div>
          ) : (
            <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">س</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white p-1 rounded flex-shrink-0">
            {sidebarOpen ? (lang === 'ar' ? '◀' : '▶') : (lang === 'ar' ? '▶' : '◀')}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 mx-2 mb-1 rounded-lg transition-all duration-200 group ${
                isActive(item.href)
                  ? 'bg-sky-500 text-white shadow-md nav-active'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className={`text-lg flex-shrink-0 transition-transform duration-200 ${isActive(item.href) ? '' : 'group-hover:scale-110'}`}>{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              {sidebarOpen && isActive(item.href) && (
                <span className="ms-auto w-1.5 h-1.5 rounded-full bg-white opacity-80" />
              )}
            </Link>
          ))}
        </nav>

        {/* Language toggle + user */}
        {sidebarOpen && (
          <div className="p-4 border-t border-slate-700 space-y-3">
            {/* Language toggle */}
            <button
              onClick={toggle}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-sm"
            >
              <span className="text-slate-300">{lang === 'ar' ? 'English' : 'العربية'}</span>
              <span className="text-base">{lang === 'ar' ? '🇬🇧' : '🇦🇪'}</span>
            </button>

            {/* User info */}
            {session?.user && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold">{session.user.name?.charAt(0) || 'م'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full py-2 px-3 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                >
                  {t.nav.signOut}
                </button>
              </>
            )}
          </div>
        )}

        {/* Collapsed: show toggle icon only */}
        {!sidebarOpen && (
          <div className="p-3 border-t border-slate-700">
            <button
              onClick={toggle}
              className="w-full flex items-center justify-center py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-base"
              title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            >
              {lang === 'ar' ? '🇬🇧' : '🇦🇪'}
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-semibold text-slate-800">
            {navItems.find((n) => isActive(n.href))?.label || t.nav.dashboard}
          </h1>
          <Link
            href="/dashboard/upload"
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-all"
          >
            <span>⬆️</span>
            {t.nav.uploadCsv}
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  )
}
