'use client'
import { useState } from 'react'
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
  const [email, setEmail] = useState('technician@example.com')
  const [password, setPassword] = useState('dev-demo-password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState('technician')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()

      if (data.success) {
        localStorage.setItem('nawi_token', data.data.token)
        router.push(data.data.user.role === 'Business' ? '/account' : '/dashboard')
      } else {
        setError(data.error || 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
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
                  <h1 className="text-3xl font-bold tracking-tight">ANCRS</h1>
                  <p className="text-indigo-200 text-sm font-medium">Legal Metrology Platform</p>
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-2xl font-semibold leading-tight">
                  Automated NAWI Compliance & Reporting System
                </h2>
                <p className="text-indigo-100/80 leading-relaxed text-sm">
                  A comprehensive platform for Non-Automatic Weighing Instruments verification, testing, and certification under OIML R76 standards.
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-white/20">
                <div className="flex items-center gap-2 text-sm text-indigo-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    System Operational
                  </div>
                </div>
              </div>
            </div>

            {/* Role selection preview */}
            <div className="relative z-10 mt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-3">Select Your Role</p>
              <div className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role.id)
                      setEmail(`${role.id === 'officer' ? 'reviewer' : role.id}@example.com`)
                    }}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                      ${selectedRole === role.id
                        ? 'bg-white text-indigo-900 shadow-lg shadow-indigo-900/20 scale-[1.02]'
                        : 'bg-white/5 hover:bg-white/10 text-indigo-100'}
                    `}
                  >
                    <role.icon className={`w-5 h-5 ${selectedRole === role.id ? 'text-indigo-600' : 'text-indigo-300'}`} />
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
                  Access the ANCRS platform to perform verifications
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleLogin}>
                {error && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="technician@example.com"
                    className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
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
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Remember me
                  </label>
                  <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
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
                  <p>PHASE 5 FOUNDATION DEMO</p>
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
        <p>ANCRS &copy; 2024 - Automated NAWI Compliance & Reporting System</p>
        <p className="mt-1">Legal Metrology Verification Platform</p>
      </div>
    </div>
  )
}
