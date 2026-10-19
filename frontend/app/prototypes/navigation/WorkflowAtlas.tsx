'use client'

import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { Brand, DashboardScene, NavButton, RoleSelect, ThemeButton, UserSummary, usePrototypeState } from './shared'
import styles from './prototype.module.css'

export default function WorkflowAtlas() {
  const state = usePrototypeState()
  const primary = state.items.filter(item => ['overview', 'account'].includes(item.id))
  const workflow = state.items.filter(item => ['instruments', 'queue'].includes(item.id))
  const records = state.items.filter(item => item.id === 'reports')
  const groups = [{ label: 'Workspace', items: primary }, { label: 'Laboratory workflow', items: workflow }, { label: 'Records', items: records }].filter(group => group.items.length)
  return (
    <div className={`${styles.root} ${styles.atlasRoot}`} data-theme={state.theme}>
      <a className={styles.skipLink} href="#prototype-main">Skip to content</a>
      <div className={styles.mobileBar}><Brand /><button className={styles.mobileMenuButton} onClick={() => state.setMobileOpen(true)} aria-expanded={state.mobileOpen} aria-controls="atlas-mobile-nav" aria-label="Open navigation"><Menu size={20} /></button></div>
      {state.mobileOpen && <button className={styles.scrim} onClick={() => state.setMobileOpen(false)} aria-label="Close navigation" />}
      <aside id="atlas-mobile-nav" className={styles.atlasSidebar} data-collapsed={state.collapsed ? '' : undefined} data-mobile-open={state.mobileOpen ? '' : undefined} aria-label="Primary navigation">
        <div className={styles.atlasTop}><Brand compact={state.collapsed} /><button className={styles.mobileClose} onClick={() => state.setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
        {!state.collapsed && <div className={styles.labIdentity}><span>North regional laboratory</span><strong>Verification desk 02</strong></div>}
        <nav className={styles.atlasNav}>{groups.map(group => <section key={group.label}><h2 className={styles.groupLabel}>{state.collapsed ? <span className={styles.groupRule} /> : group.label}</h2>{group.items.map(item => <NavButton key={item.id} item={item} active={state.active === item.id} compact={state.collapsed} showDescription onClick={() => state.setActive(item.id)} />)}</section>)}</nav>
        <div className={styles.atlasFooter}><RoleSelect role={state.role} setRole={state.setRole} compact={state.collapsed} /><ThemeButton theme={state.theme} setTheme={state.setTheme} label={!state.collapsed} /><UserSummary role={state.role} compact={state.collapsed} /></div>
        <button className={styles.atlasCollapse} onClick={() => state.setCollapsed(!state.collapsed)} aria-label={state.collapsed ? 'Expand navigation' : 'Collapse navigation'}>{state.collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Collapse</span></>}</button>
      </aside>
      <div className={styles.atlasMain}>
        <div className={styles.atlasUtility}><span>Friday, 17 October</span><span className={styles.operationalDot}>3 reviewers online</span></div>
        <DashboardScene active={state.active} role={state.role} variant="Workflow Atlas" />
      </div>
    </div>
  )
}
