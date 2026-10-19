'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  ChevronRight,
  ClipboardList,
  Files,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Scale,
  User,
  X,
} from 'lucide-react'
import { getSession } from '@/lib/laboratory'
import type { Session } from '@/lib/laboratory'
import { DashboardSessionContext } from '@/lib/dashboardSession'
import { logout, verifySession } from '@/lib/session'
import styles from './dashboard-shell.module.css'

type NavItem = {
  name: string
  href: string
  icon: typeof LayoutDashboard
  matches?: string[]
}

const staffNavigation: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Instruments', href: '/instruments', icon: Scale },
  { name: 'Manufacturers', href: '/manufacturers', icon: Files },
  { name: 'Evaluation queue', href: '/tests', icon: ClipboardList, matches: ['/test-cases'] },
  { name: 'Reports', href: '/reports', icon: FileText },
]

const businessNavigation: NavItem[] = [
  { name: 'Applications', href: '/applications', icon: Files },
  { name: 'Account', href: '/account', icon: User },
]

function isCurrentRoute(pathname: string, item: NavItem) {
  return pathname === item.href
    || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
    || !!item.matches?.some((path) => pathname.startsWith(path))
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const logoutPending = useRef(false)

  useEffect(() => {
    let alive = true
    const refreshSession = async () => {
      const requestedToken = localStorage.getItem('nawi_token')
      const current = getSession()
      if (!current) { if (alive) { setSession(null); router.replace('/login') }; return }
      try {
        const verified = await verifySession()
        if (alive && localStorage.getItem('nawi_token') === requestedToken) { setSession({ ...current, ...verified }); setSessionError('') }
      } catch (error) {
        if (alive) { setSession(null); setSessionError(error instanceof Error ? error.message : 'Session verification failed.') }
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'nawi_token' || event.key === null) refreshSession()
    }
    refreshSession()
    const invalid = () => { setSession(null); router.replace('/login') }
    window.addEventListener('w8lab-session-invalid', invalid)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refreshSession)
    window.addEventListener('pageshow', refreshSession)
    const interval = window.setInterval(refreshSession, 60000)
    return () => {
      alive = false
      window.clearInterval(interval)
      window.removeEventListener('w8lab-session-invalid', invalid)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refreshSession)
      window.removeEventListener('pageshow', refreshSession)
    }
  }, [pathname, router])

  useEffect(() => setMobileOpen(false), [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  const navItems = useMemo(
    () => session?.role === 'Business' ? businessNavigation : session ? [...staffNavigation,
      ...(session.role === 'Administrator' ? [{ name: 'Staff accounts', href: '/staff', icon: User }] : [])] : [],
    [session],
  )
  const userRole = session?.role || 'Loading session…'
  const homeHref = session?.role === 'Business' ? '/applications' : '/dashboard'
  const businessRoute = pathname === '/account' || pathname === '/applications' || pathname.startsWith('/applications/')
  const currentPage = navItems.find((item) => isCurrentRoute(pathname, item))?.name
    || (session?.role === 'Business' ? 'Business account' : 'Laboratory workspace')

  const signOut = async () => {
    if (logoutPending.current) return
    logoutPending.current = true
    setSigningOut(true)
    try { await logout(); setSession(null); router.replace('/login') }
    catch { setSessionError('Sign out could not be confirmed. Check your connection and retry.') }
    finally { logoutPending.current = false; setSigningOut(false) }
  }

  return (
    <DashboardSessionContext.Provider value={session}>
      <div className={styles.shell} data-collapsed={collapsed ? '' : undefined}>
        <a className={styles.skipLink} href="#main-content">Skip to content</a>

        <header className={styles.mobileHeader}>
          <Brand href={homeHref} />
          <button className={styles.iconButton} type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="primary-navigation">
            <Menu aria-hidden="true" />
          </button>
        </header>

        {mobileOpen && <button className={styles.scrim} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

        <aside id="primary-navigation" className={styles.rail} data-mobile-open={mobileOpen ? '' : undefined} aria-label="Primary navigation">
          <div className={styles.brandRow}>
            <Brand compact={collapsed} href={homeHref} />
            <button className={`${styles.iconButton} ${styles.collapseButton}`} type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
              {collapsed ? <ChevronRight aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
            <button className={`${styles.iconButton} ${styles.mobileClose}`} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X aria-hidden="true" />
            </button>
          </div>

          {!collapsed && <div className={styles.roleContext}><span>Current workspace</span><strong>{userRole}</strong></div>}

          <nav className={styles.navList} aria-label="Workspace">
            {navItems.map((item) => {
              const active = isCurrentRoute(pathname, item)
              return (
                <Link key={item.name} href={item.href} className={styles.navLink} data-active={active ? '' : undefined} aria-current={active ? 'page' : undefined} title={collapsed ? item.name : undefined}>
                  <item.icon aria-hidden="true" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          <div className={styles.railFooter}>
            <div className={styles.userSummary} title={collapsed ? `${userRole} · ${session?.email || ''}` : undefined}>
              <span className={styles.avatar}>{userRole.charAt(0)}</span>
              {!collapsed && <span className={styles.userCopy}><strong>{userRole}</strong><small>{session?.email}</small></span>}
            </div>
            <button className={styles.signOut} type="button" disabled={signingOut} onClick={signOut} title={collapsed ? 'Sign out' : undefined}>
              <LogOut aria-hidden="true" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>

        <div className={styles.workspace}>
          <div className={styles.utilityBar}>
            <div><strong>{currentPage}</strong><span>Legal Metrology Compliance Platform</span></div>
            <span className={styles.systemStatus}><Activity aria-hidden="true" /> System operational</span>
          </div>

          <main id="main-content" className={styles.main} tabIndex={-1}>
            <div className={styles.content}>
              {sessionError && <p role="alert" className="mb-4 text-rose-800 dark:text-rose-200">{sessionError} <button className="underline" onClick={() => window.location.reload()}>Retry</button></p>}
              {!session ? <p role="status">{sessionError ? 'Session could not be verified.' : 'Loading session…'}</p> : pathname === '/staff' && session.role !== 'Administrator' ? (
                <p role="alert">Access denied. Staff management requires an Administrator account.</p>
              ) : session.role === 'Business' && !businessRoute ? (
                <div><p role="alert">Access denied. This page is for laboratory staff.</p><Link href="/applications" className={styles.inlineLink}>Go to your applications</Link></div>
              ) : session.role !== 'Business' && businessRoute ? (
                <div><p role="alert">Access denied. Business applications require a Business account.</p><Link href="/dashboard" className={styles.inlineLink}>Go to the laboratory workspace</Link></div>
              ) : children}
            </div>
          </main>
        </div>
      </div>
    </DashboardSessionContext.Provider>
  )
}

function Brand({ compact = false, href }: { compact?: boolean; href: string }) {
  return (
    <Link className={styles.brand} href={href} aria-label="W8LAB home">
      <span className={styles.brandMark}><Scale aria-hidden="true" /></span>
      {!compact && <span className={styles.brandCopy}><strong>W8LAB</strong><small>Inspection workspace</small></span>}
    </Link>
  )
}
