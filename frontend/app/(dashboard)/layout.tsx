"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api, User as AccountUser } from '../lib/api'
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

import { AccountContext } from '../lib/account-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [error, setError] = useState('')
  const [demoRemaining, setDemoRemaining] = useState<number | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    const expired = () => router.replace('/login')
    const demoExpired = () => router.replace('/')
    window.addEventListener('demo-expired', demoExpired)
    const demoState = sessionStorage.getItem('w8lab_evaluator_demo')
    let timeout: ReturnType<typeof setTimeout> | undefined
    let ticker: ReturnType<typeof setInterval> | undefined
    if (demoState) {
      try {
        const metadata = JSON.parse(demoState)
        const expiry = Date.parse(metadata.expiresAt)
        if (Number.isFinite(expiry)) {
          const evaluate = () => {
            const remaining = Math.max(0, Math.ceil((expiry - Date.now()) / 1000))
            setDemoRemaining(remaining)
            if (remaining === 0) {
              localStorage.removeItem('nawi_token')
              sessionStorage.removeItem('w8lab_evaluator_demo')
              sessionStorage.setItem('w8lab_demo_expired_notice', '1')
              router.replace('/')
            }
          }
          evaluate()
          ticker = setInterval(evaluate, 1000)
        }
      } catch { sessionStorage.removeItem('w8lab_evaluator_demo') }
    }
    const focusCheck = () => {
      if (demoState) api('/auth/me').catch(() => {})
    }
    window.addEventListener('focus', focusCheck)
    window.addEventListener('session-expired', expired)
    if (!localStorage.getItem('nawi_token')) expired()
    else api<AccountUser>('/auth/me').then(setUser).catch(e => setError(e.message))
    return () => {
      window.removeEventListener('session-expired', expired)
      window.removeEventListener('demo-expired', demoExpired)
      window.removeEventListener('focus', focusCheck)
      if (ticker) clearInterval(ticker)
      if (timeout) clearTimeout(timeout)
    }
  }, [router])
  const laboratory = !!user && ['Technician', 'Reviewer', 'Administrator'].includes(user.role)
  const allowed = !!user && (pathname === '/applications' || pathname.startsWith('/applications/') ||
    (pathname === '/staff' ? user.role === 'Administrator' : laboratory))
  useEffect(() => {
    if (user && !allowed) router.replace('/applications')
  }, [user, allowed, router])
  function logout() {
    localStorage.removeItem('nawi_token')
    router.replace('/login')
  }
  if (!user || !allowed) return (
    <main className="p-8">
      <p role="status">{error || 'Loading your workspace…'}</p>
      {error && <button onClick={logout} className="underline">Return to sign in</button>}
    </main>
  )
  const userRole = user.role
  const navItems = [
    { name: 'Applications', href: '/applications', icon: FileText },
    ...(user.role === 'Administrator' ? [{ name: 'Staff accounts', href: '/staff', icon: User }] : []),
    ...(laboratory ? [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Instruments', href: '/instruments', icon: Scale },
      { name: 'Evaluation Queue', href: '/tests', icon: ClipboardList },
    ] : []),
  ]

  return (
    <AccountContext.Provider value={user}>
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <div className="w-64 hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white leading-tight">W8Lab</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">NAWI Verification</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</div>
          {navItems.map((item) => (
            <Link
              key={item.name}
              aria-current={pathname === item.href ? 'page' : undefined}
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
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{user.name} · {userRole}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          {user.email.endsWith('@demo.w8lab.test') && <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">Switch Demo Role</Link>}
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20">
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dashboard</h2>
              <p className="text-xs text-slate-500 hidden lg:block">Legal Metrology Compliance Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">System Operational</span>
            </div>
            {user.email.endsWith('@demo.w8lab.test') && <Link href="/" className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">Switch Demo Role</Link>}
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <nav aria-label="Mobile navigation" className="md:hidden flex gap-3 overflow-x-auto p-3 border-b">
          {navItems.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className="whitespace-nowrap text-sm text-indigo-700">{item.name}</Link>)}
        </nav>
        {user.email.endsWith('@demo.w8lab.test') && demoRemaining !== null && <div role="timer" className="px-4 py-2 text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100">Demo expires in {String(Math.floor(demoRemaining / 3600)).padStart(2, '0')}:{String(Math.floor(demoRemaining % 3600 / 60)).padStart(2, '0')}:{String(demoRemaining % 60).padStart(2, '0')}</div>}
        {user.email.endsWith('@demo.w8lab.test') && <div role='status' className='px-4 py-2 text-xs bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100'>SIH Evaluator Demo — sample data only, not an official report environment</div>}
        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
    </AccountContext.Provider>
  )
}
