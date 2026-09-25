import { TestCase, ObservationRecord } from './domain';
import { EvidenceRecord } from './evidence';

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

  complianceSummary: {
    weighing: string;
    eccentricity: string;
    repeatability: string;
    tare: string;
    zeroSetting: string;
    overallVerdict: string;
  };
}
