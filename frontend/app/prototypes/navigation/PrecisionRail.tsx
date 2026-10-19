'use client'

import { ChevronLeft, ChevronRight, Menu, PanelLeftClose, X } from 'lucide-react'
import { Brand, DashboardScene, NavButton, RoleSelect, ThemeButton, UserSummary, usePrototypeState } from './shared'
import styles from './prototype.module.css'

export default function PrecisionRail() {
  const state = usePrototypeState()
  return (
    <div className={`${styles.root} ${styles.precisionRoot}`} data-theme={state.theme}>
      <a className={styles.skipLink} href="#prototype-main">Skip to content</a>
      <div className={styles.mobileBar}>
        <Brand />
        <button className={styles.mobileMenuButton} onClick={() => state.setMobileOpen(true)} aria-expanded={state.mobileOpen} aria-controls="precision-mobile-nav" aria-label="Open navigation"><Menu size={20} /></button>
      </div>
      {state.mobileOpen && <button className={styles.scrim} onClick={() => state.setMobileOpen(false)} aria-label="Close navigation" />}
      <aside id="precision-mobile-nav" className={styles.precisionRail} data-collapsed={state.collapsed ? '' : undefined} data-mobile-open={state.mobileOpen ? '' : undefined} aria-label="Primary navigation">
        <div className={styles.railBrandRow}><Brand compact={state.collapsed} /><button className={styles.collapseButton} onClick={() => state.setCollapsed(!state.collapsed)} aria-label={state.collapsed ? 'Expand navigation' : 'Collapse navigation'}>{state.collapsed ? <ChevronRight size={17} /> : <PanelLeftClose size={17} />}</button><button className={styles.mobileClose} onClick={() => state.setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
        <div className={styles.railRole}><RoleSelect role={state.role} setRole={state.setRole} compact={state.collapsed} /></div>
        <nav className={styles.navList}>{state.items.map(item => <NavButton key={item.id} item={item} active={state.active === item.id} compact={state.collapsed} onClick={() => state.setActive(item.id)} />)}</nav>
        <div className={styles.railFooter}><ThemeButton theme={state.theme} setTheme={state.setTheme} label={!state.collapsed} /><UserSummary role={state.role} compact={state.collapsed} /></div>
      </aside>
      <div className={styles.precisionMain}>
        <div className={styles.utilityBar}><span>W8LAB laboratory workspace</span><span className={styles.operationalDot}>Systems operational</span></div>
        <DashboardScene active={state.active} role={state.role} variant="Precision Rail" />
      </div>
    </div>
  )
}
