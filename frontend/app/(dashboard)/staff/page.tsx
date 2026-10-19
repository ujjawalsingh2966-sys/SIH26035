'use client'
import { useEffect, useRef, useState } from 'react'
import { laboratoryApi } from '@/lib/laboratory'
import { useDashboardSession } from '@/lib/dashboardSession'

interface Staff { id: string; name: string; email: string; role: string; active: boolean }
const empty = { name: '', email: '', password: '', role: 'Technician', adoptLegacyIdentity: false }
const field = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-500'
export default function StaffPage() {
  const session = useDashboardSession()
  const [staff, setStaff] = useState<Staff[]>([])
  const [form, setForm] = useState(empty)
  const [reset, setReset] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  async function load() {
    setLoading(true)
    try { setStaff(await laboratoryApi<Staff[]>('/staff')); setError('') }
    catch (error) { setError(error instanceof Error ? error.message : 'Staff list unavailable.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (session?.role === 'Administrator') void load() }, [session?.id, session?.role])
  async function mutate(path: string, method: string, body?: unknown) {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try {
      await laboratoryApi(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
      setMessage('Staff change saved. Account security changes invalidate existing sessions.')
      await load(); return true
    } catch (error) { setError(error instanceof Error ? error.message : 'Change could not be confirmed. Refresh before retrying.'); return false }
    finally { pending.current = false; setBusy(false) }
  }
  if (session?.role !== 'Administrator') return <p role="alert">Staff management requires an Administrator account.</p>
  return <div className="space-y-6 text-slate-900 dark:text-slate-100">
    <header><h1 className="text-3xl font-bold">Staff accounts</h1><p className="mt-2">Provision laboratory access. Saved roles and identities are permanent; accounts are deactivated, not deleted.</p></header>
    {error && <p role="alert" className="rounded-lg border border-rose-400 p-4 text-rose-800 dark:text-rose-200">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-400 p-4 text-emerald-800 dark:text-emerald-200">{message}</p>}
    <section className="card p-5" aria-labelledby="provision-heading">
      <h2 id="provision-heading" className="text-xl font-bold">Provision staff account</h2>
      <form className="mt-4" aria-busy={busy} onSubmit={async event => { event.preventDefault(); if (await mutate('/staff', 'POST', form)) setForm(empty) }}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label>Full name<input className={field} autoComplete="off" required minLength={2} maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
          <label>Email address<input type="email" className={field} autoComplete="off" required maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
          <label>Staff role<select className={field} value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{['Technician', 'Reviewer', 'Administrator'].map(role => <option key={role}>{role}</option>)}</select></label>
          <label>Initial password<input type="password" className={field} autoComplete="new-password" required minLength={12} maxLength={128} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /><span className="text-sm">12–128 characters. Deliver privately to the verified staff member.</span></label>
          <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" checked={form.adoptLegacyIdentity} onChange={event => setForm({ ...form, adoptLegacyIdentity: event.target.checked })} />Adopt this verified person’s legacy identity, preserving existing record ownership. No records will be reassigned.</label>
          <button className={`${button} bg-indigo-600 text-white hover:bg-indigo-700 sm:col-span-2`} type="submit">{busy ? 'Saving…' : 'Create staff account'}</button>
        </fieldset>
      </form>
    </section>
    <section aria-labelledby="staff-list-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="staff-list-heading" className="text-xl font-bold">Laboratory staff</h2><button className={button} disabled={busy || loading} onClick={load}>Refresh staff</button></div>
      {loading ? <p role="status">Loading staff…</p> : !staff.length ? <p>No staff accounts found.</p> : staff.map(account => <article aria-label={`Staff ${account.email}`} key={account.id} className="card space-y-3 p-5">
        <h3 className="break-words text-lg font-bold">{account.name}</h3><p className="break-all">{account.email}</p><p>{account.role} · {account.active ? 'Active' : 'Inactive'}</p>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || account.id === session.id} onClick={() => mutate(`/staff/${account.id}`, 'PATCH', { active: !account.active })}>{account.active ? 'Deactivate' : 'Activate'}</button>
          <button className={button} disabled={busy} onClick={() => mutate(`/staff/${account.id}/revoke-sessions`, 'POST')}>Revoke sessions</button></div>
        <form onSubmit={async event => { event.preventDefault(); if (await mutate(`/staff/${account.id}`, 'PATCH', { password: reset[account.id] })) setReset({ ...reset, [account.id]: '' }) }}>
          <fieldset disabled={busy} className="space-y-2"><label>New password for {account.name}<input type="password" className={field} autoComplete="new-password" required minLength={12} maxLength={128} value={reset[account.id] || ''} onChange={event => setReset({ ...reset, [account.id]: event.target.value })} /></label><button className={button} type="submit">Reset password</button></fieldset>
        </form>
      </article>)}
    </section>
  </div>
}
