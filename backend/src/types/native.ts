import type { Instrument } from './domain';
export const ZERO_MECHANISMS = ['NON_AUTOMATIC', 'SEMI_AUTOMATIC', 'AUTOMATIC', 'ZERO_TRACKING'] as const;
export type ZeroMechanism = typeof ZERO_MECHANISMS[number];
export const TEST_PURPOSES = ['TYPE_EVALUATION', 'INITIAL_VERIFICATION', 'IN_SERVICE_INSPECTION'] as const;
export const INDICATION_TYPES = ['DIGITAL', 'ANALOG', 'UNKNOWN'] as const;
export const LOAD_RECEPTORS = ['PLATFORM', 'SPECIAL', 'ROLLING', 'UNKNOWN'] as const;
export type TestPurpose = typeof TEST_PURPOSES[number];
export type Applicability = 'REQUIRED' | 'NOT APPLICABLE' | 'UNDETERMINED' | 'UNSUPPORTED';
export interface ProcedureDecision {
  id: string; name: string; clauses: string[]; applicability: Applicability; reason: string;
  native: boolean; samples?: { series: string; loadG: string; count: number; minimumOnly: boolean;
    plan?: { loadG: string; phase?: string; position?: string; tareG?: string; baseG?: string; elapsedSeconds?: number }[] }[];
}
export interface NativeProfile {
  purpose: TestPurpose;
  indication: typeof INDICATION_TYPES[number];
  zeroDevices: ZeroMechanism[] | null; // null means unknown, [] explicitly declares none.
  initialZeroSetting: boolean | null;
  eccentricityPossible: boolean | null;
  loadReceptor: typeof LOAD_RECEPTORS[number];
  supportPoints?: number;
  evidenceReference: string;
  noEccentricityJustification?: string;
}
export interface NativeProgramme {
  id: string; standard: 'OIML R 76-1:2006'; reportReference: 'OIML R 76-2:2007';
  ruleset: string; createdAt: string; createdBy: string; instrumentFingerprint: string;
  instrument: Instrument; profile: NativeProfile; decisions: ProcedureDecision[];
  performance?: PerformanceProfile;
}
/** Additive P4A declaration. Null is unknown, never an implied absence. */
export interface PerformanceProfile {
  selfIndicating: boolean | null;
  devices: ('DISPLAY' | 'PRINT')[] | null;
  tareKind: 'NONE' | 'SUBTRACTIVE' | 'ADDITIVE' | 'UNKNOWN';
  maximumTareG: string | null;
  tareWeighingDevice: boolean | null;
  combinedZeroTare: boolean | null;
  mobile: boolean | null;
  adjacentSupports: boolean | null;
  rollingSections: number | null;
  rollingReverse: boolean | null;
  rollingLoadG: string | null;
  initialZeroRangeG: string | null;
  stabilityFunctions: ('PRINT' | 'STORE' | 'ZERO' | 'TARE')[] | null;
  stabilityDocumentation: string;
  stabilityWorstCase: string;
  stabilityLoadsG: Partial<Record<'PRINT' | 'STORE' | 'ZERO' | 'TARE', string>>;
}
export interface NativeReading {
  sequence: number; load: string; indication: string; additionalWeights: string; unit: string;
  unloadedIndication?: string; unloadedAtRest?: boolean; resetToZero?: boolean;
  phase?: string; position?: string; timestamp?: string; temperatureC?: string;
  tareLoad?: string; baseLoad?: string;
  zero?: { load: string; indication: string; additionalWeights: string };
  deviceIndications?: { indication: string; additionalWeights: string; zero?: { load: string; indication: string; additionalWeights: string } }[];
  initialIndication?: string; decreasedIndication?: string; restoredWeight?: string; addedLoad?: string;
  continuousBlocked?: boolean; prematureBlocked?: boolean; disturbed?: boolean;
  outputIndication?: string; following?: { seconds: string; indication: string }[];
}
export interface NativeSubmission {
  procedureId: string; series: string; readings: NativeReading[];
  conditions: { stable?: boolean; automaticDevicesInOperation?: boolean; zeroInitiatedNearChangeover?: boolean;
    outsideAutomaticRange?: boolean; otherAutomaticDevicesDisabled?: boolean; sufficientAccuracy?: boolean;
    preloaded?: boolean; loadMaintained?: boolean; environmentalStability?: boolean;
    worstCaseApplied?: boolean; documentationReviewed?: boolean; positionEvidence?: boolean; immediateStableReadings?: boolean };
  evidenceReference: string;
}
export interface NativeResult {
  status: 'PASS' | 'FAIL' | 'INCOMPLETE'; complete: boolean; clauses: string[]; standard: string; ruleset: string;
  methodology: string; issues: string[]; count: number; requiredCount: number;
  rows: { sequence: number; loadG: string; indicationG: string; additionalWeightsG: string; P: string; E: string; limitG: string; verdict: 'PASS' | 'FAIL';
    E0?: string; Ec?: string; phase?: string; position?: string; timestamp?: string; details?: string }[];
  minimumErrorG?: string; maximumErrorG?: string; spreadG?: string; limitG?: string; spreadVerdict?: 'PASS' | 'FAIL';
}
export interface NativeTestRecord {
  id: string; testCaseId: string; programmeId: string; submission: NativeSubmission; result: NativeResult;
  createdAt: string; createdBy: string; inputFingerprint: string;
}
