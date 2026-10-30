"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Plus, Scale, Settings2 } from "lucide-react"
import { api, post } from "../../../lib/api"

type Manufacturer = { id: string; name: string }
type Instrument = {
  manufacturerId: string; name: string; model: string; serialNumber: string;
  isWeighing: boolean; isManual: boolean; isElectronic: boolean; isSingleRange: boolean;
  accuracyClass: string; maxCapacity: string; minCapacity: string; e: string; d: string; hasTare: boolean
}
const initial: Instrument = {
  manufacturerId: "", name: "", model: "", serialNumber: "",
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
  accuracyClass: "III", maxCapacity: "", minCapacity: "", e: "", d: "", hasTare: false
}

export default function NewInstrumentPage() {
  const router = useRouter()
  const pending = useRef(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<Instrument>(initial)
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loadingManufacturers, setLoadingManufacturers] = useState(true)
  const [showManufacturerForm, setShowManufacturerForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [creatingManufacturer, setCreatingManufacturer] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    api<Manufacturer[]>("/manufacturers")
      .then(data => setManufacturers(data))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load manufacturers."))
      .finally(() => setLoadingManufacturers(false))
  }, [])

  const setValue = (field: keyof Instrument, value: string | boolean) =>
    setForm(current => ({ ...current, [field]: value }))

  function nextStep() {
    setError("")
    if (!form.isWeighing || !form.isManual || !form.isElectronic || !form.isSingleRange) {
      setError("Out of scope: this pilot requires an electronic, single-range non-automatic weighing instrument.")
      return
    }
    setStep(2)
  }

  async function createManufacturer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creatingManufacturer) return
    setCreatingManufacturer(true)
    setError("")
    setMessage("")
    const values = new FormData(event.currentTarget)
    try {
      const created = await post<Manufacturer>("/manufacturers", {
        name: String(values.get("name") || "").trim(),
        address: String(values.get("address") || "").trim(),
        identifier: String(values.get("identifier") || "").trim()
      })
      setManufacturers(current => [...current, created])
      setValue("manufacturerId", created.id)
      setShowManufacturerForm(false)
      setMessage("Manufacturer added and selected.")
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to create manufacturer.")
    } finally {
      setCreatingManufacturer(false)
    }
  }

  function validate(): string | null {
    if (!form.manufacturerId) return "Choose or register a manufacturer before creating an instrument."
    if (![form.name, form.model, form.serialNumber].every(value => value.trim().length > 0)) return "Enter the instrument name, model and serial number."
    const decimal = /^(?:\d+)(?:\.\d+)?$/
    if (![form.maxCapacity, form.minCapacity, form.e, form.d].every(value => decimal.test(value))) return "Enter non-negative decimal values (in grams) for Max, Min, e and d."
    // Compare decimal strings exactly: measurement validation must not round through JS Number.
    const compareDecimal = (left: string, right: string): number => {
      const [lWhole, lFraction = ""] = left.split(".")
      const [rWhole, rFraction = ""] = right.split(".")
      const places = Math.max(lFraction.length, rFraction.length)
      const l = BigInt(lWhole + lFraction.padEnd(places, "0"))
      const r = BigInt(rWhole + rFraction.padEnd(places, "0"))
      return l > r ? 1 : l < r ? -1 : 0
    }
    const zero = "0"
    if (!(compareDecimal(form.maxCapacity, form.minCapacity) > 0 &&
      compareDecimal(form.minCapacity, zero) >= 0 &&
      compareDecimal(form.e, zero) > 0 &&
      compareDecimal(form.d, zero) > 0 &&
      compareDecimal(form.d, form.e) <= 0 &&
      compareDecimal(form.e, form.maxCapacity) <= 0)) return "Require 0 ≤ Min < Max and 0 < d ≤ e ≤ Max."
    return null
  }

  async function createInstrument() {
    if (pending.current) return
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    pending.current = true
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const instrument = await post<{ id: string }>("/instruments", form)
      try {
        const testCase = await post<{ id: string }>("/test-cases", { instrumentId: instrument.id })
        router.push("/test-cases/" + encodeURIComponent(testCase.id) + "/workspace")
      } catch (cause: unknown) {
        setMessage("Instrument created, but the test case could not be opened. You can find the instrument in the registry.")
        setError(cause instanceof Error ? cause.message : "Could not create the test case.")
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to create instrument.")
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const classification = [
    { key: "isWeighing", title: "Weighing instrument", subtitle: "Measures mass" },
    { key: "isManual", title: "Non-automatic operation", subtitle: "Requires operator intervention" },
    { key: "isElectronic", title: "Electronic instrument", subtitle: "Within this pilot's supported technology" },
    { key: "isSingleRange", title: "Single range", subtitle: "One operating range" }
  ] as const

  return <div className="w8-intake-page">
    <Link href="/instruments" className="w8-intake-back"><ArrowLeft size={17}/> Instrument registry</Link>
    <div className="w8-intake-heading"><div><div className="w8-section-label"><Scale size={15}/> LABORATORY INTAKE</div><h1>Register an instrument</h1><p>Confirm the instrument's scope and record the parameters needed for testing.</p></div><div className="w8-intake-progress"><span>STEP {step} OF 2</span><div><i className="done"/><i className={step === 2 ? "done" : ""}/></div></div></div>

    {error && <div role="alert" className="w8-feature-alert is-error">{error}</div>}
    {message && <div role="status" className="w8-feature-alert is-success">{message}{message.startsWith("Instrument created") && <> <Link href="/instruments" className="underline">Go to instrument registry</Link></>}</div>}

    <div className="w8-intake-columns">
      <section className="w8-feature-panel">
        <div className="w8-panel-intro"><div className="w8-panel-icon">{step === 1 ? <ClipboardCheck size={21}/> : <Settings2 size={21}/>}</div><div><h2>{step === 1 ? "Classification gate" : "Identification and limits"}</h2><p>{step === 1 ? "Verify that this instrument fits the pilot scope." : "Provide the instrument details exactly as recorded."}</p></div></div>
        {step === 1 ? <div className="w8-intake-options">{classification.map(item => <label key={item.key}><input type="checkbox" checked={form[item.key]} onChange={event => setValue(item.key,event.target.checked)}/><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><Check size={18} className={form[item.key] ? "selected" : "not-selected"}/></label>)}</div> :
        <div className="w8-intake-form">
          <div className="w8-intake-row">
            <label>Instrument name<input value={form.name} onChange={event => setValue("name", event.target.value)} placeholder="Name of weighing instrument" maxLength={120}/></label>
            <label>Model<input value={form.model} onChange={event => setValue("model", event.target.value)} placeholder="Manufacturer model" maxLength={120}/></label>
          </div>
          <label>Serial number<input value={form.serialNumber} onChange={event => setValue("serialNumber", event.target.value)} placeholder="Instrument serial number" maxLength={120}/></label>
          <div className="w8-intake-row">
            <label>Manufacturer<select disabled={loadingManufacturers} value={form.manufacturerId} onChange={event => setValue("manufacturerId",event.target.value)}><option value="">{loadingManufacturers ? "Loading manufacturers…" : "Select manufacturer"}</option>{manufacturers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Accuracy class<select value={form.accuracyClass} onChange={event => setValue("accuracyClass", event.target.value)}><option value="I">Class I</option><option value="II">Class II</option><option value="III">Class III</option><option value="IIII">Class IIII</option></select></label>
          </div>
          <button type="button" className="w8-intake-inline" onClick={() => setShowManufacturerForm(value => !value)} aria-expanded={showManufacturerForm}><Plus size={15}/> {showManufacturerForm ? "Close manufacturer form" : "Register a manufacturer"}</button>
          {showManufacturerForm && <form className="w8-manufacturer-form" onSubmit={createManufacturer}><h3>New manufacturer</h3><label>Name<input name="name" required placeholder="Manufacturer's name"/></label><label>Address<input name="address" required placeholder="Manufacturer's address"/></label><label>Identifier<input name="identifier" required placeholder="Registration identifier"/></label><button type="submit" className="w8-feature-button" disabled={creatingManufacturer}>{creatingManufacturer ? "Saving manufacturer…" : "Save manufacturer"}</button></form>}
          <div className="w8-intake-measure-label">MEASUREMENT PARAMETERS · GRAMS</div>
          <div className="w8-intake-row">
            <label>Maximum capacity (Max)<input inputMode="decimal" value={form.maxCapacity} onChange={event => setValue("maxCapacity", event.target.value)} placeholder="Max (g)"/></label>
            <label>Minimum capacity (Min)<input inputMode="decimal" value={form.minCapacity} onChange={event => setValue("minCapacity", event.target.value)} placeholder="Min (g)"/></label>
            <label>Verification scale interval (e)<input inputMode="decimal" value={form.e} onChange={event => setValue("e", event.target.value)} placeholder="e (g)"/></label>
            <label>Actual scale interval (d)<input inputMode="decimal" value={form.d} onChange={event => setValue("d", event.target.value)} placeholder="d (g)"/></label>
          </div>
          <label className="w8-intake-check"><input type="checkbox" checked={form.hasTare} onChange={event => setValue("hasTare",event.target.checked)}/>Instrument has a tare device</label>
        </div>}
        <div className="w8-intake-actions">
          {step === 1 ? <button type="button" className="w8-feature-button" onClick={nextStep}>Continue to instrument details <ArrowRight size={17}/></button> :
            <><button type="button" className="w8-intake-secondary" onClick={() => setStep(1)} disabled={busy}><ArrowLeft size={17}/> Back</button><button type="button" className="w8-feature-button" onClick={createInstrument} disabled={busy || creatingManufacturer}>{busy ? "Creating instrument…" : "Register & initiate test"} <ArrowRight size={17}/></button></>}
        </div>
      </section>
      <aside className="w8-intake-aside"><div className="w8-section-label">BEFORE YOU CONTINUE</div><h2>A trustworthy record starts here.</h2><p>Use the instrument's real identification information and scale intervals. The test case will be created after successful registration.</p><div className="w8-intake-aside-rule"/><div><span>01</span> Confirm scope and class</div><div><span>02</span> Record limits in grams</div><div><span>03</span> Enter laboratory observations</div><div className="w8-intake-aside-note">This is a pilot guided by OIML R76. It does not produce statutory certification by itself.</div></aside>
    </div>
  </div>
}
