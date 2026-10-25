'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ShieldCheck, FlaskConical, ClipboardCheck, Scale, Copy, ArrowRight, Loader2 } from 'lucide-react'
import { API_BASE_URL } from './lib/api'

type Credential = { role: 'Technician' | 'Reviewer' | 'Administrator'; email: string; password: string }
type DemoWorkspace = { workspaceId: string; expiresAt: string; credentials: Credential[] }
const descriptions: Record<string, string> = {
  Technician: 'Register NAWI instruments, enter test observations, and submit cases.',
  Reviewer: 'Inspect evidence, review submitted cases, and request corrections.',
  Administrator: 'Explore administrative features and review the evaluation workflow.',
}

export default function Home() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<DemoWorkspace | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function generate() {
    setBusy('generate')
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/evaluator-demo/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not generate demo accounts')
      const data = result.data as DemoWorkspace
      setWorkspace(data)
      sessionStorage.setItem('w8lab_evaluator_demo', JSON.stringify(data))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Demo service unavailable')
    } finally { setBusy('') }
  }
  async function signIn(credential: Credential) {
    setBusy(credential.role)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/evaluator-demo/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credential.email, password: credential.password }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not sign in')
      localStorage.setItem('nawi_token', result.data.token)
      router.push('/dashboard')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Demo login failed')
    } finally { setBusy('') }
  }

  return <main className="min-h-screen bg-[#080d1a] text-white">
    <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between border-b border-white/10">
      <Link href="/" className="flex items-center gap-3 font-bold text-xl"><Scale className="text-indigo-400"/> W8LAB</Link>
      <div className="flex gap-3 items-center text-sm">
        <a href="#evaluator" className="text-indigo-200 hover:text-white">Evaluator Access</a>
        <Link href="/login" className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/10">Staff Sign In</Link>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
      <div>
        <p className="uppercase tracking-[.22em] text-indigo-300 text-xs font-semibold">Smart India Hackathon · SIH26035</p>
        <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">Digital NAWI testing, review & reporting.</h1>
        <p className="mt-6 text-slate-300 text-lg">Explore W8LAB's OIML R76-guided laboratory evaluation workflow, from instrument registration through observations, review and digital reports.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#evaluator" className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400">Evaluator Demo Access</a>
          <Link href="/login" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">Regular Sign In</Link>
        </div>
        <p className="mt-6 text-xs text-slate-400">Demonstration reports are prototypes, not official verification certificates.</p>
      </div>
      <div className="rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-900/40 to-slate-900 p-8 shadow-xl">
        <ShieldCheck className="h-10 w-10 text-emerald-400"/>
        <h2 className="mt-5 text-2xl font-bold">Explore the complete workflow</h2>
        <div className="mt-6 space-y-5">
          {[
            { title: '01 — Lab Technician', text: 'Register, test and submit cases' },
            { title: '02 — Reviewing Officer', text: 'Review observations and send corrections' },
            { title: '03 — System Administrator', text: 'Explore administration and approved reports' },
          ].map((step) => <div key={step.title} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="font-semibold">{step.title}</p><p className="text-slate-300 text-sm mt-1">{step.text}</p>
          </div>)}
        </div>
      </div>
    </section>
    <section id="evaluator" className="border-t border-white/10 bg-[#0d1426]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-indigo-300 font-semibold text-sm">SIH EVALUATOR PORTAL</p>
          <h2 className="mt-3 text-3xl font-bold">Generate your private demo workspace</h2>
          <p className="mt-4 text-slate-300">Generate three temporary credentials and explore real role-based workflows. Your sample data is separate from live accounts and other evaluators. Accounts expire after 24 hours.</p>
        </div>
        {error && <div role="alert" className="mt-6 rounded-lg border border-rose-500/50 bg-rose-950/50 px-4 py-3 text-rose-200">{error}</div>}
        {!workspace && <button disabled={busy !== ''} onClick={generate} className="mt-8 rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400 disabled:opacity-50 flex gap-2 items-center">
          {busy === 'generate' ? <Loader2 className="animate-spin"/> : <ShieldCheck/>} Generate Demo Credentials
        </button>}
        {workspace && <div className="mt-8">
          <p className="text-sm text-emerald-300" role="status">Demo workspace created. Expires: {new Date(workspace.expiresAt).toLocaleString()}</p>
          <p className="text-xs text-amber-200 mt-2">Copy the credentials now. They will not be shown by the server again. Only use these accounts for demonstration.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {workspace.credentials.map((credential) => <div key={credential.role} className="rounded-2xl border border-white/15 bg-slate-900 p-5">
              <div className="flex items-center gap-2 text-indigo-300">
                {credential.role === 'Technician' ? <FlaskConical/> : credential.role === 'Reviewer' ? <ClipboardCheck/> : <ShieldCheck/>}
                <h3 className="font-bold">{credential.role === 'Reviewer' ? 'Reviewing Officer' : credential.role === 'Technician' ? 'Lab Technician' : 'System Administrator'}</h3>
              </div>
              <p className="text-sm text-slate-300 mt-3 min-h-16">{descriptions[credential.role]}</p>
              <p className="mt-4 text-xs text-slate-400">Demo user ID (email)</p>
              <div className="flex gap-2 items-start mt-1">
                <code className="text-xs break-all text-slate-100 flex-1">{credential.email}</code>
                <button aria-label={`Copy ${credential.role} email`} onClick={() => navigator.clipboard.writeText(credential.email)}><Copy className="h-4 w-4"/></button>
              </div>
              <p className="mt-4 text-xs text-slate-400">Password</p>
              <div className="flex gap-2 items-start mt-1">
                <code className="text-xs break-all text-slate-100 flex-1">{credential.password}</code>
                <button aria-label={`Copy ${credential.role} password`} onClick={() => navigator.clipboard.writeText(credential.password)}><Copy className="h-4 w-4"/></button>
              </div>
              <button disabled={busy !== ''} onClick={() => signIn(credential)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 font-semibold hover:bg-indigo-500 disabled:opacity-50">
                {busy === credential.role ? <Loader2 className="animate-spin h-4 w-4"/> : <ArrowRight className="h-4 w-4"/>} Sign in as {credential.role}
              </button>
            </div>)}
          </div>
        </div>}
      </div>
    </section>
    <footer className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-400">W8LAB · SIH26035 · Evaluator demonstration environment</footer>
  </main>
}
