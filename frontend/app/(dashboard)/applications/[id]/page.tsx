'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useDashboardSession } from '@/lib/dashboardSession'
import { businessApplicationApi, type BusinessApplication } from '@/lib/businessApplications'

const displayDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))

export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const session = useDashboardSession()
  if (!session) return <p role="status" className="card p-6">Loading session…</p>
  if (session.role !== 'Business') return <p role="alert" className="card p-6">Application details are available only to Business accounts.</p>
  return <ApplicationDetail key={`${session.id}:${params.id}`} id={params.id} />
}

function ApplicationDetail({ id }: { id: string }) {
  const [application, setApplication] = useState<BusinessApplication | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setApplication(null)
    setError('')
    businessApplicationApi<BusinessApplication>(`/verification/applications/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setApplication(result) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [attempt, id])

  if (error) return <div className="card p-6"><p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p><div className="mt-4 flex flex-wrap gap-3"><button className="btn btn-secondary btn-md" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button><Link className="btn btn-secondary btn-md" href="/applications">Back to applications</Link></div></div>
  if (!application) return <p role="status" className="card p-6">Loading application…</p>

  const instrument = application.instrument
  return (
    <article className="space-y-6">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300" href="/applications"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to applications</Link>
      <header className="card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">Initial verification application</p><h1 className="mt-2 break-words">{instrument.name}</h1><p className="mt-2 font-mono text-sm text-slate-600 dark:text-slate-300">Application {application.id}</p></div><span className="badge badge-primary self-start px-3 py-1">Submitted</span></div>
        <div role="status" className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><strong>Application submitted</strong><p className="mt-1 text-sm">This record is saved and visible only to its owning Business account. Submitted fields are read-only.</p></div></div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="business-summary"><h2 id="business-summary" className="text-xl">Business and site</h2><dl className="mt-5 space-y-4"><div><dt className="text-sm text-slate-600 dark:text-slate-300">Business name</dt><dd className="mt-1 font-medium">{application.businessName}</dd></div><div><dt className="text-sm text-slate-600 dark:text-slate-300">Installation address</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{application.address}</dd></div></dl></section>
        <section className="card p-6" aria-labelledby="identity-summary"><h2 id="identity-summary" className="text-xl">Instrument identity</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-slate-600 dark:text-slate-300">Name</dt><dd className="mt-1 font-medium">{instrument.name}</dd></div><div><dt className="text-sm text-slate-600 dark:text-slate-300">Model</dt><dd className="mt-1 font-medium">{instrument.model}</dd></div><div><dt className="text-sm text-slate-600 dark:text-slate-300">Serial number</dt><dd className="mt-1 font-medium">{instrument.serialNumber}</dd></div><div><dt className="text-sm text-slate-600 dark:text-slate-300">Accuracy class</dt><dd className="mt-1 font-medium">Class {instrument.accuracyClass}</dd></div><div><dt className="text-sm text-slate-600 dark:text-slate-300">Tare device</dt><dd className="mt-1 font-medium">{instrument.hasTare ? 'Yes' : 'No'}</dd></div></dl></section>
      </div>

      <section className="card overflow-hidden" aria-labelledby="metrology-summary"><div className="card-header"><h2 id="metrology-summary" className="text-xl">Metrological limits</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Declared values in grams (g)</p></div><div className="grid grid-cols-2 divide-x divide-y divide-slate-200 dark:divide-slate-700 sm:grid-cols-4 sm:divide-y-0">{[
        ['Maximum, Max', instrument.maxCapacity], ['Minimum, Min', instrument.minCapacity], ['Verification interval, e', instrument.e], ['Scale interval, d', instrument.d],
      ].map(([label, value]) => <div className="p-5" key={label}><p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 font-mono text-lg font-semibold tabular-nums">{value} g</p></div>)}</div></section>

      <section className="card p-6" aria-labelledby="history-title"><h2 id="history-title" className="text-xl">Application history</h2><ol className="mt-5 space-y-4">{application.history.map((entry, index) => <li key={`${entry.at}:${index}`} className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-600" aria-hidden="true" /><div><p className="font-semibold">Application submitted</p><p className="text-sm text-slate-600 dark:text-slate-300">{displayDate(entry.at)}</p></div></li>)}</ol></section>
    </article>
  )
}
