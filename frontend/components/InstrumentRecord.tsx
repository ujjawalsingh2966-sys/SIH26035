'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { laboratoryApi, TestCase, statusLabel } from '@/lib/laboratory'
import { useDashboardSession } from '@/lib/dashboardSession'
import { Manufacturer, RegisteredInstrument, masterButton } from '@/lib/masterData'
import { createRecord, CreationFailure } from '@/components/InstrumentRegistration'
export function InstrumentRecord({ id, historyOnly = false }: { id: string; historyOnly?: boolean }) {
  const session = useDashboardSession(), router = useRouter(), pending = useRef(false)
  const [data, setData] = useState<{ instrument: RegisteredInstrument; manufacturer?: Manufacturer; linked: boolean; evaluationSupport: { supported: boolean; reasons: string[] } }>()
  const [history, setHistory] = useState<TestCase[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [unknown, setUnknown] = useState(false)
  async function load() { setLoading(true); try { const [record, history] = await Promise.all([laboratoryApi<NonNullable<typeof data>>(`/instruments/${id}`), laboratoryApi<TestCase[]>(`/instruments/${id}/history`)]); setData(record); setHistory(history); setError('') } catch (error) { setError(error instanceof Error ? error.message : 'Instrument unavailable.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [id])
  async function createCase() {
    if (pending.current || unknown) return
    pending.current = true; setBusy(true)
    let navigating = false
    try { const caseId = await createRecord('test-cases', { instrumentId: id }); navigating = true; router.push(`/test-cases/${caseId}/workspace`) }
    catch (error) { setError(error instanceof Error ? error.message : 'Create failed.'); if (!(error instanceof CreationFailure && error.confirmedRejection)) setUnknown(true) }
    finally { if (!navigating) { pending.current = false; setBusy(false) } }
  }
  if (loading) return <p role="status">Loading instrument…</p>
  const instrument = data?.instrument
  return <div className="space-y-5 text-slate-900 dark:text-slate-100"><Link href="/instruments" className="underline">Instrument directory</Link><h1 className="text-3xl font-bold">{historyOnly ? 'Instrument Testing History' : instrument?.name || 'Instrument unavailable'}</h1>{error && <p role="alert">{error} <button onClick={load} className={masterButton}>Refresh</button></p>}{unknown && <p role="alert">Creation outcome is unknown. Check history before starting another request. No automatic retry will occur.</p>}
    {instrument && <><div className="flex flex-wrap gap-3"><Link className={masterButton} href={`/instruments/${id}`}>Instrument details</Link><Link className={masterButton} href={`/instruments/${id}/history`}>Testing history</Link>{!data.linked && (session?.role === 'Administrator' || session?.id === instrument.createdBy && session?.role === 'Technician') && <Link className={masterButton} href={`/instruments/${id}/edit`}>Edit registration</Link>}{session?.role === 'Technician' && data.evaluationSupport.supported && <button className={masterButton} disabled={busy || unknown} onClick={createCase}>{busy ? 'Creating…' : 'Create test case'}</button>}</div>
      {!data.evaluationSupport.supported && <section className="rounded-lg border border-amber-500 p-4" aria-label="Unsupported evaluation profile"><h2 className="font-bold">Registration is not evaluation support</h2><ul className="list-disc pl-5">{data.evaluationSupport.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></section>}
      {!historyOnly && <section className="card space-y-4 p-5"><h2 className="text-xl font-bold">Saved specifications</h2><p>Manufacturer: {data.manufacturer ? <Link className="underline" href={`/manufacturers/${data.manufacturer.id}`}>{data.manufacturer.name} · {data.manufacturer.identifier}</Link> : 'Not recorded (legacy reference)'}</p><p className="break-words">Address: {data.manufacturer?.address || 'Not recorded'}</p><dl className="grid gap-4 sm:grid-cols-2">{Object.entries({ Model: instrument.model, 'Serial number': instrument.serialNumber, 'Accuracy class': instrument.accuracyClass, 'Max (g)': instrument.maxCapacity, 'Min (g)': instrument.minCapacity, 'e (g)': instrument.e, 'd (g)': instrument.d, 'n = Max/e': instrument.n, 'Tare device': instrument.hasTare === undefined ? undefined : instrument.hasTare ? 'Yes' : 'No', 'Software identification': instrument.softwareIdentification, 'Type approval mark (declared)': instrument.typeApprovalMark, 'Technical characteristics': instrument.technicalNotes }).map(([label, value]) => <div className="min-w-0 rounded border border-slate-300 p-3 dark:border-slate-600" key={label}><dt className="text-sm">{label}</dt><dd className="break-words font-semibold">{value || 'Not recorded'}</dd></div>)}</dl>{instrument.declaredSpecifications && <p className="text-sm">Originally entered: Max {instrument.declaredSpecifications.maxCapacity}, Min {instrument.declaredSpecifications.minCapacity}, e {instrument.declaredSpecifications.e}, d {instrument.declaredSpecifications.d} {instrument.declaredSpecifications.unit}.</p>}<p className="text-sm">{data.linked ? 'Specifications are locked because a test case references this instrument.' : 'Technical edits are permitted only before a test case exists.'} New cases freeze their own instrument/manufacturer snapshot.</p></section>}
      <section className="space-y-3"><h2 className="text-xl font-bold">Authorized test cases</h2><p className="text-sm">Only cases permitted by your laboratory role and ownership policy are shown.</p>{!history.length ? <p>No accessible test cases.</p> : history.map(test => <article className="card space-y-2 p-4" key={test.id}><p className="break-all">{test.id}</p><p>{statusLabel(test.status)} · {new Date(test.createdAt).toLocaleString()}</p><Link className="underline" href={`/test-cases/${test.id}/workspace`}>Open Workspace</Link></article>)}</section></>}
  </div>
}
