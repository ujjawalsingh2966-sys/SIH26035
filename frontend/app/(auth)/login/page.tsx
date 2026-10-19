'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Scale, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending.current) return
    pending.current = true
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      let data: { success?: boolean; error?: string; errors?: Array<{ msg?: string }>; data?: { token?: string; user?: { role?: string } } }
      try {
        data = await res.json()
      } catch {
        setError(res.ok ? 'The W8LAB server returned an unreadable response.' : `Sign in failed (HTTP ${res.status}). Please try again.`)
        return
      }

      if (!res.ok || !data.success || !data.data?.token || !data.data.user?.role) {
        if (res.status === 401) {
          setError('Invalid email or password.')
        } else {
          const validation = data.errors?.map(item => item.msg).filter(Boolean).join(' ')
          setError(data.error || validation || `Sign in failed (HTTP ${res.status}). Please try again.`)
        }
        return
      }

      localStorage.setItem('nawi_token', data.data.token)
      router.push(data.data.user.role === 'Business' ? '/applications' : '/dashboard')
    } catch {
      setError('Unable to reach the W8LAB server. Check your connection and try again.')
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return (
    <div className="mesh-background min-h-screen flex flex-col">
      {/* Top decorative bar */}
      <div className="h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 w-full" />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

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
                  <h1 className="text-3xl font-bold tracking-tight">W8LAB</h1>
                  <p className="text-indigo-200 text-sm font-medium">Legal Metrology Platform</p>
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-2xl font-semibold leading-tight">
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
                    System Operational
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
          <div className="w-full md:w-7/12 p-8 md:p-12">
            <div className="max-w-md mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sign In</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Access W8LAB to perform instrument verifications
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Use your administrator-provisioned account. Your saved role determines access.</p>
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

                <div>
                  <label htmlFor="staff-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    autoComplete="username"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="technician@example.com"
                    className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="staff-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="staff-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
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

                <p className="text-sm text-slate-600 dark:text-slate-300">Need access or a password reset? Contact your laboratory administrator.</p>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-lg w-full rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30 disabled:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-100"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-sm text-indigo-700 dark:text-indigo-300">
                <p><Link href="/business/login" className="underline">Business sign in</Link></p>
                <p><Link href="/register" className="underline">Create a Business account</Link></p>
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
        <p>W8LAB &copy; 2024 - Weighing Instrument Testing & Inspection</p>
        <p className="mt-1">Legal Metrology Verification Platform</p>
      </div>
    </div>
  )
}
