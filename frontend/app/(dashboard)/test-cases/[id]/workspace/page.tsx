'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Scale,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Thermometer,
  Droplet,
  BarChart3,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  Activity,
  Lock,
  Unlock,
  Download,
  Upload,
  Settings,
  Play,
  RotateCcw,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

export type TestCaseStatus = 'DRAFT' | 'TESTING' | 'READY_FOR_REVIEW' | 'UNDER_REVIEW' | 'RETURNED_FOR_CORRECTION' | 'APPROVED'

export type ObservationType = 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING'

interface TestCase {
  id: string
  instrumentId: string
  technicianId: string
  status: TestCaseStatus
  reviewerId?: string
  reviewNotes?: string
  approvalDate?: string
  createdAt: string
  updatedAt: string
  laboratoryConditions?: {
    temperature: string
    humidity: string
    pressure: string
  }
  testConfiguration: {
    weighing: string
    eccentricity: string
    repeatability: string
    tare: string
    zeroSetting: string
  }
  isInitialVerification?: boolean
}

interface Observation {
  id: string
  testCaseId: string
  testType: ObservationType
  sequence: number
  load: string
  indication: string
  additionalWeights: string
}

export default function TestCaseWorkspace({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [testCase, setTestCase] = useState<TestCase | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [activeTab, setActiveTab] = useState<ObservationType>('WEIGHING')
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [savingLab, setSavingLab] = useState(false)
  const [addingObs, setAddingObs] = useState(false)
  const [deletingObsId, setDeletingObsId] = useState<string | null>(null)

  // Lab conditions form
  const [lab, setLab] = useState({ temperature: '', humidity: '', pressure: '' })

  // Observation form
  const [obsForm, setObsForm] = useState({
    load: '',
    indication: '',
    additionalWeights: '0'
  })

  useEffect(() => {
    fetchData()
  }, [params.id])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('nawi_token')

      // Fetch test case via authorized single read endpoint, fallback to list if needed
      const tcRes = await fetch(`${API_BASE_URL}/api/v1/test-cases/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const tcData = await tcRes.json()
      if (tcRes.ok && tcData.success && tcData.data) {
        setTestCase(tcData.data)
        if (tcData.data.laboratoryConditions) {
          setLab(tcData.data.laboratoryConditions)
        }
      } else {
        const listRes = await fetch(`${API_BASE_URL}/api/v1/test-cases`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const listData = await listRes.json()
        const currentTc = listData.data?.find((t: TestCase) => t.id === params.id)
        if (currentTc) {
          setTestCase(currentTc)
          if (currentTc.laboratoryConditions) {
            setLab(currentTc.laboratoryConditions)
          }
        }
      }

      // Fetch observations
      const obsRes = await fetch(`${API_BASE_URL}/api/v1/observations/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const obsData = await obsRes.json()
      setObservations(obsData.data || [])
    } catch (e: any) {
      setSubmitError(e?.message || 'Failed to load test case data')
    } finally {
      setLoading(false)
    }
  }

  const saveLabConditions = async () => {
    if (savingLab) return
    const token = localStorage.getItem('nawi_token')
    setSavingLab(true)
    setSubmitError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/test-cases/${params.id}/laboratory-conditions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(lab)
      })
      const result = await res.json()

      if (res.ok && result.success) {
        if (result.data) {
          setTestCase(result.data)
          if (result.data.laboratoryConditions) {
            setLab(result.data.laboratoryConditions)
          }
        }
        setSuccessMessage('Laboratory conditions saved successfully')
        setShowSuccessToast(true)
        setTimeout(() => setShowSuccessToast(false), 3000)
      } else {
        setSubmitError(result.error || `Failed to save laboratory conditions (HTTP ${res.status})`)
        setTimeout(() => setSubmitError(''), 5000)
      }
    } catch (e: any) {
      setSubmitError(e?.message || 'Network error while saving laboratory conditions')
      setTimeout(() => setSubmitError(''), 5000)
    } finally {
      setSavingLab(false)
    }
  }

  const addObservation = async () => {
    if (addingObs) return
    if (!obsForm.load || !obsForm.indication) {
      setSubmitError('Load and indication are required fields')
      setTimeout(() => setSubmitError(''), 4000)
      return
    }

    setAddingObs(true)
    setSubmitError('')
    try {
      const typeObs = observations.filter(o => o.testType === activeTab)
      const maxSeq = typeObs.reduce((max, o) => Math.max(max, Number(o.sequence) || 0), 0)
      const seq = maxSeq + 1
      const token = localStorage.getItem('nawi_token')

      const res = await fetch(`${API_BASE_URL}/api/v1/observations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          testCaseId: params.id,
          testType: activeTab,
          sequence: seq,
          load: obsForm.load,
          indication: obsForm.indication,
          additionalWeights: obsForm.additionalWeights
        })
      })
      const result = await res.json()

      if (res.ok && result.success) {
        setObservations(prev => [...prev, result.data])
        setObsForm({ load: '', indication: '', additionalWeights: '0' })
        setSuccessMessage('Observation recorded successfully')
        setShowSuccessToast(true)
        setTimeout(() => setShowSuccessToast(false), 3000)
      } else {
        setSubmitError(result.error || `Failed to record observation (HTTP ${res.status})`)
        setTimeout(() => setSubmitError(''), 5000)
      }
    } catch (e: any) {
      setSubmitError(e?.message || 'Network error while recording observation')
      setTimeout(() => setSubmitError(''), 5000)
    } finally {
      setAddingObs(false)
    }
  }

  const deleteObservation = async (obsId: string) => {
    if (deletingObsId) return
    if (!window.confirm('Are you sure you want to delete this observation? This action will be audited.')) return
    setDeletingObsId(obsId)
    setSubmitError('')
    try {
      const token = localStorage.getItem('nawi_token')
      const res = await fetch(`${API_BASE_URL}/api/v1/observations/${obsId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()

      if (res.ok && result.success) {
        setObservations(prev => prev.filter(o => o.id !== obsId))
        setSuccessMessage('Observation deleted successfully')
        setShowSuccessToast(true)
        setTimeout(() => setShowSuccessToast(false), 3000)
      } else {
        setSubmitError(result.error || `Failed to delete observation (HTTP ${res.status})`)
        setTimeout(() => setSubmitError(''), 5000)
      }
    } catch (e: any) {
      setSubmitError(e?.message || 'Network error while deleting observation')
      setTimeout(() => setSubmitError(''), 5000)
    } finally {
      setDeletingObsId(null)
    }
  }

  const submitTest = async () => {
    if (!confirm('Submit this test case for review? Observations will be locked.')) return

    try {
      const token = localStorage.getItem('nawi_token')
      const res = await fetch(`${API_BASE_URL}/api/v1/test-cases/${params.id}/workflow/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.success) {
        setTestCase(result.data)
        setSuccessMessage('Test case submitted for review successfully')
        setShowSuccessToast(true)
        setTimeout(() => {
          setShowSuccessToast(false)
          router.push('/tests')
        }, 2000)
      } else {
        setSubmitError(result.error || 'Failed to submit test case for review')
        setTimeout(() => setSubmitError(''), 5000)
      }
    } catch (e) {
      setSubmitError('Network error while submitting for review')
      setTimeout(() => setSubmitError(''), 3000)
    }
  }

  const isLocked = Boolean(testCase && ['READY_FOR_REVIEW', 'UNDER_REVIEW', 'APPROVED'].includes(testCase.status))
  const isTesting = testCase?.status === 'TESTING'

  const startTesting = async () => {
    try {
      setSubmitError('')
      const token = localStorage.getItem('nawi_token')
      const res = await fetch(`${API_BASE_URL}/api/v1/test-cases/${params.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'TESTING' })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start testing')
      }
      if (data.data) {
        setTestCase(data.data)
      }
      setSuccessMessage(testCase?.status === 'RETURNED_FOR_CORRECTION' ? 'Testing resumed successfully' : 'Testing started successfully')
      setShowSuccessToast(true)
      setTimeout(() => setShowSuccessToast(false), 3000)
      await fetchData()
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to start testing')
      setTimeout(() => setSubmitError(''), 5000)
    }
  }

  // Calculate MPE (Maximum Permissible Error) placeholder
  // In Phase 6, this will use actual metrological calculations
  const getMPEStatus = (load: string, indication: string) => {
    // Simplified - will be replaced with actual calculations in Phase 6
    const diff = Math.abs(parseFloat(load) - parseFloat(indication))
    return diff < 0.01 ? 'PASS' : 'WARN'
  }

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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Test Case Not Found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">The requested test case could not be found.</p>
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
    .map(([key]) => key.toUpperCase().replace('_SETTING', ' SETTING') as ObservationType)

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
    <div className="w8-lab-workspace space-y-6 animate-fade-in-up">
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
            <span className="font-mono text-slate-900 dark:text-white">{testCase.id.slice(0, 8)}...</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Observation Workspace</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium',
              testCase.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
              testCase.status === 'READY_FOR_REVIEW' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              testCase.status === 'UNDER_REVIEW' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
              testCase.status === 'TESTING' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
              testCase.status === 'RETURNED_FOR_CORRECTION' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            )}>
              {testCase.status.replace(/_/g, ' ')}
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

      {submitError && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-4 text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Action failed</p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{submitError}</p>
            </div>
          </div>
          <button
            onClick={() => setSubmitError('')}
            className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 underline flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

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
                <span className="font-medium text-slate-900 dark:text-white">Loading...</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Model</span>
                <span className="font-medium text-slate-900 dark:text-white">Loading...</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Serial Number</span>
                <span className="font-mono text-slate-900 dark:text-white">Loading...</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400">Accuracy Class</span>
                <span className="font-medium text-slate-900 dark:text-white">Loading...</span>
              </div>
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
                      "block w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all",
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
                      "block w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all",
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
                      "block w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all",
                      isLocked ? "border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed" : "border-slate-300 dark:border-slate-600 focus:border-indigo-500"
                    )}
                  />
                  {isLocked && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
                </div>
              </div>
              {!isLocked && (
                <button
                  onClick={saveLabConditions}
                  disabled={savingLab}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {savingLab ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Conditions
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Action Panel */}
          {testCase.status === 'DRAFT' && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-500" />
                Start Testing
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                This test case is currently in Draft status. Transition to Testing to begin recording observations.
              </p>
              {submitError && (
                <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
              <button
                onClick={startTesting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-600/20"
              >
                <Play className="w-5 h-5" />
                Start Testing
              </button>
            </div>
          )}

          {testCase.status === 'RETURNED_FOR_CORRECTION' && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-500" />
                Returned for Correction
              </h3>
              {testCase.reviewNotes && (
                <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm">
                  <p className="font-medium text-rose-800 dark:text-rose-300 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Reviewer Notes:
                  </p>
                  <p className="text-rose-700 dark:text-rose-200 text-xs">
                    {testCase.reviewNotes}
                  </p>
                </div>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                This test case was returned by the reviewer. Resume testing to make corrections and update observations.
              </p>
              {submitError && (
                <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
              <button
                onClick={startTesting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-rose-600/20"
              >
                <RotateCcw className="w-5 h-5" />
                Resume Testing
              </button>
            </div>
          )}

          {testCase.status === 'TESTING' && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Submit for Review
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Once submitted, this test case will be locked and sent for review. All observations will become read-only.
              </p>
              {submitError && (
                <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
              <button
                onClick={submitTest}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-amber-600/20"
              >
                <CheckCircle2 className="w-5 h-5" />
                Submit for Review
              </button>
            </div>
          )}

          {isLocked && testCase.status === 'READY_FOR_REVIEW' && (
            <div className="card p-5">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Ready for Review
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This test case has been submitted and is awaiting reviewer assignment. Observations and conditions are locked.
              </p>
            </div>
          )}

          {isLocked && testCase.status === 'UNDER_REVIEW' && (
            <div className="card p-5">
              <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Under Review
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This test case is currently being reviewed by a reviewer. Observations and conditions are locked.
              </p>
            </div>
          )}

          {isLocked && testCase.status === 'APPROVED' && (
            <div className="card p-5">
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Test Case Approved
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This test case has been approved with all metrological checks passing. Observations and conditions are locked.
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
                    onClick={() => setActiveTab(test)}
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

            {/* Observation Form / Gate Banner */}
            {isTesting ? (
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
                <div className="flex justify-between items-center mt-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-rose-500">*</span> Required fields
                  </p>
                  <button
                    onClick={addObservation}
                    disabled={addingObs}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {addingObs ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Record Observation
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {testCase.status === 'DRAFT' && (
                    <>
                      <AlertCircle className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Observation entry is disabled in <span className="font-semibold text-slate-900 dark:text-white">DRAFT</span>. Start testing to begin recording data.
                      </p>
                    </>
                  )}
                  {testCase.status === 'RETURNED_FOR_CORRECTION' && (
                    <>
                      <RotateCcw className="w-5 h-5 text-rose-500 flex-shrink-0" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Test case was <span className="font-semibold text-rose-600 dark:text-rose-400">Returned for Correction</span>. Resume testing to record or modify observations.
                      </p>
                    </>
                  )}
                  {isLocked && (
                    <>
                      <Lock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Observations are <span className="font-semibold text-slate-900 dark:text-white">locked</span> in {testCase.status.replace(/_/g, ' ')} status.
                      </p>
                    </>
                  )}
                </div>
                {testCase.status === 'DRAFT' && (
                  <button
                    onClick={startTesting}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    Start Testing
                  </button>
                )}
                {testCase.status === 'RETURNED_FOR_CORRECTION' && (
                  <button
                    onClick={startTesting}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resume Testing
                  </button>
                )}
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
                    {isTesting ? `Use the form above to add observations for ${activeTab} tests` : `Observations will appear here when recorded during testing.`}
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
                      {isTesting && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {observationsByType[activeTab]?.map((obs) => {
                      const mpeStatus = getMPEStatus(obs.load, obs.indication)
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
                          {isTesting && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deleteObservation(obs.id)}
                                disabled={deletingObsId === obs.id}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                                title="Delete Observation"
                              >
                                {deletingObsId === obs.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
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
                  Phase 5: String-based observation storage
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
