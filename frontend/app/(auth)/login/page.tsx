"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, Scale, ShieldCheck } from "lucide-react"
import { post } from "../../lib/api"
import { startEvaluatorDemo } from "../../lib/demo"

const steps = [
  { number: "01", name: "Register instruments", detail: "Capture identification and verification parameters." },
  { number: "02", name: "Evaluate observations", detail: "Follow the laboratory test and review workflow." },
  { number: "03", name: "Review evidence", detail: "Track decisions, reports and prototype records." }
]

export default function LoginPage() {
  const router = useRouter()
  const pending = useRef(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [register, setRegister] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState("")

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setLoading(true)
    setError("")
    setMessage("")
    try {
      if (register) {
        await post("/auth/register", { name, email, password })
        setRegister(false)
        setPassword("")
        setMessage("Business account created. Sign in to submit a verification application.")
      } else {
        const response = await post<{ token: string; user?: { role?: string } }>("/auth/login", { email, password })
        if (!response?.token) throw new Error("Sign in failed. Please try again.")
        localStorage.setItem("nawi_token", response.token)
        router.replace(["Technician", "Reviewer", "Administrator"].includes(response.user?.role ?? "") ? "/dashboard" : "/applications")
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to continue. Please try again.")
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  const launchDemo = async () => {
    if (demoLoading || loading) return
    setDemoLoading(true)
    setDemoError("")
    try {
      await startEvaluatorDemo()
      router.replace("/dashboard")
    } catch (cause: unknown) {
      setDemoError(cause instanceof Error ? cause.message : "Unable to start demo access.")
    } finally {
      setDemoLoading(false)
    }
  }

  const toggleMode = () => {
    if (loading) return
    setRegister(current => !current)
    setError("")
    setMessage("")
    setPassword("")
  }

  return (
    <main className="w8-login">
      <div className="w8-login-brandbar">
        <a href="/" className="w8-login-wordmark" aria-label="W8LAB home">
          <Scale size={29} strokeWidth={1.65} aria-hidden="true" /><span>W8LAB<span className="w8-login-dot">.</span></span>
        </a>
        <span>NAWI VERIFICATION PLATFORM</span>
      </div>

      <div className="w8-login-layout">
        <section className="w8-login-story" aria-labelledby="login-story-title">
          <div className="w8-story-overline">METROLOGY / EVIDENCE / WORKFLOW</div>
          <h1 id="login-story-title">Measure with clarity.<br/><em>Decide with confidence.</em></h1>
          <p>One workspace for weighing instrument testing, recorded observations, verification applications and accountable review.</p>
          <div className="w8-story-steps" aria-label="Workflow overview">
            {steps.map(step => <div className="w8-story-step" key={step.number}>
              <span>{step.number}</span>
              <div><strong>{step.name}</strong><p>{step.detail}</p></div>
              <Check size={17} aria-hidden="true" />
            </div>)}
          </div>
          <div className="w8-story-bottom"><div className="w8-story-line" aria-hidden="true"/><span>OIML R76-guided testing · Pilot software</span></div>
        </section>

        <section className="w8-login-form-section" aria-labelledby="login-form-title">
          <div className="w8-auth-panel">
            <div className="w8-auth-eyebrow"><ShieldCheck size={16} aria-hidden="true"/> SECURE WORKSPACE ACCESS</div>
            <h2 id="login-form-title">{register ? "Create your business account" : "Welcome back"}</h2>
            <p className="w8-auth-description">{register ? "Start and track verification applications with a Business account." : "Sign in using your registered account to access W8LAB."}</p>

            {message && <div className="w8-auth-message" role="status">{message}</div>}
            {error && <div className="w8-auth-error" role="alert">{error}</div>}

            <form onSubmit={submit} aria-busy={loading} className="w8-auth-form">
              {register && <div className="w8-auth-field">
                <label htmlFor="business-name">Your name</label>
                <input id="business-name" name="name" type="text" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Full name"/>
              </div>}
              <div className="w8-auth-field">
                <label htmlFor="login-email">Email address</label>
                <input id="login-email" type="email" name="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@organization.com"/>
              </div>
              <div className="w8-auth-field">
                <div className="w8-auth-field-head"><label htmlFor="login-password">Password</label><span>{register ? "12+ characters" : "Required"}</span></div>
                <div className="w8-password-input">
                  <input id="login-password" name="password" type={showPassword ? "text" : "password"} required minLength={register ? 12 : 1} maxLength={128} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password"/>
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(current => !current)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>
                </div>
              </div>
              <button className="w8-auth-submit" type="submit" disabled={loading}>
                {loading ? <LoaderCircle size={19} className="w8-auth-spinner" aria-hidden="true"/> : <span>{register ? "Create business account" : "Sign in to workspace"}</span>}
                {loading ? (register ? "Creating account…" : "Signing in…") : <ArrowRight size={19} aria-hidden="true"/>}
              </button>
            </form>
            <button className="w8-auth-toggle" type="button" disabled={loading} onClick={toggleMode}>
              {register ? "Already have an account? Sign in" : "New business? Create an account"} <ArrowRight size={15} aria-hidden="true"/>
            </button>
            <section className="w8-demo-entry" aria-label="Evaluator demo access">
              <div className="w8-demo-entry-top"><span className="w8-demo-dot" aria-hidden="true" /> EVALUATOR ACCESS</div>
              <h3>Explore W8LAB for 24 hours</h3>
              <p>Get one demo ID in this browser and switch between Lab Technician, Reviewing Officer and System Administrator. Demo records stay separate from real accounts.</p>
              {demoError && <p role="alert" className="w8-auth-error">{demoError}</p>}
              <button type="button" className="w8-demo-launch" onClick={launchDemo} disabled={loading || demoLoading}>
                {demoLoading ? <LoaderCircle size={17} className="w8-auth-spinner" aria-hidden="true"/> : <ShieldCheck size={18} aria-hidden="true"/>}
                {demoLoading ? "Preparing demo workspace…" : "Generate / Resume Demo ID"}
                <ArrowRight size={17} aria-hidden="true"/>
              </button>
              <small>One session per browser profile (best effort). Clearing browser data or using another browser can create a new ID.</small>
            </section>
            <div className="w8-auth-footnote">Staff accounts are provisioned by an administrator. For access or password assistance, contact your laboratory administrator.</div>
          </div>
        </section>
      </div>
      <footer className="w8-login-footer"><span>© W8LAB · Instrument verification workspace</span><span>Prototype outputs are not statutory certificates.</span></footer>
    </main>
  )
}
