'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSession } from '@/lib/laboratory'
import type { Session } from '@/lib/laboratory'
import { DashboardSessionContext } from '@/lib/dashboardSession'
import {
  LayoutDashboard,
  Scale,
  ClipboardList,
  User,
  Settings,
  LogOut,
  Activity,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    const refreshSession = () => {
      const current = getSession()
      setSession(current)
      if (!current) router.replace('/login')
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'nawi_token' || event.key === null) refreshSession()
    }
    refreshSession()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refreshSession)
    window.addEventListener('pageshow', refreshSession)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refreshSession)
      window.removeEventListener('pageshow', refreshSession)
    }
  }, [pathname, router])
  const userRole = session?.role || 'Loading session…'
  const signOut = () => { setSession(null); localStorage.removeItem('nawi_token'); router.replace('/login') }

  const navItems = session?.role === 'Business' ? [
    { name: 'Account', href: '/account', icon: User },
  ] : !session ? [] : [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Instruments', href: '/instruments', icon: Scale },
    { name: 'Evaluation Queue', href: '/tests', icon: ClipboardList },
    { name: 'Reports', href: '/reports', icon: FileText },
  ]

  return (
    <DashboardSessionContext.Provider value={session}>
    <div className="mesh-background flex h-screen">
      {/* Sidebar */}
      <div className="w-64 hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white leading-tight">ANCRS</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nawi System</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</div>
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                "text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <item.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* User Role & Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-medium text-sm">
              {userRole.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{userRole}</p>
              <p className="text-[10px] text-slate-500 truncate">{session?.email}</p>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col md:overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300">
              <LayoutDashboard className="w-6 h-6" />
            </button>
            <div className="hidden md:block">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{session?.role === 'Business' ? 'Business account' : 'Dashboard'}</h2>
              <p className="text-xs text-slate-500 hidden lg:block">Legal Metrology Compliance Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session && session.role !== 'Business' && <Link href="/reports" className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 md:hidden" aria-label="Reports">
              <FileText className="h-4 w-4" />Reports
            </Link>}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">System Operational</span>
            </div>
            <button onClick={signOut} aria-label="Sign Out" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-transparent">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {!session ? <p role="status" className="text-slate-900 dark:text-slate-100">Loading session…</p> : session.role === 'Business' && pathname !== '/account' ? (
              <div className="text-slate-900 dark:text-slate-100"><p role="alert">Access denied. This page is for laboratory staff.</p><Link href="/account" className="inline-block mt-3 text-indigo-700 dark:text-indigo-300 underline">Go to your account</Link></div>
            ) : children}
          </div>
        </main>
      </div>
    </div>
    </DashboardSessionContext.Provider>
  )
}
