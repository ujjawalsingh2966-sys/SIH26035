import { TestCase, ObservationRecord } from './domain';
import { EvidenceRecord } from './evidence';
import { MetrologicalQuantity } from '../calculations/types';
import { ComplianceVerdict } from '../compliance/types';

/**
 * Presentation-layer view of a single observation's already-persisted
 * Calculation -> Rule -> Compliance evaluation (see ObservationEvaluation in
 * types/domain.ts and EvaluationService). Built entirely from stored data -
 * no formula, MPE table, or verdict is recomputed to produce this view.
 */
export interface ObservationEvaluationView {
  observationId: string;
  testType: string;
  sequence: number;

  appliedLoad: MetrologicalQuantity;
  indication: MetrologicalQuantity;
  additionalWeights: MetrologicalQuantity;

  P: MetrologicalQuantity;
  E: MetrologicalQuantity;
  Ec: MetrologicalQuantity;
  m: string;

  // Undefined when the Rule Engine could not resolve an MPE limit (e.g. BLOCKED/NOT_APPLICABLE).
  mpe?: MetrologicalQuantity;
  verdict: ComplianceVerdict;
  ruleVersion: string;
  explainability: string;
  evaluatedAt: string;
}

export interface ReportDataset {
  reportId: string;
  testCaseId: string;
  status: 'PROTOTYPE' | 'FINAL';
  disclaimer: 'Prototype / Pending Official Template Confirmation';

  meta: {
    generatedAt: string;
    generatedBy: string;
    ruleEngineVersion: string;
    cryptographicSeal: string;
  };

  testDetails: TestCase;
  instrumentDetails?: any;
  observations: ObservationRecord[];
  evidence: EvidenceRecord[];

  // One entry per observation that has completed evaluation, built from the persisted
  // ObservationEvaluation (see ObservationEvaluationView) - this is the metrological
  // calculation/compliance evidence the report is meant to actually show.
  observationEvaluations: ObservationEvaluationView[];

  complianceSummary: {
    weighing: string;
    eccentricity: string;
    repeatability: string;
    tare: string;
    zeroSetting: string;
    overallVerdict: string;
  };
}
