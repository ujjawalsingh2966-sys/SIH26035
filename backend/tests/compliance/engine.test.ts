import { ComplianceEngine } from '../../src/compliance/engine';
import { ComplianceEvaluationRequest } from '../../src/compliance/types';

describe('Compliance Decision Engine', () => {

  describe('Golden Path Test Cases', () => {

    it('GT-01-PASS-III-NOR: Class III Normal Passing Evaluation', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '5004.5', unit: 'g' },
          E: { value: '4.5', unit: 'g' },
          Ec: { value: '4.5', unit: 'g' },
          m: '1000',
          traces: []
        },
        rulePackage: {
          status: 'APPLICABLE',
          mpeLimit: { value: '5', unit: 'g' },
          mpeMultiplier: '1.0',
          traceability: {
            ruleId: 'R76-T6',
            ruleVersion: '1.0.0',
            sourceDocument: 'OIML R76',
            sourceReference: 'Table 6, Class III',
            explanation: ['Class III Table 6 dictates MPE = 1.0e = 5g']
          }
        },
        load: { value: '5000', unit: 'g' },
        instrumentId: 'INST-001'
      };

      const result = ComplianceEngine.evaluate(request);

      expect(result.verdict).toBe('PASS');
      expect(result.trace).toBeDefined();
      expect(result.trace?.appliedLoad.value).toBe('5000');
      expect(result.trace?.resolutionComparison).toContain('Absolute(Ec: 4.5 g) <= MPELimit(5 g)');
      expect(result.trace?.internalMath.Ec.value).toBe('4.5');
      expect(result.trace?.applicableRequirement).toContain('1.0');
    });

    it('GT-02-FAIL-III-NOR: Class III Normal Failing Evaluation', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '5010.5', unit: 'g' },
          E: { value: '10.5', unit: 'g' },
          Ec: { value: '10.5', unit: 'g' },
          m: '1000',
          traces: []
        },
        rulePackage: {
          status: 'APPLICABLE',
          mpeLimit: { value: '5', unit: 'g' },
          mpeMultiplier: '1.0',
          traceability: {
            ruleId: 'R76-T6',
            ruleVersion: 'v25-XYZ',
            sourceDocument: 'OIML R76',
            sourceReference: 'Table 6, Class III',
            explanation: []
          }
        },
        load: { value: '5000', unit: 'g' },
        instrumentId: 'INST-001'
      };

      const result = ComplianceEngine.evaluate(request);

      expect(result.verdict).toBe('FAIL');
      expect(result.trace).toBeDefined();
      expect(result.trace?.resolutionComparison).toContain('Absolute(Ec: 10.5 g) > MPELimit(5 g)');
    });

    it('GT-03-PASS-II-BNDRY: Class II Exact Mathematical Boundary', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '200.005', unit: 'g' },
          E: { value: '0.005', unit: 'g' },
          Ec: { value: '0.000', unit: 'g' },
          m: '20000',
          traces: []
        },
        rulePackage: {
          status: 'APPLICABLE',
          mpeLimit: { value: '0.01', unit: 'g' },
          mpeMultiplier: '1.0',
          traceability: {
            ruleId: 'R76-T6-BNDRY',
            ruleVersion: '1.0',
            sourceDocument: 'OIML R76',
            sourceReference: 'Table 6, Class II',
            explanation: ['Strict high-precision class boundary']
          }
        },
        load: { value: '200', unit: 'g' },
        instrumentId: 'INST-BNDRY-002'
      };

      const result = ComplianceEngine.evaluate(request);

      expect(result.verdict).toBe('PASS');
      expect(result.trace).toBeDefined();
      expect(result.trace?.resolutionComparison).toContain('Absolute(Ec: 0 g) <= MPELimit(0.01 g)');
    });
  });

  describe('Edge Cases and Inconclusive/Blocked States', () => {

    it('returns BLOCKED when calculation is missing Ec', () => {
      const request: any = {
        calculationResult: { m: '10' },
        rulePackage: { status: 'APPLICABLE', mpeLimit: { value: '1', unit: 'g' } },
        load: { value: '10', unit: 'g' },
        instrumentId: 'INST'
      };

      const result = ComplianceEngine.evaluate(request);
      expect(result.verdict).toBe('BLOCKED');
      expect(result.trace).toBeUndefined();
    });

    it('returns BLOCKED if rulePackage status is BLOCKED', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '1', unit: 'g' },
          E: { value: '1', unit: 'g' },
          Ec: { value: '1', unit: 'g' },
          m: '10',
          traces: []
        },
        rulePackage: {
          status: 'BLOCKED',
          reason: 'Rules failed to load'
        },
        load: { value: '10', unit: 'g' },
        instrumentId: 'INST'
      };

      const result = ComplianceEngine.evaluate(request);
      expect(result.verdict).toBe('BLOCKED');
    });

    it('returns BLOCKED if rulePackage missing mpeLimit despite APPLICABLE', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '1', unit: 'g' },
          E: { value: '1', unit: 'g' },
          Ec: { value: '1', unit: 'g' },
          m: '10',
          traces: []
        },
        rulePackage: {
          status: 'APPLICABLE'
        },
        load: { value: '10', unit: 'g' },
        instrumentId: 'INST'
      };

      const result = ComplianceEngine.evaluate(request);
      expect(result.verdict).toBe('BLOCKED');
    });

    it('returns INCONCLUSIVE if rulePackage status is NOT_APPLICABLE', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '1', unit: 'g' },
          E: { value: '1', unit: 'g' },
          Ec: { value: '1', unit: 'g' },
          m: '10',
          traces: []
        },
        rulePackage: {
          status: 'NOT_APPLICABLE',
        },
        load: { value: '10', unit: 'g' },
        instrumentId: 'INST'
      };

      const result = ComplianceEngine.evaluate(request);
      expect(result.verdict).toBe('INCONCLUSIVE');
    });

    it('handles requests missing traceability info gracefully', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '1.0', unit: 'kg' },
          E: { value: '0.005', unit: 'kg' },
          Ec: { value: '0.005', unit: 'kg' },
          m: '1000',
          traces: []
        },
        rulePackage: {
          status: 'APPLICABLE',
          mpeLimit: { value: '6', unit: 'g' },
          mpeMultiplier: '1.0'
        },
        load: { value: '1000', unit: 'g' },
        instrumentId: 'INST-001'
      };

      const result = ComplianceEngine.evaluate(request);
      expect(result.verdict).toBe('PASS');
      expect(result.trace?.ruleEngineVersion).toBe('UNKNOWN');
      expect(result.trace?.applicableRequirement).toBe('Unknown Requirement');
    });

    it('converts units properly (e.g. Ec in kg, MPE in g)', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '1.0', unit: 'kg' },
          E: { value: '0.005', unit: 'kg' },
          Ec: { value: '0.005', unit: 'kg' },
          m: '1000',
          traces: []
        },
        rulePackage: {
          status: 'APPLICABLE',
          mpeLimit: { value: '6', unit: 'g' },
          mpeMultiplier: '1.0',
          traceability: {
            ruleId: 'R76-T6',
            ruleVersion: '1.0.0',
            sourceDocument: 'OIML R76',
            sourceReference: 'Table 6',
            explanation: []
          }
        },
        load: { value: '1000', unit: 'g' },
        instrumentId: 'INST-001'
      };

      const result = ComplianceEngine.evaluate(request);
      expect(result.verdict).toBe('PASS');
    });

    it('handles negative Ec appropriately with Math.abs', () => {
      const request: ComplianceEvaluationRequest = {
        calculationResult: {
          P: { value: '1.0', unit: 'kg' },
          E: { value: '-6', unit: 'g' },
          Ec: { value: '-6', unit: 'g' },
          m: '1000',
          traces: []
        },
        rulePackage: {
          status: 'APPLICABLE',
          mpeLimit: { value: '5', unit: 'g' },
          mpeMultiplier: '1.0',
          traceability: {
            ruleId: 'R76-T6',
            ruleVersion: '1.0.0',
            sourceDocument: 'OIML R76',
            sourceReference: 'Table 6',
            explanation: []
          }
        },
        load: { value: '1000', unit: 'g' },
        instrumentId: 'INST-001'
      };

      const result = ComplianceEngine.evaluate(request);
      expect(result.verdict).toBe('FAIL');
    });
  });

});
