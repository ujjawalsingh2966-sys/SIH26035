'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Decimal from 'decimal.js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canCreateInstrument, getSession, laboratoryApi } from '@/lib/laboratory';
import { useDashboardSession } from '@/lib/dashboardSession';
import type { RegisteredInstrument } from '@/lib/masterData';
import { registrationIssue } from '@/lib/masterData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export class CreationFailure extends Error {
  constructor(message: string, readonly confirmedRejection = false) { super(message); }
}

export async function createRecord(endpoint: string, payload: unknown, method = 'POST'): Promise<string> {
  const token = localStorage.getItem('nawi_token');
  if (!token) throw new CreationFailure('Please sign in again before saving.', true);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new CreationFailure('The save response was not received.');
  }

  let result;
  try { result = await response.json(); }
  catch { throw new CreationFailure('The save response could not be read.'); }

  // These API validation/authentication rejections occur before the record is saved.
  // Network errors, timeouts and server failures cannot safely authorize another POST.
  if (response.status >= 400 && response.status < 500 && response.status !== 408 && result.success === false) {
    const message = result.error || result.errors?.map((error: { path?: string; msg: string }) => `${error.path || 'Request'}: ${error.msg}`).join('; ');
    throw new CreationFailure(message || 'The save was rejected. Please check the form and retry.', true);
  }
  if (!response.ok || result.success !== true || typeof result.data?.id !== 'string' || !result.data.id) {
    throw new CreationFailure('The save outcome could not be confirmed.');
  }
  return result.data.id;
}

const inputClassName = [
  'border border-slate-300 bg-white p-2 text-slate-900 caret-slate-900 placeholder:text-slate-500',
  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:caret-slate-100 dark:placeholder:text-slate-400',
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
  'dark:focus:border-blue-400 dark:focus:ring-blue-400/30',
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 disabled:placeholder:text-slate-600 disabled:opacity-100',
  'dark:disabled:bg-slate-900 dark:disabled:text-slate-400 dark:disabled:placeholder:text-slate-400',
  'autofill:bg-white autofill:text-slate-900 autofill:caret-slate-900 autofill:shadow-[inset_0_0_0_1000px_#ffffff]',
  'autofill:[-webkit-text-fill-color:#0f172a] dark:autofill:bg-slate-800 dark:autofill:text-slate-100',
  'dark:autofill:caret-slate-100 dark:autofill:shadow-[inset_0_0_0_1000px_#1e293b]',
  'dark:autofill:[-webkit-text-fill-color:#f1f5f9] w-full min-w-0 rounded transition-colors',
].join(' ');

const measurementInputClassName = [
  'border border-slate-300 bg-blue-50 p-2 font-mono text-slate-900 caret-slate-900 placeholder:text-slate-600',
  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:caret-slate-100 dark:placeholder:text-slate-400',
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
  'dark:focus:border-blue-400 dark:focus:ring-blue-400/30',
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 disabled:placeholder:text-slate-600 disabled:opacity-100',
  'dark:disabled:bg-slate-900 dark:disabled:text-slate-400 dark:disabled:placeholder:text-slate-400',
  'autofill:bg-blue-50 autofill:text-slate-900 autofill:caret-slate-900 autofill:shadow-[inset_0_0_0_1000px_#eff6ff]',
  'autofill:[-webkit-text-fill-color:#0f172a] dark:autofill:bg-slate-800 dark:autofill:text-slate-100',
  'dark:autofill:caret-slate-100 dark:autofill:shadow-[inset_0_0_0_1000px_#1e293b]',
  'dark:autofill:[-webkit-text-fill-color:#f1f5f9] w-full min-w-0 rounded transition-colors',
].join(' ');

const checkboxClassName = [
  'h-5 w-5 accent-blue-600 dark:accent-blue-500',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
  'focus-visible:ring-offset-white dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-800',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export default function NewInstrumentPage() {
  const session = useDashboardSession();
  if (!session) return <p role="status" className="card p-6 text-slate-900 dark:text-slate-100">Loading session…</p>;
  if (!canCreateInstrument(session)) return (
    <div className="card space-y-4 p-6 text-slate-900 dark:text-slate-100">
      <h1 className="text-xl text-slate-900 dark:text-slate-100">Instrument creation unavailable</h1>
      <p>Instrument creation is available to Technicians. You can view instruments and continue your review workflow.</p>
      <div className="flex flex-wrap gap-4 text-indigo-700 dark:text-indigo-300">
        <Link href="/instruments" className="underline">View instruments</Link>
        <Link href="/tests" className="underline">Evaluation Queue</Link>
      </div>
    </div>
  );
  return <NewInstrumentForm key={session.id} technicianId={session.id} />;
}

export function NewInstrumentForm({ technicianId, existing }: { technicianId: string; existing?: RegisteredInstrument }) {
  const router = useRouter();
  const [step, setStep] = useState(existing ? 2 : 1);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const uncertainSave = useRef(false);
  const saved = useRef<{ instrumentId?: string; testCaseId?: string }>({});
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState('');
  const [savedInstrumentId, setSavedInstrumentId] = useState<string>();
  const [savedTestCaseId, setSavedTestCaseId] = useState<string>();
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [manufacturers, setManufacturers] = useState<{ id: string; name: string; identifier: string }[]>([]);
  const [manufacturerQuery, setManufacturerQuery] = useState('');
  const [manufacturerLoading, setManufacturerLoading] = useState(true);
  const loadManufacturers = async () => {
    setManufacturerLoading(true);
    try { setManufacturers(await laboratoryApi('/manufacturers')); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Manufacturer directory unavailable.'); }
    finally { setManufacturerLoading(false); }
  };
  useEffect(() => { void loadManufacturers(); }, []);

  const [formData, setFormData] = useState({
    manufacturerId: existing?.manufacturerId || '',
    name: existing?.name || '',
    model: existing?.model || '',
    serialNumber: existing?.serialNumber || '',

    // Gate properties
    isWeighing: true,
    isManual: true,
    isElectronic: true,
    isSingleRange: true,

    // Config limits
    accuracyClass: existing?.accuracyClass || 'III',
    maxCapacity: existing?.declaredSpecifications?.maxCapacity || existing?.maxCapacity || '',
    minCapacity: existing?.declaredSpecifications?.minCapacity || existing?.minCapacity || '',
    e: existing?.declaredSpecifications?.e || existing?.e || '',
    d: existing?.declaredSpecifications?.d || existing?.d || '',
    hasTare: existing?.hasTare || false, weighingUnit: existing?.declaredSpecifications?.unit || 'g', hasAuxiliaryIndication: existing?.hasAuxiliaryIndication || false, isGrading: existing?.isGrading || false,
    softwareControlled: existing?.softwareControlled || false, softwareIdentification: existing?.softwareIdentification || '', typeApprovalMark: existing?.typeApprovalMark || '', technicalNotes: existing?.technicalNotes || ''
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentSession = getSession();
    if (!(canCreateInstrument(currentSession) || existing && currentSession?.role === 'Administrator') || currentSession?.id !== technicianId) {
      setError('Your session changed. Sign in again before creating an instrument.');
      return;
    }
    if (step !== 2 || inFlight.current || uncertainSave.current) return;
    // Close the overlap window synchronously, before React renders disabled controls.
    inFlight.current = true;
    setPending(true);
    setError('');
    let navigating = false;
    let saving = 'instrument';
    try {
      if (!formData.isWeighing || !formData.isManual || !formData.isElectronic || !formData.isSingleRange) {
        throw new CreationFailure('OUT_OF_SCOPE: Instrument does not meet OIML R76 MVP criteria.', true);
      }
      if (!saved.current.instrumentId) {
        const issue = registrationIssue(formData);
        if (issue) throw new CreationFailure(issue, true);
        setProgress('Saving instrument…');
        saved.current.instrumentId = await createRecord(existing ? `instruments/${existing.id}` : 'instruments',
          { ...formData, ...(existing ? { expectedRevision: existing.revision ?? 0 } : {}) }, existing ? 'PUT' : 'POST');
        setSavedInstrumentId(saved.current.instrumentId);
      }
      if (existing || formData.accuracyClass === 'I' || formData.hasAuxiliaryIndication || formData.isGrading) {
        router.push(`/instruments/${saved.current.instrumentId}`); navigating = true; return;
      }
      saving = 'test case';
      if (!saved.current.testCaseId) {
        setProgress('Creating test case…');
        saved.current.testCaseId = await createRecord('test-cases', { instrumentId: saved.current.instrumentId });
        setSavedTestCaseId(saved.current.testCaseId);
      }
      setProgress('Opening workspace…');
      router.push(`/test-cases/${saved.current.testCaseId}/workspace`);
      navigating = true; // Keep the guard closed until this form unmounts.
    } catch (failure) {
      if (saved.current.testCaseId) {
        setError('The instrument and test case are saved. Open the saved workspace to continue.');
      } else if (failure instanceof CreationFailure && failure.confirmedRejection) {
        setError(failure.message);
      } else {
        uncertainSave.current = true;
        setOutcomeUnknown(true);
        setError(`The ${saving} save could not be confirmed and may have completed. Check Instruments and Evaluation Queue before starting another submission. This form will not resend it.`);
      }
    } finally {
      if (!navigating) {
        inFlight.current = false;
        setPending(false);
        setProgress('');
      }
    }
  };

  const controlsLocked = pending || !!savedInstrumentId || outcomeUnknown;

  return (
    <form onSubmit={handleCreate} aria-busy={pending} className="max-w-4xl bg-white p-8 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <h1 className="mb-6 border-b border-slate-200 pb-2 font-mono text-2xl font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">{existing ? 'EDIT INSTRUMENT RECORD' : 'CREATE INSTRUMENT RECORD'}</h1>

      {error && (
        <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 font-mono font-bold text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}
      {pending && <p role="status" className="mb-4 text-slate-800 dark:text-slate-100">{progress}</p>}
      {savedInstrumentId && !pending && !outcomeUnknown && !savedTestCaseId && (
        <p role="status" className="mb-4 text-slate-800 dark:text-slate-100">Instrument saved. Retry will reuse it and create only its test case. Keep this form open to retry.</p>
      )}
      {savedTestCaseId && <a href={`/test-cases/${savedTestCaseId}/workspace`} className="mb-4 inline-block text-blue-700 underline dark:text-blue-300">Open saved workspace</a>}
      {outcomeUnknown && (
        <p className="mb-4 flex gap-4 text-blue-700 dark:text-blue-300">
          <a href="/instruments" target="_blank" rel="noreferrer" className="underline">Check Instruments</a>
          <a href="/tests" target="_blank" rel="noreferrer" className="underline">Check Evaluation Queue</a>
        </p>
      )}

      {step === 1 && (
        <fieldset disabled={controlsLocked} className="m-0 min-w-0 space-y-6 border-0 p-0">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Step 1: Statutory Classification Gate</h2>
          <div className="space-y-4 rounded border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <label className="flex items-center space-x-3 text-slate-800 dark:text-slate-100">
              <input type="checkbox" checked={formData.isWeighing} onChange={e => setFormData({...formData, isWeighing: e.target.checked})} className={checkboxClassName} />
              <span className="font-mono">Is it a Weighing Instrument?</span>
            </label>
            <label className="flex items-center space-x-3 text-slate-800 dark:text-slate-100">
              <input type="checkbox" checked={formData.isManual} onChange={e => setFormData({...formData, isManual: e.target.checked})} className={checkboxClassName} />
              <span className="font-mono">Does it require manual intervention? (NAWI)</span>
            </label>
            <label className="flex items-center space-x-3 text-slate-800 dark:text-slate-100">
              <input type="checkbox" checked={formData.isElectronic} onChange={e => setFormData({...formData, isElectronic: e.target.checked})} className={checkboxClassName} />
              <span className="font-mono">Is it fully Electronic?</span>
            </label>
            <label className="flex items-center space-x-3 text-slate-800 dark:text-slate-100">
              <input type="checkbox" checked={formData.isSingleRange} onChange={e => setFormData({...formData, isSingleRange: e.target.checked})} className={checkboxClassName} />
              <span className="font-mono">Is it a Single-Range instrument?</span>
            </label>
          </div>
          <button type="button" onClick={() => setStep(2)} className="rounded bg-blue-600 px-6 py-2 font-mono font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-900 dark:disabled:bg-slate-700 dark:disabled:text-slate-300">CONTINUE TO METADATA</button>
        </fieldset>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Step 2: Core Metadata & Limits</h2>
          <fieldset disabled={controlsLocked} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <div className="space-y-3 rounded-lg border border-slate-300 p-4 dark:border-slate-600">
              <label htmlFor="manufacturer-search" className="input-label">Search manufacturers</label>
              <input id="manufacturer-search" value={manufacturerQuery} onChange={event => setManufacturerQuery(event.target.value)} className={inputClassName} />
              <label htmlFor="instrument-manufacturer" className="input-label">Manufacturer</label>
              <select id="instrument-manufacturer" required value={formData.manufacturerId} onChange={event => setFormData({ ...formData, manufacturerId: event.target.value })} className={inputClassName}>
                <option value="">{manufacturerLoading ? 'Loading manufacturers…' : 'Select a manufacturer'}</option>
                {manufacturers.filter(item => item.id === formData.manufacturerId || `${item.name} ${item.identifier}`.toLowerCase().includes(manufacturerQuery.toLowerCase())).map(item => <option key={item.id} value={item.id}>{item.name} · {item.identifier}</option>)}
              </select>
              <p className="text-sm">No matching record? <Link href="/manufacturers/new" target="_blank" className="underline text-indigo-700 dark:text-indigo-300">Create manufacturer in a new tab</Link></p>
              <button type="button" onClick={loadManufacturers} className="min-h-11 rounded border px-4 py-2 focus-visible:ring-2 focus-visible:ring-indigo-500">Refresh manufacturers</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="instrument-name" className="input-label">Name</label>
                <input id="instrument-name" placeholder="Name (e.g. Sartorius 200)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClassName} />
              </div>
              <div className="min-w-0">
                <label htmlFor="instrument-model" className="input-label">Model</label>
                <input id="instrument-model" placeholder="Model" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className={inputClassName} />
              </div>
              <div className="min-w-0">
                <label htmlFor="instrument-serial-number" className="input-label">Serial Number</label>
                <input id="instrument-serial-number" placeholder="Serial Number" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} className={inputClassName} />
              </div>

              <div className="min-w-0">
                <label htmlFor="instrument-accuracy-class" className="input-label">Accuracy Class</label>
                <select id="instrument-accuracy-class" value={formData.accuracyClass} onChange={e => setFormData({...formData, accuracyClass: e.target.value})} className={`${inputClassName} font-mono [color-scheme:light] dark:[color-scheme:dark]`}>
                  <option value="I" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">Class I (Special)</option>
                  <option value="II" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">Class II (High)</option>
                  <option value="III" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">Class III (Medium)</option>
                  <option value="IIII" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">Class IIII (Ordinary)</option>
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="instrument-max-capacity" className="input-label">Max Capacity</label>
                <input id="instrument-max-capacity" placeholder="Max Capacity (String strictly)" value={formData.maxCapacity} onChange={e => setFormData({...formData, maxCapacity: e.target.value})} className={measurementInputClassName} />
              </div>
              <div className="min-w-0">
                <label htmlFor="instrument-min-capacity" className="input-label">Min Capacity</label>
                <input id="instrument-min-capacity" placeholder="Min Capacity" value={formData.minCapacity} onChange={e => setFormData({...formData, minCapacity: e.target.value})} className={measurementInputClassName} />
              </div>
              <div className="min-w-0">
                <label htmlFor="instrument-e" className="input-label">Verification Scale Interval (e)</label>
                <input id="instrument-e" placeholder="Verification Scale Interval (e)" value={formData.e} onChange={e => setFormData({...formData, e: e.target.value})} className={measurementInputClassName} />
              </div>
              <div className="min-w-0">
                <label htmlFor="instrument-d" className="input-label">Actual Scale Interval (d)</label>
                <input id="instrument-d" placeholder="Actual Scale Interval (d)" value={formData.d} onChange={e => setFormData({...formData, d: e.target.value})} className={measurementInputClassName} />
              </div>
            </div>

            <label htmlFor="weighing-unit" className="input-label">Weighing unit for Max, Min, e and d</label>
            <select id="weighing-unit" value={formData.weighingUnit} onChange={event => setFormData({ ...formData, weighingUnit: event.target.value })} className={inputClassName}>{['mg', 'g', 'kg', 't'].map(unit => <option key={unit}>{unit}</option>)}</select>
            <p className="text-sm">n = Max/e: <output aria-label="Number of verification scale intervals">{(() => { try { const max = new Decimal(formData.maxCapacity), e = new Decimal(formData.e); return max.gt(0) && e.gt(0) ? max.div(e).toString() : 'Not determined'; } catch { return 'Not determined'; } })()}</output>. Stored measurement specifications are normalized to grams.</p>
            {(['hasAuxiliaryIndication', 'isGrading', 'softwareControlled'] as const).map(key => <label key={key} className="flex items-center gap-3"><input type="checkbox" className={checkboxClassName} checked={formData[key]} onChange={event => setFormData({ ...formData, [key]: event.target.checked, ...(key === 'softwareControlled' && !event.target.checked ? { softwareIdentification: '' } : {}) })} /><span>{key === 'hasAuxiliaryIndication' ? 'Auxiliary indicating device fitted' : key === 'isGrading' ? 'Grading instrument for transport tariff/toll' : 'Software-controlled instrument'}</span></label>)}
            {formData.softwareControlled && <div><label htmlFor="instrument-software" className="input-label">Software identification</label><input id="instrument-software" required maxLength={160} value={formData.softwareIdentification} onChange={event => setFormData({ ...formData, softwareIdentification: event.target.value })} className={inputClassName} /></div>}
            <div><label htmlFor="instrument-approval-mark" className="input-label">Type approval mark (if applicable; not independently verified)</label><input id="instrument-approval-mark" maxLength={160} value={formData.typeApprovalMark} onChange={event => setFormData({ ...formData, typeApprovalMark: event.target.value })} className={inputClassName} /></div>
            <div><label htmlFor="instrument-notes" className="input-label">Technical characteristics / additional markings (if applicable)</label><textarea id="instrument-notes" value={formData.technicalNotes} onChange={event => setFormData({ ...formData, technicalNotes: event.target.value })} className={inputClassName} maxLength={1000} /></div>
            {(formData.accuracyClass === 'I' || formData.hasAuxiliaryIndication || formData.isGrading) && <p role="status" className="rounded border border-amber-500 p-3">This profile can be registered after metadata validation, but native evaluation is not supported. Saving opens its details without creating a test case.</p>}
            <label className="mt-4 flex items-center space-x-3 text-slate-800 dark:text-slate-100">
              <input type="checkbox" checked={formData.hasTare} onChange={e => setFormData({...formData, hasTare: e.target.checked})} className={checkboxClassName} />
              <span className="font-mono">Equipped with Tare device?</span>
            </label>
          </fieldset>

          <div className="mt-6 flex space-x-4">
            <button type="button" disabled={controlsLocked} onClick={() => setStep(1)} className="rounded bg-slate-200 px-6 py-2 font-mono font-bold text-slate-900 transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 dark:focus-visible:ring-slate-400 dark:focus-visible:ring-offset-slate-900 dark:disabled:bg-slate-800 dark:disabled:text-slate-400">BACK</button>
            <button type="submit" disabled={pending || outcomeUnknown} className="min-h-11 rounded bg-green-700 px-6 py-2 font-mono font-bold text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 dark:bg-green-700 dark:hover:bg-green-800 dark:focus-visible:ring-green-500 dark:focus-visible:ring-offset-slate-900 dark:disabled:bg-slate-700 dark:disabled:text-slate-300">{pending ? progress : savedTestCaseId ? 'OPEN SAVED WORKSPACE' : savedInstrumentId ? 'RETRY TEST CASE' : existing ? 'SAVE REGISTRATION' : formData.accuracyClass === 'I' || formData.hasAuxiliaryIndication || formData.isGrading ? 'REGISTER PROFILE ONLY' : 'SUBMIT & INITIATE TEST'}</button>
          </div>
        </div>
      )}
    </form>
  );
}
