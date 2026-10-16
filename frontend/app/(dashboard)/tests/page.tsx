'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  PlusCircle,
  Search,
  MoreHorizontal,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  FileText,
  ChevronRight,
  Clock4,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { laboratoryApi, getSession, statusLabel, canCreateInstrument } from '@/lib/laboratory'
import { useDashboardSession } from '@/lib/dashboardSession'
import type { TestCase, TestCaseStatus, Session } from '@/lib/laboratory'

export default function TestsPage() {
  const creationSession = useDashboardSession()
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const fetchTestCases = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setTestCases(await laboratoryApi<TestCase[]>('/test-cases')) }
    catch (error) { setError((error as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const current = getSession()
    setSession(current)
    if (current && ['Reviewer', 'Administrator'].includes(current.role)) setFilterStatus('review_queue')
    fetchTestCases()
  }, [fetchTestCases])

  const filteredTestCases = testCases.filter(tc => {
    const matchesSearch =
      tc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.instrumentId.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'review_queue' ? ['READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(tc.status) && tc.technicianId !== session?.id : tc.status === filterStatus)
    return matchesSearch && matchesStatus
  })

  // Status counts
  const statusCounts = testCases.reduce((acc, tc) => {
    acc[tc.status] = (acc[tc.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const getStatusColor = (status: TestCaseStatus) => {
    switch (status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      case 'TESTING': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
      case 'READY_FOR_REVIEW': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      case 'UNDER_REVIEW': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      case 'RETURNED_FOR_CORRECTION': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
  }

  const getStatusIcon = (status: TestCaseStatus) => {
    switch (status) {
      case 'APPROVED': return CheckCircle2
      case 'READY_FOR_REVIEW': case 'UNDER_REVIEW': return FileText
      case 'TESTING': return Clock4
      case 'RETURNED_FOR_CORRECTION': return AlertTriangle
      default: return ClipboardList
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <ClipboardList className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading evaluation queue...</p>
        </div>
      </div>
    )
  }

  if (error) return <div className="card p-6 text-slate-900 dark:text-slate-100"><p role="alert">{error}</p><button onClick={fetchTestCases} className="mt-3 text-indigo-700 underline dark:text-indigo-300">Retry loading queue</button></div>

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Evaluation Queue</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredTestCases.length} test case{filteredTestCases.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canCreateInstrument(creationSession) && <Link href="/instruments/new" className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            + Start New Test
          </Link>}
        </div>
      </div>

      <button disabled={loading} onClick={fetchTestCases} className="text-sm text-indigo-700 underline dark:text-indigo-300">Refresh queue</button>
      {/* Status Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search test cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none cursor-pointer whitespace-nowrap"
            >
              <option value="all">All Statuses</option>
              {session && ['Reviewer', 'Administrator'].includes(session.role) && <option value="review_queue">Awaiting Review</option>}
              <option value="TESTING">In Progress</option>
              <option value="READY_FOR_REVIEW">Submitted for Review</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="DRAFT">Draft</option>
              <option value="RETURNED_FOR_CORRECTION">Returned for Correction</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Pending</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {statusCounts['DRAFT'] || 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">In Progress</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{statusCounts['TESTING'] || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Review</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {(statusCounts['READY_FOR_REVIEW'] || 0) + (statusCounts['UNDER_REVIEW'] || 0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Approved</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{statusCounts['APPROVED'] || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Returned</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{statusCounts['RETURNED_FOR_CORRECTION'] || 0}</p>
        </div>
      </div>

      {/* Test Cases Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                <th className="px-6 py-4 font-medium">Test ID</th>
                <th className="px-6 py-4 font-medium">Instrument</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Created</th>
                <th className="px-6 py-4 font-medium">Tests</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredTestCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <ClipboardList className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">No test cases found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTestCases.map((testCase) => {
                  const StatusIcon = getStatusIcon(testCase.status)
                  const applicableTests = Object.entries(testCase.testConfiguration)
                    .filter(([_, status]) => status !== 'NOT APPLICABLE')
                    .map(([key]) => key.toUpperCase())

                  return (
                    <tr key={testCase.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span className="font-mono text-xs text-slate-900 dark:text-white">{testCase.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            I
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">ID: {testCase.instrumentId}</p>
                            <p className="text-xs text-slate-500">Technician: {testCase.technicianId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
                          getStatusColor(testCase.status)
                        )}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusLabel(testCase.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300 text-xs">
                        {new Date(testCase.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {applicableTests.map(test => (
                            <span key={test} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {test}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/test-cases/${testCase.id}/workspace`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Open Workspace
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Workflow Pipeline</h3>
        <div className="flex flex-wrap gap-4">
          {[
            { status: 'DRAFT', label: 'Draft', icon: ClipboardList, completed: false },
            { status: 'TESTING', label: 'In Progress', icon: Clock4, completed: false },
            { status: 'READY_FOR_REVIEW', label: 'Submitted', icon: FileText, completed: false },
            { status: 'UNDER_REVIEW', label: 'Under Review', icon: AlertCircle, completed: false },
            { status: 'RETURNED_FOR_CORRECTION', label: 'Returned for Correction', icon: AlertTriangle, completed: false },
            { status: 'APPROVED', label: 'Approved', icon: CheckCircle2, completed: false },
          ].map((step, idx, arr) => {
            const isActive = idx === arr.length - 1
            return (
              <div key={step.status} className="flex items-center gap-2">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  step.completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400"
                )}>
                  <step.icon className="w-5 h-5" />
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  step.completed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                )}>
                  {step.label}
                </span>
                {idx < arr.length - 1 && (
                  <div className="w-8 h-0.5 bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
