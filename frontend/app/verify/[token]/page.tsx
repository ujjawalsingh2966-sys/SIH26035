"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FileCheck2, Scale, ShieldCheck } from "lucide-react"
import { API_BASE_URL } from "../../lib/api"

interface PublicCertificate {
  id: string
  instrumentName: string
  model: string
  serialNumber: string
  issuedAt: string
  validUntil: string
  status: string
  disclaimer: string
}

export default function VerifyPage({ params }: { params: { token: string } }) {
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    fetch(
      API_BASE_URL + "/api/v1/verification/public/certificates/" + encodeURIComponent(params.token),
      { cache: "no-store", signal: controller.signal },
    )
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message || "Certificate not found.")
        return body.data as PublicCertificate
      })
      .then(setCertificate)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : "Unable to verify the prototype certificate.")
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [params.token])

  const fields = certificate ? [
    ["Certificate reference", certificate.id],
    ["Instrument", certificate.instrumentName],
    ["Model", certificate.model],
    ["Serial number", certificate.serialNumber],
    ["Issued on", new Date(certificate.issuedAt).toLocaleString()],
    ["Valid until", new Date(certificate.validUntil).toLocaleString()]
  ] : []

  return <main className="w8-verify">
    <header className="w8-verify-header">
      <div className="w8-verify-brand"><Scale size={29} strokeWidth={1.6}/><strong>W8LAB<span>.</span></strong></div>
      <span>PUBLIC PROTOTYPE VERIFICATION</span>
    </header>
    <div className="w8-verify-main">
      <Link href="/login" className="w8-verify-back"><ArrowLeft size={16}/> Back to sign in</Link>
      <div className="w8-verify-intro"><div className="w8-section-label"><ShieldCheck size={16}/> REFERENCE LOOKUP</div><h1>Certificate verification</h1><p>Review the public details of a W8LAB prototype record. This lookup does not establish statutory certification.</p></div>
      <section className="w8-verify-panel" aria-live="polite">
        <div className="w8-verify-panel-head"><FileCheck2 size={25} strokeWidth={1.7}/><span>PROTOTYPE RECORD</span></div>
        {loading ? <p className="w8-verify-feedback" role="status">Checking the certificate reference…</p> :
          error ? <p className="w8-verify-feedback is-error" role="alert">{error}</p> :
          certificate ? <>
            <div className="w8-verify-status"><span className={certificate.status === "VALID" ? "is-valid" : "is-expired"}>{certificate.status === "VALID" ? "Within recorded validity" : "Expired"}</span><small>Prototype record · Public view</small></div>
            <dl className="w8-verify-details">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <p className="w8-verify-disclaimer"><ShieldCheck size={17} aria-hidden="true"/>{certificate.disclaimer}</p>
          </> : <p role="status" className="w8-verify-feedback">No certificate details were returned.</p>}
      </section>
      <p className="w8-verify-note">Only public certificate fields are displayed here. Business addresses, account identifiers and inspection details are not included.</p>
    </div>
  </main>
}
