import { Decimal } from 'decimal.js';
import {
  ComplianceEvaluationRequest,
  ComplianceResult,
  ComplianceVerdict,
  ComplianceTrace
} from './types';
import { convertToUnit } from '../calculations/unitConversion';

export class ComplianceEngine {
  /**
   * Evaluates the regulatory compliance of a specific observation.
   * Matches calculated Error (Ec) against statutory MPE limits.
   */
  static evaluate(request: ComplianceEvaluationRequest): ComplianceResult {
    // 1. Check for BLOCKED conditions
    if (
      request.rulePackage.status === 'BLOCKED' ||
      !request.calculationResult ||
      !request.calculationResult.Ec
    ) {
      return { verdict: 'BLOCKED' };
    }

    // 2. Check for INCONCLUSIVE conditions
    if (request.rulePackage.status === 'NOT_APPLICABLE') {
      return { verdict: 'INCONCLUSIVE' };
    }

    // Must be APPLICABLE
    const mpeLimit = request.rulePackage.mpeLimit;
    if (!mpeLimit) {
      return { verdict: 'BLOCKED' };
    }

    const ruleVersion = request.rulePackage.traceability?.ruleVersion || 'UNKNOWN';
    const applicableRequirement = request.rulePackage.traceability?.explanation.join(', ') || 'Unknown Requirement';

    // 3. Align Units before comparison (Pick MPE's unit as the target standard for comparison)
    const targetUnit = mpeLimit.unit;
    const ecDecimal = convertToUnit(request.calculationResult.Ec, targetUnit);
    const mpeDecimal = new Decimal(mpeLimit.value);

    const absEc = ecDecimal.value.abs();

    // 4. Comparison Evaluation
    // |Ec| <= MPE
    const isPass = absEc.lessThanOrEqualTo(mpeDecimal);
    const verdict: ComplianceVerdict = isPass ? 'PASS' : 'FAIL';

    // Format output strings for trace to avoid arbitrary zero paddings
    const absEcStr = this.formatDecimalForTrace(absEc);
    const mpeStr = this.formatDecimalForTrace(mpeDecimal);

    const resolutionComparison = `Absolute(Ec: ${absEcStr} ${targetUnit}) ${isPass ? '<=' : '>'} MPELimit(${mpeStr} ${targetUnit}) -> ${isPass ? 'TRUE' : 'FALSE'}`;

    // 5. Generate Trace
    const trace: ComplianceTrace = {
      instrumentIdentity: request.instrumentId,
      appliedLoad: request.load,
      internalMath: {
        P: request.calculationResult.P,
        E: request.calculationResult.E,
        Ec: request.calculationResult.Ec,
      },
      activeMpeCeiling: mpeLimit,
      applicableRequirement,
      ruleEngineVersion: ruleVersion,
      resolutionComparison
    };

    return {
      verdict,
      trace
    };
  }

  /**
   * Helper to format decimal outputs for cleanly readable traces without trailing zeroes.
   */
  private static formatDecimalForTrace(value: Decimal): string {
    return value.toString();
  }
}
