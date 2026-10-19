// Core Types for Phase 5 Instrument and Test Management

import { CalculationResult, Unit } from '../calculations/types';
import { RuleEvaluationPackage } from '../rules/types';
import { ComplianceResult } from '../compliance/types';

export interface Manufacturer {
  id: string;
  name: string;
  address: string;
  identifier: string; // Statutory applicant identifier
  revision?: number; active?: boolean; createdBy?: string; createdAt?: string; updatedAt?: string;
  history?: { action: string; actorId: string; timestamp: string; previous?: { name: string; address: string; identifier: string } }[];
}

export interface Instrument {
  id: string;
  manufacturerId: string;
  name: string;
  model: string;
  serialNumber: string;

  // Basic classification gate
  isWeighing: boolean;
  isManual: boolean;
  isElectronic: boolean;
  isSingleRange: boolean;

  // Metrological parameters (Stored as Strings to Avoid Floating Point Pollution)
  // These are only completed if the instrument passes the classification gate
  accuracyClass?: 'I' | 'II' | 'III' | 'IIII';
  maxCapacity?: string;
  minCapacity?: string;
  e?: string;
  d?: string;
  hasTare?: boolean;
  weighingUnit?: 'g'; // Canonical persisted metrological values remain grams.
  n?: string;
  hasAuxiliaryIndication?: boolean; isGrading?: boolean; softwareControlled?: boolean;
  softwareIdentification?: string; typeApprovalMark?: string; technicalNotes?: string;
  declaredSpecifications?: { unit: Unit; maxCapacity: string; minCapacity: string; e: string; d: string };
  revision?: number; createdBy?: string; createdAt?: string; updatedAt?: string;
}

export type TestExecutionStatus = 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETE' | 'NOT APPLICABLE';

export interface ApplicableTests {
  weighing: TestExecutionStatus;
  eccentricity: TestExecutionStatus;
  repeatability: TestExecutionStatus;
  tare: TestExecutionStatus;
  zeroSetting: TestExecutionStatus;
}

export interface LaboratoryConditions {
  temperature: string;
  humidity: string;
  pressure: string;
}

export interface TestCase {
  nativeProgramme?: import('./native').NativeProgramme;
  id: string;
  instrumentId: string;
  technicianId: string;
  status: TestCaseStatus;
  revision?: number; // Legacy records start at revision 0; advances on every mutation.
  
  // Phase 9: Workflow and Audit extensions
  reviewerId?: string;
  reviewNotes?: string;
  approvalDate?: string;
  createdAt: string;
  updatedAt: string;

  laboratoryConditions?: LaboratoryConditions;
  testConfiguration: ApplicableTests;

  // Phase 8 wiring: whether this test case is an initial verification (default)
  // or an in-service re-verification (MPE is scaled 2x by the Rule Engine).
  isInitialVerification?: boolean;
  masterDataSnapshot?: { version: 'W8LAB-MASTER-1'; capturedAt: string; instrument: Instrument; manufacturer: Manufacturer };

  // Server-owned, versioned applicability determination. No current public API
  // accepts this field; absence means coverage is undetermined, never "all passed".
  programmeDetermination?: {
    standard: 'OIML R 76-1:2006';
    determinedBy: string;
    determinedAt: string;
    requirements: { testType: ObservationType; minimumObservations: number }[];
  };
}

export type ObservationType = 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING';

/**
 * Persisted output of running an observation through
 * CalculationEngine -> RuleEngine -> ComplianceEngine (see EvaluationService).
 * This is the explainability trace referenced by FR-REP-02/FR-REV-02.
 */
export interface ObservationEvaluation {
  // Legacy evaluations are retained, but are not evidence of the corrected pipeline.
  calculationVersion?: string;
  inputFingerprint?: string;
  calculation: CalculationResult;
  rulePackage: RuleEvaluationPackage;
  compliance: ComplianceResult;
  evaluatedAt: string;
}

export interface ObservationRecord {
  id: string;
  testCaseId: string;
  testType: ObservationType;
  sequence: number; // For repeatable rows

  // Raw Inputs (Strings)
  load: string;
  indication: string;
  additionalWeights: string;

  // Unit shared by load/indication/additionalWeights/zeroError (defaults to 'g' if omitted;
  // Instrument.e has no unit field of its own, so 'g' is the existing implicit convention).
  unit?: Unit;
  // Error observed at the zero-load state (E0). Defaults to '0' if omitted.
  zeroError?: string;

  // Persisted result of the live Calculation -> Rule -> Compliance pipeline.
  evaluation?: ObservationEvaluation;
}


export type TestCaseStatus = 'DRAFT' | 'TESTING' | 'READY_FOR_REVIEW' | 'UNDER_REVIEW' | 'RETURNED_FOR_CORRECTION' | 'APPROVED';

export interface AuditRecord {
  id: string;
  testCaseId: string;
  actorId: string;
  actorRole: string;
  action: string;
  previousState?: string;
  newState?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
