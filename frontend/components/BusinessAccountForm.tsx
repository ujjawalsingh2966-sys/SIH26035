'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Scale } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
const inputClass = 'block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function BusinessAccountForm({ register = false }: { register?: boolean }) {
  const router = useRouter()
  const pending = useRef(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(register ? { name, email, password } : { email, password })
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(typeof result.error === 'string' ? result.error : result.errors?.map((item: { msg: string }) => item.msg).join(' ') || 'Unable to save your request. Please try again.')
        return
      }
      if (register) {
        setPassword('')
        setCreated(true)
      } else {
        // This sign-in view cannot be used to select or gain a staff role.
        if (result.data.user.role !== 'Business') {
          setError('Use laboratory staff sign in for this account.')
          return
        }
        localStorage.setItem('nawi_token', result.data.token)
        router.push('/applications')
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="mesh-background min-h-screen flex items-center justify-center p-4">
      <section className="w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-6 sm:p-10">
        <div className="flex items-center gap-3 mb-6" aria-label="W8LAB"><Scale className="text-indigo-600 dark:text-indigo-400" /><span className="font-bold text-xl">W8LAB</span></div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{register ? 'Create a Business account' : 'Business sign in'}</h1>
        {created ? (
          <div className="mt-6 space-y-4">
            <p role="status" className="text-emerald-800 dark:text-emerald-300">Your account has been created. Sign in to continue.</p>
            <Link href="/business/login" className="inline-block bg-indigo-600 text-white px-5 py-3 rounded-xl">Continue to Business sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
            {error && <p role="alert" className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200">{error}</p>}
            <fieldset disabled={busy} className="space-y-5">
              {register && <div><label htmlFor="business-name" className="input-label">Name</label><input id="business-name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className={inputClass} /></div>}
              <div><label htmlFor="business-email" className="input-label">Email address</label><input id="business-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className={inputClass} /></div>
              <div>
                <label htmlFor="business-password" className="input-label">Password</label>
                <input id="business-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={128} aria-describedby={register ? 'business-password-hint' : undefined} value={password} onChange={event => setPassword(event.target.value)} className={inputClass} />
                {register && <p id="business-password-hint" className="mt-2 text-sm text-slate-600 dark:text-slate-300">Use 12–128 characters.</p>}
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-70">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? (register ? 'Creating account…' : 'Signing in…') : (register ? 'Create account' : 'Sign In')}</button>
            </fieldset>
          </form>
        )}
        <div className="mt-6 space-y-3 text-sm text-indigo-700 dark:text-indigo-300">
          <p><Link className="underline" href={register ? '/business/login' : '/register'}>{register ? 'Already registered? Business sign in' : 'Create a Business account'}</Link></p>
          <p><Link className="underline" href="/login">Laboratory staff sign in</Link></p>
        </div>
      </section>
    </div>
  )
}
