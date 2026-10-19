import { buildNativeProgramme, nativeProgrammeIssue } from '../src/services/NativeApplicability';
import { evaluateNative, nativeFingerprint } from '../src/services/NativeEvaluation';
import { assessNative } from '../src/services/NativeAssessment';
import type { Instrument, TestCase } from '../src/types/domain';
import type { NativeProgramme, NativeSubmission, PerformanceProfile, NativeReading } from '../src/types/native';
const instrument: Instrument = { id: 'synthetic-p4a', manufacturerId: 'synthetic-maker', name: 'Synthetic scale', model: 'P4A', serialNumber: 'ONLY-TEST', isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: false, n: '3000', declaredSpecifications: { unit: 'g', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5' } };
const profile = { purpose: 'TYPE_EVALUATION' as const, indication: 'DIGITAL' as const, zeroDevices: [], initialZeroSetting: false, eccentricityPossible: true, loadReceptor: 'PLATFORM' as const, supportPoints: 4, evidenceReference: 'SYNTHETIC manual, not real certification' };
const config = (): PerformanceProfile => ({ selfIndicating: true, devices: ['DISPLAY', 'PRINT'], tareKind: 'NONE', maximumTareG: null, tareWeighingDevice: false, combinedZeroTare: false, mobile: false, adjacentSupports: false, rollingSections: null, rollingReverse: null, rollingLoadG: null, initialZeroRangeG: null, stabilityFunctions: ['PRINT'], stabilityDocumentation: 'Synthetic principle, criteria, parameters and securing reference', stabilityWorstCase: 'Synthetic worst-case settings, all variants', stabilityLoadsG: { PRINT: '7500' } });
const build = (p: Partial<PerformanceProfile> = {}, i: Partial<Instrument> = {}, pr: Partial<typeof profile> = {}) => buildNativeProgramme({ ...instrument, ...i }, { ...profile, ...pr }, 'synthetic-tech', { ...config(), ...p });
const zero = () => ({ load: '0', indication: '0', additionalWeights: '2.5' });
const reading = (sequence = 1, load = '0'): NativeReading => ({ sequence, load, indication: load, additionalWeights: '2.5', unit: 'g' });
function submission(programme: NativeProgramme, id = 'WEIGHING', series?: string): NativeSubmission {
    const s = programme.decisions.find(d => d.id === id)!.samples!.find(s => !series || s.series === series)!;
    return { procedureId: id, series: s.series, readings: s.plan!.map((r, j) => ({ ...reading(j + 1, r.loadG), ...(r.phase ? { phase: r.phase } : {}), ...(r.position ? { position: r.position, zero: zero() } : {}), ...(r.tareG ? { tareLoad: r.tareG } : {}), ...(r.baseG ? { baseLoad: r.baseG } : {}) })), conditions: { stable: true, sufficientAccuracy: true, preloaded: true, positionEvidence: true, otherAutomaticDevicesDisabled: true, zeroInitiatedNearChangeover: true }, evidenceReference: 'SYNTHETIC calibrated weights, actual test input fixture only' };
}
describe('P4A weighing and correction: independently established 5g interval expectations', () => {
    it('versioned P4A and unchanged valid P3 history both validate', () => { const old = buildNativeProgramme(instrument, profile, 'tech'); const bytes = JSON.stringify(old); expect(nativeProgrammeIssue(old)).toBeUndefined(); expect(nativeProgrammeIssue(build())).toBeUndefined(); expect(JSON.stringify(old)).toBe(bytes); expect(old.ruleset).toBe('W8LAB-R76-2006-P3-1'); });
    it('complete type plan conservatively includes ten positive loads plus zero and reverse', () => { const p = build(), s = submission(p); expect(s.readings.length).toBe(21); expect(s.readings.slice(0, 11).map(r => r.load)).toEqual(['0', '100', '1500', '2500', '3000', '4500', '6000', '7500', '9000', '10000', '15000']); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('verification plan conservatively includes five positive loads plus zero, both directions', () => { const p = build({}, {}, { purpose: 'INITIAL_VERIFICATION' as any }), s = submission(p); expect(s.readings.length).toBe(11); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('partial ascending-only data cannot pass', () => { const p = build(), s = submission(p); s.readings = s.readings.slice(0, 10); expect(evaluateNative(p, s)).toMatchObject({ complete: false, status: 'INCOMPLETE' }); });
    it('wrong load progression is rejected rather than silently sorted', () => { const p = build(), s = submission(p); [s.readings[1], s.readings[2]] = [s.readings[2], s.readings[1]]; expect(() => evaluateNative(p, s)).toThrow(/sequence/); });
    it('missing transition is rejected', () => { const p = build(), s = submission(p); s.readings[3].load = '2495'; expect(() => evaluateNative(p, s)).toThrow(/2500/); });
    it('computes independent published P=1001 E=1 E0=.5 Ec=.5 example within a tare-independent row', () => { const p = build(), s = submission(p, 'ECCENTRICITY'); for (const r of s.readings) {
        r.load = '5000';
        r.indication = '5000';
        r.additionalWeights = '1.5';
        r.zero!.additionalWeights = '2';
    } const r = evaluateNative(p, s).rows[0]; expect(r).toMatchObject({ P: '5001', E: '1', E0: '0.5', Ec: '0.5', limitG: '5', verdict: 'PASS' }); });
    it.each([['5', 'PASS'], ['4.999', 'FAIL']])('MPE at 500e boundary, delta=%s gives %s', (delta, status) => { const p = build(), s = submission(p); s.readings[3].indication = '2505'; s.readings[3].additionalWeights = delta; expect(evaluateNative(p, s).status).toBe(status); expect(evaluateNative(p, s).rows[3].limitG).toBe('2.5'); });
    it('doubles only the Table 6 service limit', () => { const p = build({}, {}, { purpose: 'IN_SERVICE_INSPECTION' as any }), s = submission(p); const r = s.readings.find(r => r.load === '2500')!; r.indication = '2505'; expect(evaluateNative(p, s).status).toBe('PASS'); expect(evaluateNative(p, s).rows.find(r => r.loadG === '2500')!.limitG).toBe('5'); });
    it('g/kg observations give byte-equivalent numeric traces and verdicts', () => { const p = build(), g = submission(p), kg = JSON.parse(JSON.stringify(g)) as NativeSubmission; for (const r of kg.readings) {
        r.unit = 'kg';
        for (const k of ['load', 'indication', 'additionalWeights'] as const)
            r[k] = String(Number(r[k]) / 1000);
    } expect(evaluateNative(p, kg)).toEqual(evaluateNative(p, g)); });
    it.each(['lb', [], {}, null])('rejects invalid or coerced unit %j', unit => { const p = build(), s = submission(p); (s.readings[0] as any).unit = unit; expect(() => evaluateNative(p, s)).toThrow(/unit/); });
    it('records a complete failed programme section without pretending overall completion', () => { const p = build(), s = submission(p); s.readings[3].indication = '2510'; const result = evaluateNative(p, s); expect(result).toMatchObject({ status: 'FAIL', complete: true }); const assessment = assessNative({ id: 'case', nativeProgramme: p } as TestCase, instrument, [{ id: 'r', testCaseId: 'case', programmeId: p.id, submission: s, result, inputFingerprint: nativeFingerprint(p, s), createdAt: '2026-01-01', createdBy: 'tech' }]); expect(assessment).toMatchObject({ complete: false, observedOutcome: 'FAIL' }); expect(assessment.procedures.find(d => d.id === 'WEIGHING')!.status).toBe('FAIL'); });
});
describe('P4A eccentricity, tare and indications', () => {
    it.each([[4, 'PLATFORM', 4, '5000'], [6, 'PLATFORM', 6, '3000'], [5, 'SPECIAL', 5, '1500']] as const)('supports %i supports / %s with %i positions', (supports, receptor, count, load) => { const p = build({}, {}, { supportPoints: supports, loadReceptor: receptor as any }), s = submission(p, 'ECCENTRICITY'); expect(s.readings).toHaveLength(count); expect(s.readings[0].load).toBe(load); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('rolling positions cover each section in both directions with fresh zero', () => { const p = build({ rollingSections: 2, rollingReverse: true, rollingLoadG: '12000' }, {}, { loadReceptor: 'ROLLING' as any }), s = submission(p, 'ECCENTRICITY'); expect(s.readings).toHaveLength(12); expect(s.readings[3].position).toBe('SECTION_1_REVERSE_BEGIN'); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('missing position cannot pass', () => { const p = build(), s = submission(p, 'ECCENTRICITY'); s.readings.pop(); expect(evaluateNative(p, s).status).toBe('INCOMPLETE'); });
    it('duplicate/forged position is rejected', () => { const p = build(), s = submission(p, 'ECCENTRICITY'); s.readings[1].position = 'QUARTER_1'; expect(() => evaluateNative(p, s)).toThrow(/position/); });
    it('requires each fresh zero measurement and sketch confirmation', () => { const p = build(), s = submission(p, 'ECCENTRICITY'); delete s.readings[0].zero; expect(() => evaluateNative(p, s)).toThrow(/zero observation/); s.readings[0].zero = zero(); s.conditions.positionEvidence = false; expect(evaluateNative(p, s).status).toBe('INCOMPLETE'); });
    it.each([{ mobile: true }, { adjacentSupports: true }])('blocked special geometry is not N/A: %j', patch => { const p = build(patch, {}, { supportPoints: 6 }); expect(p.decisions.find(d => d.id === 'ECCENTRICITY')!.applicability).toBe('UNSUPPORTED'); });
    it('subtractive tare evaluates residual net sequence separately', () => { const p = build({ tareKind: 'SUBTRACTIVE', maximumTareG: '6000' }, { hasTare: true }), s = submission(p, 'TARE'); expect(s.readings[0].tareLoad).toBe('3000'); expect(s.readings.find(r => r.phase === 'UP' && r.load === '12000')).toBeDefined(); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('additive tare requires two independent configurations', () => { const p = build({ tareKind: 'ADDITIVE', maximumTareG: '3000' }, { hasTare: true }); expect(p.decisions.find(d => d.id === 'TARE')!.samples!.map(s => s.loadG)).toEqual(['1000', '3000']); expect(evaluateNative(p, submission(p, 'TARE', 'TARE_THIRD')).status).toBe('PASS'); expect(evaluateNative(p, submission(p, 'TARE', 'TARE_MAX')).status).toBe('PASS'); });
    it('tare MPE depends on net not gross load', () => { const p = build({ tareKind: 'SUBTRACTIVE', maximumTareG: '6000' }, { hasTare: true }), s = submission(p, 'TARE'); const row = s.readings.find(r => r.load === '2500')!; row.indication = '2505'; const result = evaluateNative(p, s); expect(result.rows.find(r => r.loadG === '2500')).toMatchObject({ limitG: '2.5', verdict: 'FAIL' }); });
    it.each([['1.25', 'FAIL'], ['1.251', 'PASS']])('electronic tare must be better than .25e at delta=%s', (delta, status) => { const p = build({ tareKind: 'SUBTRACTIVE', maximumTareG: '6000' }, { hasTare: true }), s = submission(p, 'TARE_ACCURACY'); s.readings[0].additionalWeights = delta; expect(evaluateNative(p, s).status).toBe(status); });
    it('tare comparison uses independent zero determinations and MPE-limited display agreement', () => { const p = build({ tareKind: 'SUBTRACTIVE', maximumTareG: '6000', tareWeighingDevice: true }, { hasTare: true }), s = submission(p, 'TARE_COMPARISON'); s.readings[0].zero = zero(); s.readings[0].deviceIndications = [{ indication: '3000', additionalWeights: '2.5', zero: zero() }]; expect(evaluateNative(p, s).status).toBe('PASS'); s.readings[0].deviceIndications[0].indication = '3005'; expect(evaluateNative(p, s).status).toBe('PASS'); s.readings[0].deviceIndications[0].indication = '3010'; expect(evaluateNative(p, s).status).toBe('FAIL'); });
    it('multiple devices compare every weighing step; printing cannot differ', () => { const p = build({ devices: ['DISPLAY', 'PRINT'] }), s = submission(p, 'MULTIPLE_INDICATORS'); for (const r of s.readings)
        r.deviceIndications = [{ indication: r.indication, additionalWeights: '2.5' }, { indication: r.indication, additionalWeights: '2.5' }]; expect(evaluateNative(p, s).status).toBe('PASS'); s.readings[3].deviceIndications![1].indication = '2505'; expect(evaluateNative(p, s).status).toBe('FAIL'); });
    it('single device is justified N/A, not PASS', () => expect(build({ devices: ['DISPLAY'], stabilityFunctions: ['STORE'], stabilityLoadsG: { STORE: '7500' } }).decisions.find(d => d.id === 'MULTIPLE_INDICATORS')!.applicability).toBe('NOT APPLICABLE'));
    it('supplementary test uses declared upper initial-zero limit', () => { const p = build({ initialZeroRangeG: '4500' }, {}, { initialZeroSetting: true }), s = submission(p, 'SUPPLEMENTARY_WEIGHING'); expect(evaluateNative(p, s).status).toBe('PASS'); s.readings[0].baseLoad = '4000'; expect(() => evaluateNative(p, s)).toThrow(/compensated/); });
    it('declared initial-zero range at 20% excludes supplementary test only', () => { const p = build({ initialZeroRangeG: '3000' }, {}, { initialZeroSetting: true }); expect(p.decisions.find(d => d.id === 'SUPPLEMENTARY_WEIGHING')!.applicability).toBe('NOT APPLICABLE'); expect(p.decisions.find(d => d.id === 'ZERO_RANGE_CONTROLS')!.applicability).toBe('UNSUPPORTED'); });
});
describe('P4A discrimination and time', () => {
    const disc = () => { const p = build(), s = submission(p, 'DISCRIMINATION'); for (const r of s.readings) {
        r.initialIndication = r.load;
        r.decreasedIndication = String(Number(r.load) - 5);
        r.restoredWeight = '0.5';
        r.addedLoad = '7';
        r.indication = String(Number(r.load) + 5);
    } return { p, s }; };
    it('digital type discrimination verifies actual sequence and 1.4d response', () => { const { p, s } = disc(); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('wrong discrimination response is a completed FAIL', () => { const { p, s } = disc(); s.readings[0].indication = '100'; expect(evaluateNative(p, s)).toMatchObject({ complete: true, status: 'FAIL' }); });
    it('wrong 1.4d addition is invalid input, not a pass', () => { const { p, s } = disc(); s.readings[0].addedLoad = '6'; expect(() => evaluateNative(p, s)).toThrow(/1.4d/); });
    it('verification digital discrimination is N/A', () => expect(build({}, {}, { purpose: 'INITIAL_VERIFICATION' as any }).decisions.find(d => d.id === 'DISCRIMINATION')!.applicability).toBe('NOT APPLICABLE'));
    it.each([[true, 'NOT APPLICABLE'], [false, 'UNSUPPORTED'], [null, 'UNDETERMINED']] as const)('sensitivity selfIndicating=%s is %s', (self, status) => expect(build({ selfIndicating: self }).decisions.find(d => d.id === 'SENSITIVITY')!.applicability).toBe(status));
    const creep = () => { const p = build(), s = submission(p, 'CREEP'); s.conditions = { ...s.conditions, loadMaintained: true, environmentalStability: true, immediateStableReadings: true }; s.readings.forEach((r, j) => { r.timestamp = ['2026-01-01T00:00:00Z', '2026-01-01T00:15:00Z', '2026-01-01T00:30:00Z'][j]; r.temperatureC = '20'; }); return { p, s }; };
    it('creep accepts strictly qualifying actual 30-minute early exit', () => { const { p, s } = creep(); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('creep .2e equality requires four hours instead of early PASS', () => { const { p, s } = creep(); s.readings[2].additionalWeights = '1.5'; expect(evaluateNative(p, s).status).toBe('INCOMPLETE'); });
    it.each([['7.5', 'PASS'], ['7.501', 'FAIL']])('four-hour creep MPE boundary %s gives %s', (change, status) => { const { p, s } = creep(); s.readings[2].additionalWeights = '1.5'; s.readings.push({ ...reading(4, '15000'), indication: '15010', additionalWeights: String(12.5 - Number(change)), temperatureC: '20', timestamp: '2026-01-01T04:00:00Z' }); expect(evaluateNative(p, s).status).toBe(status); });
    it('out-of-order time is rejected', () => { const { p, s } = creep(); s.readings[1].timestamp = '2026-01-01T00:00:00Z'; expect(() => evaluateNative(p, s)).toThrow(/chronological/); });
    it('no future/simulated timestamp is accepted', () => { const { p, s } = creep(); s.readings[2].timestamp = '2999-01-01T00:30:00Z'; expect(() => evaluateNative(p, s)).toThrow(/actual observation/); });
    it('missing 15-minute reading stays incomplete', () => { const { p, s } = creep(); s.readings[1].timestamp = '2026-01-01T00:16:00Z'; expect(evaluateNative(p, s).status).toBe('INCOMPLETE'); });
    it('unstable environment invalidates test completion', () => { const { p, s } = creep(); s.readings[1].temperatureC = '22.1'; expect(evaluateNative(p, s).status).toBe('INCOMPLETE'); });
    const returning = () => { const p = build(), s = submission(p, 'ZERO_RETURN'); s.conditions = { ...s.conditions, loadMaintained: true, environmentalStability: true, immediateStableReadings: true }; s.readings.forEach((r, j) => { r.timestamp = ['2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z', '2026-01-01T00:31:00Z', '2026-01-01T00:31:05Z'][j]; r.temperatureC = '20'; }); return { p, s }; };
    it.each([['0', 'PASS'], ['-0.001', 'FAIL']])('zero return 0.5e boundary delta=%s', (delta, status) => { const { p, s } = returning(); if (delta === '0')
        s.readings[3].additionalWeights = '0';
    else {
        s.readings[3].indication = '5';
        s.readings[3].additionalWeights = '4.999';
    } expect(evaluateNative(p, s).status).toBe(status); });
    it('short load duration is incomplete', () => { const { p, s } = returning(); s.readings[2].timestamp = '2026-01-01T00:30:59Z'; expect(evaluateNative(p, s).status).toBe('INCOMPLETE'); });
});
describe('P4A equilibrium, validation and historical safety', () => {
    const stable = () => { const p = build(), s = submission(p, 'EQUILIBRIUM'); s.conditions = { ...s.conditions, worstCaseApplied: true, documentationReviewed: true }; for (const r of s.readings) {
        r.continuousBlocked = true;
        r.prematureBlocked = true;
        r.disturbed = true;
        r.outputIndication = '7500';
        r.following = [{ seconds: '0', indication: '7500' }, { seconds: '5', indication: '7505' }];
    } return { p, s }; };
    it('five actual equilibrium repetitions with adjacent output trace pass', () => { const { p, s } = stable(); expect(evaluateNative(p, s).status).toBe('PASS'); });
    it('four repetitions cannot pass', () => { const { p, s } = stable(); s.readings.pop(); expect(evaluateNative(p, s).status).toBe('INCOMPLETE'); });
    it('operation under continuous disturbance is a FAIL', () => { const { p, s } = stable(); s.readings[0].continuousBlocked = false; expect(evaluateNative(p, s).status).toBe('FAIL'); });
    it('non-adjacent following indications fail', () => { const { p, s } = stable(); s.readings[0].following![1].indication = '7510'; expect(evaluateNative(p, s).status).toBe('FAIL'); });
    it('printed value must be one of the following indications', () => { const { p, s } = stable(); s.readings[0].outputIndication = '7495'; expect(evaluateNative(p, s).status).toBe('FAIL'); });
    it('short following trace is invalid', () => { const { p, s } = stable(); s.readings[0].following![1].seconds = '4'; expect(() => evaluateNative(p, s)).toThrow(/0–5/); });
    it('undocumented worst case is undetermined, never N/A', () => { const p = build({ stabilityWorstCase: '' }); expect(p.decisions.find(d => d.id === 'EQUILIBRIUM')!.applicability).toBe('UNDETERMINED'); });
    it.each([['selfIndicating', []], ['tareKind', ['NONE']], ['devices', [['DISPLAY']]], ['stabilityFunctions', [{}]], ['rollingSections', '1'], ['mobile', 'false']])('rejects malformed performance field %s', (field, value) => expect(() => build({ [field as string]: value })).toThrow());
    it('tampered frozen applicability cannot be accepted', () => { const p = build(); p.decisions.find(d => d.id === 'INFLUENCE_TIME')!.applicability = 'NOT APPLICABLE'; expect(nativeProgrammeIssue(p)).toMatch(/invalid/); expect(() => evaluateNative(p, {} as any)).toThrow(/invalid/); });
    it('privileged test fields are rejected', () => { const p = build(), s = submission(p); (s as any).status = 'PASS'; expect(() => evaluateNative(p, s)).toThrow(/fields/); });
    it('stale result version cannot count as current completion', () => { const p = build(), s = submission(p), result = evaluateNative(p, s); result.ruleset = 'W8LAB-R76-2006-P3-1'; const a = assessNative({ id: 'case', nativeProgramme: p } as TestCase, instrument, [{ id: 'r', testCaseId: 'case', programmeId: p.id, submission: s, result, inputFingerprint: nativeFingerprint(p, s), createdAt: '2026-01-01', createdBy: 'tech' }]); expect(a.complete).toBe(false); expect(a.procedures.find(d => d.id === 'WEIGHING')!.status).toBe('INCOMPLETE'); });
});
