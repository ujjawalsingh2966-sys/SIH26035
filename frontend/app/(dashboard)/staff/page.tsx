"use client"

import { useEffect, useState } from "react"
import { Mail, Shield, UserPlus, Users } from "lucide-react"
import { api, post, User } from "../../lib/api"

export default function StaffPage() {
  const [staff, setStaff] = useState<User[]>([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<User>("/auth/me")
      .then(user => {
        if (user.role !== "Administrator") throw new Error("This page is for administrators.")
        setAllowed(true)
        return api<User[]>("/auth/staff")
      })
      .then(setStaff)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load staff accounts."))
      .finally(() => setLoading(false))
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const input = new FormData(form)
    setBusy(true)
    setMessage("")
    setError("")
    try {
      await post("/auth/staff", Object.fromEntries(input))
      setStaff(await api<User[]>("/auth/staff"))
      form.reset()
      setMessage("Staff account created successfully.")
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to create staff account.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="w8-feature-page">
    <div className="w8-feature-heading">
      <div><div className="w8-section-label"><Shield size={15}/> ADMINISTRATION</div><h1>Staff accounts</h1><p>Manage access to the W8LAB verification workspace.</p></div>
      <div className="w8-feature-count"><Users size={18}/><span>{loading ? "—" : staff.length} accounts</span></div>
    </div>

    {error && <div className="w8-feature-alert is-error" role="alert">{error}</div>}
    {message && <div className="w8-feature-alert is-success" role="status">{message}</div>}
    {loading && <div role="status" className="w8-feature-placeholder">Loading staff accounts…</div>}

    {allowed && <div className="w8-staff-grid">
      <section className="w8-feature-panel" aria-labelledby="staff-create-title">
        <div className="w8-panel-intro"><div className="w8-panel-icon"><UserPlus size={21}/></div><div><h2 id="staff-create-title">Add a team member</h2><p>Create a new staff sign-in with the appropriate access level.</p></div></div>
        <form onSubmit={submit} className="w8-form-stack">
          <label>Full name<input name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} placeholder="Staff member's name"/></label>
          <label>Email address<input name="email" type="email" autoComplete="off" required maxLength={254} placeholder="person@organization.com"/></label>
          <label>Initial password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} placeholder="At least 12 characters"/></label>
          <label>Workspace role<select name="role" defaultValue="Technician">{["Technician","Reviewer","Administrator","LMO","GATC"].map(role => <option key={role} value={role}>{role}</option>)}</select></label>
          <p className="w8-field-help">Passwords must be at least 12 characters. Share credentials with the staff member through a secure channel.</p>
          <button type="submit" className="w8-feature-button" disabled={busy}><UserPlus size={18}/>{busy ? "Creating account…" : "Create staff account"}</button>
        </form>
      </section>

      <section className="w8-feature-panel" aria-labelledby="staff-list-title">
        <div className="w8-panel-intro"><div className="w8-panel-icon"><Users size={21}/></div><div><h2 id="staff-list-title">Team directory</h2><p>Accounts and roles currently registered in W8LAB.</p></div></div>
        {staff.length === 0 ? <div className="w8-staff-empty"><Users size={31} strokeWidth={1.4}/><strong>No staff accounts listed</strong><span>New staff accounts will appear here.</span></div> :
          <ul className="w8-staff-list">{staff.map(user => <li key={user.id}><span className="w8-list-avatar" aria-hidden="true">{user.name?.slice(0,1).toUpperCase() || "?"}</span><div className="w8-staff-identity"><strong>{user.name}</strong><span><Mail size={12}/>{user.email}</span></div><span className="w8-staff-role">{user.role}</span></li>)}</ul>}
      </section>
    </div>}
  </div>
}
