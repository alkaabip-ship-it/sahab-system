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
  HiCog8Tooth, HiSparkles, HiEnvelope, HiUserGroup, HiCalculator,
  HiFlag, HiBars3, HiXMark, HiArchiveBox,
  HiListBullet, HiCpuChip,
} from 'react-icons/hi2'

function LogoBrand() {
  return (
    <div className="relative w-28 h-9 flex-shrink-0">
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

function SidebarNav({ sidebarOpen, onClose }: { sidebarOpen: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const { t, lang } = useTranslation()
  const { data: session } = useSession()
  const perms = usePermissions()
  const role = (session?.user as any)?.role

  const allNavItems = [
    { href: '/dashboard',                 label: t.nav.dashboard,       icon: <HiSquares2X2 size={20} />,           key: 'dashboard' },
    { href: '/dashboard/projects',        label: t.nav.projects,        icon: <HiClipboardDocumentList size={20} />, key: 'projects' },
    { href: '/dashboard/suppliers',       label: t.nav.suppliers,       icon: <HiBuildingOffice2 size={20} />,      key: 'suppliers' },
    { href: '/dashboard/bills',           label: t.nav.bills,           icon: <HiDocumentText size={20} />,         key: 'bills' },
    { href: '/dashboard/clients',         label: t.nav.clients,         icon: <HiUsers size={20} />,                key: 'clients' },
    { href: '/dashboard/reports',         label: t.nav.reports,         icon: <HiChartBarSquare size={20} />,       key: 'reports' },
    { href: '/dashboard/admin',           label: t.nav.admin,           icon: <HiCog6Tooth size={20} />,            key: 'admin' },
    { href: '/dashboard/planning',        label: t.nav.planning,        icon: <HiCalculator size={20} />,           key: 'planning' },
    { href: '/dashboard/upload-bill',     label: t.nav.uploadBill,      icon: <HiSparkles size={20} />,             key: 'uploadBill' },
    { href: '/dashboard/communications',  label: t.nav.communications,  icon: <HiEnvelope size={20} />,             key: 'communications' },
    { href: '/dashboard/event-management',label: t.nav.eventManagement, icon: <HiFlag size={20} />,                 key: 'eventManagement' },
    { href: '/dashboard/inventory',       label: t.nav.inventory,       icon: <HiArchiveBox size={20} />,           key: 'inventory' },
    { href: '/dashboard/tasks',           label: t.nav.tasks,           icon: <HiListBullet size={20} />,           key: 'tasks' },
    { href: '/dashboard/users',           label: 'المستخدمون',          icon: <HiUserGroup size={20} />,            key: '__admin_only__' },
    { href: '/dashboard/agent',           label: lang === 'ar' ? 'الوكيل الذكي' : 'AI Agent', icon: <HiCpuChip size={20} />, key: '__admin_only__' },
    { href: '/dashboard/settings',        label: t.nav.settings,        icon: <HiCog8Tooth size={20} />,            key: 'settings' },
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
          onClick={onClose}
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
  const { t, lang, toggle } = useTranslation()
  const perms = usePermissions()
  const role = (session?.user as any)?.role

  // Desktop: collapsed/expanded sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Mobile: drawer open/closed
  const [mobileOpen, setMobileOpen] = useState(false)
  // JS-based mobile detection — reads window immediately on first client render
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 1024
    return false
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

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
    : pathname.startsWith('/dashboard/upload-bill') ? t.nav.uploadBill
    : pathname.startsWith('/dashboard/communications') ? t.nav.communications
    : pathname.startsWith('/dashboard/users') ? 'المستخدمون'
    : pathname.startsWith('/dashboard/planning') ? t.nav.planning
    : pathname.startsWith('/dashboard/event-management') ? t.nav.eventManagement
    : pathname.startsWith('/dashboard/inventory')   ? t.nav.inventory
    : pathname.startsWith('/dashboard/tasks')       ? t.nav.tasks
    : pathname.startsWith('/dashboard/agent')       ? (lang === 'ar' ? 'الوكيل الذكي' : 'AI Agent')
    : t.nav.settings

  /* ── Shared sidebar inner content ── */
  const SidebarContent = ({ isDrawer = false }: { isDrawer?: boolean }) => (
    <>
      {/* Header */}
      <div className={`flex items-center border-b border-slate-700 ${
        isDrawer ? 'p-4 justify-between' : sidebarOpen ? 'p-4 justify-between' : 'p-3 justify-center'
      }`}>
        {(isDrawer || sidebarOpen) ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <LogoBrand />
            <p className="text-xs text-slate-400 leading-tight truncate">
              {lang === 'ar' ? 'نظام سحاب' : 'Sahab System'}
            </p>
          </div>
        ) : (
          <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">س</span>
          </div>
        )}
        {isDrawer ? (
          <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white p-1 rounded flex-shrink-0">
            <HiXMark size={22} />
          </button>
        ) : (
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white p-1 rounded flex-shrink-0">
            {sidebarOpen ? (lang === 'ar' ? '◀' : '▶') : (lang === 'ar' ? '▶' : '◀')}
          </button>
        )}
      </div>

      <SidebarNav
        sidebarOpen={isDrawer ? true : sidebarOpen}
        onClose={isDrawer ? () => setMobileOpen(false) : undefined}
      />

      {/* Footer */}
      {(isDrawer || sidebarOpen) ? (
        <div className="p-4 border-t border-slate-700 space-y-3">
          <button onClick={toggle}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-sm">
            <span className="text-slate-300">{lang === 'ar' ? 'English' : 'العربية'}</span>
            <span className="text-base">{lang === 'ar' ? '🇬🇧' : '🇦🇪'}</span>
          </button>
          {session?.user && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
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
      ) : (
        <div className="p-3 border-t border-slate-700 space-y-2">
          <button onClick={toggle}
            className="w-full flex items-center justify-center py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-base"
            title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}>
            {lang === 'ar' ? '🇬🇧' : '🇦🇪'}
          </button>
        </div>
      )}
    </>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── CSS: force-hide desktop sidebar on small screens ──────────── */}
      <style>{`
        @media (max-width: 1023px) {
          .sahab-desktop-sidebar { display: none !important; }
          .sahab-hamburger        { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .sahab-mobile-drawer    { display: none !important; }
          .sahab-mobile-backdrop  { display: none !important; }
          .sahab-hamburger        { display: none !important; }
        }
      `}</style>

      {/* ── Mobile backdrop ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="sahab-mobile-backdrop fixed inset-0 bg-black/60 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer (always in DOM, slides in/out) ──────────────── */}
      <aside
        className="sahab-mobile-drawer fixed inset-y-0 z-40 w-72 bg-slate-800 text-white flex flex-col transition-transform duration-300"
        style={{ left: 0, transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <SidebarContent isDrawer={true} />
      </aside>

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className={`
        sahab-desktop-sidebar flex flex-col
        ${sidebarOpen ? 'w-64' : 'w-16'}
        bg-slate-800 text-white transition-all duration-300 flex-shrink-0
      `}>
        <SidebarContent isDrawer={false} />
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — shown via CSS on mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="sahab-hamburger text-slate-600 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 flex-shrink-0"
              style={{ display: 'none' }}
            >
              <HiBars3 size={24} />
            </button>
            <h1 className="text-base md:text-lg font-semibold text-slate-800 truncate">{pageTitle}</h1>
          </div>
          {!perms.viewFinancials && role !== 'ADMIN' && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
              🔒 <span className="hidden sm:inline">الأرقام المالية مخفية</span>
            </span>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-3 md:p-6 animate-fade-in">{children}</main>
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
