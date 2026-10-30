'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Scale,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '../../lib/api'
import { useAccount } from '../../lib/account-context'

interface Instrument {
  id: string
  name: string
  model: string
  serialNumber: string
  manufacturerId: string
  isWeighing: boolean
  isManual: boolean
  isElectronic: boolean
  isSingleRange: boolean
  accuracyClass?: 'I' | 'II' | 'III' | 'IIII'
  maxCapacity?: string
  minCapacity?: string
  e?: string
  d?: string
  hasTare?: boolean
  createdAt: string
  updatedAt: string
}

export default function InstrumentsPage() {
  const account = useAccount()
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClass, setFilterClass] = useState<string>('all')

  useEffect(() => {
    setLoading(true)
    setError('')
    api<Instrument[]>('/instruments')
      .then(setInstruments)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load instruments.'))
      .finally(() => setLoading(false))
  }, [refresh])

  const filteredInstruments = instruments.filter(inst => {
    const matchesSearch =
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClass = filterClass === 'all' || inst.accuracyClass === filterClass
    return matchesSearch && matchesClass
  })

  const classCounts = instruments.reduce((acc, inst) => {
    const cls = inst.accuracyClass || 'N/A'
    acc[cls] = (acc[cls] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      case 'INACTIVE': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Scale className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading instruments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w8-instrument-registry space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Instrument Registry</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredInstruments.length} instrument{filteredInstruments.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        {account?.role === 'Technician' && <Link
          href="/instruments/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-indigo-600/20"
        >
          <PlusCircle className="w-4 h-4" />
          Register Instrument
        </Link>}
      </div>

      {error && <div role="alert" className="w8-feature-alert is-error w8-registry-error"><AlertCircle size={18} aria-hidden="true"/><span>{error}</span><button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search instruments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none cursor-pointer"
            >
              <option value="all">All Classes</option>
              <option value="I">Class I</option>
              <option value="II">Class II</option>
              <option value="III">Class III</option>
              <option value="IIII">Class IIII</option>
              <option value="N/A">No Class</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{instruments.length}</p>
        </div>
        {['I', 'II', 'III', 'IIII', 'N/A'].map((cls) => (
          <div key={cls} className="card p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Class {cls}</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{classCounts[cls] || 0}</p>
          </div>
        ))}
      </div>

      {/* Instruments Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                <th className="px-6 py-4 font-medium">Instrument</th>
                <th className="px-6 py-4 font-medium">Model</th>
                <th className="px-6 py-4 font-medium">Serial</th>
                <th className="px-6 py-4 font-medium">Class</th>
                <th className="px-6 py-4 font-medium">Capacity</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredInstruments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Scale className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">No instruments found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInstruments.map((instrument) => (
                  <tr key={instrument.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {instrument.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{instrument.name}</p>
                          <p className="text-xs text-slate-500">ID: {instrument.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {instrument.model}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-mono text-xs">
                      {instrument.serialNumber}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        instrument.accuracyClass === 'I' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                        instrument.accuracyClass === 'II' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        instrument.accuracyClass === 'III' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                        instrument.accuracyClass === 'IIII' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      )}>
                        {instrument.accuracyClass || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {instrument.maxCapacity}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {instrument.isElectronic && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200 font-medium">Electronic</span>
                        )}
                        {instrument.isSingleRange && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-50 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-200 font-medium">Single Range</span>
                        )}
                        {instrument.hasTare && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-50 dark:bg-rose-900/30 text-rose-900 dark:text-rose-200 font-medium">Tare</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end">
                        <Link href="/tests" className="w8-row-action" title="Open evaluation queue">
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          Evaluation queue
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredInstruments.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredInstruments.length} instrument{filteredInstruments.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-slate-500">Import and export are not available in this pilot.</p>
          </div>
        )}
      </div>
    </div>
  )
}
