import Decimal from 'decimal.js';
import type { NativeProgramme, NativeReading, NativeResult, NativeSubmission } from '../types/native';
import { convertToUnit, isMassUnit } from '../calculations/unitConversion';
import { RuleEngine } from '../rules/engine';
import { MasterDataError } from './MasterDataService';
import { eccentricLoad, eccentricPositions, loadSteps, tareSeries } from './PerformancePlan';
const D = Decimal.clone({ precision: 100 });
const fail = (message: string): never => { throw new MasterDataError(message); };
const object = (v: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k)))
        fail(`Unsupported ${label} fields`);
    return v as Record<string, unknown>;
};
function number(value: unknown, signed = false): Decimal {
    if (typeof value !== 'string' || value.length > 40 || !(signed ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/).test(value))
        fail('Observations must be finite decimal strings without exponent notation');
    return new D(value as string);
}
function grams(value: unknown, unit: unknown, signed = false): Decimal {
    if (!isMassUnit(unit))
        fail('Unsupported mass unit; use mg, g, kg or t');
    return new D(convertToUnit({ value: number(value, signed).toString(), unit: unit as 'g' }, 'g').value.toString());
}
function time(value: unknown): number {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now())
        fail('Enter an actual observation timestamp with timezone, not a future or simulated time');
    return Date.parse(value as string);
}
export function performanceMpe(programme: NativeProgramme, load: Decimal): Decimal {
    const i = programme.instrument, e = new D(i.e!);
    const rule = RuleEngine.evaluate({ instrument: { isNAWI: true, isElectronic: true, isSingleRange: true, isGraduated: true, scaleType: 'Manual', accuracyClass: i.accuracyClass!, hasTare: !!i.hasTare }, testType: 'TEST-WEIGH', isInitialVerification: programme.profile.purpose !== 'IN_SERVICE_INSPECTION', m: load.div(e).toString(), e: { value: e.toString(), unit: 'g' } });
    if (rule.status !== 'APPLICABLE' || !rule.mpeLimit)
        throw new MasterDataError('MPE cannot be resolved for this load', 422);
    return new D(rule.mpeLimit.value);
}
export function evaluatePerformance(programme: NativeProgramme, submission: NativeSubmission): NativeResult {
    object(submission, ['procedureId', 'series', 'readings', 'conditions', 'evidenceReference'], 'test');
    const decision = programme.decisions.find(d => d.id === submission.procedureId)!;
    const sample = decision.samples?.find(s => s.series === submission.series);
    if (!sample)
        fail('Unsupported performance series');
    if (!Array.isArray(submission.readings) || submission.readings.length > 250)
        fail('Readings must be an array (maximum 250)');
    const c = object(submission.conditions, ['stable', 'sufficientAccuracy', 'automaticDevicesInOperation', 'zeroInitiatedNearChangeover', 'outsideAutomaticRange', 'otherAutomaticDevicesDisabled', 'preloaded', 'loadMaintained', 'environmentalStability', 'worstCaseApplied', 'documentationReviewed', 'positionEvidence', 'immediateStableReadings'], 'test condition');
    if (Object.values(c).some(v => typeof v !== 'boolean'))
        fail('Test conditions must be explicit booleans');
    if (typeof submission.evidenceReference !== 'string' || !submission.evidenceReference.trim() || submission.evidenceReference.length > 1000)
        fail('Record observation, sketch and calibrated equipment evidence (maximum 1000 characters)');
    const p = programme.performance!, i = programme.instrument, e = new D(i.e!), max = new D(i.maxCapacity!), id = decision.id;
    const issues: string[] = [], rows: NativeResult['rows'] = [];
    const need = (condition: boolean, message: string) => { if (!condition)
        issues.push(message); };
    need(c.stable === true, 'Confirm the required stabilized observations.');
    need(c.sufficientAccuracy === true, 'Confirm sufficient determination accuracy with calibrated equipment evidence.');
    const automatic = programme.profile.zeroDevices!.some(v => ['AUTOMATIC', 'ZERO_TRACKING'].includes(v));
    const disabled = ['ECCENTRICITY', 'ZERO_RETURN', 'TARE_ACCURACY', 'TARE_COMPARISON', 'EQUILIBRIUM'].includes(id);
    if (automatic && disabled)
        need(c.otherAutomaticDevicesDisabled === true, 'Automatic zero-setting/tracking must be disabled for this procedure.');
    const seq = submission.readings;
    const core = ['sequence', 'load', 'indication', 'additionalWeights', 'unit'];
    const extra: Record<string, string[]> = {
        WEIGHING: ['phase'], MULTIPLE_INDICATORS: ['phase', 'deviceIndications'], SUPPLEMENTARY_WEIGHING: ['phase', 'baseLoad'],
        TARE: ['phase', 'tareLoad'], TARE_ACCURACY: ['tareLoad'], TARE_COMPARISON: ['tareLoad', 'zero', 'deviceIndications'],
        ECCENTRICITY: ['position', 'zero'], DISCRIMINATION: ['initialIndication', 'decreasedIndication', 'restoredWeight', 'addedLoad'],
        CREEP: ['timestamp', 'temperatureC'], ZERO_RETURN: ['phase', 'timestamp', 'temperatureC'],
        EQUILIBRIUM: ['baseLoad', 'continuousBlocked', 'prematureBlocked', 'disturbed', 'outputIndication', 'following'],
    };
    const measured = seq.map((r, index) => {
        object(r, [...core, ...extra[id]], 'reading');
        if (r.sequence !== index + 1)
            fail('Readings must retain consecutive chronological sequence starting at 1');
        const L = grams(r.load, r.unit), I = grams(r.indication, r.unit, true), delta = grams(r.additionalWeights, r.unit);
        if (delta.gt(e) || !I.mod(e).isZero())
            fail('Additional changeover weights must be within one e; indications must be multiples of d=e');
        const grossMax = max.plus(p.tareKind === 'ADDITIVE' ? p.maximumTareG || 0 : 0);
        if (L.gt(grossMax))
            fail('Applied load exceeds declared maximum gross capacity');
        const P = I.plus(e.div(2)).minus(delta), E = P.minus(L);
        return { r, L, I, delta, P, E };
    });
    const push = (m: typeof measured[number], error: Decimal, limit: Decimal, pass = error.abs().lte(limit), zero?: Decimal, details?: string) => {
        rows.push({ sequence: m.r.sequence, loadG: m.L.toString(), indicationG: m.I.toString(), additionalWeightsG: m.delta.toString(), P: m.P.toString(), E: m.E.toString(), limitG: limit.toString(), verdict: pass ? 'PASS' : 'FAIL', ...(zero !== undefined ? { E0: zero.toString(), Ec: error.toString() } : {}), ...(m.r.phase ? { phase: m.r.phase } : {}), ...(m.r.position ? { position: m.r.position } : {}), ...(m.r.timestamp ? { timestamp: m.r.timestamp } : {}), ...(details ? { details } : {}) });
    };
    const zero = (r: NativeReading): Decimal => {
        object(r.zero, ['load', 'indication', 'additionalWeights'], 'zero observation');
        const z = r.zero!, L = grams(z.load, r.unit), I = grams(z.indication, r.unit, true), delta = grams(z.additionalWeights, r.unit);
        if (!I.mod(e).isZero() || delta.gt(e) || L.gt(max))
            fail('Invalid zero changeover determination');
        if (automatic && !disabled) {
            if (!L.eq(e.times(10)))
                fail('Supported automatic zero proxy is the declared nominal 10e; other selections need separate verification');
            need(c.outsideAutomaticRange === true, 'Confirm zero proxy is outside the automatic range.');
        }
        else if (!L.eq(0))
            fail('Fresh direct zero determination must have zero applied load');
        return I.plus(e.div(2)).minus(delta).minus(L);
    };
    let methodology = 'P=I+e/2−ΔL; E=P−L; Ec=E−E0; |Ec|≤MPE(L).';
    if (['WEIGHING', 'MULTIPLE_INDICATORS', 'SUPPLEMENTARY_WEIGHING', 'TARE'].includes(id)) {
        need(c.preloaded === true, 'Confirm preloading once to Max or declared Lim before the weighing test (A.4.1.10).');
        const tare = tareSeries(p).find(t => t.series === submission.series);
        const upper = id === 'TARE' && p.tareKind === 'SUBTRACTIVE' ? max.minus(tare!.tareG) : max;
        const steps = loadSteps(i, upper.toString(), id === 'TARE' ? 5 : programme.profile.purpose === 'TYPE_EVALUATION' ? 10 : 5);
        const plan = [...steps.map(L => ({ L, phase: 'UP' })), ...steps.slice(0, -1).reverse().map(L => ({ L, phase: 'DOWN' }))];
        need(seq.length === plan.length, `Required complete ascending/descending plan: ${plan.length} readings; ${seq.length} recorded.`);
        const E0 = measured[0]?.E;
        for (const [index, m] of measured.entries()) {
            if (!plan[index] || !m.L.eq(plan[index].L) || m.r.phase !== plan[index].phase)
                fail(`Reading ${index + 1}: expected ${plan[index]?.phase || 'no extra step'} ${plan[index]?.L || ''} g; exact nominal selection only`);
            if (id === 'TARE' && !grams(m.r.tareLoad, m.r.unit).eq(tare!.tareG))
                fail('Actual tare load must match this frozen tare configuration');
            if (id === 'SUPPLEMENTARY_WEIGHING' && !grams(m.r.baseLoad, m.r.unit).eq(p.initialZeroRangeG!))
                fail('Actual compensated base load must equal the declared upper initial zero-setting limit');
            const limit = performanceMpe(programme, m.L), Ec = m.E.minus(E0!);
            let pass = Ec.abs().lte(limit), details = '';
            if (id === 'MULTIPLE_INDICATORS') {
                if (!Array.isArray(m.r.deviceIndications) || m.r.deviceIndications.length !== p.devices!.length)
                    fail('Record every declared device at each weighing load');
                const devices = m.r.deviceIndications!.map((v, j) => {
                    object(v, ['indication', 'additionalWeights'], 'device observation');
                    const I = grams(v.indication, m.r.unit, true), delta = grams(v.additionalWeights, m.r.unit);
                    if (!I.mod(e).isZero() || delta.gt(e))
                        fail('Invalid device changeover observation');
                    const start = seq[0].deviceIndications?.[j];
                    if (!start)
                        fail('Missing initial device zero');
                    const E0j = grams(start!.indication, seq[0].unit, true).plus(e.div(2)).minus(grams(start!.additionalWeights, seq[0].unit));
                    const Ecj = I.plus(e.div(2)).minus(delta).minus(m.L).minus(E0j);
                    const agreement = p.devices![j] === 'PRINT' ? I.eq(m.I) : I.minus(m.I).abs().lte(limit);
                    if (!Ecj.abs().lte(limit) || !agreement)
                        pass = false;
                    if (j === 0 && (!I.eq(m.I) || !delta.eq(m.delta)))
                        fail('Primary device must match the primary observation');
                    return `D${j + 1} ${p.devices![j]}: I=${I}, E0=${E0j}, Ec=${Ecj}, agreement=${agreement}`;
                });
                details = devices.join('; ');
            }
            push(m, Ec, limit, pass, E0, details);
        }
        if (automatic)
            need(c.otherAutomaticDevicesDisabled === true, 'This supported progressive plan uses a direct initial zero; disable automatic zero/tracking. Active-device proxy plans remain unsupported.');
    }
    else if (id === 'ECCENTRICITY') {
        const positions = eccentricPositions(programme.profile, p), target = eccentricLoad(i, programme.profile, p);
        need(seq.length === positions.length, `All ${positions.length} receptor positions are required.`);
        need(c.positionEvidence === true, 'Record actual load placement/distribution and receptor sketch in the evidence reference.');
        for (const [index, m] of measured.entries()) {
            if (m.r.position !== positions[index] || !m.L.eq(target))
                fail(`Expected position ${positions[index]} with nominal ${target} g`);
            const E0 = zero(m.r), Ec = m.E.minus(E0), limit = performanceMpe(programme, m.L);
            push(m, Ec, limit, Ec.abs().lte(limit), E0);
        }
    }
    else if (id === 'TARE_ACCURACY') {
        need(seq.length === 1, 'One actual tare-setting determination is required.');
        need(c.zeroInitiatedNearChangeover === true, 'Confirm tare was initiated near the changeover point.');
        for (const m of measured) {
            if (!m.L.eq(0) || !m.I.eq(0) || !grams(m.r.tareLoad, m.r.unit).eq(sample!.loadG))
                fail('Tare-setting accuracy requires actual configured tare and zero post-setting net load/indication');
            push(m, m.E, e.times('0.25'), m.E.abs().lt(e.times('0.25')));
        }
        methodology = 'Tare-setting E0=I+e/2−ΔL−L; electronic accuracy better than ±0.25e (strict boundary, 4.6.3).';
    }
    else if (id === 'TARE_COMPARISON') {
        need(seq.length === 1, 'One paired determination for this tare configuration is required.');
        for (const m of measured) {
            if (!m.L.eq(sample!.loadG) || !grams(m.r.tareLoad, m.r.unit).eq(sample!.loadG))
                fail('Compare the same actual tare load on both devices');
            const pair = m.r.deviceIndications;
            if (!Array.isArray(pair) || pair.length !== 1)
                fail('Record the tare weighing-device indication and changeover weight');
            object(pair![0], ['indication', 'additionalWeights', 'zero'], 'tare device');
            const J = grams(pair![0].indication, m.r.unit, true), delta = grams(pair![0].additionalWeights, m.r.unit);
            if (!J.mod(e).isZero() || delta.gt(e))
                fail('Invalid tare weighing-device observation');
            const E0 = zero(m.r), tareE0 = zero({ ...m.r, zero: pair![0].zero }), Ec = m.E.minus(E0), other = J.plus(e.div(2)).minus(delta).minus(m.L).minus(tareE0), limit = performanceMpe(programme, m.L);
            push(m, Ec, limit, Ec.abs().lte(limit) && other.abs().lte(limit) && J.minus(m.I).abs().lte(limit), E0, `Tare display I=${J} g, E0=${tareE0} g, Ec=${other} g; display difference must not exceed MPE. Printed-value agreement is separately tested under A.4.5.`);
        }
    }
    else if (id === 'DISCRIMINATION') {
        const loads = [new D(i.minCapacity!), max.div(2), max];
        need(seq.length === 3, 'Three distinct discrimination loads are required.');
        for (const [index, m] of measured.entries()) {
            if (!loads[index] || !m.L.eq(loads[index]))
                fail('Supported discrimination targets are Min, half Max and Max');
            const initial = grams(m.r.initialIndication, m.r.unit, true), decreased = grams(m.r.decreasedIndication, m.r.unit, true), restored = grams(m.r.restoredWeight, m.r.unit), added = grams(m.r.addedLoad, m.r.unit);
            if (!initial.mod(e).isZero() || !decreased.mod(e).isZero())
                fail('Discrimination indications must be multiples of d=e');
            if (!restored.eq(e.times('0.1')) || !added.eq(e.times('1.4')))
                fail('Supported protocol replaces a 0.1d weight then gently adds exactly 1.4d');
            const response = m.I.minus(initial);
            push(m, response, e, decreased.eq(initial.minus(e)) && m.I.eq(initial.plus(e)), undefined, `Initial I=${initial}; reduced I=${decreased}; replaced=${restored}; added=${added}; final−initial=${response} g.`);
        }
        methodology = 'A.4.8.2: after reduction to I−d and replacement of one 0.1d weight, gentle addition of 1.4d must produce I+d. No weighing-error verdict is inferred from this response test.';
    }
    else if (id === 'CREEP' || id === 'ZERO_RETURN') {
        need(c.loadMaintained === true, 'Confirm uninterrupted loading for the recorded duration.');
        need(c.environmentalStability === true, 'Confirm reasonably constant environmental conditions throughout the actual observations.');
        need(c.immediateStableReadings === true, 'Confirm initial/returned readings were taken as soon as indication stabilized.');
        const stamps = seq.map(r => time(r.timestamp));
        if (stamps.some((t, j) => j > 0 && t <= stamps[j - 1]))
            fail('Observation timestamps must be strictly chronological; rows are never sorted automatically');
        const temps = seq.map(r => number(r.temperatureC, true));
        if (temps.length)
            need(D.max(...temps).minus(D.min(...temps)).lte(2), 'Temperature variation exceeds 2 °C; test conditions are invalid.');
        if (id === 'CREEP') {
            need(seq.length >= 3, 'Initial, 15-minute and 30-minute observations are required.');
            if (measured.some(m => !m.L.eq(max)))
                fail('Supported creep load is exact nominal Max throughout');
            const elapsed = stamps.map(t => (t - stamps[0]) / 1000), at15 = elapsed.indexOf(900), at30 = elapsed.indexOf(1800), at4h = elapsed.indexOf(14400);
            need(at15 >= 0 && at30 >= 0, 'Actual 15-minute and 30-minute readings are required; do not interpolate.');
            const first = measured[0]?.E;
            const early = !!first && at15 >= 0 && at30 >= 0 && measured.filter((_, j) => elapsed[j] <= 1800).every(m => m.E.minus(first).abs().lt(e.times('0.5'))) && measured[at30].E.minus(measured[at15].E).abs().lt(e.times('0.2'));
            need(early || at4h >= 0, 'Strict early-exit limits were not met; continue actual observations through four hours.');
            const limit = early ? e.times('0.5') : performanceMpe(programme, max);
            measured.forEach(m => { const change = m.E.minus(first!); push(m, change, limit, change.abs().lte(limit), first, `Change from initial=${change} g; ${early ? 'strict 30-minute early exit' : 'four-hour path'}`); });
            methodology = 'Actual changeover indications: 30-minute termination only if all initial deviations <0.5e AND |E30−E15|<0.2e. Otherwise four-hour changes ≤MPE(Max). Temperature variation ≤2 °C. No generated/interpolated times.';
        }
        else {
            const phases = ['INITIAL_ZERO', 'LOAD_START', 'LOAD_END', 'RETURN_ZERO'];
            need(seq.length === 4, 'Initial zero, load start/end and stable return-to-zero observations are required.');
            for (const [j, m] of measured.entries())
                if (m.r.phase !== phases[j] || !m.L.eq(j === 1 || j === 2 ? max : 0))
                    fail('Zero-return sequence must be initial zero → Max load start → Max load end → unloaded stable zero');
            if (seq.length >= 3)
                need(stamps[2] - stamps[1] >= 1800000, 'Keep the near-Max load applied for at least 30 minutes.');
            const before = measured[0]?.E;
            measured.forEach((m, j) => { const difference = m.E.minus(before!); push(m, difference, e.times('0.5'), j !== 3 || difference.abs().lte(e.times('0.5')), before, `Return deviation=${difference} g`); });
            methodology = 'A.4.11.2: stable zero before and immediately after removing Max load held for ≥30 minutes; |Eafter−Ebefore|≤0.5e. Automatic zero/tracking disabled.';
        }
    }
    else if (id === 'EQUILIBRIUM') {
        need(c.worstCaseApplied === true && c.documentationReviewed === true, 'Review manufacturer principle/criteria, parameters, securing and all variants; apply documented worst-case adjustment.');
        need(seq.length === 5, 'Five actual disturbance/operation repetitions are required for this function.');
        const printing = ['PRINT', 'STORE'].includes(submission.series);
        for (const m of measured) {
            if (!grams(m.r.baseLoad, m.r.unit).eq(sample!.loadG))
                fail('Actual test load must match the documented operating-range selection');
            for (const k of ['continuousBlocked', 'prematureBlocked', 'disturbed'] as const)
                if (typeof m.r[k] !== 'boolean')
                    fail('Record continuous-disturbance inhibition, premature inhibition and single-disturbance outcome explicitly');
            let pass = m.r.continuousBlocked === true && m.r.prematureBlocked === true && m.r.disturbed === true, detail = '';
            if (printing) {
                if (!m.L.eq(sample!.loadG))
                    fail('Print/store applied load must match function test load');
                const output = grams(m.r.outputIndication, m.r.unit, true), trace = m.r.following;
                if (!output.mod(e).isZero() || !Array.isArray(trace) || trace.length < 2 || trace.length > 100)
                    fail('Record output and the actual five-second indication trace');
                const times = trace!.map(v => { object(v, ['seconds', 'indication'], 'following indication'); return number(v.seconds); });
                if (!times[0].eq(0) || !times[times.length - 1].eq(5) || times.some((t, j) => t.gt(5) || j > 0 && t.lte(times[j - 1])))
                    fail('Trace must span exactly 0–5 actual seconds in chronological order');
                const values = trace!.map(v => grams(v.indication, m.r.unit, true));
                if (values.some(v => !v.mod(e).isZero()))
                    fail('Trace indications must be multiples of d=e');
                const range = D.max(...values).minus(D.min(...values));
                pass = pass && range.lte(e) && values.some(v => v.eq(output));
                detail = `Output=${output} g; five-second range=${range} g; output included=${values.some(v => v.eq(output))}`;
                push(m, range, e, pass, undefined, detail);
            }
            else {
                if (!m.L.eq(0) || !m.I.eq(0))
                    fail('Zero/tare operation accuracy must record zero post-operation net load/indication');
                const limit = e.times('0.25');
                pass = pass && (submission.series === 'TARE' ? m.E.abs().lt(limit) : m.E.abs().lte(limit));
                push(m, m.E, limit, pass, undefined, 'Single-disturbance zero/tare accuracy plus operation inhibition.');
            }
        }
        methodology = 'A.4.12: five repetitions per declared function, manufacturer worst case; continuous/premature operation inhibition. PRINT/STORE: only two adjacent indications over 5s including output. ZERO/TARE: respective setting accuracy.';
    }
    else
        throw new MasterDataError('Performance procedure is not implemented', 422);
    const complete = issues.length === 0;
    return { standard: programme.standard, ruleset: programme.ruleset, clauses: decision.clauses, methodology, issues, complete, status: !complete ? 'INCOMPLETE' : rows.some(r => r.verdict === 'FAIL') ? 'FAIL' : 'PASS', count: rows.length, requiredCount: sample!.count, rows };
}
