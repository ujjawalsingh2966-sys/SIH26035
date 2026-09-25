import { CalculationEngine } from '../../src/calculations/engine';
import { RuleEngine } from '../../src/rules/engine';
import { ComplianceEngine } from '../../src/compliance/engine';
import { InstrumentContext, RuleEvaluationContext } from '../../src/rules/types';
import { ObservationState, MetrologicalQuantity } from '../../src/calculations/types';
import { ComplianceEvaluationRequest } from '../../src/compliance/types';

describe('End-to-End Compliance Pipeline Integration (Phases 5 -> 6 -> 7 -> 8)', () => {
  it('E2E: Should process Golden Test 01 - GT-01-PASS-III-NOR successfully', () => {
    // 1. Phase 5: Observation Input
    const instrument: InstrumentContext = {
      isNAWI: true,
      isElectronic: true,
      isSingleRange: true,
      isGraduated: true,
      scaleType: 'Manual',
      accuracyClass: 'III',
      hasTare: true
    };

    const observation: ObservationState = {
      L: { value: '5', unit: 'kg' },
      I: { value: '5005', unit: 'g' },
      deltaL: { value: '3', unit: 'g' },
      e: { value: '5', unit: 'g' },
      E0: { value: '0', unit: 'g' }
    };

    // 2. Phase 6: Metrological Calculations
    const calcResult = CalculationEngine.calculate(observation);
    expect(calcResult.Ec.value).toBe('4.5'); // Calculated Ec
    expect(calcResult.m).toBe('1000'); // Load multiplier

    // 3. Phase 7: Regulatory Rule Evaluation
    const ruleContext: RuleEvaluationContext = {
      instrument,
      testType: 'TEST-WEIGH',
      isInitialVerification: true,
      m: calcResult.m,
      e: observation.e
    };
    const rulePackage = RuleEngine.evaluate(ruleContext);
    expect(rulePackage.status).toBe('APPLICABLE');
    expect(rulePackage.mpeLimit?.value).toBe('5'); // 1.0 * e(5g)

    // 4. Phase 8: Compliance Evaluation
    const complianceRequest: ComplianceEvaluationRequest = {
      calculationResult: calcResult,
      rulePackage,
      load: observation.L,
      instrumentId: 'INST-E2E-GT01'
    };
    const complianceResult = ComplianceEngine.evaluate(complianceRequest);

    // Assert Verdict
    expect(complianceResult.verdict).toBe('PASS');
    expect(complianceResult.trace).toBeDefined();
    expect(complianceResult.trace?.resolutionComparison).toBe('Absolute(Ec: 4.5 g) <= MPELimit(5 g) -> TRUE');
    expect(complianceResult.trace?.appliedLoad).toEqual({ value: '5', unit: 'kg' });
  });

  it('E2E: Should process Golden Test 02 - GT-02-FAIL-III-NOR successfully', () => {
    const instrument: InstrumentContext = {
      isNAWI: true,
      isElectronic: true,
      isSingleRange: true,
      isGraduated: true,
      scaleType: 'Manual',
      accuracyClass: 'III',
      hasTare: true
    };

    const observation: ObservationState = {
      L: { value: '5', unit: 'kg' },
      I: { value: '5010', unit: 'g' },
      deltaL: { value: '2', unit: 'g' },
      e: { value: '5', unit: 'g' },
      E0: { value: '0', unit: 'g' }
    };

    const calcResult = CalculationEngine.calculate(observation);

    const ruleContext: RuleEvaluationContext = {
      instrument,
      testType: 'TEST-WEIGH',
      isInitialVerification: true,
      m: calcResult.m,
      e: observation.e
    };
    const rulePackage = RuleEngine.evaluate(ruleContext);

    const complianceRequest: ComplianceEvaluationRequest = {
      calculationResult: calcResult,
      rulePackage,
      load: observation.L,
      instrumentId: 'INST-E2E-GT02'
    };
    const complianceResult = ComplianceEngine.evaluate(complianceRequest);

    expect(complianceResult.verdict).toBe('FAIL');
    expect(complianceResult.trace?.resolutionComparison).toBe('Absolute(Ec: 10.5 g) > MPELimit(5 g) -> FALSE');
  });

  it('E2E: Should accurately propagate upstream BLOCKED states safely avoiding math exceptions', () => {
    // 1. Un-supported instrument parameters (e.g. Mechanical scales)
    const instrument: InstrumentContext = {
      isNAWI: true,
      isElectronic: false, // Mechanical triggers block
      isSingleRange: true,
      isGraduated: true,
      scaleType: 'Manual',
      accuracyClass: 'III',
      hasTare: true
    };

    const observation: ObservationState = {
      L: { value: '1', unit: 'kg' },
      I: { value: '1000', unit: 'g' },
      deltaL: { value: '0', unit: 'g' },
      e: { value: '5', unit: 'g' },
      E0: { value: '0', unit: 'g' }
    };

    const calcResult = CalculationEngine.calculate(observation);
    const ruleContext: RuleEvaluationContext = {
      instrument,
      testType: 'TEST-WEIGH',
      isInitialVerification: true,
      m: calcResult.m,
      e: observation.e
    };

    // Phase 7 correctly blocks
    const rulePackage = RuleEngine.evaluate(ruleContext);
    expect(rulePackage.status).toBe('BLOCKED');

    // Phase 8 appropriately accepts block gracefully
    const complianceRequest: ComplianceEvaluationRequest = {
      calculationResult: calcResult,
      rulePackage,
      load: observation.L,
      instrumentId: 'INST-MECH-BLOCK'
    };
    const complianceResult = ComplianceEngine.evaluate(complianceRequest);

    expect(complianceResult.verdict).toBe('BLOCKED');
    expect(complianceResult.trace).toBeUndefined(); // Trace shouldn't execute limits
  });
});
