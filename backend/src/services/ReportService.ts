import * as crypto from 'crypto';
import { testCaseStore, observationStore, instrumentStore } from '../repositories';
import { EvidenceService } from './EvidenceService';
import { ReportDataset } from '../types/report';
import { HtmlGenerator } from '../utils/HtmlGenerator';
import { SimplePdfGenerator } from '../utils/SimplePdfGenerator';
import { ApplicableTests, ObservationRecord, ObservationType } from '../types/domain';
import { ComplianceVerdict } from '../compliance/types';

// Worst-of ranking used to aggregate multiple observations of the same test type,
// and to derive the overall verdict, into a single ComplianceVerdict.
const VERDICT_SEVERITY: Record<ComplianceVerdict, number> = {
  PASS: 0,
  INCONCLUSIVE: 1,
  BLOCKED: 2,
  FAIL: 3
};

const TEST_TYPE_TO_CONFIG_KEY: Record<ObservationType, keyof ApplicableTests> = {
  WEIGHING: 'weighing',
  ECCENTRICITY: 'eccentricity',
  REPEATABILITY: 'repeatability',
  TARE: 'tare',
  ZERO_SETTING: 'zeroSetting'
};

function worstVerdict(verdicts: ComplianceVerdict[]): ComplianceVerdict {
  return verdicts.reduce((worst, v) => (VERDICT_SEVERITY[v] > VERDICT_SEVERITY[worst] ? v : worst), 'PASS' as ComplianceVerdict);
}

export class ReportService {
  public static generateReportData(testCaseId: string, generatedByRole: string): ReportDataset {
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) {
      throw new Error(`Test case not found: ${testCaseId}`);
    }

    if (testCase.status !== 'APPROVED') {
      throw new Error('Final test reports can only be generated from test cases in APPROVED status');
    }

    const allObservations = observationStore.findAll().filter(o => o.testCaseId === testCaseId);
    const evidence = EvidenceService.getEvidenceForTestCase(testCaseId);
    const instrument = instrumentStore.findById(testCase.instrumentId);

    // Source of truth: the persisted Calculation -> Rule -> Compliance evaluation on each
    // observation (see EvaluationService, invoked live at observation-submission time).
    // No re-evaluation happens here - this only aggregates already-persisted verdicts.
    const evaluated = allObservations.filter((o): o is ObservationRecord & { evaluation: NonNullable<ObservationRecord['evaluation']> } => !!o.evaluation);

    const perTypeVerdict: Record<string, string> = {
      weighing: testCase.testConfiguration.weighing,
      eccentricity: testCase.testConfiguration.eccentricity,
      repeatability: testCase.testConfiguration.repeatability,
      tare: testCase.testConfiguration.tare,
      zeroSetting: testCase.testConfiguration.zeroSetting
    };

    for (const [testType, configKey] of Object.entries(TEST_TYPE_TO_CONFIG_KEY)) {
      const matching = evaluated.filter(o => o.testType === testType);
      if (matching.length > 0) {
        perTypeVerdict[configKey] = worstVerdict(matching.map(o => o.evaluation.compliance.verdict));
      }
    }

    const overallVerdict = evaluated.length > 0
      ? worstVerdict(evaluated.map(o => o.evaluation.compliance.verdict))
      : 'BLOCKED';

    // Rule version actually used during evaluation, read from the persisted trace rather
    // than a literal - falls back to 'UNKNOWN' only if no observation carries traceability
    // (e.g. all observations were BLOCKED before a rule package could be resolved).
    const ruleEngineVersion = evaluated
      .map(o => o.evaluation.rulePackage.traceability?.ruleVersion)
      .find((v): v is string => !!v) || 'UNKNOWN';

    const baseDataset = {
      reportId: `REP_${testCaseId}_${Date.now()}`,
      testCaseId,
      status: 'FINAL' as const,
      disclaimer: 'Prototype / Pending Official Template Confirmation' as const,
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: generatedByRole,
        ruleEngineVersion,
        cryptographicSeal: ''
      },
      testDetails: testCase,
      instrumentDetails: instrument,
      observations: allObservations,
      evidence: evidence,
      complianceSummary: {
        weighing: perTypeVerdict.weighing,
        eccentricity: perTypeVerdict.eccentricity,
        repeatability: perTypeVerdict.repeatability,
        tare: perTypeVerdict.tare,
        zeroSetting: perTypeVerdict.zeroSetting,
        overallVerdict
      }
    };

    // Construct seal string over data properties
    const sealString = JSON.stringify({
      testCase,
      observations: allObservations,
      ruleEngineVersion: baseDataset.meta.ruleEngineVersion
    });

    const hash = crypto.createHash('sha256').update(sealString).digest('hex');
    baseDataset.meta.cryptographicSeal = hash;

    return baseDataset;
  }

  public static generateHtmlReport(testCaseId: string, role: string): string {
    const data = this.generateReportData(testCaseId, role);
    return HtmlGenerator.generate(data);
  }

  public static generatePdfReport(testCaseId: string, role: string): Buffer {
    const data = this.generateReportData(testCaseId, role);
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
      ``,
      `-- Compliance --`,
      `Overall: ${data.complianceSummary.overallVerdict}`,
      `Weighing: ${data.complianceSummary.weighing}`,
      `Eccentricity: ${data.complianceSummary.eccentricity}`,
      `Repeatability: ${data.complianceSummary.repeatability}`,
      `Tare: ${data.complianceSummary.tare}`,
      `Zero Setting: ${data.complianceSummary.zeroSetting}`,
      ``,
      `-- Security --`,
      `Rule Version: ${data.meta.ruleEngineVersion}`,
      `Seal: ${data.meta.cryptographicSeal}`,
      ``,
      `-- Evidence Attached --`,
      `Total items: ${data.evidence.length}`
    ];

    return SimplePdfGenerator.generateDocument(lines);
  }
}
