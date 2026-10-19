'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { laboratoryApi } from '@/lib/laboratory'
import { useDashboardSession } from '@/lib/dashboardSession'
import { Manufacturer, RegisteredInstrument, masterField, masterButton } from '@/lib/masterData'

export function ManufacturerDirectory() {
  const session = useDashboardSession()
  const [rows, setRows] = useState<Manufacturer[]>([]), [query, setQuery] = useState(''), [archived, setArchived] = useState(false)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  async function load() { setLoading(true); try { setRows(await laboratoryApi(`/manufacturers?q=${encodeURIComponent(query)}&includeArchived=${archived}`)); setError('') } catch (error) { setError(error instanceof Error ? error.message : 'Directory unavailable.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  return <div className="space-y-6 text-slate-900 dark:text-slate-100"><header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Manufacturers</h1><p>Shared manufacturer identities for laboratory instruments.</p></div>{['Technician', 'Administrator'].includes(session?.role || '') && <Link href="/manufacturers/new" className={masterButton}>Create manufacturer</Link>}</header>
    <form onSubmit={event => { event.preventDefault(); void load() }} className="card flex flex-wrap items-end gap-4 p-5"><label className="min-w-0 flex-1">Search name, identifier or address<input className={masterField} value={query} onChange={event => setQuery(event.target.value)} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Include archived</label><button className={masterButton} disabled={loading}>Search manufacturers</button></form>
    {error && <p role="alert">{error} <button className={masterButton} onClick={load}>Retry</button></p>}{loading ? <p role="status">Loading manufacturers…</p> : !rows.length ? <p>No manufacturers found.</p> : <div className="grid gap-4 lg:grid-cols-2">{rows.map(row => <article className="card space-y-2 p-5" key={row.id}><h2 className="break-words text-xl font-bold"><Link className="underline" href={`/manufacturers/${row.id}`}>{row.name}</Link></h2><p className="break-all">{row.identifier}</p><p className="break-words">{row.address}</p><p>{row.active === false ? 'Archived' : 'Active'}</p></article>)}</div>}
  </div>
}
export function ManufacturerRecord({ id, edit = false }: { id?: string; edit?: boolean }) {
  const session = useDashboardSession(), router = useRouter(), pending = useRef(false)
  const [record, setRecord] = useState<Manufacturer>(), [rows, setRows] = useState<RegisteredInstrument[]>([])
  const [form, setForm] = useState({ name: '', address: '', identifier: '' })
  const [loading, setLoading] = useState(!!id), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  async function load() { if (!id) return; setLoading(true); try { const row = await laboratoryApi<Manufacturer>(`/manufacturers/${id}`); setRecord(row); setForm({ name: row.name, address: row.address, identifier: row.identifier }); setRows(await laboratoryApi(`/instruments?manufacturerId=${id}`)); setError('') } catch (error) { setError(error instanceof Error ? error.message : 'Manufacturer unavailable.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [id])
  const mayWrite = session?.role === 'Administrator' || session?.role === 'Technician' && (!id || record?.createdBy === session.id)
  async function save(archive = false) {
    if (pending.current || uncertain) return
    pending.current = true; setBusy(true); setError('')
    let navigating = false
    try {
      const token = localStorage.getItem('nawi_token')
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/v1/manufacturers${id ? `/${id}` : ''}`, { method: archive ? 'DELETE' : id ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(archive ? { expectedRevision: record?.revision ?? 0 } : { ...form, ...(id ? { expectedRevision: record?.revision ?? 0 } : {}) }) })
      const result = await response.json()
      if (!response.ok) { if (response.status >= 500 || response.status === 408) setUncertain(true); throw new Error(result.error || 'The change was rejected.') }
      navigating = !archive
      router.push(`/manufacturers/${result.data.id}`); router.refresh(); if (archive) await load()
    } catch (error) { if (error instanceof TypeError || error instanceof SyntaxError) setUncertain(true); setError(error instanceof Error ? error.message : 'Save could not be confirmed.') }
    finally { if (!navigating) { pending.current = false; setBusy(false) } }
  }
  if (loading) return <p role="status">Loading manufacturer…</p>
  const isForm = !id || edit
  return <div className="space-y-5 text-slate-900 dark:text-slate-100"><Link className="underline" href="/manufacturers">Manufacturer directory</Link><h1 className="text-3xl font-bold">{isForm ? id ? 'Edit manufacturer' : 'Create manufacturer' : record?.name || 'Manufacturer unavailable'}</h1>
    {error && <p role="alert" className="rounded border border-rose-400 p-4">{error}</p>}{uncertain && <p role="alert">Save outcome is unknown. This form will not resend. Check the directory and refresh before starting another change.</p>}
    {isForm ? !mayWrite ? <p role="alert">Only an authorized Technician or Administrator may manage this manufacturer.</p> : <form className="card space-y-4 p-5" onSubmit={event => { event.preventDefault(); void save() }} aria-busy={busy}><fieldset className="space-y-4" disabled={busy || uncertain}>
      <div><label htmlFor="manufacturer-name">Manufacturer name</label><input id="manufacturer-name" required maxLength={160} className={masterField} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div>
      <div><label htmlFor="manufacturer-identifier">Manufacturer identifier</label><input id="manufacturer-identifier" required maxLength={100} className={masterField} value={form.identifier} onChange={event => setForm({ ...form, identifier: event.target.value })} /></div>
      <div><label htmlFor="manufacturer-address">Manufacturer address</label><textarea id="manufacturer-address" required maxLength={600} className={masterField} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></div><button className={`${masterButton} bg-indigo-600 text-white`}>{busy ? 'Saving…' : 'Save manufacturer'}</button>
    </fieldset></form> : record && <><section className="card space-y-3 p-5"><p className="break-all">Identifier: {record.identifier}</p><p className="break-words">Address: {record.address}</p><p>{record.active === false ? 'Archived' : 'Active'}</p>{mayWrite && record.active !== false && <div className="flex flex-wrap gap-3"><Link className={masterButton} href={`/manufacturers/${id}/edit`}>Edit manufacturer</Link><button className={masterButton} disabled={busy || rows.length > 0 || uncertain} onClick={() => save(true)}>Archive manufacturer</button></div>}<p className="text-sm">Linked identities are retained. Legacy cases without snapshots block edits that could change report metadata.</p></section><section className="space-y-3"><h2 className="text-xl font-bold">Registered instruments</h2>{!rows.length ? <p>No linked instruments.</p> : rows.map(row => <Link className="card block p-4 underline" key={row.id} href={`/instruments/${row.id}`}>{row.name} · {row.model} · {row.serialNumber}</Link>)}</section></>}
  </div>
}
