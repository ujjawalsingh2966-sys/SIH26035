import type { Instrument, Manufacturer, ObservationRecord, ObservationType, TestCase } from '../types/domain';
import { finiteDecimal, isMassUnit } from '../calculations/unitConversion';
import { EVALUATION_VERSION, observationFingerprint } from './EvaluationService';
import { observationStore, nativeTestStore } from '../repositories';
import { caseMasterData } from './MasterDataService';
import { assessNative } from './NativeAssessment';

export const TEST_KEYS = {
  WEIGHING: 'weighing', ECCENTRICITY: 'eccentricity', REPEATABILITY: 'repeatability',
  TARE: 'tare', ZERO_SETTING: 'zeroSetting',
} as const;
export type ProgrammeTestStatus = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT STARTED' | 'NOT APPLICABLE' | 'UNSUPPORTED' | 'UNDETERMINED';
export interface ProgrammeAssessment {
  complete: boolean;
  applicability: 'DETERMINED' | 'UNDETERMINED';
  overallVerdict: 'PASS' | 'FAIL' | 'INCOMPLETE';
  observedOutcome: 'PASS' | 'FAIL' | 'UNDETERMINED';
  tests: Record<keyof typeof TEST_KEYS, { status: ProgrammeTestStatus; reason?: string; observations: number }>;
  issues: string[];
  native?: ReturnType<typeof assessNative>;
}

const nonblank = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

function currentResolvedEvaluation(instrument: Instrument, testCase: TestCase, row: ObservationRecord): boolean {
  const evaluation = row.evaluation;
  if (!evaluation || evaluation.calculationVersion !== EVALUATION_VERSION
    || evaluation.inputFingerprint !== observationFingerprint(instrument, row, testCase.isInitialVerification !== false)
    || evaluation.rulePackage?.status !== 'APPLICABLE'
    || !['PASS', 'FAIL'].includes(evaluation.compliance?.verdict)
    || !evaluation.rulePackage.traceability?.ruleVersion) return false;
  try {
    for (const quantity of [evaluation.calculation.P, evaluation.calculation.E, evaluation.calculation.Ec, evaluation.rulePackage.mpeLimit]) {
      if (!quantity || !isMassUnit(quantity.unit)) return false;
      finiteDecimal(quantity.value);
    }
    return true;
  } catch { return false; }
}

/** A completeness gate, not a new metrology evaluator. It never recalculates or
 * changes stored observations. Untested, blocked and unknown are not PASS/N/A. */
export function assessProgramme(testCase: TestCase, instrument: Instrument | undefined,
  manufacturer: Manufacturer | undefined, observations: ObservationRecord[]): ProgrammeAssessment {
  const issues: string[] = [];
  const rows = observations.filter(row => row.testCaseId === testCase.id);
  if (!manufacturer || ![manufacturer.name, manufacturer.address, manufacturer.identifier].every(nonblank)) {
    issues.push('Manufacturer details are missing or not linked to this instrument.');
  }
  if (!instrument || ![instrument.name, instrument.model, instrument.serialNumber].every(nonblank)
    || !['I', 'II', 'III', 'IIII'].includes(instrument.accuracyClass || '')
    || instrument.isWeighing !== true || instrument.isManual !== true
    || instrument.isElectronic !== true || instrument.isSingleRange !== true
    || typeof instrument.hasTare !== 'boolean') {
    issues.push('Instrument identity, classification or supported profile is incomplete.');
  }
  try {
    const max = finiteDecimal(instrument?.maxCapacity), min = finiteDecimal(instrument?.minCapacity);
    const e = finiteDecimal(instrument?.e), d = finiteDecimal(instrument?.d);
    if (min.lt(0) || !min.lt(max) || !d.gt(0) || d.gt(e) || e.gt(max)) throw new Error();
  } catch { issues.push('Valid instrument Max, Min, e and d in grams are required.'); }
  try {
    const conditions = testCase.laboratoryConditions;
    finiteDecimal(conditions?.temperature);
    const humidity = finiteDecimal(conditions?.humidity), pressure = finiteDecimal(conditions?.pressure);
    if (humidity.lt(0) || humidity.gt(100) || !pressure.gt(0)) throw new Error();
  } catch { issues.push('Valid laboratory temperature, humidity (0–100%) and pressure (>0 hPa) are required.'); }

  if (testCase.nativeProgramme !== undefined && instrument) {
    const native = assessNative(testCase, instrument, nativeTestStore.findAll());
    issues.push(...native.issues);
    const tests = {} as ProgrammeAssessment['tests'];
    for (const type of Object.keys(TEST_KEYS) as ObservationType[]) {
      const decisions = native.procedures.filter(item => type === 'ZERO_SETTING' ? item.id.startsWith('ZERO_') : item.id === type);
      const unfinished = decisions.find(item => !['PASS','FAIL','NOT APPLICABLE'].includes(item.status));
      const status = (!decisions.length ? 'UNDETERMINED' : unfinished?.status || (decisions.some(item => item.status === 'FAIL') ? 'FAIL' : decisions.every(item => item.status === 'NOT APPLICABLE') ? 'NOT APPLICABLE' : 'PASS')) as ProgrammeTestStatus;
      tests[type] = { status, reason: decisions.map(item => `${item.id}: ${item.reason}`).join(' '), observations: decisions.reduce((sum, item) => sum + item.observations, 0) };
    }
    const complete = issues.length === 0;
    return { complete, applicability: native.applicability, native, tests, issues, observedOutcome: native.observedOutcome,
      overallVerdict: complete ? native.observedOutcome === 'FAIL' ? 'FAIL' : 'PASS' : 'INCOMPLETE' };
  }
  const determination = testCase.programmeDetermination;
  const requirements = determination?.requirements;
  const requiredTypes: ObservationType[] = ['WEIGHING', 'ECCENTRICITY', 'REPEATABILITY', 'ZERO_SETTING'];
  if (instrument?.hasTare !== false) requiredTypes.push('TARE');
  const determined = !!determination && determination.standard === 'OIML R 76-1:2006'
    && nonblank(determination.determinedBy) && Number.isFinite(Date.parse(determination.determinedAt))
    && Array.isArray(requirements) && requirements.length > 0
    && requirements.every(item => item && Object.prototype.hasOwnProperty.call(TEST_KEYS, item.testType)
      && Number.isSafeInteger(item.minimumObservations) && item.minimumObservations > 0)
    && new Set(requirements.map(item => item.testType)).size === requirements.length
    && requiredTypes.every(type => requirements.some(item => item.testType === type));
  if (!determined) issues.push('Applicable test programme is undetermined. A server-owned applicability and sampling plan is required; the five core tabs alone do not establish full R76 coverage.');
  if (rows.some(row => !Object.prototype.hasOwnProperty.call(TEST_KEYS, row.testType))) {
    issues.push('The record contains an unknown test type.');
  }

  const tests = {} as ProgrammeAssessment['tests'];
  for (const type of Object.keys(TEST_KEYS) as ObservationType[]) {
    const matching = rows.filter(row => row.testType === type);
    let status: ProgrammeTestStatus, reason: string | undefined;
    if (type === 'TARE' && instrument?.hasTare === false && matching.length === 0) {
      status = 'NOT APPLICABLE'; reason = 'Instrument has no tare device (hasTare=false).';
    } else if (!matching.length) {
      status = 'NOT STARTED'; reason = 'No observations recorded.';
    } else {
      const expected = determined ? requirements!.find(item => item.testType === type)?.minimumObservations : undefined;
      const sequences = matching.map(row => row.sequence);
      if (!instrument || matching.some(row => !currentResolvedEvaluation(instrument, testCase, row))
        || sequences.some(sequence => !Number.isSafeInteger(sequence) || sequence < 1)
        || new Set(sequences).size !== matching.length
        || (expected !== undefined && matching.length < expected)
        || (type === 'TARE' && instrument.hasTare === false)) {
        status = 'INCOMPLETE';
        reason = 'Required sampling or a current, resolved evaluation is missing; blocked/legacy evaluations cannot establish completion.';
      } else {
        status = matching.some(row => row.evaluation!.compliance.verdict === 'FAIL') ? 'FAIL' : 'PASS';
      }
    }
    tests[type] = { status, reason, observations: matching.length };
    if (status === 'NOT STARTED' || status === 'INCOMPLETE') issues.push(`${type}: ${reason}`);
  }
  const complete = issues.length === 0;
  const resolvedRows = rows.filter(row => instrument && currentResolvedEvaluation(instrument, testCase, row));
  const observedOutcome = resolvedRows.some(row => row.evaluation!.compliance.verdict === 'FAIL') ? 'FAIL'
    : resolvedRows.length ? 'PASS' : 'UNDETERMINED';
  return { complete, applicability: determined ? 'DETERMINED' : 'UNDETERMINED', tests, issues,
    observedOutcome, overallVerdict: complete ? (observedOutcome === 'FAIL' ? 'FAIL' : 'PASS') : 'INCOMPLETE' };
}

export function assessStoredProgramme(testCase: TestCase): ProgrammeAssessment {
  const { instrument, manufacturer } = caseMasterData(testCase);
  return assessProgramme(testCase, instrument, manufacturer, observationStore.findAll());
}
