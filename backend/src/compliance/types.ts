import { CalculationResult, MetrologicalQuantity } from '../calculations/types';
import { InstrumentContext, RuleEvaluationPackage } from '../rules/types';

export type ComplianceVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'BLOCKED';

export interface ComplianceTrace {
  instrumentIdentity: string;
  appliedLoad: MetrologicalQuantity;
  internalMath: {
    P: MetrologicalQuantity;
    E: MetrologicalQuantity;
    Ec: MetrologicalQuantity;
  };
  activeMpeCeiling: MetrologicalQuantity;
  applicableRequirement: string;
  ruleEngineVersion: string;
  resolutionComparison: string;
}

export interface ComplianceResult {
  verdict: ComplianceVerdict;
  trace?: ComplianceTrace;
}

export interface ComplianceEvaluationRequest {
  calculationResult: CalculationResult;
  rulePackage: RuleEvaluationPackage;
  load: MetrologicalQuantity;
  instrumentId: string;
}
