'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n/LanguageContext'
import { PermissionsProvider, usePermissions } from '@/lib/PermissionsContext'
import {
  HiSquares2X2, HiClipboardDocumentList, HiBuildingOffice2,
  HiDocumentText, HiUsers, HiChartBarSquare, HiCog6Tooth,
  HiCog8Tooth, HiSparkles, HiEnvelope, HiUserGroup,
} from 'react-icons/hi2'

function LogoBrand() {
  return (
    <div className="relative w-32 h-10 flex-shrink-0">
      <Image src="/logo.png" alt="Sahab" fill className="object-contain object-right"
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement
          if (fallback) fallback.style.opacity = '1'
        }} />
      <span style={{ opacity: 0, transition: 'opacity 0.2s' }}
        className="absolute inset-0 flex items-center text-white font-bold text-xl">سحاب</span>
    </div>
  )
}

function SidebarNav({ sidebarOpen }: { sidebarOpen: boolean }) {
  const pathname = usePathname()
  const { t, lang } = useTranslation()
  const { data: session } = useSession()
  const perms = usePermissions()
  const role = (session?.user as any)?.role

  const allNavItems = [
    { href: '/dashboard',               label: t.nav.dashboard,  icon: <HiSquares2X2 size={20} />,          key: 'dashboard' },
    { href: '/dashboard/projects',      label: t.nav.projects,   icon: <HiClipboardDocumentList size={20} />, key: 'projects' },
    { href: '/dashboard/suppliers',     label: t.nav.suppliers,  icon: <HiBuildingOffice2 size={20} />,     key: 'suppliers' },
    { href: '/dashboard/bills',         label: t.nav.bills,      icon: <HiDocumentText size={20} />,        key: 'bills' },
    { href: '/dashboard/clients',       label: t.nav.clients,    icon: <HiUsers size={20} />,               key: 'clients' },
    { href: '/dashboard/reports',       label: t.nav.reports,    icon: <HiChartBarSquare size={20} />,      key: 'reports' },
    { href: '/dashboard/admin',         label: t.nav.admin,      icon: <HiCog6Tooth size={20} />,           key: 'admin' },
    { href: '/dashboard/upload-bill',   label: 'رفع فاتورة AI', icon: <HiSparkles size={20} />,            key: 'uploadBill' },
    { href: '/dashboard/communications',label: 'التواصل',        icon: <HiEnvelope size={20} />,            key: 'communications' },
    { href: '/dashboard/users',         label: 'المستخدمون',     icon: <HiUserGroup size={20} />,           key: '__admin_only__' },
    { href: '/dashboard/settings',      label: t.nav.settings,   icon: <HiCog8Tooth size={20} />,           key: 'settings' },
  ]

  const navItems = allNavItems.filter(item => {
    if (item.key === '__admin_only__') return role === 'ADMIN'
    if (role === 'ADMIN') return true
    return perms.tabs[item.key as keyof typeof perms.tabs] !== false
  })

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex-1 py-4 overflow-y-auto sidebar-nav">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href}
          className={`flex items-center gap-3 px-4 py-3 mx-2 mb-1 rounded-lg transition-all duration-200 group ${
            isActive(item.href) ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}>
          <span className={`flex-shrink-0 transition-transform duration-200 ${isActive(item.href) ? '' : 'group-hover:scale-110'}`}>{item.icon}</span>
          {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
          {sidebarOpen && isActive(item.href) && <span className="ms-auto w-1.5 h-1.5 rounded-full bg-white opacity-80" />}
        </Link>
      ))}
    </nav>
  )
}

function DashboardInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { t, lang, toggle } = useTranslation()
  const perms = usePermissions()
  const role = (session?.user as any)?.role

  // Redirect away from dashboard home if user has no access to it
  useEffect(() => {
    if (role === 'ADMIN' || !role) return
    if (pathname === '/dashboard' && !perms.tabs.dashboard) {
      const TAB_ROUTES: Record<string, string> = {
        projects: '/dashboard/projects', suppliers: '/dashboard/suppliers',
        bills: '/dashboard/bills', clients: '/dashboard/clients',
        reports: '/dashboard/reports', uploadBill: '/dashboard/upload-bill',
        communications: '/dashboard/communications', settings: '/dashboard/settings',
      }
      const first = Object.entries(perms.tabs).find(([k, v]) => k !== 'dashboard' && v)
      if (first) router.replace(TAB_ROUTES[first[0]] ?? '/dashboard/projects')
    }
  }, [pathname, perms, role])

  const pageTitle = pathname === '/dashboard' ? t.nav.dashboard
    : pathname.startsWith('/dashboard/projects') ? t.nav.projects
    : pathname.startsWith('/dashboard/suppliers') ? t.nav.suppliers
    : pathname.startsWith('/dashboard/bills') ? t.nav.bills
    : pathname.startsWith('/dashboard/clients') ? t.nav.clients
    : pathname.startsWith('/dashboard/reports') ? t.nav.reports
    : pathname.startsWith('/dashboard/admin') ? t.nav.admin
    : pathname.startsWith('/dashboard/upload-bill') ? 'رفع فاتورة AI'
    : pathname.startsWith('/dashboard/communications') ? 'التواصل'
    : pathname.startsWith('/dashboard/users') ? 'المستخدمون'
    : t.nav.settings

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-800 text-white flex flex-col transition-all duration-300 flex-shrink-0`}>
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

        <SidebarNav sidebarOpen={sidebarOpen} />

        {sidebarOpen && (
          <div className="p-4 border-t border-slate-700 space-y-3">
            <button onClick={toggle}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-sm">
              <span className="text-slate-300">{lang === 'ar' ? 'English' : 'العربية'}</span>
              <span className="text-base">{lang === 'ar' ? '🇬🇧' : '🇦🇪'}</span>
            </button>
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
                <button onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full py-2 px-3 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                  {t.nav.signOut}
                </button>
              </>
            )}
          </div>
        )}

        {!sidebarOpen && (
          <div className="p-3 border-t border-slate-700">
            <button onClick={toggle}
              className="w-full flex items-center justify-center py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-base"
              title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}>
              {lang === 'ar' ? '🇬🇧' : '🇦🇪'}
            </button>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-semibold text-slate-800">{pageTitle}</h1>
          {!perms.viewFinancials && role !== 'ADMIN' && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
              🔒 الأرقام المالية مخفية
            </span>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <DashboardInner>{children}</DashboardInner>
    </PermissionsProvider>
  )
}
