import { DecimalQuantity, MetrologicalQuantity } from '../calculations/types';

export type InstrumentAccuracyClass = 'I' | 'II' | 'III' | 'IIII';
export type TestType = 'TEST-WEIGH' | 'TEST-ECC' | 'TEST-REP' | 'TEST-TARE' | 'TEST-ZERO';

export interface InstrumentContext {
  isNAWI: boolean;
  isElectronic: boolean;
  isSingleRange: boolean;
  isGraduated: boolean;
  scaleType: 'Manual' | 'Semi-Automatic' | 'Automatic';
  accuracyClass: InstrumentAccuracyClass;
  hasTare: boolean;
}

export interface RuleEvaluationContext {
  instrument: InstrumentContext;
  testType: string;
  isInitialVerification: boolean;
  m: string; // Load Multiplier factor from Phase 6
  e: MetrologicalQuantity; // Needed to compute final absolute MPE
}

export type EvaluationState = 'APPLICABLE' | 'NOT_APPLICABLE' | 'BLOCKED';

export interface RuleTraceability {
  ruleId: string;
  ruleVersion: string;
  sourceDocument: string;
  sourceReference: string;
  effectiveDate?: string;
  explanation: string[];
}

export interface RuleEvaluationPackage {
  status: EvaluationState;
  reason?: string;
  mpeLimit?: MetrologicalQuantity;
  mpeMultiplier?: string; // 0.5, 1.0, 1.5, etc.
  traceability?: RuleTraceability;
}
