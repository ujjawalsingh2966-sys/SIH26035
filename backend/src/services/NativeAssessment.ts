import type { TestCase, Instrument } from '../types/domain';
import type { NativeTestRecord, ProcedureDecision } from '../types/native';
import { instrumentFingerprint, NATIVE_RULESET, nativeProgrammeIssue } from './NativeApplicability';
import { nativeFingerprint } from './NativeEvaluation';
export function assessNative(testCase: TestCase, instrument: Instrument, records: NativeTestRecord[]) {
  const programme = testCase.nativeProgramme!;
  const issue = nativeProgrammeIssue(programme);
  if (issue) return { standard: 'OIML R 76-1:2006', ruleset: NATIVE_RULESET, purpose: 'UNDETERMINED',
    complete: false, applicability: 'UNDETERMINED' as const, observedOutcome: 'UNDETERMINED' as const,
    procedures: [] as (ProcedureDecision & { status: string; recordedSeries: number; observations: number })[], issues: [issue] };
  const issues: string[] = [];
  if (programme.instrumentFingerprint !== instrumentFingerprint(instrument)) issues.push('Native programme frozen instrument does not match.');
  const currentResult = (record: NativeTestRecord) => record.programmeId === programme.id
    && record.inputFingerprint === nativeFingerprint(programme, record.submission)
    && record.result.ruleset === programme.ruleset && record.result.complete
    && ['PASS','FAIL'].includes(record.result.status);
  const procedures = programme.decisions.map(decision => {
    let status: string = decision.applicability;
    const tests = records.filter(record => record.testCaseId === testCase.id && record.submission.procedureId === decision.id);
    if (decision.applicability === 'REQUIRED') {
      const samples = decision.samples || [];
      status = !tests.length ? 'NOT STARTED' : !decision.native || !samples.length || samples.some(sample => {
        const record = tests.find(item => item.submission.series === sample.series);
        return !record || !currentResult(record);
      }) ? 'INCOMPLETE' : tests.some(item => item.result.status === 'FAIL') ? 'FAIL' : 'PASS';
    }
    if (!['PASS','FAIL','NOT APPLICABLE'].includes(status)) issues.push(`${decision.id}: ${status}. ${decision.reason}`);
    return { ...decision, status, recordedSeries: tests.length, observations: tests.reduce((sum, item) => sum + item.result.count, 0) };
  });
  // A completed failed series remains an observed failure even when a second
  // prescribed series is missing. Programme completeness is evaluated separately.
  const resolved = records.filter(record => record.testCaseId === testCase.id && currentResult(record)
    && programme.decisions.some(decision => decision.native && decision.applicability === 'REQUIRED'
      && decision.id === record.submission.procedureId && decision.samples?.some(sample => sample.series === record.submission.series)));
  return { standard: programme.standard, ruleset: programme.ruleset, purpose: programme.profile.purpose,
    complete: issues.length === 0, applicability: procedures.some(item => item.status === 'UNDETERMINED') ? 'UNDETERMINED' as const : 'DETERMINED' as const,
    observedOutcome: resolved.some(item => item.result.status === 'FAIL') ? 'FAIL' as const : resolved.length ? 'PASS' as const : 'UNDETERMINED' as const,
    procedures, issues };
}
