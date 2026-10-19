'use client';
import { useRef, useState } from 'react';
import { masterButton, masterField } from '@/lib/masterData';
import { blankPerformanceReading, nativeFormIssue } from '@/lib/native';
import type { PerformanceProfile, NativeProgramme, NativeTestRecord, NativeSubmission, NativeReading, ProcedureDecision } from '@/lib/native';
import { CreationFailure } from './InstrumentRegistration';
export function PerformanceDeclaration({ value: p, onChange, hasTare }: {
    value: PerformanceProfile;
    onChange: (p: PerformanceProfile) => void;
    hasTare: boolean;
}) {
    const change = (key: keyof PerformanceProfile, value: unknown) => onChange({ ...p, [key]: value });
    const tri = (key: keyof PerformanceProfile, label: string) => <label className="block" key={key}>{label}<select aria-label={label} className={masterField} value={p[key] === null ? 'UNKNOWN' : p[key] ? 'YES' : 'NO'} onChange={e => change(key, e.target.value === 'UNKNOWN' ? null : e.target.value === 'YES')}>{['UNKNOWN', 'YES', 'NO'].map(v => <option key={v}>{v}</option>)}</select></label>;
    const mass = (key: keyof PerformanceProfile, label: string) => <label className="block" key={key}>{label} (g)<input inputMode="decimal" className={masterField} value={String(p[key] ?? '')} onChange={e => change(key, e.target.value || null)}/></label>;
    return <fieldset className="space-y-4 rounded-lg border border-indigo-400 p-4"><legend className="px-2 font-semibold">P4A performance characteristics</legend><p>Use actual manufacturer documentation. Blank/UNKNOWN is undetermined, never an absent device. Targets are not laboratory observations. Existing saved P3 evidence is not upgraded or recalculated.</p><div className="grid gap-4 md:grid-cols-2">
    {tri('selfIndicating', 'Self-indicating instrument')}{tri('mobile', 'Vehicle-mounted / mobile / portable weighbridge')}
    <label className="block">Indicating / printing devices (in order)<select aria-label="Indicating / printing devices (in order)" className={masterField} value={p.devices === null ? 'UNKNOWN' : p.devices.join(',')} onChange={e => change('devices', e.target.value === 'UNKNOWN' ? null : e.target.value.split(','))}><option value="UNKNOWN">UNKNOWN</option><option value="DISPLAY">One display only</option><option value="DISPLAY,DISPLAY">Two displays</option><option value="DISPLAY,PRINT">Display and printer</option><option value="DISPLAY,DISPLAY,PRINT">Two displays and printer</option></select></label>
    {tri('adjacentSupports', 'Support points too close for separate test areas (>4 platform supports)')}
    {hasTare && <><label className="block">Tare kind<select className={masterField} value={p.tareKind} onChange={e => change('tareKind', e.target.value)}>{['UNKNOWN', 'SUBTRACTIVE', 'ADDITIVE'].map(v => <option key={v}>{v}</option>)}</select></label>{mass('maximumTareG', 'Maximum tare effect')}{tri('tareWeighingDevice', 'Tare weighing device fitted')}{tri('combinedZeroTare', 'Combined zero / tare control')}</>}
    {mass('initialZeroRangeG', 'Upper initial zero-setting range (if fitted)')}
    <label className="block">Rolling receptor sections<input type="number" min={1} max={20} className={masterField} value={p.rollingSections ?? ''} onChange={e => change('rollingSections', e.target.value ? Number(e.target.value) : null)}/></label>{tri('rollingReverse', 'Rolling loads may travel in both directions')}{mass('rollingLoadG', 'Usual heaviest, most concentrated rolling load')}
  </div>
  <label className="block">Stability function inventory<select aria-label="Stability function inventory" className={masterField} value={p.stabilityFunctions === null ? 'UNKNOWN' : 'KNOWN'} onChange={e => change('stabilityFunctions', e.target.value === 'UNKNOWN' ? null : [])}><option value="UNKNOWN">UNKNOWN</option><option value="KNOWN">Documented — select all relevant functions</option></select></label>
  {p.stabilityFunctions !== null && <div className="grid gap-4 sm:grid-cols-2">{(['PRINT', 'STORE', 'ZERO', 'TARE'] as const).filter(f => f !== 'TARE' || hasTare).map(f => <div key={f}><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={p.stabilityFunctions!.includes(f)} onChange={e => change('stabilityFunctions', e.target.checked ? [...p.stabilityFunctions!, f] : p.stabilityFunctions!.filter(v => v !== f))}/>{f} stability function</label>{p.stabilityFunctions!.includes(f) && <label className="block">{f} documented test load within operating range (g)<input inputMode="decimal" className={masterField} value={p.stabilityLoadsG[f] ?? ''} onChange={e => change('stabilityLoadsG', { ...p.stabilityLoadsG, [f]: e.target.value })}/></label>}</div>)}</div>}
  <label className="block">Stability documentation: principle, criteria, parameters and securing<textarea maxLength={2000} className={masterField} value={p.stabilityDocumentation} onChange={e => change('stabilityDocumentation', e.target.value)}/></label><label className="block">Worst-case adjustment and type variants<textarea maxLength={2000} className={masterField} value={p.stabilityWorstCase} onChange={e => change('stabilityWorstCase', e.target.value)}/></label>
  </fieldset>;
}
export function PerformanceObservationForm({ id, programme, decision, sample, record, revision, mayRecord, onSaved, saveNative }: {
    id: string;
    programme: NativeProgramme;
    decision: ProcedureDecision;
    sample: NonNullable<ProcedureDecision['samples']>[number];
    record?: NativeTestRecord;
    revision: number;
    mayRecord: boolean;
    onSaved: () => Promise<void>;
    saveNative: (path: string, payload: unknown) => Promise<unknown>;
}) {
    const procedure = decision.id, series = sample.series, printing = procedure === 'EQUILIBRIUM' && ['PRINT', 'STORE'].includes(series);
    const guard = useRef(false), [busy, setBusy] = useState(false), [unknown, setUnknown] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
    const blank = (n: number, unit: string) => {
        const r = blankPerformanceReading(n, unit, procedure, sample.plan?.[n - 1], programme.performance?.devices?.length);
        if (printing) {
            r.outputIndication = '';
            r.following = [{ seconds: '', indication: '' }, { seconds: '', indication: '' }];
        }
        return r;
    };
    const [input, setInput] = useState<NativeSubmission>(record?.submission || { procedureId: procedure, series, readings: Array.from({ length: sample.count }, (_, j) => blank(j + 1, 'g')), conditions: {}, evidenceReference: '' });
    const unit = input.readings[0]?.unit || 'g';
    const patch = (index: number, values: Partial<NativeReading>) => setInput({ ...input, readings: input.readings.map((r, j) => j === index ? { ...r, ...values } : r) });
    const field = (index: number, key: keyof NativeReading, label: string) => { const row = input.readings[index], fieldId = `performance-${index}-${key}`; return <label className="block" key={key} htmlFor={fieldId}>{label}{!['timestamp', 'temperatureC'].includes(key) ? ` (${unit})` : key === 'temperatureC' ? ' (°C)' : ' (ISO 8601, timezone required)'}<input id={fieldId} required className={masterField} inputMode={key === 'timestamp' ? 'text' : 'decimal'} value={String(row[key] ?? '')} onChange={e => patch(index, { [key]: e.target.value })}/></label>; };
    const zeroFields = (index: number, z: NonNullable<NativeReading['zero']>, onChange: (v: typeof z) => void, prefix: string) => <fieldset className="grid gap-3 sm:grid-cols-3"><legend>{prefix} — fresh observed zero determination</legend>{(['load', 'indication', 'additionalWeights'] as const).map(k => <label className="block" key={k}>{prefix} zero {k} ({unit})<input required inputMode="decimal" className={masterField} value={z[k]} onChange={e => onChange({ ...z, [k]: e.target.value })}/></label>)}</fieldset>;
    async function save() {
        if (guard.current || unknown)
            return;
        const issue = nativeFormIssue(input, false);
        if (issue) {
            setError(issue);
            return;
        }
        guard.current = true;
        setBusy(true);
        setError('');
        setSaved(false);
        try {
            await saveNative(`/native/${id}/tests/${procedure}/${series}`, { expectedRevision: revision, submission: input });
            setSaved(true);
            await onSaved();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed.');
            if (!(e instanceof CreationFailure && e.confirmedRejection))
                setUnknown(true);
        }
        finally {
            guard.current = false;
            setBusy(false);
        }
    }
    const flags: [
        keyof NativeSubmission['conditions'],
        string
    ][] = [['stable', 'Required readings were stable'], ['sufficientAccuracy', 'Sufficient measurement accuracy confirmed by equipment evidence']];
    if (['WEIGHING', 'TARE', 'MULTIPLE_INDICATORS', 'SUPPLEMENTARY_WEIGHING'].includes(procedure))
        flags.push(['preloaded', 'Preloaded once to Max or declared Lim before weighing']);
    if (programme.profile.zeroDevices?.some(v => ['AUTOMATIC', 'ZERO_TRACKING'].includes(v)))
        flags.push(['otherAutomaticDevicesDisabled', 'Automatic zero-setting / tracking disabled for direct-zero protocol']);
    if (procedure === 'ECCENTRICITY')
        flags.push(['positionEvidence', 'Load placement, distribution and receptor sketch recorded in evidence']);
    if (procedure === 'TARE_ACCURACY')
        flags.push(['zeroInitiatedNearChangeover', 'Tare initiated near the changeover point']);
    if (['CREEP', 'ZERO_RETURN'].includes(procedure))
        flags.push(['loadMaintained', 'Load maintained continuously for actual recorded duration'], ['environmentalStability', 'Environmental conditions remained reasonably constant'], ['immediateStableReadings', 'Initial / returned readings taken as soon as indication stabilized']);
    if (procedure === 'EQUILIBRIUM')
        flags.push(['documentationReviewed', 'Manufacturer principle, criteria, parameters and securing reviewed'], ['worstCaseApplied', 'Documented worst-case adjustment and variants tested']);
    const hasValues = input.readings.some(r => r.load || r.indication || r.additionalWeights || r.timestamp);
    const outcomeLabel = (key: string) => key === 'disturbed' ? 'Single disturbance and prompt operation performed' : key === 'continuousBlocked' ? 'Operation inhibited during continuous disturbance' : 'Operation inhibited before stable equilibrium';
    return <form onSubmit={e => { e.preventDefault(); void save(); }} aria-busy={busy} className="space-y-5"><header className="space-y-2"><h3 className="text-xl font-semibold">{decision.name} / {series}</h3><p>{decision.clauses.join(' · ')}. {decision.reason}</p><p>Required: {sample.count} planned readings. Enter actual observations. Partial evidence stays INCOMPLETE. Corrections retain previous inputs/results in audit history.</p></header>
    {error && <p role="alert" className="rounded border border-rose-500 p-3">{error}</p>}{unknown && <p role="alert">Save outcome unknown. This form will not resend. Reload and inspect saved evidence.</p>}{saved && <p role="status">Performance evidence saved. Inspect results and remaining requirements below.</p>}
    <fieldset disabled={busy || unknown || !mayRecord} className="space-y-5"><label className="block">Performance observation unit<select className={masterField} disabled={!!hasValues} value={unit} onChange={e => setInput({ ...input, readings: input.readings.map(r => ({ ...r, unit: e.target.value })) })}>{['mg', 'g', 'kg', 't'].map(u => <option key={u}>{u}</option>)}</select></label><p className="text-sm">Choose units before entry. Planned targets and saved traces are in grams; values are never silently relabeled.</p>
    {procedure === 'ECCENTRICITY' && <figure className="rounded border border-slate-400 p-4"><figcaption className="mb-3 font-semibold">Receptor position map — confirm actual sketch in evidence</figcaption><ol className={`grid gap-3 ${programme.profile.loadReceptor === 'PLATFORM' && (programme.profile.supportPoints || 0) <= 4 ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>{sample.plan?.map((r, j) => <li key={r.position} className="rounded border border-indigo-400 p-3 tabular-nums">{j + 1}. {r.position?.replace(/_/g, ' ')}</li>)}</ol></figure>}
    {input.readings.map((row, index) => {
            const planned = sample.plan?.[index];
            return <fieldset key={row.sequence} className="space-y-4 rounded-lg border border-slate-300 p-4 dark:border-slate-600"><legend className="px-2 font-semibold">Reading {row.sequence}{row.phase ? ` · ${row.phase}` : ''}{row.position ? ` · ${row.position}` : ''}</legend><p className="text-sm">Nominal target {planned?.loadG ?? sample.loadG} g{planned?.tareG ? `; tare ${planned.tareG} g` : ''}{planned?.baseG ? `; base / function load ${planned.baseG} g` : ''}{planned?.elapsedSeconds !== undefined ? `; actual time at +${planned.elapsedSeconds / 60} min` : ''}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{field(index, 'load', 'Actual applied load L')}{field(index, 'indication', procedure === 'DISCRIMINATION' ? 'Final indication I+d' : 'Actual indication I')}{field(index, 'additionalWeights', 'Actual changeover weights ΔL')}{row.tareLoad !== undefined && field(index, 'tareLoad', 'Actual tare load')}{row.baseLoad !== undefined && field(index, 'baseLoad', 'Actual compensated base / function load')}{row.timestamp !== undefined && field(index, 'timestamp', 'Actual observation timestamp')}{row.temperatureC !== undefined && field(index, 'temperatureC', 'Actual temperature')}
      {procedure === 'DISCRIMINATION' && <>{field(index, 'initialIndication', 'Initial indication I')}{field(index, 'decreasedIndication', 'Reduced indication I−d')}{field(index, 'restoredWeight', 'Small weight replaced (nominal 0.1d)')}{field(index, 'addedLoad', 'Gently added load (nominal 1.4d)')}</>}</div>
      {row.zero && zeroFields(index, row.zero, v => patch(index, { zero: v }), 'Primary')}
      {row.deviceIndications?.map((device, j) => <fieldset key={j} className="space-y-3 rounded border border-slate-400 p-3"><legend>Device {j + 1}: {procedure === 'TARE_COMPARISON' ? 'TARE' : programme.performance?.devices?.[j]}</legend><div className="grid gap-4 sm:grid-cols-2">{(['indication', 'additionalWeights'] as const).map(k => <label key={k} className="block">Device {j + 1} {k} ({unit})<input required className={masterField} inputMode="decimal" value={device[k]} onChange={e => patch(index, { deviceIndications: row.deviceIndications!.map((v, n) => n === j ? { ...v, [k]: e.target.value } : v) })}/></label>)}</div>{device.zero && zeroFields(index, device.zero, v => patch(index, { deviceIndications: row.deviceIndications!.map((d, n) => n === j ? { ...d, zero: v } : d) }), 'Tare device')}</fieldset>)}
      {procedure === 'EQUILIBRIUM' && <>{(['disturbed', 'continuousBlocked', 'prematureBlocked'] as const).map(k => <label key={k} className="block">{outcomeLabel(k)}<select aria-label={outcomeLabel(k)} required className={masterField} value={row[k] === undefined ? '' : row[k] ? 'YES' : 'NO'} onChange={e => patch(index, { [k]: e.target.value === 'YES' })}><option value="">Record actual outcome</option><option>YES</option><option>NO</option></select></label>)}{printing && <>{field(index, 'outputIndication', 'Actual printed / stored value')}<fieldset className="space-y-3"><legend>Actual following indications over 0–5 seconds</legend>{row.following?.map((t, j) => <div key={j} className="grid gap-3 sm:grid-cols-2">{(['seconds', 'indication'] as const).map(k => <label key={k}>{k === 'seconds' ? 'Actual seconds after output' : `Observed indication (${unit})`}<input required inputMode="decimal" className={masterField} value={t[k]} onChange={e => patch(index, { following: row.following!.map((v, n) => n === j ? { ...v, [k]: e.target.value } : v) })}/></label>)}</div>)}<button type="button" className={masterButton} onClick={() => patch(index, { following: [...row.following!, { seconds: '', indication: '' }] })}>Add following indication</button></fieldset></>}</>}
    </fieldset>;
        })}
    <div className="flex flex-wrap gap-3"><button type="button" className={masterButton} disabled={input.readings.length >= 250 || !['CREEP', 'ECCENTRICITY'].includes(procedure)} onClick={() => setInput({ ...input, readings: [...input.readings, blank(input.readings.length + 1, unit)] })}>Add actual reading</button><button type="button" className={masterButton} disabled={input.readings.length <= 1} onClick={() => setInput({ ...input, readings: input.readings.slice(0, -1) })}>Remove last actual reading</button></div>
    {flags.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={input.conditions[key] === true} onChange={e => setInput({ ...input, conditions: { ...input.conditions, [key]: e.target.checked } })}/>{label}</label>)}
    <label className="block">Performance observation / calibrated equipment / sketch evidence<textarea required maxLength={1000} className={masterField} value={input.evidenceReference} onChange={e => setInput({ ...input, evidenceReference: e.target.value })}/></label><button type="submit" className={`${masterButton} bg-indigo-700 text-white`}>{busy ? 'Saving performance evidence…' : 'Save performance evidence'}</button></fieldset>{!mayRecord && <p>Read-only. Only the owning Technician in TESTING may change observations.</p>}
  </form>;
}
export function PerformanceHistory({ tests }: {
    tests: NativeTestRecord[];
}) {
    return <section className="card space-y-4 p-5"><h2 className="text-xl font-semibold">Performance correction and chronology traces</h2>{tests.filter(t => t.result.ruleset === 'W8LAB-R76-2006-P4A-1').map(t => <article key={t.id} className="space-y-3"><h3 className="font-semibold">{t.submission.procedureId} / {t.submission.series}: {t.result.status}</h3><p>Saved {t.createdAt}. {t.result.clauses.join(' · ')}</p><div role="region" tabIndex={0} aria-label={`${t.submission.procedureId} detailed traces`} className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm tabular-nums"><thead><tr>{['No. / position', 'Time / phase', 'P (g)', 'E (g)', 'E0 (g)', 'Ec (g)', 'Limit (g)', 'Verdict / details'].map(v => <th className="border-b p-2" key={v}>{v}</th>)}</tr></thead><tbody>{t.result.rows.map(r => <tr key={r.sequence}>{[`${r.sequence} ${r.position || ''}`, `${r.timestamp || ''} ${r.phase || ''}`, r.P, r.E, r.E0 ?? '—', r.Ec ?? '—', r.limitG, `${r.verdict} ${r.details || ''}`].map((v, j) => <td className="border-b p-2 align-top" key={j}>{v}</td>)}</tr>)}</tbody></table></div><details><summary className="cursor-pointer py-3 font-semibold">Saved raw observations and conditions</summary><pre className="overflow-x-auto rounded border border-slate-400 p-3 text-xs" tabIndex={0}>{JSON.stringify(t.submission, null, 2)}</pre></details></article>)}</section>;
}
