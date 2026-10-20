import { unitOfWork } from '../repositories/persistence';
import * as crypto from 'crypto';
import { testCaseStore, observationStore, nativeTestStore } from '../repositories';
import { EvidenceService } from './EvidenceService';
import { ReportDataset } from '../types/report';
import { HtmlGenerator } from '../utils/HtmlGenerator';
import { SimplePdfGenerator } from '../utils/SimplePdfGenerator';
import { ObservationRecord, ObservationType } from '../types/domain';
import { ObservationEvaluationView } from '../types/report';
import { assessStoredProgramme, TEST_KEYS } from './ProgrammeAssessment';
import { caseMasterData } from './MasterDataService';

export class ReportService {
  public static async generateReportData(testCaseId: string, generatedByRole: string): Promise<ReportDataset> {
    return unitOfWork.read(async () => {
      const testCase = (await testCaseStore.findById(testCaseId));
      if (!testCase) {
        throw new Error(`Test case not found: ${testCaseId}`);
      }

      if (testCase.status !== 'APPROVED') {
        throw new Error('Final test reports can only be generated from test cases in APPROVED status');
      }

      const allObservations = (await observationStore.findAll()).filter(o => o.testCaseId === testCaseId);
      const evidence = (await EvidenceService.getEvidenceForTestCase(testCaseId));
      const { instrument, manufacturer, source } = (await caseMasterData(testCase));

      // Source of truth: the persisted Calculation -> Rule -> Compliance evaluation on each
      // observation (see EvaluationService, invoked live at observation-submission time).
      // No re-evaluation happens here - this only aggregates already-persisted verdicts.
      const evaluated = allObservations.filter((o): o is ObservationRecord & { evaluation: NonNullable<ObservationRecord['evaluation']> } => !!o.evaluation);

      // Only the shared completeness assessment may supply programme outcomes;
      // stored tab flags and a worst-of-observed-rows reduction cannot establish coverage.
      const perTypeVerdict: Record<string, string> = {};
      const programme = (await assessStoredProgramme(testCase));
      for (const [type, key] of Object.entries(TEST_KEYS)) {
        perTypeVerdict[key] = programme.tests[type as ObservationType].status;
      }
      const overallVerdict = programme.overallVerdict;

      // Rule version actually used during evaluation, read from the persisted trace rather
      // than a literal - falls back to 'UNKNOWN' only if no observation carries traceability
      // (e.g. all observations were BLOCKED before a rule package could be resolved).
      const ruleEngineVersion = evaluated
        .map(o => o.evaluation.rulePackage.traceability?.ruleVersion)
        .find((v): v is string => !!v) || testCase.nativeProgramme?.ruleset || 'UNKNOWN';

      // Presentation view of each observation's already-persisted evaluation - a direct
      // read of stored data (calculation.P/E/Ec/m, rulePackage.mpeLimit, compliance.verdict
      // and trace), not a recomputation. See ObservationEvaluationView.
      const observationEvaluations: ObservationEvaluationView[] = evaluated.map(o => ({
        observationId: o.id,
        testType: o.testType,
        sequence: o.sequence,
        appliedLoad: { value: o.load, unit: o.unit || 'g' },
        indication: { value: o.indication, unit: o.unit || 'g' },
        additionalWeights: { value: o.additionalWeights, unit: o.unit || 'g' },
        P: o.evaluation.calculation.P,
        E: o.evaluation.calculation.E,
        Ec: o.evaluation.calculation.Ec,
        m: o.evaluation.calculation.m,
        mpe: o.evaluation.rulePackage.mpeLimit,
        verdict: o.evaluation.compliance.verdict,
        ruleVersion: o.evaluation.rulePackage.traceability?.ruleVersion || 'UNKNOWN',
        explainability: o.evaluation.compliance.trace?.resolutionComparison || 'No comparison available (evaluation did not reach a resolvable APPLICABLE rule state)',
        evaluatedAt: o.evaluation.evaluatedAt
      }));

      const baseDataset = {
        reportId: `REP_${testCaseId}_${Date.now()}`,
        testCaseId,
        // Preserve legacy records; do not repeat a historical false FINAL claim.
        status: programme.complete ? 'FINAL' as const : 'PROTOTYPE' as const,
        disclaimer: 'Prototype / Pending Official Template Confirmation' as const,
        meta: {
          generatedAt: new Date().toISOString(),
          generatedBy: generatedByRole,
          ruleEngineVersion,
          cryptographicSeal: ''
        },
        testDetails: testCase,
        instrumentDetails: instrument,
        manufacturerDetails: manufacturer,
        metadataSource: source,
        observations: allObservations,
        evidence: evidence,
        programme,
        nativeTests: (await nativeTestStore.findAll()).filter(item => item.testCaseId === testCase.id),
        observationEvaluations,
        complianceSummary: {
          weighing: perTypeVerdict.weighing,
          eccentricity: perTypeVerdict.eccentricity,
          repeatability: perTypeVerdict.repeatability,
          tare: perTypeVerdict.tare,
          zeroSetting: perTypeVerdict.zeroSetting,
          overallVerdict
        }
      };

      // Construct seal string over data properties. allObservations already carries each
      // observation's persisted `.evaluation` (calculation/rule/compliance), so the seal
      // covers the real evaluation evidence, not just the raw inputs.
      const sealString = JSON.stringify({
        testCase,
        observations: allObservations,
        ...(testCase.nativeProgramme ? { nativeTests: baseDataset.nativeTests } : {}),
        ruleEngineVersion: baseDataset.meta.ruleEngineVersion
      });

      const hash = crypto.createHash('sha256').update(sealString).digest('hex');
      baseDataset.meta.cryptographicSeal = hash;

      return baseDataset;
    });
  }

  public static async generateHtmlReport(testCaseId: string, role: string): Promise<string> {
    return unitOfWork.read(async () => {
      const data = await this.generateReportData(testCaseId, role);
      return HtmlGenerator.generate(data);
    });
  }

  public static async generatePdfReport(testCaseId: string, role: string): Promise<Buffer> {
    return unitOfWork.read(async () => {
      const data = await this.generateReportData(testCaseId, role);
      const lines = [
        `OIML R76 Test Report`,
        `===================`,
        `DISCLAIMER: ${data.disclaimer}`,
        ``,
        `Report ID: ${data.reportId}`,
        `Test Case ID: ${data.testCaseId}`,
        `Status: ${data.status}`,
        `Generated At: ${data.meta.generatedAt}`,
        `Generated By: ${data.meta.generatedBy}`,
        `Metadata source: ${data.metadataSource}`,
        `Manufacturer: ${data.manufacturerDetails?.name || 'Not recorded'}`,
        `Manufacturer address: ${data.manufacturerDetails?.address || 'Not recorded'}`,
        `Manufacturer identifier: ${data.manufacturerDetails?.identifier || 'Not recorded'}`,
        `Instrument: ${data.instrumentDetails?.name || 'Not recorded'}`,
        `Model: ${data.instrumentDetails?.model || 'Not recorded'}  Serial: ${data.instrumentDetails?.serialNumber || 'Not recorded'}`,
        `Class: ${data.instrumentDetails?.accuracyClass || 'Not recorded'}  n: ${data.instrumentDetails?.n || 'Not recorded'}`,
        `Max: ${data.instrumentDetails?.maxCapacity || 'Not recorded'} g  Min: ${data.instrumentDetails?.minCapacity || 'Not recorded'} g`,
        `e: ${data.instrumentDetails?.e || 'Not recorded'} g  d: ${data.instrumentDetails?.d || 'Not recorded'} g`,
        `Software identification: ${data.instrumentDetails?.softwareIdentification || 'Not declared'}`,
        `Type approval mark (declared, not verified): ${data.instrumentDetails?.typeApprovalMark || 'Not recorded'}`,
        `Technical characteristics: ${data.instrumentDetails?.technicalNotes || 'Not recorded'}`,
        `Declared profile: ${data.instrumentDetails?.isElectronic ? 'Electronic' : 'Not recorded'}, ${data.instrumentDetails?.isManual ? 'Non-automatic' : 'Not recorded'}, ${data.instrumentDetails?.isSingleRange ? 'Single range' : 'Not recorded'}`,
        `Tare device: ${data.instrumentDetails?.hasTare === undefined ? 'Not recorded' : data.instrumentDetails.hasTare ? 'Yes' : 'No'}`,
        ``,
        `-- Compliance --`,
        `Overall: ${data.complianceSummary.overallVerdict}`,
        `Programme: ${data.programme.applicability}`,
        ...data.programme.issues.map(issue => `INCOMPLETE: ${issue}`),
        `Weighing: ${data.complianceSummary.weighing}`,
        `Eccentricity: ${data.complianceSummary.eccentricity}`,
        `Repeatability: ${data.complianceSummary.repeatability}`,
        `Tare: ${data.complianceSummary.tare}`,
        `Zero Setting: ${data.complianceSummary.zeroSetting}`,
        ``,
        `-- Metrological Evaluation --`,
        ...(data.programme.native ? [`Native programme: ${data.programme.native.standard} / ${data.programme.native.ruleset} / ${data.programme.native.purpose}`,
          ...(data.programme.native?.procedures || []).map(item => `${item.id}: ${item.applicability} / ${item.status}; ${item.clauses.join(', ')}; ${item.reason}`),
          ...(data.nativeTests || []).flatMap(test => [`${test.submission.procedureId}/${test.submission.series}: ${test.result.status}`, test.result.methodology,
            `Spread: ${test.result.spreadG || 'N/A'} g; limit: ${test.result.limitG || 'UNDETERMINED'} g`,
            ...test.result.rows.map(row => `#${row.sequence} L=${row.loadG}, I=${row.indicationG}, deltaL=${row.additionalWeightsG}, P=${row.P}, E=${row.E}, limit=${row.limitG} g: ${row.verdict}`),
            ...(test.result.ruleset === 'W8LAB-R76-2006-P4A-1' ? test.result.rows.flatMap(row => [`#${row.sequence}: phase=${row.phase || 'N/A'} position=${row.position || 'N/A'} time=${row.timestamp || 'N/A'} E0=${row.E0 ?? 'N/A'} Ec=${row.Ec ?? 'N/A'} g`, ...(row.details ? [row.details] : [])]) : []),
            `Evidence: ${test.submission.evidenceReference}`, ...test.result.issues])] : []),
        ...(data.observationEvaluations.length === 0
          ? [`(No evaluated observations recorded)`]
          : data.observationEvaluations.flatMap(ev => [
              `[${ev.testType} #${ev.sequence}]`,
              `  Load: ${ev.appliedLoad.value} ${ev.appliedLoad.unit}  Indication: ${ev.indication.value} ${ev.indication.unit}  Add. Weights: ${ev.additionalWeights.value} ${ev.additionalWeights.unit}`,
              `  P: ${ev.P.value} ${ev.P.unit}  E: ${ev.E.value} ${ev.E.unit}  Ec: ${ev.Ec.value} ${ev.Ec.unit}  m: ${ev.m}`,
              `  MPE: ${ev.mpe ? `${ev.mpe.value} ${ev.mpe.unit}` : 'N/A'}  Verdict: ${ev.verdict}  Rule Version: ${ev.ruleVersion}`,
              `  ${ev.explainability}`,
              `  Evaluated At: ${ev.evaluatedAt}`,
              ``
            ])),
        `-- Security --`,
        `Rule Version: ${data.meta.ruleEngineVersion}`,
        `Seal: ${data.meta.cryptographicSeal}`,
        ``,
        `-- Evidence Attached --`,
        `Total items: ${data.evidence.length}`
      ];

      return SimplePdfGenerator.generateDocument(lines);
    });
  }
}
