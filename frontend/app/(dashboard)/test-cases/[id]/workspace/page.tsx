'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Save, CheckCircle2, AlertCircle, Thermometer, Plus, Trash2, FileText, Activity, Lock, Scale, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { laboratoryApi, getSession, statusLabel } from '@/lib/laboratory'
import type { TestCase, Observation, ObservationType, LaboratoryRecord, Session } from '@/lib/laboratory'

const emptyObservation = { load: '', indication: '', additionalWeights: '0', zeroError: '0', unit: 'g' }

export default function TestCaseWorkspace({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [testCase, setTestCase] = useState<TestCase | null>(null)
  const [record, setRecord] = useState<LaboratoryRecord | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [activeTab, setActiveTab] = useState<ObservationType>('WEIGHING')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [reason, setReason] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lab, setLab] = useState({ temperature: '', humidity: '', pressure: '' })
  const [obsForm, setObsForm] = useState(emptyObservation)

  useEffect(() => {
    if (!showSuccessToast) return
    const timeout = setTimeout(() => setShowSuccessToast(false), 4000)
    return () => clearTimeout(timeout)
  }, [showSuccessToast])

  const fetchData = useCallback(async () => {
    const [details, rows] = await Promise.all([
      laboratoryApi<LaboratoryRecord>(`/repository/records/${params.id}`),
      laboratoryApi<Observation[]>(`/observations/${params.id}`)
    ])
    setRecord(details)
    setTestCase(details.testCase)
    setObservations(rows)
    setLab(details.testCase.laboratoryConditions || { temperature: '', humidity: '', pressure: '' })
    setLoadError('')
  }, [params.id])

  useEffect(() => {
    setSession(getSession())
    setLoading(true)
    fetchData().catch(error => setLoadError(error.message)).finally(() => setLoading(false))
  }, [fetchData])

  // A ref closes the double-click window before React renders disabled controls.
  const mutate = async (operation: () => Promise<unknown>, message: string, afterSuccess?: () => void) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setSubmitError('')
    setShowSuccessToast(false)
    try {
      await operation()
      afterSuccess?.()
      setSuccessMessage(message)
      setShowSuccessToast(true)
      try { await fetchData() } catch (error) {
        setLoadError(`Saved, but refresh failed: ${(error as Error).message}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Request failed. Please try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const transition = (action: 'submit' | 'start-review' | 'return' | 'approve' | 'testing') => {
    if (!testCase || inFlight.current) return
    if (action === 'return' && !reason.trim()) { setSubmitError('A correction reason is required.'); return }
    if (action === 'approve' && !confirm('Approve this laboratory record? Further changes will be locked.')) return
    if (action === 'submit' && !confirm('Submit for review? Observations will become read-only.')) return
    const endpoint = action === 'testing' ? 'status' : `workflow/${action}`
    return mutate(async () => {
      const updated = await laboratoryApi<TestCase>(`/test-cases/${params.id}/${endpoint}`, {
        method: action === 'testing' ? 'PUT' : 'POST',
        body: JSON.stringify({ expectedRevision: testCase.revision ?? 0, status: 'TESTING', reason })
      })
      setTestCase(updated)
    }, 'Workflow updated.', () => setReason(''))
  }

  const saveLabConditions = () => mutate(() => laboratoryApi(`/test-cases/${params.id}/laboratory-conditions`, {
    method: 'PUT', body: JSON.stringify(lab)
  }), 'Laboratory conditions saved.')

  const addObservation = () => {
    if (!obsForm.load || !obsForm.indication) { setSubmitError('Load and indication are required.'); return }
    const sequence = Math.max(0, ...observations.filter(o => o.testType === activeTab).map(o => o.sequence)) + 1
    return mutate(() => laboratoryApi(editingId ? `/observations/${editingId}` : '/observations', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({ ...obsForm, testCaseId: params.id, testType: activeTab, sequence })
    }), editingId ? 'Observation corrected; previous values retained in audit history.' : 'Observation recorded.', () => {
      setObsForm(emptyObservation)
      setEditingId(null)
    })
  }

  const deleteObservation = (id: string) => {
    if (inFlight.current || !confirm('Delete this observation? Its previous values and evaluation will remain in audit history.')) return
    return mutate(() => laboratoryApi(`/observations/${id}`, { method: 'DELETE' }), 'Observation deleted; history retained.', () => {
      if (editingId === id) { setEditingId(null); setObsForm(emptyObservation) }
    })
  }

  const editObservation = (observation: Observation) => {
    setEditingId(observation.id)
    setObsForm({ load: observation.load, indication: observation.indication, additionalWeights: observation.additionalWeights,
      unit: observation.unit || 'g', zeroError: observation.zeroError || '0' })
  }
  const isOwner = session?.role === 'Technician' && session.id === testCase?.technicianId
  const canReview = !!session && ['Reviewer', 'Administrator'].includes(session.role) && session.id !== testCase?.technicianId
  const isAssignedReviewer = canReview && session?.id === testCase?.reviewerId
  const isLocked = !isOwner || testCase?.status !== 'TESTING' || busy || !!loadError
  const submitTest = () => transition('submit')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (!testCase) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-rose-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Workspace unavailable</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{loadError || 'The requested test case could not be found.'}</p>
          <button className="mt-3 text-indigo-700 underline dark:text-indigo-300" onClick={() => {
            setLoading(true)
            fetchData().catch(error => setLoadError(error.message)).finally(() => setLoading(false))
          }}>Retry loading workspace</button>
          <button
            onClick={() => router.push('/tests')}
            className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Evaluation Queue
          </button>
        </div>
      </div>
    )
  }

  // Get applicable tests
  const applicableTests = Object.entries(testCase.testConfiguration)
    .filter(([_, status]) => status !== 'NOT APPLICABLE')
    .map(([key]) => (key === 'zeroSetting' ? 'ZERO_SETTING' : key.toUpperCase()) as ObservationType)

  // Group observations by type
  const observationsByType = applicableTests.reduce((acc, type) => {
    acc[type] = observations.filter(o => o.testType === type)
    return acc
  }, {} as Record<ObservationType, Observation[]>)

  // Calculate statistics
  const stats = {
    total: observations.length,
    byType: applicableTests.reduce((acc, type) => {
      acc[type] = observations.filter(o => o.testType === type).length
      return acc
    }, {} as Record<ObservationType, number>),
    lastUpdated: testCase.updatedAt
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {(submitError || loadError) && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          <p>{submitError || loadError}</p>
          <button disabled={busy} className="mt-2 underline" onClick={() => {
            setSubmitError('')
            setLoading(true)
            fetchData().catch(error => setLoadError(error.message)).finally(() => setLoading(false))
          }}>Refresh record</button>
        </div>
      )}
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-mono">TEST CASE:</span>
            <span className="font-mono text-slate-900 dark:text-white">{testCase.id}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{canReview ? 'Laboratory Review' : 'Observation Workspace'}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium',
              testCase.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
              testCase.status === 'READY_FOR_REVIEW' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              testCase.status === 'UNDER_REVIEW' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
              testCase.status === 'TESTING' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            )}>
              {statusLabel(testCase.status)}
            </span>
            {testCase.isInitialVerification && (
              <span className="px-2.5 py-0.5 rounded-full font-medium text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Initial Verification
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/tests"
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Back to Queue
          </Link>
        </div>
      </div>

      {testCase.reviewNotes && (
        <div className="card border-l-4 border-l-amber-500 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white">Latest reviewer feedback</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">{testCase.reviewNotes}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Previous correction cycles remain in the audit history below.</p>
        </div>
      )}

      <div className="card p-5 space-y-3 text-slate-900 dark:text-slate-100">
        <p className="text-sm break-all">Technician: {testCase.technicianId} · Reviewer: {testCase.reviewerId || 'Not assigned'}</p>
        {isOwner && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(testCase.status) && (
          <button disabled={busy || !!loadError} onClick={() => transition('testing')} className="btn bg-indigo-600 text-white disabled:opacity-50">
            {testCase.status === 'DRAFT' ? 'Start Testing' : 'Resume Testing'}
          </button>
        )}
        {canReview && testCase.status === 'READY_FOR_REVIEW' && (
          <button disabled={busy || !!loadError} onClick={() => transition('start-review')} className="btn bg-indigo-600 text-white disabled:opacity-50">Start Review</button>
        )}
        {isAssignedReviewer && testCase.status === 'UNDER_REVIEW' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="correction-reason">Correction reason (required when returning)</label>
            <textarea id="correction-reason" value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
            <div className="flex flex-wrap gap-3">
              <button disabled={busy || !!loadError || !reason.trim()} onClick={() => transition('return')} className="btn bg-amber-700 text-white disabled:opacity-50">Return for Correction</button>
              <button disabled={busy || !!loadError || !record?.programme?.complete} aria-describedby="programme-status" onClick={() => transition('approve')} className="btn bg-emerald-700 text-white disabled:opacity-50">Approve Record</button>
            </div>
          </div>
        )}
        {canReview && testCase.status === 'UNDER_REVIEW' && !isAssignedReviewer && <p>Only the assigned reviewer can return or approve this record.</p>}
        {isOwner && ['READY_FOR_REVIEW', 'UNDER_REVIEW', 'APPROVED'].includes(testCase.status) && <p>Changes are locked while this record is submitted, under review, or approved.</p>}
        {busy && <p role="status">Saving…</p>}
      </div>

      <section className="card p-5 space-y-3 text-slate-900 dark:text-slate-100" aria-labelledby="programme-status">
        <h2 id="programme-status" className="text-xl">Test programme: {record?.programme?.overallVerdict || 'INCOMPLETE'}</h2>
        <Link className="inline-flex min-h-11 items-center rounded border border-indigo-500 px-4 py-2 font-semibold text-indigo-800 dark:text-indigo-200" href={`/test-cases/${params.id}/programme`}>Applicability, sampling & native tests</Link>
        <p className="text-sm">Applicability: {record?.programme?.applicability || 'UNDETERMINED'}. Recorded observation outcome: {record?.programme?.observedOutcome || 'UNDETERMINED'}.</p>
        {!record?.programme?.complete && <p className="font-medium text-amber-800 dark:text-amber-200">Final approval is blocked until required information, applicable tests and sampling are complete. Missing or unsupported tests are not automatically not applicable.</p>}
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">{record?.programme?.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
        {record?.programme && <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(record.programme.tests).map(([type, test]) => <div key={type} className="rounded border border-slate-200 p-3 dark:border-slate-700"><dt className="text-sm font-medium">{statusLabel(type)}</dt><dd className="mt-1 text-sm">{test.status} · {test.observations} observation(s)</dd>{test.reason && <dd className="mt-1 text-xs text-slate-600 dark:text-slate-300">{test.reason}</dd>}</div>)}</dl>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Test Case Info & Environment */}
        <div className="space-y-6">
          {/* Instrument Info */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-400" />
              Instrument Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Name</span>
                <span className="font-medium text-slate-900 dark:text-white">{record?.instrument?.name || 'Not recorded'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Model</span>
                <span className="font-medium text-slate-900 dark:text-white">{record?.instrument?.model || 'Not recorded'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Serial Number</span>
                <span className="font-mono text-slate-900 dark:text-white">{record?.instrument?.serialNumber || 'Not recorded'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400">Accuracy Class</span>
                <span className="font-medium text-slate-900 dark:text-white">{record?.instrument?.accuracyClass || 'Not recorded'}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-200">Manufacturer: {record?.manufacturer?.name || 'Not recorded'}</p>
              <p className="break-words text-slate-700 dark:text-slate-200">Manufacturer address: {record?.manufacturer?.address || 'Not recorded'}</p>
              <p className="break-words text-slate-700 dark:text-slate-200">Manufacturer identifier: {record?.manufacturer?.identifier || 'Not recorded'}</p>
              <p className="text-slate-700 dark:text-slate-200">n: {record?.instrument?.n || 'Not recorded'} · Metadata: {record?.metadataSource || 'Not recorded'}</p>
              <p className="text-slate-700 dark:text-slate-200">Max: {record?.instrument?.maxCapacity || '—'} g · Min: {record?.instrument?.minCapacity || '—'} g</p>
              <p className="text-slate-700 dark:text-slate-200">e: {record?.instrument?.e || '—'} g · d: {record?.instrument?.d || '—'} g</p>
            </div>
          </div>

          {/* Laboratory Conditions */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-slate-400" />
              Laboratory Conditions
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Temperature (°C)
                </label>
                <div className="relative">
                  <input
                    disabled={isLocked}
                    value={lab.temperature}
                    onChange={e => setLab({...lab, temperature: e.target.value})}
                    className={cn(
                      "block w-full px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all",
                      isLocked ? "border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed" : "border-slate-300 dark:border-slate-600 focus:border-indigo-500"
                    )}
                  />
                  {isLocked && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Humidity (%)
                </label>
                <div className="relative">
                  <input
                    disabled={isLocked}
                    value={lab.humidity}
                    onChange={e => setLab({...lab, humidity: e.target.value})}
                    className={cn(
                      "block w-full px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all",
                      isLocked ? "border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed" : "border-slate-300 dark:border-slate-600 focus:border-indigo-500"
                    )}
                  />
                  {isLocked && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Pressure (hPa)
                </label>
                <div className="relative">
                  <input
                    disabled={isLocked}
                    value={lab.pressure}
                    onChange={e => setLab({...lab, pressure: e.target.value})}
                    className={cn(
                      "block w-full px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all",
                      isLocked ? "border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed" : "border-slate-300 dark:border-slate-600 focus:border-indigo-500"
                    )}
                  />
                  {isLocked && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
                </div>
              </div>
              {!isLocked && (
                <button
                  onClick={saveLabConditions}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Conditions
                </button>
              )}
            </div>
          </div>

          {/* Action Panel */}
          {!isLocked && (
            <div className="card p-5 border-l-4 border-l-amber-500">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Submit for Review
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Once submitted, this test case will be locked and sent for review. All observations will become read-only.
              </p>
              <button
                onClick={submitTest}
                disabled={!!editingId}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-amber-600/20"
              >
                <CheckCircle2 className="w-5 h-5" />
                Submit for Review
              </button>
              {editingId && <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Save or cancel the observation correction before submitting.</p>}
            </div>
          )}

          {isLocked && testCase.status === 'APPROVED' && (
            <div className="card p-5 border-l-4 border-l-emerald-500">
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Test Case Approved
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This record retains its saved approval state and is locked. {record?.programme?.complete ? 'Programme completeness has been verified.' : 'Its incomplete programme does not qualify for a final compliance report.'} Individual saved verdicts remain visible.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Observation Workspace */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden flex flex-col h-[600px]">
            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
              <div className="flex min-w-max">
                {applicableTests.map((test) => (
                  <button
                    key={test}
                    onClick={() => { setActiveTab(test); setEditingId(null); setObsForm(emptyObservation) }}
                    className={cn(
                      "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === test
                        ? "border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    {test}
                    <span className={cn(
                      "ml-2 px-2 py-0.5 rounded-full text-xs",
                      activeTab === test
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {observationsByType[test]?.length || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Observation Form */}
            {!isLocked && (
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Load (L) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={obsForm.load}
                      onChange={e => setObsForm({...obsForm, load: e.target.value})}
                      placeholder="e.g., 100.00"
                      className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Indication (I) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={obsForm.indication}
                      onChange={e => setObsForm({...obsForm, indication: e.target.value})}
                      placeholder="e.g., 100.02"
                      className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Add. Weights (ΔL)
                    </label>
                    <input
                      type="text"
                      value={obsForm.additionalWeights}
                      onChange={e => setObsForm({...obsForm, additionalWeights: e.target.value})}
                      placeholder="e.g., 0.00"
                      className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-slate-900 dark:text-slate-100">
                  <label className="text-sm">Unit
                    <select value={obsForm.unit} onChange={event => setObsForm({ ...obsForm, unit: event.target.value })} className="ml-2 rounded border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900">
                      {['mg', 'g', 'kg', 't'].map(unit => <option key={unit}>{unit}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">Zero error (E0)
                    <input value={obsForm.zeroError} onChange={event => setObsForm({ ...obsForm, zeroError: event.target.value })} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" />
                  </label>
                </div>
                {editingId && <button className="mt-2 text-sm text-indigo-700 underline dark:text-indigo-300" onClick={() => { setEditingId(null); setObsForm(emptyObservation) }}>Cancel correction</button>}
                <div className="flex justify-between items-center mt-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-rose-500">*</span> Required fields
                  </p>
                  <button
                    onClick={addObservation}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {editingId ? 'Save Correction' : 'Record Observation'}
                  </button>
                </div>
              </div>
            )}

            {/* Observations Table */}
            <div className="flex-1 overflow-auto">
              {observationsByType[activeTab]?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">No observations recorded</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    Use the form above to add observations for {activeTab} tests
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                      <th className="px-4 py-3 font-medium w-16">Seq</th>
                      <th className="px-4 py-3 font-medium">Load (L)</th>
                      <th className="px-4 py-3 font-medium">Indication (I)</th>
                      <th className="px-4 py-3 font-medium">ΔL</th>
                      <th className="px-4 py-3 font-medium">Unit / E0</th>
                      <th className="px-4 py-3 font-medium">Saved error / MPE / Verdict</th>
                      {!isLocked && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {observationsByType[activeTab]?.map((obs) => {
                      const evaluation = obs.evaluation
                      return (
                        <tr key={obs.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {obs.sequence}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-900/20">
                            {obs.load}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-900/20">
                            {obs.indication}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-900/20">
                            {obs.additionalWeights}
                          </td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{obs.unit || 'g'} / {obs.zeroError || '0'}</td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-100">
                            {evaluation ? <div className="min-w-48 space-y-1">
                              <p>E: {evaluation.calculation.E.value} {evaluation.calculation.E.unit}</p>
                              <p>Ec: {evaluation.calculation.Ec.value} {evaluation.calculation.Ec.unit}</p>
                              <p>MPE: {evaluation.rulePackage.mpeLimit ? `${evaluation.rulePackage.mpeLimit.value} ${evaluation.rulePackage.mpeLimit.unit}` : 'Not available'}</p>
                              <p className="font-bold">{evaluation.compliance.verdict}</p>
                              <details className="text-xs"><summary className="cursor-pointer">Evaluation details</summary>
                                <p>{evaluation.compliance.trace?.resolutionComparison || evaluation.rulePackage.reason}</p>
                                <p>{evaluation.rulePackage.traceability?.ruleVersion}</p>
                                <p>{evaluation.compliance.trace?.applicableRequirement}</p>
                                <p>Evaluated: {new Date(evaluation.evaluatedAt).toLocaleString()}</p>
                              </details>
                            </div> : <span>Not evaluated</span>}
                          </td>
                          {!isLocked && (
                            <td className="px-4 py-3 text-right">
                              <button aria-label={`Edit observation ${obs.sequence}`} onClick={() => editObservation(obs)} className="p-1.5 text-indigo-700 dark:text-indigo-300"><Pencil className="w-4 h-4" /></button>
                              <button
                                aria-label={`Delete observation ${obs.sequence}`}
                                onClick={() => deleteObservation(obs.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>
                  {activeTab}: {observationsByType[activeTab]?.length || 0} observation{observationsByType[activeTab]?.length !== 1 ? 's' : ''} recorded
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Saved laboratory observations
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <section className="card p-5 text-slate-900 dark:text-slate-100">
        <h3 className="font-semibold mb-3">Available evidence</h3>
        {!record?.evidence.length ? <p>No evidence attached.</p> : <ul className="space-y-3">
          {record.evidence.map(evidence => <li key={evidence.id} className="border-b border-slate-200 pb-3 dark:border-slate-700">
            <p className="font-medium">{evidence.fileName} · {statusLabel(evidence.testType)}</p>
            <p className="whitespace-pre-wrap">{evidence.description}</p>
            <p className="text-sm">{evidence.mimeType} · {evidence.sizeBytes} bytes · {new Date(evidence.uploadedAt).toLocaleString()}</p>
            {evidence.fileData ? <button className="text-indigo-700 underline dark:text-indigo-300" onClick={() => {
              try {
                const raw = atob(evidence.fileData!.replace(/^data:[^,]*,/, ''))
                const url = URL.createObjectURL(new Blob([Uint8Array.from(raw, char => char.charCodeAt(0))], { type: 'application/octet-stream' }))
                const link = document.createElement('a'); link.href = url; link.download = evidence.fileName; link.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              } catch { setSubmitError('This evidence file could not be downloaded.') }
            }}>Download evidence</button> : <p className="text-sm">File content not available.</p>}
          </li>)}
        </ul>}
      </section>
      <section className="card p-5 text-slate-900 dark:text-slate-100">
        <h3 className="font-semibold mb-3">Review and audit history</h3>
        {!record?.history.length ? <p>No audit events recorded.</p> : <ol className="space-y-4">
          {record.history.map(event => <li key={event.id} className="border-l-2 border-slate-300 pl-4 dark:border-slate-600">
            <p className="font-medium">{statusLabel(event.action)}</p>
            <p className="text-sm break-all">{new Date(event.timestamp).toLocaleString()} · {event.actorRole} · {event.actorId}</p>
            {event.newState && <p className="text-sm">{event.previousState && `${statusLabel(event.previousState)} → `}{statusLabel(event.newState)}</p>}
            {typeof event.metadata?.reason === 'string' && <p className="whitespace-pre-wrap break-words">{event.metadata.reason}</p>}
            {event.metadata && <details className="mt-1 text-sm"><summary className="cursor-pointer">Saved audit details</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-3 dark:bg-slate-800">{JSON.stringify(event.metadata, null, 2)}</pre></details>}
          </li>)}
        </ol>}
      </section>
    </div>
  )
}
