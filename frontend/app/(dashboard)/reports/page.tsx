'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useDashboardSession } from '@/lib/dashboardSession'
import { getSession } from '@/lib/laboratory'
import type { Instrument, Session, TestCase } from '@/lib/laboratory'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
interface ReportRow { testCase: TestCase; instrument: Instrument | null; manufacturer: { name: string } | null }
interface Listing { rows: ReportRow[]; total: number; state: 'loading' | 'ready' | 'error' | 'denied'; message?: string }
class ReportRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
const actionClass = 'rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300'

async function requireSuccess(response: Response) {
  if (response.ok) return
  const result = await response.json().catch(() => null)
  throw new ReportRequestError(result?.error || `Report request failed (${response.status}).`, response.status)
}

export default function ReportsPage() {
  const session = useDashboardSession()
  if (!session) return <p role="status" className="card p-6 text-slate-900 dark:text-slate-100">Loading session…</p>
  if (!['Technician', 'Reviewer', 'Administrator'].includes(session.role)) return (
    <div className="card p-6 text-slate-900 dark:text-slate-100"><h1 className="text-xl text-slate-900 dark:text-slate-100">Reports</h1><p role="alert">Access denied. Your role cannot view laboratory reports.</p></div>
  )
  return <ReportsIndex key={`${session.id}:${session.role}`} session={session} />
}

function ReportsIndex({ session }: { session: Session }) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ query: '', page: 1, refresh: 0 })
  const [listing, setListing] = useState<Listing>({ rows: [], total: 0, state: 'loading' })
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [preview, setPreview] = useState<{ id: string; html: string } | null>(null)
  const actionInFlight = useRef(false)
  const actionController = useRef<AbortController | null>(null)
  const currentSession = (token: string | null) => {
    const current = getSession()
    return !!token && localStorage.getItem('nawi_token') === token && current?.id === session.id && current.role === session.role
  }

  useEffect(() => {
    const controller = new AbortController()
    const token = localStorage.getItem('nawi_token')
    const isCurrent = () => {
      const current = getSession()
      return !!token && localStorage.getItem('nawi_token') === token && current?.id === session.id && current.role === session.role
    }
    setListing({ rows: [], total: 0, state: 'loading' })
    setPreview(null)
    setActionError('')
    const load = async () => {
      try {
        if (!isCurrent()) throw new ReportRequestError('Your session changed. Reload Reports to continue.', 401)
        const query = new URLSearchParams({ status: 'APPROVED', page: String(filters.page), limit: '20', q: filters.query })
        // RepositoryService.search applies record access before filtering/pagination.
        // This read does not call a report generator or change record/audit state.
        const response = await fetch(`${API_BASE_URL}/api/v1/repository/search?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal })
        await requireSuccess(response)
        const result = await response.json()
        if (!result.success || !Array.isArray(result.data) || !Number.isFinite(result.total)) throw new Error('The report list response could not be read.')
        if (!isCurrent()) throw new ReportRequestError('Your session changed. Reload Reports to continue.', 401)
        if (!controller.signal.aborted) setListing({ rows: result.data, total: result.total, state: 'ready' })
      } catch (error) {
        if (controller.signal.aborted) return
        const denied = error instanceof ReportRequestError && [401, 403].includes(error.status)
        setListing({ rows: [], total: 0, state: denied ? 'denied' : 'error', message: denied ? 'Access denied. Please sign in with an account permitted to view these reports.' : (error as Error).message })
      }
    }
    load()
    return () => { controller.abort(); actionController.current?.abort() }
  }, [session.id, session.role, filters.query, filters.page, filters.refresh])

  const openReport = async (id: string, format: 'html' | 'pdf') => {
    if (actionInFlight.current) return
    actionInFlight.current = true
    const controller = new AbortController()
    actionController.current = controller
    const token = localStorage.getItem('nawi_token')
    setAction(`${id}:${format}`)
    setActionError('')
    try {
      if (!currentSession(token)) throw new ReportRequestError('Your session changed. Reload Reports before opening a report.', 401)
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/${encodeURIComponent(id)}/${format}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal })
      await requireSuccess(response)
      if (format === 'html') {
        const html = await response.text()
        if (!currentSession(token) || controller.signal.aborted) return
        setPreview({ id, html })
      } else {
        if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The server did not return a PDF. Please retry the download.')
        const blob = await response.blob()
        if (!currentSession(token) || controller.signal.aborted) return
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `report-${id}.pdf`
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 1500)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setActionError(error instanceof ReportRequestError && [401, 403].includes(error.status) ? 'Access denied. You are not permitted to open this report with the current session.' : `The report could not be opened. ${(error as Error).message}`)
    } finally {
      if (!controller.signal.aborted) { setAction(''); actionInFlight.current = false }
    }
  }
  const refresh = () => setFilters(current => ({ ...current, refresh: current.refresh + 1 }))
  const pages = Math.max(1, Math.ceil(listing.total / 20))

  return (
    <div className="card space-y-6 p-6 text-slate-900 dark:text-slate-100">
      <div>
        <h1 className="text-2xl text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="mt-2">Saved approved laboratory records available to your account.</p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">A saved approval state alone does not establish compliance. Incomplete or undetermined programmes export only as PROTOTYPE / INCOMPLETE, never FINAL.</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Prototype / Pending Official Template Confirmation</p>
      </div>
      <form onSubmit={event => { event.preventDefault(); setFilters(current => ({ query: search.trim(), page: 1, refresh: current.refresh + 1 })) }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="report-query" className="input-label">Search by test ID, model or manufacturer</label>
          <input id="report-query" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded border border-slate-300 bg-white p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
        </div>
        <button type="submit" disabled={!!action} className={actionClass}>Search reports</button>
        <button type="button" disabled={!!action} onClick={refresh} className={actionClass}>Refresh reports</button>
      </form>
      {listing.state === 'loading' && <p role="status">Loading reports…</p>}
      {listing.state === 'denied' && <div><h2 className="text-lg text-slate-900 dark:text-slate-100">Access denied</h2><p role="alert">{listing.message}</p><Link href="/login" className="text-indigo-700 underline dark:text-indigo-300">Sign in</Link></div>}
      {listing.state === 'error' && <div className="space-y-3"><p role="alert">Reports could not be loaded. {listing.message}</p><button onClick={refresh} className={actionClass}>Retry loading reports</button></div>}
      {listing.state === 'ready' && listing.rows.length === 0 && <p>No approved reports found.</p>}
      {actionError && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">{actionError}</p>}
      {action && <p role="status">{action.endsWith(':pdf') ? 'Downloading report…' : 'Opening report preview…'}</p>}
      {listing.state === 'ready' && listing.rows.map(row => (
        <article key={row.testCase.id} aria-label={`Report ${row.testCase.id}`} className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="break-words text-lg text-slate-900 dark:text-slate-100">{row.instrument?.name || 'Instrument unavailable'}</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="min-w-0"><dt className="font-medium">Test case</dt><dd className="break-all">{row.testCase.id}</dd></div>
            <div><dt className="font-medium">Status</dt><dd>{row.testCase.status}</dd></div>
            <div className="min-w-0"><dt className="font-medium">Model / serial number</dt><dd className="break-words">{row.instrument?.model || '—'} / {row.instrument?.serialNumber || '—'}</dd></div>
            <div><dt className="font-medium">Approved</dt><dd>{new Date(row.testCase.approvalDate || row.testCase.updatedAt).toLocaleString()}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={!!action} onClick={() => openReport(row.testCase.id, 'html')} className={actionClass}>Preview report</button>
            <button disabled={!!action} onClick={() => openReport(row.testCase.id, 'pdf')} className={actionClass}>Download PDF</button>
            <Link href={`/test-cases/${row.testCase.id}/workspace`} className="text-indigo-700 underline dark:text-indigo-300">View saved record</Link>
          </div>
        </article>
      ))}
      {listing.state === 'ready' && listing.total > 0 && <div className="flex flex-wrap items-center gap-3">
        <button disabled={filters.page <= 1 || !!action} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))} className={actionClass}>Previous reports</button>
        <p>Page {filters.page} of {pages} ({listing.total} reports)</p>
        <button disabled={filters.page >= pages || !!action} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))} className={actionClass}>Next reports</button>
      </div>}
      {preview && <section aria-label="Report preview" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="break-all text-lg text-slate-900 dark:text-slate-100">Report preview: {preview.id}</h2><button onClick={() => setPreview(null)} className={actionClass}>Close preview</button></div>
        <iframe title={`Report preview ${preview.id}`} sandbox="" srcDoc={preview.html} className="h-[36rem] w-full border border-slate-300 bg-white" />
      </section>}
    </div>
  )
}
