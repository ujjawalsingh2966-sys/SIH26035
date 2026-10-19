'use client'

import { Focus, Menu, Minimize2, X } from 'lucide-react'
import { Brand, DashboardScene, NavButton, RoleSelect, ThemeButton, UserSummary, usePrototypeState } from './shared'
import styles from './prototype.module.css'

export default function CommandDeck() {
  const state = usePrototypeState()
  return (
    <div className={`${styles.root} ${styles.commandRoot}`} data-theme={state.theme} data-focused={state.collapsed ? '' : undefined}>
      <a className={styles.skipLink} href="#prototype-main">Skip to content</a>
      <header className={styles.commandHeader}>
        <div className={styles.commandPrimary}>
          <Brand compact={state.collapsed} />
          <nav className={styles.commandNav} aria-label="Primary navigation">
            {state.items.map(item => <NavButton key={item.id} item={item} active={state.active === item.id} compact={state.collapsed} onClick={() => state.setActive(item.id)} />)}
          </nav>
          <div className={styles.commandActions}>
            <RoleSelect role={state.role} setRole={state.setRole} compact />
            <ThemeButton theme={state.theme} setTheme={state.setTheme} label={false} />
            <UserSummary role={state.role} compact />
            <button className={styles.iconAction} onClick={() => state.setCollapsed(!state.collapsed)} aria-label={state.collapsed ? 'Exit focus mode' : 'Enter focus mode'} title={state.collapsed ? 'Exit focus mode' : 'Enter focus mode'}>{state.collapsed ? <Focus size={17} /> : <Minimize2 size={17} />}</button>
            <button className={styles.commandMenu} onClick={() => state.setMobileOpen(true)} aria-expanded={state.mobileOpen} aria-controls="command-mobile-nav" aria-label="Open navigation"><Menu size={20} /></button>
          </div>
        </div>
        {!state.collapsed && <div className={styles.commandContext}><span><strong>Reviewing workspace</strong> · 8 records require attention</span><span>OIML R 76 · Rule set v1.2</span></div>}
      </header>
      {state.mobileOpen && <button className={styles.scrim} onClick={() => state.setMobileOpen(false)} aria-label="Close navigation" />}
      <section id="command-mobile-nav" className={styles.commandSheet} data-mobile-open={state.mobileOpen ? '' : undefined} aria-label="Mobile navigation">
        <div className={styles.sheetHeader}><Brand /><button className={styles.mobileClose} onClick={() => state.setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
        <RoleSelect role={state.role} setRole={state.setRole} />
        <nav className={styles.navList}>{state.items.map(item => <NavButton key={item.id} item={item} active={state.active === item.id} onClick={() => state.setActive(item.id)} />)}</nav>
        <div className={styles.sheetFooter}><ThemeButton theme={state.theme} setTheme={state.setTheme} /><UserSummary role={state.role} /></div>
      </section>
      <DashboardScene active={state.active} role={state.role} variant="Command Deck" />
    </div>
  )
}
