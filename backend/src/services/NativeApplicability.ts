import { createHash, randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import type { Instrument } from '../types/domain';
import type { NativeProgramme, NativeProfile, ProcedureDecision } from '../types/native';
import { ZERO_MECHANISMS, TEST_PURPOSES, INDICATION_TYPES, LOAD_RECEPTORS } from '../types/native';
import { MasterDataError, evaluationSupport } from './MasterDataService';
import { PERFORMANCE_RULESET, validatePerformance, performanceDecisions } from './PerformancePlan';
export const NATIVE_RULESET = 'W8LAB-R76-2006-P3-1';
export const instrumentFingerprint = (instrument: Instrument) => createHash('sha256').update(JSON.stringify(instrument)).digest('hex');
function enumString<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new MasterDataError(`${field} must be a supported primitive string`);
  return value as T;
}
/** No default verification branch: untrusted or stored values must be valid first. */
export function nativePurposePolicy(value: unknown) {
  const purpose = enumString(value, TEST_PURPOSES, 'Test purpose');
  switch (purpose) {
    case 'TYPE_EVALUATION': return { typeEvaluation: true, serviceInspection: false, initialLimits: true };
    case 'INITIAL_VERIFICATION': return { typeEvaluation: false, serviceInspection: false, initialLimits: true };
    case 'IN_SERVICE_INSPECTION': return { typeEvaluation: false, serviceInspection: true, initialLimits: false };
    default: throw new MasterDataError('Unsupported test purpose');
  }
}
export function validateProfile(value: unknown): NativeProfile {
  const keys = ['purpose', 'indication', 'zeroDevices', 'initialZeroSetting', 'eccentricityPossible', 'loadReceptor', 'supportPoints', 'evidenceReference', 'noEccentricityJustification'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new MasterDataError('Unsupported programme profile fields');
  const input = value as Record<string, unknown>;
  const purpose = enumString(input.purpose, TEST_PURPOSES, 'Test purpose');
  const indication = enumString(input.indication, INDICATION_TYPES, 'Indication type');
  const loadReceptor = enumString(input.loadReceptor, LOAD_RECEPTORS, 'Load receptor');
  if (input.zeroDevices !== null && (!Array.isArray(input.zeroDevices) || new Set(input.zeroDevices).size !== input.zeroDevices.length)) throw new MasterDataError('Declare zeroDevices as known mechanisms, [] for none, or null for unknown');
  const zeroDevices = input.zeroDevices === null ? null : (input.zeroDevices as unknown[]).map(device => enumString(device, ZERO_MECHANISMS, 'Zero mechanism'));
  for (const key of ['initialZeroSetting', 'eccentricityPossible']) if (input[key] !== null && typeof input[key] !== 'boolean') throw new MasterDataError(`${key} must be true, false or null (unknown)`);
  if (input.supportPoints !== undefined && (!Number.isSafeInteger(input.supportPoints) || Number(input.supportPoints) < 1 || Number(input.supportPoints) > 100)) throw new MasterDataError('Support points must be an integer from 1 to 100');
  for (const key of ['evidenceReference', ...(input.eccentricityPossible === false ? ['noEccentricityJustification'] : [])]) if (typeof input[key] !== 'string' || !(input[key] as string).trim() || (input[key] as string).length > 1000) throw new MasterDataError(`${key} is required (maximum 1000 characters)`);
  if (input.noEccentricityJustification !== undefined && typeof input.noEccentricityJustification !== 'string') throw new MasterDataError('Invalid eccentricity justification');
  return { purpose, indication, loadReceptor,
    zeroDevices,
    initialZeroSetting: input.initialZeroSetting as boolean | null, eccentricityPossible: input.eccentricityPossible as boolean | null,
    ...(input.supportPoints !== undefined ? { supportPoints: input.supportPoints as number } : {}),
    evidenceReference: input.evidenceReference as string,
    ...(input.noEccentricityJustification !== undefined ? { noEccentricityJustification: input.noEccentricityJustification as string } : {}) };
}
/** Coverage register, not a declaration that grouped requirements have been tested. */
function nativeDecisions(instrument: Instrument, profile: NativeProfile): ProcedureDecision[] {
  const decisions: ProcedureDecision[] = [];
  const add = (id: string, name: string, clauses: string[], applicability: ProcedureDecision['applicability'], reason: string, native = false, samples?: ProcedureDecision['samples']) => decisions.push({ id, name, clauses, applicability, reason, native, ...(samples ? { samples } : {}) });
  const policy = nativePurposePolicy(profile.purpose), type = policy.typeEvaluation;
  const supported = evaluationSupport(instrument).supported && instrument.isManual && instrument.isElectronic && instrument.isSingleRange && ['II','III','IIII'].includes(instrument.accuracyClass || '') && instrument.d === instrument.e;
  const known = supported && profile.indication === 'DIGITAL';
  const base = !supported || profile.indication === 'ANALOG' ? 'UNSUPPORTED' : profile.indication === 'UNKNOWN' ? 'UNDETERMINED' : 'REQUIRED';
  add('IDENTITY_TECHNICAL', 'Documentation, construction, marking and technical examination', ['A.1–A.3','4','5','7', type ? '8.2' : '8.3.1–8.3.2'], 'UNSUPPORTED', 'Registration metadata is available, but prescribed technical/visual examinations are not yet captured or evaluated.');
  const max = new Decimal(instrument.maxCapacity || '0');
  const count = type ? max.lt('1000000') ? 10 : 3 : instrument.accuracyClass === 'II' ? 6 : 3;
  const samples = type ? [{ series: 'HALF_MAX', loadG: max.times('0.5').toString(), count, minimumOnly: max.gte('1000000') }, { series: 'MAX', loadG: max.toString(), count, minimumOnly: max.gte('1000000') }] : [{ series: 'EIGHTY_PERCENT', loadG: max.times('0.8').toString(), count, minimumOnly: false }];
  add('REPEATABILITY', 'Repeatability series', ['3.6','3.6.1','A.4.10','A.4.4.3'], base === 'REQUIRED' && profile.zeroDevices === null ? 'UNDETERMINED' : base, 'Digital changeover method with exact nominal 50%/100% (type) or 80% (verification) targets. Other “about/close” loads need a separately verified selection policy; no tolerance is invented. Zero-device presence must be declared.', known && profile.zeroDevices !== null, samples);
  add('WEIGHING', 'Increasing/decreasing weighing series', ['3.5.1','A.4.4.1', ...(type ? [] : ['8.3.3'])], base === 'REQUIRED' ? 'UNSUPPORTED' : base, `${type ? 'Initial intrinsic-error: at least 10' : 'Other/verification: normally at least 5'} distinct loads, including applicable Min/Max and MPE changes, increasing/decreasing series. Existing per-row evaluator does not validate this entire procedure.`, false);
  const eccentricity = profile.eccentricityPossible === false ? 'NOT APPLICABLE' : profile.eccentricityPossible === null || profile.loadReceptor === 'UNKNOWN' || profile.loadReceptor === 'PLATFORM' && !profile.supportPoints ? 'UNDETERMINED' : 'UNSUPPORTED';
  add('ECCENTRICITY', 'Eccentric loading / receptor-specific positions', ['3.6.2','A.4.7'], eccentricity, eccentricity === 'NOT APPLICABLE' ? `${profile.noEccentricityJustification}; evidence: ${profile.evidenceReference}` : 'Receptor construction, support count, positioning/sketch and conditions of use are required; existing generic rows do not establish prescribed coverage.');
  add('TARE', 'Tare accuracy and weighing', ['4.6','A.4.6'], instrument.hasTare === false ? 'NOT APPLICABLE' : instrument.hasTare === true ? 'UNSUPPORTED' : 'UNDETERMINED', instrument.hasTare === false ? 'Frozen instrument declaration hasTare=false; no tare device.' : 'Tare type/capacity and procedure-specific load series are not yet verified.');
  for (const mechanism of ZERO_MECHANISMS) {
    const present = profile.zeroDevices?.includes(mechanism);
    const service = policy.serviceInspection;
    add(`ZERO_${mechanism}`, `Zero accuracy: ${mechanism.replace(/_/g,' ')}`, ['4.5.2', mechanism === 'NON_AUTOMATIC' || mechanism === 'SEMI_AUTOMATIC' ? 'A.4.2.3.1' : 'A.4.2.3.2', 'A.4.4.3'], profile.zeroDevices === null ? 'UNDETERMINED' : !present ? 'NOT APPLICABLE' : service ? 'UNSUPPORTED' : base, profile.zeroDevices === null ? 'Zero-device presence is unknown.' : !present ? `Explicit device inventory excludes ${mechanism}; evidence: ${profile.evidenceReference}` : service ? 'Service-inspection treatment of the 4.5.2 technical accuracy limit under 8.4.2 needs separate verified policy; do not assume either scaling or no scaling.' : 'Accuracy only: changeover error magnitude ≤ 0.25 e; range, signalling and operating controls are separate requirements.', known && !!present && !service, [{ series: 'ACCURACY', loadG: mechanism === 'AUTOMATIC' || mechanism === 'ZERO_TRACKING' ? new Decimal(instrument.e || 0).times(10).toString() : '0', count: 1, minimumOnly: false }]);
  }
  add('ZERO_RANGE_CONTROLS', 'Zero range, indication, operating controls and tracking rate', ['4.5.1','4.5.4–4.5.7','A.4.2.1–A.4.2.2','A.4.12'], profile.zeroDevices === null || profile.initialZeroSetting === null ? 'UNDETERMINED' : 'UNSUPPORTED', 'Initial zero-setting, total range, signalling, equilibrium/control timing and tracking rate require separate evidence; accuracy alone cannot complete clause 4.5.');
  add('SUPPLEMENTARY_WEIGHING', 'Supplementary weighing after initial zero-setting', ['4.5.1','A.4.4.2'], profile.initialZeroSetting === false ? 'NOT APPLICABLE' : profile.initialZeroSetting === null ? 'UNDETERMINED' : 'UNSUPPORTED', profile.initialZeroSetting === false ? `No initial zero-setting device declared; evidence: ${profile.evidenceReference}` : 'Declared initial zero-setting range and compensated-load testing are needed; do not assume range ≤20%.');
  add('DISCRIMINATION', 'Discrimination', ['3.8','A.4.8','8.3.3'], profile.indication === 'UNKNOWN' ? 'UNDETERMINED' : profile.indication === 'ANALOG' ? 'UNSUPPORTED' : !type ? 'NOT APPLICABLE' : !known ? base : new Decimal(instrument.d || 0).lt('0.005') ? 'NOT APPLICABLE' : 'UNSUPPORTED', profile.indication === 'UNKNOWN' ? 'Indication type is unknown.' : profile.indication === 'ANALOG' ? 'Analog discrimination protocol is not implemented.' : !type ? '8.3.3 excludes digital-indication discrimination during verification.' : new Decimal(instrument.d || 0).lt('0.005') ? 'Frozen d is below 5 mg; digital A.4.8.2 excludes this profile.' : 'Three-load discrimination protocol is not implemented.');
  add('INFLUENCE_TIME', 'Influence quantities, creep, zero return, endurance and equilibrium', ['3.9','A.4.11–A.4.12','A.5–A.6'], type ? 'UNSUPPORTED' : 'UNDETERMINED', 'Type programme requires applicable influence/time tests; verification treatment requires the approved type and location/use evidence. Missing attributes are not N/A.');
  add('ELECTRONIC_SOFTWARE', 'Electronic disturbance, span stability, software and module compatibility', ['5.3–5.5','Annex B','Annex C–G'], type ? 'UNSUPPORTED' : 'UNDETERMINED', 'Power supplies, interfaces, software and module configuration need a verified examination/test path; not implemented as an aggregate PASS.');
  return decisions;
}
export function buildNativeProgramme(instrument: Instrument, input: NativeProfile, actorId: string, performance?: unknown): NativeProgramme {
  const profile = validateProfile(input);
  const declaration = performance === undefined ? undefined : validatePerformance(performance, instrument);
  const legacy = nativeDecisions(instrument, profile);
  return { id: `programme_${randomUUID()}`, standard: 'OIML R 76-1:2006', reportReference: 'OIML R 76-2:2007', ruleset: declaration ? PERFORMANCE_RULESET : NATIVE_RULESET, createdAt: new Date().toISOString(), createdBy: actorId, instrumentFingerprint: instrumentFingerprint(instrument), instrument: JSON.parse(JSON.stringify(instrument)), profile,
    decisions: declaration ? performanceDecisions(instrument,profile,declaration,legacy) : legacy, ...(declaration ? {performance:declaration} : {}) };
}
/** Validate persisted JSON without mutating, normalizing or re-evaluating history. */
export function nativeProgrammeIssue(value: unknown): string | undefined {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MasterDataError('Programme metadata is malformed');
    const programme = value as NativeProgramme, profile = validateProfile(programme.profile);
    if (programme.standard !== 'OIML R 76-1:2006' || programme.reportReference !== 'OIML R 76-2:2007' || ![NATIVE_RULESET,PERFORMANCE_RULESET].includes(programme.ruleset)) throw new MasterDataError('Unsupported stored edition or ruleset');
    if (typeof programme.id !== 'string' || !programme.id || typeof programme.createdBy !== 'string' || !programme.createdBy
      || typeof programme.createdAt !== 'string' || !Number.isFinite(Date.parse(programme.createdAt))) throw new MasterDataError('Programme provenance is malformed');
    if (!programme.instrument || typeof programme.instrument !== 'object' || Array.isArray(programme.instrument)
      || programme.instrumentFingerprint !== instrumentFingerprint(programme.instrument)) throw new MasterDataError('Frozen instrument fingerprint does not match');
    const legacy = nativeDecisions(programme.instrument, profile);
    const expected = programme.ruleset === PERFORMANCE_RULESET ? performanceDecisions(programme.instrument,profile,validatePerformance(programme.performance,programme.instrument),legacy) : legacy;
    if (programme.ruleset === NATIVE_RULESET && programme.performance !== undefined) throw new MasterDataError('P3 history cannot contain P4A declarations');
    if (!Array.isArray(programme.decisions) || JSON.stringify(programme.decisions) !== JSON.stringify(expected)) throw new MasterDataError('Stored applicability or sampling decisions do not match the validated profile');
    return undefined;
  } catch (error) {
    return `Stored native programme is invalid: ${error instanceof MasterDataError ? error.message : 'Malformed metadata or decisions'}. Evaluation is blocked; preserve this history for explicit remediation.`;
  }
}
export function requireNativeProgramme(value: unknown): asserts value is NativeProgramme {
  const issue = nativeProgrammeIssue(value);
  if (issue) throw new MasterDataError(issue, 409);
}
