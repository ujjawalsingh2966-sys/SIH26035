// Core Types for Phase 5 Instrument and Test Management

import { CalculationResult, Unit } from '../calculations/types';
import { RuleEvaluationPackage } from '../rules/types';
import { ComplianceResult } from '../compliance/types';

export interface Manufacturer {
  id: string;
  name: string;
  address: string;
  identifier: string; // Statutory applicant identifier
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
  id: string;
  instrumentId: string;
  technicianId: string;
  status: TestCaseStatus;
  
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
}

export type ObservationType = 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING';

/**
 * Persisted output of running an observation through
 * CalculationEngine -> RuleEngine -> ComplianceEngine (see EvaluationService).
 * This is the explainability trace referenced by FR-REP-02/FR-REV-02.
 */
export interface ObservationEvaluation {
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
