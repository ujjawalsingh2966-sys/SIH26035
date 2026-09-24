// Core Types for Phase 5 Instrument and Test Management

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
  status: 'DRAFT' | 'TESTING' | 'SUBMITTED_FOR_REVIEW';
  createdAt: string;
  updatedAt: string;

  laboratoryConditions?: LaboratoryConditions;
  testConfiguration: ApplicableTests;
}

export type ObservationType = 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING';

export interface ObservationRecord {
  id: string;
  testCaseId: string;
  testType: ObservationType;
  sequence: number; // For repeatable rows

  // Raw Inputs (Strings)
  load: string;
  indication: string;
  additionalWeights: string;
}
