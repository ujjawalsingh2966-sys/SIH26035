"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowUpRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  UserRound,
  X
} from "lucide-react"
import { api, User as AccountUser } from "../lib/api"
import { AccountContext } from "../lib/account-context"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AccountUser | null>(null)
  const [error, setError] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const expired = () => router.replace("/login")
    window.addEventListener("session-expired", expired)
    if (!localStorage.getItem("nawi_token")) {
      expired()
    } else {
      api<AccountUser>("/auth/me")
        .then(setUser)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Unable to load your account.")
        })
    }
    return () => window.removeEventListener("session-expired", expired)
  }, [router])

  const laboratory = !!user && ["Technician", "Reviewer", "Administrator"].includes(user.role)
  const inApplications = pathname === "/applications" || pathname.startsWith("/applications/")
  const allowed = !!user && (inApplications || (pathname === "/staff" ? user.role === "Administrator" : laboratory))

  useEffect(() => {
    if (user && !allowed) router.replace("/applications")
  }, [user, allowed, router])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function logout() {
    localStorage.removeItem("nawi_token")
    router.replace("/login")
  }

  if (!user || !allowed) {
    return (
      <main className="w8-gate" role="status">
        <div className="w8-gate-mark"><Scale size={28} aria-hidden="true" /></div>
        <h1>Opening your workspace</h1>
        <p>{error || "Checking your account and permissions…"}</p>
        {error && <button className="w8-text-action" onClick={logout}>Return to sign in</button>}
      </main>
    )
  }

  const navItems = [
    { name: "Applications", href: "/applications", icon: FileText },
    ...(user.role === "Administrator" ? [{ name: "Staff accounts", href: "/staff", icon: UserRound }] : []),
    ...(laboratory ? [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Instruments", href: "/instruments", icon: Scale },
      { name: "Evaluation queue", href: "/tests", icon: ClipboardList }
    ] : [])
  ]

  const activeItem = navItems.find(item => pathname === item.href || pathname.startsWith(item.href + "/"))
  const pageName = activeItem?.name ?? "Workspace"

  return (
    <AccountContext.Provider value={user}>
      <div className="w8-workspace">
        <aside className="w8-sidebar" aria-label="Workspace navigation">
          <div className="w8-brand">
            <div className="w8-brand-symbol" aria-hidden="true"><Scale size={25} strokeWidth={1.75} /></div>
            <div>
              <strong>W8LAB<span className="w8-brand-period">.</span></strong>
              <small>Legal metrology / NAWI</small>
            </div>
          </div>

          <div className="w8-sidebar-label">Workspace</div>
          <nav className="w8-desktop-nav" aria-label="Primary navigation">
            {navItems.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link href={item.href} key={item.href} aria-current={active ? "page" : undefined} className={active ? "w8-nav-link is-active" : "w8-nav-link"}>
                  <item.icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span>{item.name}</span>
                  {active && <span className="w8-nav-marker" aria-hidden="true" />}
                </Link>
              )
            })}
          </nav>

          <div className="w8-sidebar-end">
            <div className="w8-workspace-note">
              <span className="w8-note-rule" aria-hidden="true" />
              <span>Evidence-led instrument evaluation and verification workflows.</span>
            </div>
            <div className="w8-profile">
              <div className="w8-avatar" aria-hidden="true">{user.name?.charAt(0)?.toUpperCase() || "W"}</div>
              <div className="w8-profile-info">
                <strong>{user.name}</strong>
                <span>{user.role}</span>
                <small title={user.email}>{user.email}</small>
              </div>
            </div>
            <button type="button" className="w8-signout" onClick={logout}><LogOut size={17} aria-hidden="true" /> Sign out <ArrowUpRight size={15} aria-hidden="true" /></button>
          </div>
        </aside>

        <div className="w8-app-shell">
          <header className="w8-topbar">
            <div className="w8-topbar-start">
              <button type="button" className="w8-mobile-toggle" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="w8-mobile-navigation" onClick={() => setMobileOpen(open => !open)}>
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
              <div className="w8-topbar-breadcrumb"><span>W8LAB</span><span className="w8-crumb-separator">/</span><strong>{pageName}</strong></div>
            </div>
            <div className="w8-topbar-end"><span className="w8-role-tag">{user.role}</span><button type="button" className="w8-mobile-signout" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button></div>
          </header>

          <nav id="w8-mobile-navigation" aria-label="Mobile navigation" className={mobileOpen ? "w8-mobile-nav is-open" : "w8-mobile-nav"}>
            {navItems.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/")
              return <Link href={item.href} onClick={() => setMobileOpen(false)} key={item.href} aria-current={active ? "page" : undefined} className={active ? "w8-mobile-link is-active" : "w8-mobile-link"}><item.icon size={17} aria-hidden="true" />{item.name}</Link>
            })}
          </nav>

          <main className="w8-app-main"><div className="w8-app-content">{children}</div></main>
        </div>
      </div>
    </AccountContext.Provider>
  )
}
