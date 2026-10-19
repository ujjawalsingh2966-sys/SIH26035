'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FilePlus2, Search } from 'lucide-react'
import { useDashboardSession } from '@/lib/dashboardSession'
import {
  businessApplicationApi,
  type BusinessApplication,
  type BusinessApplicationList,
  type NewBusinessApplication,
} from '@/lib/businessApplications'

type FormState = {
  businessName: string
  address: string
  name: string
  model: string
  serialNumber: string
  accuracyClass: 'II' | 'III' | 'IIII'
  maxCapacity: string
  minCapacity: string
  e: string
  d: string
  hasTare: boolean
  scopeConfirmed: boolean
}

const initialForm: FormState = {
  businessName: '', address: '', name: '', model: '', serialNumber: '', accuracyClass: 'III',
  maxCapacity: '', minCapacity: '', e: '', d: '', hasTare: false, scopeConfirmed: false,
}

const inputClass = 'input min-h-11 disabled:cursor-not-allowed disabled:opacity-70'
const measureClass = `${inputClass} font-mono tabular-nums`

function applicationValidation(form: FormState) {
  if (!form.businessName.trim() || !form.address.trim() || !form.name.trim() || !form.model.trim() || !form.serialNumber.trim()) {
    return 'Complete every required business and instrument field.'
  }
  const decimal = /^\d+(\.\d+)?$/
  if (![form.maxCapacity, form.minCapacity, form.e, form.d].every(value => decimal.test(value))) {
    return 'Enter capacities and intervals as non-negative decimal values in grams.'
  }
  const [maximum, minimum, verificationInterval, scaleInterval] = [form.maxCapacity, form.minCapacity, form.e, form.d].map(Number)
  if (!(minimum < maximum && scaleInterval > 0 && scaleInterval <= verificationInterval && verificationInterval <= maximum)) {
    return 'Values must satisfy Min < Max and 0 < d ≤ e ≤ Max.'
  }
  if (!form.scopeConfirmed) return 'Confirm the supported instrument profile before submitting.'
  return ''
}

function submittedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function ApplicationsPage() {
  const session = useDashboardSession()
  if (!session) return <p role="status" className="card p-6">Loading session…</p>
  if (session.role !== 'Business') return <p role="alert" className="card p-6">Applications are available only to Business accounts.</p>
  return <BusinessApplications key={session.id} />
}

function BusinessApplications() {
  const router = useRouter()
  const [applications, setApplications] = useState<BusinessApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<FormState>(initialForm)
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const submissionKey = useRef<string>()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    businessApplicationApi<BusinessApplicationList>('/verification/applications', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setApplications(result.applications) })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [loadAttempt])

  const visibleApplications = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return applications
    return applications.filter(application => [
      application.businessName,
      application.instrument.name,
      application.instrument.model,
      application.instrument.serialNumber,
      application.id,
    ].some(field => field.toLowerCase().includes(value)))
  }, [applications, query])

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm(current => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current) return
    const validation = applicationValidation(form)
    if (validation) {
      setFormError(validation)
      return
    }
    inFlight.current = true
    setPending(true)
    setFormError('')
    if (!submissionKey.current) submissionKey.current = crypto.randomUUID()
    const payload: NewBusinessApplication = {
      submissionKey: submissionKey.current,
      businessName: form.businessName.trim(),
      address: form.address.trim(),
      instrument: {
        name: form.name.trim(), model: form.model.trim(), serialNumber: form.serialNumber.trim(),
        accuracyClass: form.accuracyClass, maxCapacity: form.maxCapacity, minCapacity: form.minCapacity,
        e: form.e, d: form.d, hasTare: form.hasTare,
        isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
      },
    }
    try {
      const application = await businessApplicationApi<BusinessApplication>('/verification/applications', {
        method: 'POST', body: JSON.stringify(payload),
      })
      router.push(`/applications/${application.id}`)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Application could not be submitted.')
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">Business verification</p>
          <h1 className="mt-2 text-3xl">Applications</h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Submit an initial verification request and track records owned by this Business account.</p>
        </div>
        <a href="#new-application" className="btn btn-primary btn-md self-start"><FilePlus2 className="h-4 w-4" aria-hidden="true" />New application</a>
      </header>

      <section aria-labelledby="own-applications-title" className="card overflow-hidden">
        <div className="card-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 id="own-applications-title" className="text-xl">Your applications</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Only applications created by this account are shown.</p></div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Search your applications</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input className="input pl-9" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search serial, model or ID" />
          </label>
        </div>
        <div className="card-body">
          {loading ? <p role="status">Loading applications…</p> : loadError ? (
            <div><p role="alert" className="text-rose-700 dark:text-rose-300">{loadError}</p><button type="button" className="btn btn-secondary btn-md mt-3" onClick={() => setLoadAttempt(value => value + 1)}>Try again</button></div>
          ) : applications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center dark:border-slate-600 dark:bg-slate-900/50"><p className="font-semibold">No applications yet</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Use the form below to submit your first verification application.</p></div>
          ) : visibleApplications.length === 0 ? <p>No applications match “{query}”.</p> : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {visibleApplications.map(application => (
                <li key={application.id}>
                  <Link href={`/applications/${application.id}`} className="group flex flex-col gap-3 rounded-lg px-2 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-slate-950 dark:text-white">{application.instrument.name}</strong><span className="badge badge-primary">Submitted</span></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{application.instrument.model} · Serial {application.instrument.serialNumber}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Submitted {submittedDate(application.createdAt)}</p></div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-indigo-700 dark:text-indigo-300">View details <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <form id="new-application" onSubmit={submit} aria-busy={pending} className="card scroll-mt-6 overflow-hidden">
        <div className="card-header"><p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Initial verification</p><h2 className="mt-1 text-2xl">Create and submit application</h2><p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">This workflow has no draft state. A valid form is submitted immediately and becomes read-only.</p></div>
        <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
          <div className="card-body space-y-8">
            {formError && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{formError}</div>}
            <section aria-labelledby="business-details-title"><h3 id="business-details-title" className="text-lg">Business and site</h3><div className="mt-4 grid gap-5 md:grid-cols-2">
              <label><span className="input-label">Business name <span aria-hidden="true">*</span></span><input className={inputClass} name="businessName" autoComplete="organization" required maxLength={200} value={form.businessName} onChange={event => update('businessName', event.target.value)} /></label>
              <label><span className="input-label">Installation address <span aria-hidden="true">*</span></span><textarea className={`${inputClass} min-h-24 resize-y`} name="address" autoComplete="street-address" required maxLength={1000} value={form.address} onChange={event => update('address', event.target.value)} /></label>
            </div></section>
            <section aria-labelledby="instrument-details-title"><h3 id="instrument-details-title" className="text-lg">Instrument identity</h3><div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <label><span className="input-label">Instrument name <span aria-hidden="true">*</span></span><input className={inputClass} name="instrumentName" required maxLength={200} value={form.name} onChange={event => update('name', event.target.value)} /></label>
              <label><span className="input-label">Model <span aria-hidden="true">*</span></span><input className={inputClass} name="model" required maxLength={200} value={form.model} onChange={event => update('model', event.target.value)} /></label>
              <label><span className="input-label">Serial number <span aria-hidden="true">*</span></span><input className={inputClass} name="serialNumber" required maxLength={200} value={form.serialNumber} onChange={event => update('serialNumber', event.target.value)} /></label>
              <label><span className="input-label">Accuracy class <span aria-hidden="true">*</span></span><select className={inputClass} name="accuracyClass" value={form.accuracyClass} onChange={event => update('accuracyClass', event.target.value as FormState['accuracyClass'])}><option value="II">Class II — High</option><option value="III">Class III — Medium</option><option value="IIII">Class IIII — Ordinary</option></select></label>
            </div></section>
            <section aria-labelledby="metrology-title"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 id="metrology-title" className="text-lg">Metrological limits</h3><p className="text-sm text-slate-600 dark:text-slate-300">All values are in grams (g)</p></div><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className="input-label">Maximum capacity, Max (g) <span aria-hidden="true">*</span></span><input className={measureClass} name="maxCapacity" inputMode="decimal" required pattern="\d+(\.\d+)?" value={form.maxCapacity} onChange={event => update('maxCapacity', event.target.value)} /></label>
              <label><span className="input-label">Minimum capacity, Min (g) <span aria-hidden="true">*</span></span><input className={measureClass} name="minCapacity" inputMode="decimal" required pattern="\d+(\.\d+)?" value={form.minCapacity} onChange={event => update('minCapacity', event.target.value)} /></label>
              <label><span className="input-label">Verification interval, e (g) <span aria-hidden="true">*</span></span><input className={measureClass} name="verificationInterval" inputMode="decimal" required pattern="\d+(\.\d+)?" value={form.e} onChange={event => update('e', event.target.value)} /></label>
              <label><span className="input-label">Scale interval, d (g) <span aria-hidden="true">*</span></span><input className={measureClass} name="scaleInterval" inputMode="decimal" required pattern="\d+(\.\d+)?" value={form.d} onChange={event => update('d', event.target.value)} /></label>
            </div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Required relationship: Min &lt; Max and 0 &lt; d ≤ e ≤ Max.</p></section>
            <section aria-labelledby="profile-title" className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50"><h3 id="profile-title" className="text-base">Supported profile</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This application is only for a non-automatic, electronic, single-range weighing instrument. Laboratory test cases and manufacturer model approval remain separate workflows.</p><div className="mt-4 space-y-3">
              <label className="flex items-start gap-3"><input className="mt-0.5 h-5 w-5 accent-indigo-600" type="checkbox" name="hasTare" checked={form.hasTare} onChange={event => update('hasTare', event.target.checked)} /><span className="text-sm">Instrument has a tare device</span></label>
              <label className="flex items-start gap-3"><input className="mt-0.5 h-5 w-5 accent-indigo-600" type="checkbox" name="scopeConfirmed" required checked={form.scopeConfirmed} onChange={event => update('scopeConfirmed', event.target.checked)} /><span className="text-sm font-medium">I confirm this instrument matches the supported profile. <span aria-hidden="true">*</span></span></label>
            </div></section>
          </div>
          <div className="card-footer flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600 dark:text-slate-300">Submission creates a permanent owner-visible record.</p><button type="submit" className="btn btn-primary btn-lg sm:self-end" disabled={pending}>{pending ? 'Submitting application…' : 'Submit application'}</button></div>
        </fieldset>
      </form>
    </div>
  )
}
