'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount } from '../../lib/account-context'
import {
  PlusCircle,
  Search,
  Scale,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  Users,
  FileText,
  MoreHorizontal,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

interface Instrument {
  id: string
  name: string
  model: string
  serialNumber: string
  accuracyClass?: string
  maxCapacity?: string
  e?: string
  d?: string
}

export type TestCaseStatus = 'DRAFT' | 'TESTING' | 'READY_FOR_REVIEW' | 'UNDER_REVIEW' | 'RETURNED_FOR_CORRECTION' | 'APPROVED'

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
}

export default function DashboardPage() {
  const user = useAccount()
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('nawi_token')
      const authHeaders = { 'Authorization': `Bearer ${token}` }

      const [instrumentsRes, testCasesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/instruments`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/v1/test-cases`, { headers: authHeaders })
      ])

      if (!instrumentsRes.ok || !testCasesRes.ok) {
        throw new Error(
          `Failed to load dashboard data (Instruments: HTTP ${instrumentsRes.status}, Tests: HTTP ${testCasesRes.status})`
        )
      }

      const [instrumentsData, testCasesData] = await Promise.all([
        instrumentsRes.json().then(d => {
          if (d && d.success === false) throw new Error(d.error || 'Failed to fetch instruments')
          return d.data || []
        }),
        testCasesRes.json().then(d => {
          if (d && d.success === false) throw new Error(d.error || 'Failed to fetch test cases')
          return d.data || []
        })
      ])

      setInstruments(instrumentsData)
      setTestCases(testCasesData)
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err)
      setError(err?.message || 'Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Calculate dashboard stats matching RepositoryService.getDashboardMetrics definitions
  const stats = {
    totalInstruments: instruments.length,
    activeTests: testCases.filter(tc => ['DRAFT', 'TESTING'].includes(tc.status)).length,
    pendingReview: testCases.filter(tc => ['READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(tc.status)).length,
    returned: testCases.filter(tc => tc.status === 'RETURNED_FOR_CORRECTION').length,
    approved: testCases.filter(tc => tc.status === 'APPROVED').length,
    instrumentsWithTests: new Set(testCases.map(tc => tc.instrumentId)).size
  }

  // Filtered test cases
  const filteredTestCases = testCases.filter(tc =>
    tc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tc.instrumentId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Status badge component
  const StatusBadge = ({ status }: { status: TestCaseStatus | string }) => {
    const statusStyles: Record<string, string> = {
      'DRAFT': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      'TESTING': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      'READY_FOR_REVIEW': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      'UNDER_REVIEW': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'RETURNED_FOR_CORRECTION': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      'APPROVED': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    }

    const style = statusStyles[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

    return (
      <span className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        style
      )}>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Legal Metrology Compliance Platform</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search test cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all w-full md:w-64"
            />
          </div>
          {user?.role === 'Technician' && <Link
            href="/instruments/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30"
          >
            <PlusCircle className="w-4 h-4" />
            New Instrument
          </Link>}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-4 text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to load dashboard data</p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      <div className="card p-4 text-sm">
        Business verification requests, officer scheduling and QR certificates are in{' '}
        <Link href="/applications" className="text-indigo-700 underline">Applications</Link>.
      </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card card-hover group">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Instruments</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.totalInstruments}</p>
              </div>
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                <Scale className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover group">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Tests</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.activeTests}</p>
              </div>
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover group">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Review</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.pendingReview}</p>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover group">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Returned</p>
                <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-2">{stats.returned}</p>
              </div>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg group-hover:bg-rose-100 dark:group-hover:bg-rose-900/30 transition-colors">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover group">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Approved</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.approved}</p>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Test Cases */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Active Test Cases</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {filteredTestCases.length} test{filteredTestCases.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <Link href="/tests" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium">
                View All
              </Link>
            </div>
            <div className="p-0">
              {filteredTestCases.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">No test cases found</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">Start a new verification or wait for tests to be created</p>
                  <Link
                    href="/instruments"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Register Instrument
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">Test ID</th>
                        <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">Instrument</th>
                        <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">Status</th>
                        <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">Created</th>
                        <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredTestCases.slice(0, 5).map((testCase) => (
                        <tr key={testCase.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              {testCase.id.slice(0, 8)}...
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
                                <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <span className="text-slate-700 dark:text-slate-300">ID: {testCase.instrumentId.slice(0, 8)}...</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={testCase.status} />
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                            {new Date(testCase.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/test-cases/${testCase.id}/workspace`}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium text-sm"
                            >
                              Open Workspace &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instrument Inventory */}
        <div className="card">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Instrument Inventory</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {stats.totalInstruments} registered instruments
            </p>
          </div>
          <div className="p-0">
            {instruments.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Scale className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">No instruments registered yet</p>
                {user?.role === 'Technician' && <Link
                  href="/instruments/new"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                >
                  <PlusCircle className="w-4 h-4" />
                  Register Instrument
                </Link>}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {instruments.slice(0, 6).map((instrument) => (
                  <div key={instrument.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {instrument.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{instrument.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{instrument.model}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {instrument.accuracyClass && (
                          <span className="px-2 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium">
                            Class {instrument.accuracyClass}
                          </span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">SN: {instrument.serialNumber}</span>
                      </div>
                    </div>
                    {instrument.maxCapacity && (
                      <div className="mt-3 flex gap-2 text-xs">
                        <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Max: {instrument.maxCapacity}
                        </span>
                        {instrument.e && (
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            e: {instrument.e}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-100 dark:border-slate-700">
            <Link href="/instruments" className="block text-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium">
              View All Instruments &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity / Status */}
      <div className="card">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">Workspace Information</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-slate-400 rounded-full" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Metrics reflect the last successful data load</span>
            </div>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 md:hidden" />
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Refresh the page for current metrics</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>OIML R76-guided pilot</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
