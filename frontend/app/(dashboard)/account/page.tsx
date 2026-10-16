'use client'
import { useEffect, useState } from 'react'
import { useDashboardSession } from '@/lib/dashboardSession'
import { laboratoryApi } from '@/lib/laboratory'

interface BusinessAccount { id: string; name: string; email: string; role: string }

function AccountDetails() {
  const [account, setAccount] = useState<BusinessAccount | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setAccount(null)
    setError('')
    laboratoryApi<BusinessAccount>('/auth/me', { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setAccount(value) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [attempt])
  return (
    <section className="max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Business account</h1>
      {error ? <div className="mt-6"><p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p><button className="mt-3 rounded-lg bg-indigo-600 text-white px-4 py-2" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : !account ? <p role="status" className="mt-6">Loading account…</p> : <dl className="mt-6 space-y-5 break-words"><div><dt className="text-sm text-slate-600 dark:text-slate-300">Name</dt><dd className="mt-1 font-medium">{account.name}</dd></div><div><dt className="text-sm text-slate-600 dark:text-slate-300">Email address</dt><dd className="mt-1 font-medium">{account.email}</dd></div><div><dt className="text-sm text-slate-600 dark:text-slate-300">Account type</dt><dd className="mt-1 font-medium">{account.role}</dd></div></dl>}
    </section>
  )
}

export default function AccountPage() {
  const session = useDashboardSession()
  if (session?.role !== 'Business') return <p role="alert" className="text-slate-900 dark:text-slate-100">This account page is for Business users.</p>
  return <AccountDetails key={session.id} />
}
