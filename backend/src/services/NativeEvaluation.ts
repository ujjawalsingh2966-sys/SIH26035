import Decimal from 'decimal.js';
import { createHash } from 'crypto';
import { convertToUnit, isMassUnit } from '../calculations/unitConversion';
import type { NativeProgramme, NativeResult, NativeSubmission } from '../types/native';
import { RuleEngine } from '../rules/engine';
import { MasterDataError } from './MasterDataService';
import { NATIVE_RULESET, requireNativeProgramme, nativePurposePolicy } from './NativeApplicability';
import { PERFORMANCE_RULESET } from './PerformancePlan';
import { evaluatePerformance } from './PerformanceEvaluation';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const nativeFingerprint = (programme: NativeProgramme, submission: NativeSubmission) => hash({ programme, submission });
function gram(value: unknown, unit: unknown, signed = false): Decimal {
  if (!isMassUnit(unit)) throw new MasterDataError('Unsupported mass unit; use mg, g, kg or t');
  if (typeof value !== 'string' || value.length > 40 || !(signed ? /^-?\d+(?:\.\d+)?$/ : /^\d+(?:\.\d+)?$/).test(value)) throw new MasterDataError('Readings must be finite decimal strings, without exponent notation');
  return convertToUnit({ value, unit }, 'g').value;
}
export function evaluateNative(programme: NativeProgramme, submission: NativeSubmission): NativeResult {
  requireNativeProgramme(programme);
  const policy = nativePurposePolicy(programme.profile.purpose);
  const decision = programme.decisions.find(item => item.id === submission?.procedureId);
  if (!decision || decision.applicability !== 'REQUIRED' || !decision.native) throw new MasterDataError('Procedure is unsupported, undetermined or not applicable; no evaluation was saved', 422);
  if (programme.ruleset === PERFORMANCE_RULESET && decision.id !== 'REPEATABILITY' && !decision.id.startsWith('ZERO_')) return evaluatePerformance(programme, submission);
  if (programme.ruleset === PERFORMANCE_RULESET && decision.id === 'ZERO_RETURN') return evaluatePerformance(programme, submission);
  const sample = decision.samples?.find(item => item.series === submission.series);
  if (!sample) throw new MasterDataError('Unsupported test series');
  if (Object.keys(submission).some(key => !['procedureId','series','readings','conditions','evidenceReference'].includes(key))) throw new MasterDataError('Unsupported or privileged test fields');
  if (!Array.isArray(submission.readings) || submission.readings.length > 100) throw new MasterDataError('Readings must be an array (maximum 100 per series)');
  if (!submission.conditions || typeof submission.conditions !== 'object' || Array.isArray(submission.conditions) || Object.entries(submission.conditions).some(([key, value]) => !['stable','automaticDevicesInOperation','zeroInitiatedNearChangeover','outsideAutomaticRange','otherAutomaticDevicesDisabled','sufficientAccuracy'].includes(key) || typeof value !== 'boolean')) throw new MasterDataError('Invalid test conditions');
  if (typeof submission.evidenceReference !== 'string' || !submission.evidenceReference.trim() || submission.evidenceReference.length > 1000) throw new MasterDataError('Record the observation/equipment evidence reference');
  const instrument = programme.instrument, e = new Decimal(instrument.e!), max = new Decimal(instrument.maxCapacity!), min = new Decimal(instrument.minCapacity!);
  const repeat = decision.id === 'REPEATABILITY';
  const automatic = ['ZERO_AUTOMATIC','ZERO_ZERO_TRACKING'].includes(decision.id);
  const fittedAutomatic = programme.profile.zeroDevices!.some(device => device === 'AUTOMATIC' || device === 'ZERO_TRACKING');
  const issues: string[] = [];
  if (![NATIVE_RULESET,PERFORMANCE_RULESET].includes(programme.ruleset)) throw new MasterDataError('Unsupported stored ruleset', 409);
  if (sample.minimumOnly ? submission.readings.length < sample.count : submission.readings.length !== sample.count) issues.push(`Series requires ${sample.minimumOnly ? 'at least ' : ''}${sample.count} readings; ${submission.readings.length} recorded.`);
  if (submission.conditions.stable !== true) issues.push('Stable loaded indications must be confirmed.');
  if (submission.conditions.sufficientAccuracy !== true) issues.push('Sufficient changeover determination accuracy must be confirmed and supported by the equipment evidence reference (A.4.4.3).');
  if (repeat && fittedAutomatic && submission.conditions.automaticDevicesInOperation !== true) issues.push('Automatic zero-setting/tracking must be in operation during repeatability (A.4.10).');
  if (!repeat && automatic && submission.conditions.outsideAutomaticRange !== true) issues.push('Bring indication outside the automatic range and document this condition (A.4.2.3.2).');
  if (!repeat && !automatic && submission.conditions.zeroInitiatedNearChangeover !== true) issues.push('Initiate zero-setting near a changeover point (A.4.2.3.1).');
  if (!repeat && !automatic && fittedAutomatic && submission.conditions.otherAutomaticDevicesDisabled !== true) issues.push('Other automatic/tracking devices must not interfere with the direct zero measurement.');
  const sequences = submission.readings.map(row => row?.sequence);
  if (sequences.some((sequence, index) => sequence !== index + 1)) throw new MasterDataError('Readings must have consecutive ordered sequences starting at 1');
  const errors: Decimal[] = [];
  let seriesLimit: Decimal | undefined;
  const rows = submission.readings.map(row => {
    if (!row || Object.keys(row).some(key => !['sequence','load','indication','additionalWeights','unit','unloadedIndication','unloadedAtRest','resetToZero'].includes(key))) throw new MasterDataError('Unsupported reading fields');
    const load = gram(row.load, row.unit), indication = gram(row.indication, row.unit, true), delta = gram(row.additionalWeights, row.unit);
    if (load.gt(max) || delta.gt(e) || !indication.mod(e).isZero()) throw new MasterDataError('Load must not exceed Max, additional changeover weights must be within one e, and indicated values must be multiples of the saved d=e');
    if (repeat && (!load.eq(sample.loadG) || load.lt(min))) throw new MasterDataError(`Supported ${sample.series} nominal load is exactly ${sample.loadG} g; other approximate-load selections are not implemented`);
    if (!repeat && (automatic ? !load.gt(0) : !load.eq(0) || !indication.eq(0))) throw new MasterDataError(automatic ? 'Outside-range accuracy requires a positive known load' : 'Direct zero accuracy requires zero post-setting load and zero indication');
    if (repeat) {
      const unloaded = gram(row.unloadedIndication, row.unit, true);
      if (!unloaded.mod(e).isZero()) throw new MasterDataError('Unloaded indications must also be multiples of the saved d=e');
      if (typeof row.resetToZero !== 'boolean' || typeof row.unloadedAtRest !== 'boolean') throw new MasterDataError('Each repetition needs an unloaded reading, rest confirmation and explicit reset-to-zero declaration');
      if (!row.unloadedAtRest || !unloaded.eq(0) && !row.resetToZero) issues.push(`Reading ${row.sequence}: unloaded rest/reset condition is incomplete (A.4.10).`);
    }
    const P = indication.plus(e.div(2)).minus(delta), E = P.minus(load);
    let limit: Decimal;
    if (repeat) {
      // Reuse the verified Table 6 MPE path; do NOT turn generic TEST-REP rows
      // into series evaluations or change the older orchestration scope.
      const rule = RuleEngine.evaluate({ instrument: { isNAWI: true, isElectronic: true, isSingleRange: true, isGraduated: true, scaleType: 'Manual', accuracyClass: instrument.accuracyClass!, hasTare: !!instrument.hasTare },
        testType: 'TEST-WEIGH', isInitialVerification: policy.initialLimits, m: load.div(e).toString(), e: { value: e.toString(), unit: 'g' } });
      if (rule.status !== 'APPLICABLE' || !rule.mpeLimit) throw new MasterDataError('MPE could not be resolved for this test load', 422);
      limit = new Decimal(rule.mpeLimit.value);
    } else limit = e.times('0.25');
    errors.push(E); seriesLimit = limit;
    return { sequence: row.sequence, loadG: load.toString(), indicationG: indication.toString(), additionalWeightsG: delta.toString(), P: P.toString(), E: E.toString(), limitG: limit.toString(), verdict: E.abs().lte(limit) ? 'PASS' as const : 'FAIL' as const };
  });
  const minimum = errors.length ? Decimal.min(...errors) : undefined, maximum = errors.length ? Decimal.max(...errors) : undefined;
  const spread = maximum?.minus(minimum!);
  const spreadVerdict = spread && seriesLimit ? spread.lte(seriesLimit) ? 'PASS' as const : 'FAIL' as const : undefined;
  const complete = issues.length === 0;
  return { standard: programme.standard, ruleset: programme.ruleset, clauses: decision.clauses,
    methodology: repeat ? 'P = I + e/2 - deltaL; E = P - L; max(E)-min(E) <= |MPE(L)| AND every |E| <= |MPE(L)|. No E0 subtraction between repetitions (A.4.10/R76-2 section 5).' : 'E0 = I + e/2 - deltaL - L; |E0| <= 0.25e. This is zero-setting accuracy only, not range/control/tracking-rate conformity.',
    status: !complete ? 'INCOMPLETE' : rows.some(row => row.verdict === 'FAIL') || repeat && spreadVerdict === 'FAIL' ? 'FAIL' : 'PASS', complete, issues, count: rows.length, requiredCount: sample.count, rows,
    ...(repeat && minimum && maximum && spread ? { minimumErrorG: minimum.toString(), maximumErrorG: maximum.toString(), spreadG: spread.toString(), spreadVerdict } : {}), ...(seriesLimit ? { limitG: seriesLimit.toString() } : {}) };
}
