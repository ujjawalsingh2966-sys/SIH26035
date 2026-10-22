'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { post } from '../../lib/api'
import { Scale, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

const roles = [
  { id: 'technician', name: 'Laboratory Technician', description: 'Perform verification tests', icon: Scale },
  { id: 'officer', name: 'Reviewing Officer', description: 'Approve test results', icon: ShieldCheck },
  { id: 'admin', name: 'System Administrator', description: 'Manage system configuration', icon: ShieldCheck },
]

export default function LoginPage() {
  const router = useRouter()
  const pending = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [register, setRegister] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending.current) return
    pending.current = true
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (register) {
        await post('/auth/register', { name, email, password })
        setRegister(false)
        setPassword('')
        setMessage('Business account created. Sign in to submit an application.')
      } else {
        const data = await post<{ token: string; user?: { role?: string } }>('/auth/login', { email, password })
        if (!data?.token) throw new Error('Sign in failed. Please try again.')
        localStorage.setItem('nawi_token', data.token)
        router.replace(data.user?.role === 'Business' ? '/applications' : '/dashboard')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in. Please try again.')
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  const toggleRegistration = () => {
    if (loading) return
    setRegister(!register)
    setError('')
    setMessage('')
    setPassword('')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#070b19] text-slate-100">
      {/* Top decorative bar */}
      <div className="h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 w-full" />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-800">

          {/* Left side - Branding */}
          <div className="w-full md:w-5/12 bg-slate-800 p-8 md:p-10 flex flex-col justify-between text-white relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-slate-900/50 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-slate-900/30 rounded-full blur-2xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Scale className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">W8LAB</h1>
                  <p className="text-indigo-200 text-sm font-medium">Legal Metrology Platform</p>
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-2xl font-semibold leading-tight text-white">
                  Weighing Instrument Testing & Inspection
                </h2>
                <p className="text-indigo-100/80 leading-relaxed text-sm">
                  Laboratory measurement entry, evaluation and reporting for Non-Automatic Weighing Instruments. Sign in does not establish compliance.
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-white/20">
                <div className="flex items-center gap-2 text-sm text-indigo-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    Secure staff access
                  </div>
                </div>
              </div>
            </div>

            {/* Role selection preview */}
            <div className="relative z-10 mt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-3">Laboratory staff access</p>
              <div className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 text-indigo-100"
                  >
                    <role.icon className="w-5 h-5 text-indigo-300" />
                    <div>
                      <p className="text-sm font-medium">{role.name}</p>
                      <p className="text-xs opacity-80">{role.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="w-full md:w-7/12 p-8 md:p-12 bg-slate-900 text-slate-100">
            <div className="max-w-md mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">{register ? "Register your business" : "Sign In"}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {register ? "Create your W8LAB Business account" : "Access W8LAB to perform instrument verifications"}
                </p>
                <p className="mt-2 text-sm text-slate-300">{register ? "Business registration is self-service. Staff accounts are created by an administrator." : "Use your administrator-provisioned or Business account. Your saved role determines access."}</p>
              </div>

              <form className="space-y-5" onSubmit={handleLogin} aria-busy={loading}>
                {error && (
                  <div role="alert" className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
                    <div className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                )}

                {register && (
                  <div>
                    <label htmlFor="business-name" className="block text-sm font-medium text-slate-300 mb-1.5">Your name</label>
                    <input id="business-name" name="name" type="text" autoComplete="name"
                      minLength={2} maxLength={120} required value={name} onChange={e => setName(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                )}
                {message && <p role="status" className="p-3 rounded-lg bg-emerald-900/40 text-emerald-200">{message}</p>}
                <div>
                  <label htmlFor="staff-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="block w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="staff-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="staff-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={register ? "new-password" : "current-password"}
                      maxLength={128}
                      minLength={register ? 12 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-4 pr-12 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-300">{register ? "Use a strong password with at least 12 characters." : "Need staff access or a password reset? Contact your laboratory administrator."}</p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {register ? "Creating account..." : "Signing in..."}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      {register ? "Create business account" : "Sign In"}
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-sm text-indigo-300">
                <button type="button" onClick={toggleRegistration} disabled={loading}
                  className="underline hover:text-white disabled:opacity-50">
                  {register ? 'Already registered? Sign in' : 'New business? Create an account'}
                </button>
                {!register && <p className="text-slate-400">Business and laboratory staff use this sign-in form.</p>}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <p>STAFF ACCESS · W8LAB</p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      v1.0.0
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-slate-400">
        <p>W8LAB — Weighing Instrument Testing & Inspection</p>
        <p className="mt-1">Legal Metrology Verification Platform</p>
      </div>
    </div>
  )
}
