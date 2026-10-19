'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Moon,
  Scale,
  Sun,
  UserRound,
} from 'lucide-react'
import styles from './prototype.module.css'

export type PrototypeRole = 'Technician' | 'Reviewer' | 'Administrator' | 'Business'
export type Theme = 'light' | 'dark'

export type NavItem = {
  id: string
  label: string
  shortLabel: string
  description: string
  icon: typeof LayoutDashboard
  count?: number
}

const staffItems: NavItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Home', description: 'Workload and laboratory health', icon: LayoutDashboard },
  { id: 'instruments', label: 'Instruments', shortLabel: 'Instruments', description: 'Registered NAWI inventory', icon: Scale },
  { id: 'queue', label: 'Evaluation queue', shortLabel: 'Queue', description: 'Testing and review lifecycle', icon: ClipboardCheck, count: 8 },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', description: 'Authorized approved records', icon: FileText },
]

const businessItems: NavItem[] = [
  { id: 'account', label: 'Business account', shortLabel: 'Account', description: 'Identity and account details', icon: Building2 },
]

export function usePrototypeState(defaultActive = 'overview') {
  const [role, setRole] = useState<PrototypeRole>('Reviewer')
  const [active, setActive] = useState(defaultActive)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const items = useMemo(() => {
    if (role === 'Business') return businessItems
    if (role === 'Technician') return staffItems
    return staffItems.filter(item => item.id !== 'instruments')
  }, [role])

  useEffect(() => {
    if (!items.some(item => item.id === active)) setActive(items[0].id)
  }, [active, items])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return {
    role,
    setRole,
    active,
    setActive: (value: string) => { setActive(value); setMobileOpen(false) },
    collapsed,
    setCollapsed,
    mobileOpen,
    setMobileOpen,
    theme,
    setTheme,
    items,
  }
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={styles.brand} aria-label="W8LAB">
      <span className={styles.brandMark}><Scale size={18} strokeWidth={2.2} /></span>
      {!compact && <span><strong>W8LAB</strong><small>NAWI inspection</small></span>}
    </div>
  )
}

export function RoleSelect({ role, setRole, compact = false }: { role: PrototypeRole; setRole: (role: PrototypeRole) => void; compact?: boolean }) {
  return (
    <label className={compact ? styles.compactRole : styles.roleControl}>
      {!compact && <span>Preview role</span>}
      <select value={role} onChange={event => setRole(event.target.value as PrototypeRole)} aria-label="Preview role">
        <option>Technician</option>
        <option>Reviewer</option>
        <option>Administrator</option>
        <option>Business</option>
      </select>
    </label>
  )
}

export function ThemeButton({ theme, setTheme, label = true }: { theme: Theme; setTheme: (theme: Theme) => void; label?: boolean }) {
  const Icon = theme === 'light' ? Moon : Sun
  return (
    <button className={styles.iconAction} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Use ${theme === 'light' ? 'dark' : 'light'} theme`}>
      <Icon size={17} />{label && <span>{theme === 'light' ? 'Dark' : 'Light'}</span>}
    </button>
  )
}

const sampleRows = [
  { id: 'TC-2847', instrument: 'Bench scale MX-15', owner: 'A. Sharma', className: 'III', updated: '9 min', status: 'Ready for review', tone: 'amber' },
  { id: 'TC-2843', instrument: 'Precision balance PX-220', owner: 'R. Mehta', className: 'II', updated: '24 min', status: 'Under review', tone: 'violet' },
  { id: 'TC-2838', instrument: 'Retail scale RS-30', owner: 'K. Rao', className: 'III', updated: '1 hr', status: 'Correction requested', tone: 'rose' },
  { id: 'TC-2829', instrument: 'Platform scale PL-600', owner: 'N. Das', className: 'IIII', updated: 'Yesterday', status: 'Approved', tone: 'green' },
]

const screenTitles: Record<string, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'Laboratory operations', title: 'Overview', description: 'Review workload, testing progress and records that need attention.' },
  instruments: { eyebrow: 'Instrument registry', title: 'Instruments', description: 'Find registered NAWI equipment and start an authorized test case.' },
  queue: { eyebrow: 'Evaluation lifecycle', title: 'Evaluation queue', description: 'Prioritize records across testing, review, correction and approval.' },
  reports: { eyebrow: 'Approved records', title: 'Reports', description: 'Preview and download reports you are authorized to access.' },
  account: { eyebrow: 'Business identity', title: 'Account', description: 'Review the persisted Business account details for this prototype.' },
}

export function DashboardScene({ active, role, variant }: { active: string; role: PrototypeRole; variant: string }) {
  const screen = screenTitles[active] || screenTitles.overview
  const business = role === 'Business'
  return (
    <main className={styles.dashboardScene} id="prototype-main" tabIndex={-1}>
      <div className={styles.sampleFlag}><Gauge size={14} /> Prototype · Sample data · {variant}</div>
      <header className={styles.sceneHeader}>
        <div>
          <p className={styles.eyebrow}>{screen.eyebrow}</p>
          <h1>{screen.title}</h1>
          <p>{screen.description}</p>
        </div>
        {!business && <button className={styles.primaryAction}>{role === 'Technician' ? 'Register instrument' : 'Open review queue'}</button>}
      </header>

      {business ? <BusinessSample /> : <LaboratorySample />}
    </main>
  )
}

function LaboratorySample() {
  return (
    <>
      <section className={styles.metricGrid} aria-label="Sample laboratory metrics">
        <article className={styles.metricCard}><span>Ready for review</span><strong>08</strong><small>3 due today</small></article>
        <article className={styles.metricCard}><span>Testing</span><strong>14</strong><small>Across 4 technicians</small></article>
        <article className={styles.metricCard}><span>Returned</span><strong>03</strong><small>Corrections pending</small></article>
        <article className={styles.metricCard}><span>Approved this week</span><strong>27</strong><small>96% first-pass review</small></article>
      </section>

      <section className={styles.queueCard}>
        <div className={styles.cardHeading}>
          <div><p className={styles.eyebrow}>Priority work</p><h2>Evaluation queue</h2></div>
          <button className={styles.secondaryAction}>View all records</button>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Test case</th><th>Instrument</th><th>Class</th><th>Owner</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>{sampleRows.map(row => <tr key={row.id}><td><strong>{row.id}</strong></td><td>{row.instrument}</td><td>{row.className}</td><td>{row.owner}</td><td><span className={styles.status} data-tone={row.tone}>{row.status}</span></td><td>{row.updated}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className={styles.detailGrid}>
        <article><p className={styles.eyebrow}>Current standard</p><h3>OIML R 76 · Rule set v1.2</h3><p>Saved evaluations remain bound to the rule version used at calculation time.</p></article>
        <article><p className={styles.eyebrow}>System status</p><h3><CheckCircle2 size={18} /> Operational</h3><p>Calculation, review and report services are available.</p></article>
      </section>
    </>
  )
}

function BusinessSample() {
  return (
    <section className={styles.accountCard}>
      <div className={styles.accountAvatar}><UserRound size={28} /></div>
      <div><p className={styles.eyebrow}>Sample Business account</p><h2>Northstar Weighing Services</h2><dl><div><dt>Email</dt><dd>operations@example.test</dd></div><div><dt>Account type</dt><dd>Business</dd></div><div><dt>Application workflow</dt><dd>Not implemented in this build</dd></div></dl></div>
    </section>
  )
}

export function NavButton({ item, active, compact, onClick, showDescription = false }: { item: NavItem; active: boolean; compact?: boolean; onClick: () => void; showDescription?: boolean }) {
  const Icon = item.icon
  return (
    <button className={styles.navButton} data-active={active ? '' : undefined} aria-current={active ? 'page' : undefined} onClick={onClick} title={compact ? item.label : undefined}>
      <Icon size={19} aria-hidden="true" />
      {!compact && <span className={styles.navCopy}><strong>{item.label}</strong>{showDescription && <small>{item.description}</small>}</span>}
      {!compact && item.count !== undefined && <span className={styles.count}>{item.count}</span>}
    </button>
  )
}

export function UserSummary({ role, compact = false }: { role: PrototypeRole; compact?: boolean }) {
  return (
    <div className={styles.userSummary} title={compact ? role : undefined}>
      <span className={styles.avatar}>{role.charAt(0)}</span>
      {!compact && <span><strong>{role}</strong><small>{role === 'Business' ? 'operations@example.test' : 'reviewer@example.test'}</small></span>}
    </div>
  )
}
