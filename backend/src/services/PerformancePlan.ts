import Decimal from 'decimal.js';
import type { Instrument } from '../types/domain';
import type { NativeProfile, PerformanceProfile, ProcedureDecision } from '../types/native';
import { MasterDataError, evaluationSupport } from './MasterDataService';
export const PERFORMANCE_RULESET = 'W8LAB-R76-2006-P4A-1';
const D = Decimal.clone({ precision: 100 });
const keys = ['selfIndicating', 'devices', 'tareKind', 'maximumTareG', 'tareWeighingDevice', 'combinedZeroTare', 'mobile', 'adjacentSupports', 'rollingSections', 'rollingReverse', 'rollingLoadG', 'initialZeroRangeG', 'stabilityFunctions', 'stabilityDocumentation', 'stabilityWorstCase', 'stabilityLoadsG'];
export const FUNCTIONS = ['PRINT', 'STORE', 'ZERO', 'TARE'] as const;
export function validatePerformance(value: unknown, instrument: Instrument): PerformanceProfile {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k)))
        throw new MasterDataError('Unsupported performance declaration');
    const p = value as Record<string, unknown>;
    if (keys.some(k => !Object.prototype.hasOwnProperty.call(p, k)))
        throw new MasterDataError('Declare every performance characteristic explicitly; null means unknown');
    for (const k of ['selfIndicating', 'tareWeighingDevice', 'combinedZeroTare', 'mobile', 'adjacentSupports', 'rollingReverse'])
        if (p[k] !== null && typeof p[k] !== 'boolean')
            throw new MasterDataError(`${k} must be boolean or null`);
    if (typeof p.tareKind !== 'string' || !['NONE', 'SUBTRACTIVE', 'ADDITIVE', 'UNKNOWN'].includes(p.tareKind))
        throw new MasterDataError('Unsupported tare kind');
    for (const k of ['maximumTareG', 'rollingLoadG', 'initialZeroRangeG'])
        if (p[k] !== null && (typeof p[k] !== 'string' || (p[k] as string).length > 40 || !/^\d+(\.\d+)?$/.test(p[k] as string) || new D(p[k] as string).lte(0)))
            throw new MasterDataError(`${k} must be a positive decimal gram string or null`);
    if (p.devices !== null && (!Array.isArray(p.devices) || p.devices.length < 1 || p.devices.length > 8 || p.devices[0] !== 'DISPLAY' || p.devices.some(d => typeof d !== 'string' || !['DISPLAY', 'PRINT'].includes(d))))
        throw new MasterDataError('Declare 1–8 devices, primary DISPLAY first, or null');
    if (p.rollingSections !== null && (!Number.isSafeInteger(p.rollingSections) || Number(p.rollingSections) < 1 || Number(p.rollingSections) > 20))
        throw new MasterDataError('Rolling sections must be 1–20 or null');
    if (p.stabilityFunctions !== null && (!Array.isArray(p.stabilityFunctions) || new Set(p.stabilityFunctions).size !== p.stabilityFunctions.length || p.stabilityFunctions.some(f => typeof f !== 'string' || !FUNCTIONS.includes(f as typeof FUNCTIONS[number]))))
        throw new MasterDataError('Invalid stability function inventory');
    for (const k of ['stabilityDocumentation', 'stabilityWorstCase'])
        if (typeof p[k] !== 'string' || (p[k] as string).length > 2000)
            throw new MasterDataError(`${k} must be text (maximum 2000 characters)`);
    if (!p.stabilityLoadsG || typeof p.stabilityLoadsG !== 'object' || Array.isArray(p.stabilityLoadsG) || Object.entries(p.stabilityLoadsG).some(([k, v]) => !FUNCTIONS.includes(k as typeof FUNCTIONS[number]) || typeof v !== 'string' || v.length > 40 || !/^\d+(\.\d+)?$/.test(v) || new D(v).gt(instrument.maxCapacity!)))
        throw new MasterDataError('Invalid function operating loads in grams');
    if (instrument.hasTare === false && (p.tareKind !== 'NONE' || p.maximumTareG !== null || p.tareWeighingDevice !== false || p.combinedZeroTare !== false))
        throw new MasterDataError('Tare declaration contradicts frozen hasTare=false');
    if (instrument.hasTare === true && p.tareKind === 'NONE')
        throw new MasterDataError('Tare declaration contradicts frozen hasTare=true');
    if (p.tareKind === 'SUBTRACTIVE' && p.maximumTareG && new D(p.maximumTareG as string).gte(instrument.maxCapacity!))
        throw new MasterDataError('Subtractive maximum tare must be below Max');
    if (p.stabilityFunctions && Array.isArray(p.stabilityFunctions) && p.stabilityFunctions.includes('TARE') && instrument.hasTare === false)
        throw new MasterDataError('TARE stability function contradicts the instrument');
    return JSON.parse(JSON.stringify(p)) as PerformanceProfile;
}
/** Exact nominal selections are a supported subset, not invented tolerances for “near”. */
export function loadSteps(instrument: Instrument, upper: string, count: number): string[] {
    const max = new D(upper), min = new D(instrument.minCapacity!), e = new D(instrument.e!);
    const thresholds = instrument.accuracyClass === 'II' ? [5000, 20000] : instrument.accuracyClass === 'III' ? [500, 2000] : [50, 200];
    const values = new Set<string>(['0', max.toString()]);
    if (min.gte('0.1') && min.lte(max))
        values.add(min.toString());
    for (const n of thresholds)
        if (e.times(n).lte(max))
            values.add(e.times(n).toString());
    // Nominal evenly spaced, e-aligned additions. Mandatory points are never dropped.
    // Count positive loads conservatively, in addition to the explicit zero reference.
    for (let i = 1; values.size < count + 1 && i < 200; i++) {
        const value = max.times(i).div(count).div(e).floor().times(e);
        if (value.gt(0) && value.lt(max))
            values.add(value.toString());
    }
    return [...values].sort((a, b) => new D(a).cmp(b));
}
export function tareSeries(p: PerformanceProfile): {
    series: string;
    tareG: string;
}[] {
    if (!p.maximumTareG || !['SUBTRACTIVE', 'ADDITIVE'].includes(p.tareKind))
        return [];
    return p.tareKind === 'SUBTRACTIVE' ? [{ series: 'TARE_HALF', tareG: new D(p.maximumTareG).div(2).toString() }]
        : [{ series: 'TARE_THIRD', tareG: new D(p.maximumTareG).div(3).toString() }, { series: 'TARE_MAX', tareG: new D(p.maximumTareG).toString() }];
}
export function eccentricPositions(profile: NativeProfile, p: PerformanceProfile): string[] {
    if (profile.loadReceptor === 'ROLLING')
        return Array.from({ length: p.rollingSections || 0 }, (_, i) => (p.rollingReverse ? ['FORWARD', 'REVERSE'] : ['FORWARD']).flatMap(d => ['BEGIN', 'MIDDLE', 'END'].map(pos => `SECTION_${i + 1}_${d}_${pos}`))).flat();
    return profile.loadReceptor === 'PLATFORM' && (profile.supportPoints || 0) <= 4 ? ['QUARTER_1', 'QUARTER_2', 'QUARTER_3', 'QUARTER_4'] : Array.from({ length: profile.supportPoints || 0 }, (_, i) => `SUPPORT_${i + 1}`);
}
export function eccentricLoad(instrument: Instrument, profile: NativeProfile, p: PerformanceProfile): string {
    const gross = new D(instrument.maxCapacity!).plus(p.tareKind === 'ADDITIVE' ? p.maximumTareG || 0 : 0);
    return profile.loadReceptor === 'ROLLING' ? p.rollingLoadG! : gross.div(profile.loadReceptor === 'SPECIAL' ? 10 : (profile.supportPoints || 0) > 4 ? profile.supportPoints! - 1 : 3).toString();
}
export function performanceDecisions(instrument: Instrument, profile: NativeProfile, p: PerformanceProfile, legacy: ProcedureDecision[]): ProcedureDecision[] {
    const type = profile.purpose === 'TYPE_EVALUATION', service = profile.purpose === 'IN_SERVICE_INSPECTION';
    if (p.devices !== null && p.stabilityFunctions !== null && p.devices.includes('PRINT') !== p.stabilityFunctions.includes('PRINT'))
        throw new MasterDataError('Printer inventory and PRINT stability function contradict one another');
    const digital = evaluationSupport(instrument).supported && instrument.isManual && instrument.isElectronic && instrument.isSingleRange && ['II', 'III', 'IIII'].includes(instrument.accuracyClass || '') && instrument.d === instrument.e && profile.indication === 'DIGITAL' && p.selfIndicating === true;
    const base = p.selfIndicating === null || profile.indication === 'UNKNOWN' ? 'UNDETERMINED' : !digital ? 'UNSUPPORTED' : profile.zeroDevices === null ? 'UNDETERMINED' : 'REQUIRED';
    const decisions = JSON.parse(JSON.stringify(legacy)) as ProcedureDecision[];
    if (p.selfIndicating !== true)
        for (const d of decisions)
            if (d.native) {
                d.native = false;
                d.applicability = p.selfIndicating === null ? 'UNDETERMINED' : 'UNSUPPORTED';
                d.reason += ' P4A self-indication must be determined and supported.';
            }
    const set = (id: string, name: string, clauses: string[], applicability: ProcedureDecision['applicability'], reason: string, samples: ProcedureDecision['samples'] = []) => {
        const d = { id, name, clauses, applicability, reason, native: applicability === 'REQUIRED', ...(samples.length ? { samples } : {}) };
        const index = decisions.findIndex(x => x.id === id);
        if (index < 0)
            decisions.push(d);
        else
            decisions[index] = d;
    };
    const sample = (series: string, loadG: string, count: number) => ({ series, loadG, count, minimumOnly: true });
    const steps = loadSteps(instrument, instrument.maxCapacity!, type ? 10 : 5);
    set('WEIGHING', 'Increasing/decreasing weighing performance', ['3.5', 'A.4.3', 'A.4.4.1', 'A.4.4.3'], base, 'Exact nominal load plan including zero, applicable Min, Max and Table 6 transitions; ascending and reverse descending coverage. Standard weights only; substitution/modules require separate protocols.', [sample('SERIES', instrument.maxCapacity!, steps.length * 2 - 1)]);
    set('SUPPLEMENTARY_WEIGHING', 'Supplementary weighing at upper initial-zero limit', ['4.5.1', 'A.4.4.2'], profile.initialZeroSetting === false ? 'NOT APPLICABLE' : profile.initialZeroSetting === null || p.initialZeroRangeG === null ? 'UNDETERMINED' : new D(p.initialZeroRangeG).lte(maximum(instrument).times('0.2')) ? 'NOT APPLICABLE' : base, 'Only a declared initial zero-setting range above 20% Max requires this series; actual compensated base load equals its upper limit. Wider-range influence requirements remain separate.', [sample('SERIES', instrument.maxCapacity!, steps.length * 2 - 1)]);
    set('MULTIPLE_INDICATORS', 'Comparison of indicating / printing devices', ['3.6.3', 'A.4.5'], p.devices === null ? 'UNDETERMINED' : p.devices.length === 1 ? 'NOT APPLICABLE' : base, p.devices?.length === 1 ? 'Documented single DISPLAY device; evidence in declaration.' : 'All declared device indications and individual zero/changeover determinations at every weighing step. Digital print equals display; display differences limited to MPE.', [sample('SERIES', instrument.maxCapacity!, steps.length * 2 - 1)]);
    let ecc: ProcedureDecision['applicability'] = profile.eccentricityPossible === false ? 'NOT APPLICABLE' : profile.eccentricityPossible === null || profile.loadReceptor === 'UNKNOWN' || p.mobile === null ? 'UNDETERMINED' : p.mobile ? 'UNSUPPORTED' : base;
    if (ecc === 'REQUIRED') {
        if (p.tareKind === 'UNKNOWN' || p.tareKind === 'ADDITIVE' && !p.maximumTareG || profile.loadReceptor !== 'ROLLING' && !profile.supportPoints)
            ecc = 'UNDETERMINED';
        else if (profile.loadReceptor === 'PLATFORM' && profile.supportPoints! > 4 && p.adjacentSupports === null || profile.loadReceptor === 'ROLLING' && (!p.rollingSections || p.rollingReverse === null || !p.rollingLoadG))
            ecc = 'UNDETERMINED';
        else if (profile.loadReceptor === 'PLATFORM' && profile.supportPoints! > 4 && p.adjacentSupports === true)
            ecc = 'UNSUPPORTED';
        else if (eccentricLoad(instrument, profile, p).length > 40)
            ecc = 'UNSUPPORTED';
        else if (profile.loadReceptor === 'ROLLING' && new D(p.rollingLoadG!).gt(new D(instrument.maxCapacity!).plus(p.tareKind === 'ADDITIVE' ? p.maximumTareG! : 0).times('0.8')))
            throw new MasterDataError('Usual heaviest rolling load must not exceed 0.8 (Max + additive tare)');
    }
    set('ECCENTRICITY', 'Eccentricity by receptor position', ['3.6.2', 'A.4.7'], ecc, ecc === 'NOT APPLICABLE' ? `${profile.noEccentricityJustification}; ${profile.evidenceReference}` : 'Quarter/support/section positions with sketch evidence, automatic devices disabled and a fresh zero determination before every loading. Mobile and closely paired supports require a separate verified protocol.', ecc === 'REQUIRED' ? [sample('POSITIONS', eccentricLoad(instrument, profile, p), eccentricPositions(profile, p).length)] : []);
    const tare = instrument.hasTare === false ? 'NOT APPLICABLE' : p.tareKind === 'UNKNOWN' || !p.maximumTareG || p.combinedZeroTare === null ? 'UNDETERMINED' : service || p.combinedZeroTare || tareSeries(p).some(t => t.tareG.length > 40) || p.tareKind === 'SUBTRACTIVE' && new D(instrument.maxCapacity!).minus(new D(p.maximumTareG).div(2)).lt(instrument.minCapacity!) ? 'UNSUPPORTED' : base;
    const tares = tareSeries(p), tareReason = 'Separate net weighing and tare-setting accuracy at prescribed nominal tare effects; combined zero/tare and service technical-accuracy policy are unsupported.';
    set('TARE', 'Net weighing with tare', ['3.5.3.3', 'A.4.6.1'], tare, tareReason, tares.map(t => sample(t.series, t.tareG, loadSteps(instrument, p.tareKind === 'SUBTRACTIVE' ? new D(instrument.maxCapacity!).minus(t.tareG).toString() : instrument.maxCapacity!, 5).length * 2 - 1)));
    set('TARE_ACCURACY', 'Accuracy of tare setting', ['4.6.3', 'A.4.6.2'], tare, tareReason, tares.map(t => sample(t.series, t.tareG, 1)));
    set('TARE_COMPARISON', 'Tare weighing-device comparison', ['3.5.3.4', '3.6.3', 'A.4.6.3'], instrument.hasTare === false || p.tareWeighingDevice === false ? 'NOT APPLICABLE' : p.tareWeighingDevice === null ? 'UNDETERMINED' : tare, 'Compare tare weighing device against primary device at the same actual tare load, including individual errors and digital agreement.', tares.map(t => sample(t.series, t.tareG, 1)));
    const disc = decisions.find(d => d.id === 'DISCRIMINATION')!;
    if (disc.applicability === 'UNSUPPORTED' && profile.indication === 'DIGITAL')
        set('DISCRIMINATION', 'Digital discrimination', ['3.8.2.2', 'A.4.8.2'], base, 'Three distinct nominal loads Min, half Max, Max. Record I, I-d, replacement small weight, actual 1.4d addition and resulting I+d.', [sample('THREE_LOADS', instrument.maxCapacity!, 3)]);
    set('SENSITIVITY', 'Sensitivity of non-self-indicating instruments', ['6.1', 'A.4.9'], p.selfIndicating === null ? 'UNDETERMINED' : p.selfIndicating ? 'NOT APPLICABLE' : 'UNSUPPORTED', 'Documented self-indication excludes A.4.9; non-self-indicating mechanical/analog profiles need verified displacement/oscillation evaluation.');
    set('CREEP', 'Creep over actual laboratory time', ['3.9.4.1', 'A.4.11.1'], type ? base : 'UNDETERMINED', 'Type programme: Max nominal load; actual initial/15/30-minute observations; strict early-exit criteria or four-hour continuation. Verification requires approved-type/use policy.', [sample('TIMELINE', instrument.maxCapacity!, 3)]);
    set('ZERO_RETURN', 'Zero return after loading', ['3.9.4.2', 'A.4.11.2'], type ? base : 'UNDETERMINED', 'Initial zero, Max loading for at least 30 minutes, immediate stable unloaded zero; automatic zero/tracking disabled.', [sample('TIMELINE', instrument.maxCapacity!, 4)]);
    const stability = p.mobile === true || profile.zeroDevices?.some(z => ['AUTOMATIC', 'ZERO_TRACKING'].includes(z)) && p.stabilityFunctions?.includes('ZERO') ? 'UNSUPPORTED' : p.mobile === null || p.stabilityFunctions === null || !p.stabilityDocumentation.trim() || !p.stabilityWorstCase.trim() || p.stabilityFunctions.some(f => p.stabilityLoadsG[f] === undefined) || instrument.hasTare === true && !p.stabilityFunctions.includes('TARE') || profile.zeroDevices?.includes('SEMI_AUTOMATIC') && !p.stabilityFunctions.includes('ZERO') ? 'UNDETERMINED' : p.stabilityFunctions.length === 0 ? 'UNDETERMINED' : base;
    set('EQUILIBRIUM', 'Stability of equilibrium', ['4.4.2', 'A.4.12'], type ? stability : 'UNDETERMINED', 'Type programme: document manufacturer principle/criteria, parameters, securing and worst case. Five repetitions per function; continuous and single disturbance. Print/store: actual 5-second indications; zero/tare: accuracy check. Verification/service technical-purpose policy remains undetermined.', (p.stabilityFunctions || []).map(f => sample(f, p.stabilityLoadsG[f] || '0', 5)));
    // Remove A.4.11/A.4.12 from the residual group without hiding remaining work.
    set('INFLUENCE_TIME', 'Remaining influence quantities and endurance', ['3.9', 'A.5', 'A.6'], type ? 'UNSUPPORTED' : 'UNDETERMINED', 'Tilt, warm-up, temperature, voltage and applicable endurance remain separate mandatory P4B work; P4A time results do not cover these.');
    set('PORTABLE_WEIGHBRIDGE', 'Portable/mobile additional operational tests', ['A.4.7.5', 'A.4.12', 'A.4.13'], p.mobile === null ? 'UNDETERMINED' : p.mobile ? 'UNSUPPORTED' : 'NOT APPLICABLE', 'Explicit mobile=false declaration excludes mobile/portable operational profile; mobile=true remains unsupported, not a PASS.');
    // Entry plans are normative targets, never observations or confirmations.
    for (const d of decisions)
        for (const s of d.samples || []) {
            if (['WEIGHING', 'MULTIPLE_INDICATORS', 'SUPPLEMENTARY_WEIGHING', 'TARE'].includes(d.id)) {
                const t = tareSeries(p).find(t => t.series === s.series);
                const upper = d.id === 'TARE' && p.tareKind === 'SUBTRACTIVE' ? new D(instrument.maxCapacity!).minus(t!.tareG).toString() : instrument.maxCapacity!;
                const loads = loadSteps(instrument, upper, d.id === 'TARE' ? 5 : type ? 10 : 5);
                s.plan = [...loads.map(loadG => ({ loadG, phase: 'UP' })), ...loads.slice(0, -1).reverse().map(loadG => ({ loadG, phase: 'DOWN' }))].map(row => ({ ...row, ...(d.id === 'TARE' ? { tareG: t!.tareG } : {}), ...(d.id === 'SUPPLEMENTARY_WEIGHING' ? { baseG: p.initialZeroRangeG! } : {}) }));
            }
            else if (d.id === 'ECCENTRICITY')
                s.plan = eccentricPositions(profile, p).map(position => ({ position, loadG: s.loadG }));
            else if (d.id === 'TARE_ACCURACY' || d.id === 'TARE_COMPARISON')
                s.plan = [{ loadG: d.id === 'TARE_ACCURACY' ? '0' : s.loadG, tareG: s.loadG }];
            else if (d.id === 'DISCRIMINATION')
                s.plan = [instrument.minCapacity!, new D(instrument.maxCapacity!).div(2).toString(), instrument.maxCapacity!].map(loadG => ({ loadG }));
            else if (d.id === 'CREEP')
                s.plan = [0, 900, 1800].map(elapsedSeconds => ({ loadG: instrument.maxCapacity!, elapsedSeconds }));
            else if (d.id === 'ZERO_RETURN')
                s.plan = ['INITIAL_ZERO', 'LOAD_START', 'LOAD_END', 'RETURN_ZERO'].map((phase, j) => ({ phase, loadG: j === 1 || j === 2 ? instrument.maxCapacity! : '0' }));
            else if (d.id === 'EQUILIBRIUM')
                s.plan = Array.from({ length: 5 }, () => ({ loadG: ['ZERO', 'TARE'].includes(s.series) ? '0' : s.loadG, baseG: s.loadG }));
        }
    return decisions;
}
function maximum(instrument: Instrument) { return new D(instrument.maxCapacity!); }
