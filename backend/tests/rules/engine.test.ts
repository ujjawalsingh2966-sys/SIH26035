import { RuleEngine } from '../../src/rules/engine';
import { RuleEvaluationContext, InstrumentContext } from '../../src/rules/types';

describe('Regulatory Rule Engine (Phase 7)', () => {
  const baseInstrument: InstrumentContext = {
    isNAWI: true,
    isElectronic: true,
    isSingleRange: true,
    isGraduated: true,
    scaleType: 'Manual',
    accuracyClass: 'III',
    hasTare: true
  };

  const baseContext: RuleEvaluationContext = {
    instrument: baseInstrument,
    testType: 'TEST-WEIGH',
    isInitialVerification: true,
    m: '1000',
    e: { value: '5', unit: 'g' }
  };

  it('Should accurately select Rule Version OIML-R76-1-2006-CORE-V1.0.0-MVP', () => {
    const result = RuleEngine.evaluate(baseContext);
    expect(result.status).toBe('APPLICABLE');
    expect(result.traceability?.ruleVersion).toBe('OIML-R76-1-2006-CORE-V1.0.0-MVP');
  });

  describe('MVP Scope Limitations', () => {
    it('Should return BLOCKED for Automatic Weighing Instruments (AWI)', () => {
      const ctx = { ...baseContext, instrument: { ...baseInstrument, isNAWI: false } };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('BLOCKED');
      expect(result.reason).toContain('AWI');
    });

    it('Should return BLOCKED for Multi-Range instruments', () => {
      const ctx = { ...baseContext, instrument: { ...baseInstrument, isSingleRange: false } };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('BLOCKED');
      expect(result.reason).toContain('Multi-range');
    });

    it('Should return BLOCKED for Mechanical instruments', () => {
      const ctx = { ...baseContext, instrument: { ...baseInstrument, isElectronic: false } };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('BLOCKED');
      expect(result.reason).toContain('Mechanical');
    });
    
    it('Should return BLOCKED for Class I instruments in MVP', () => {
      const ctx = { ...baseContext, instrument: { ...baseInstrument, accuracyClass: 'I' as const } };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('BLOCKED');
      expect(result.reason).toContain('Class I is deferred');
    });

    it('Should return NOT_APPLICABLE for tare test when instrument has no tare', () => {
      const ctx = { ...baseContext, testType: 'TEST-TARE', instrument: { ...baseInstrument, hasTare: false } };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('NOT_APPLICABLE');
      expect(result.reason).toContain('hasTare is false');
    });
    
    it('Should return BLOCKED for out-of-scope tests like TEST-REP in MVP', () => {
      const ctx = { ...baseContext, testType: 'TEST-REP' };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('BLOCKED');
      expect(result.reason).toContain('Deferred from MVP');
    });
  });

  describe('MPE Boundary Selection (Golden Tests Mapping)', () => {
    // Maps exactly to GT-01-PASS-III-NOR and GT-02-FAIL-III-NOR
    it('Should select 1.0e MPE for Class III with m=1000', () => {
      const result = RuleEngine.evaluate(baseContext); // m = 1000
      expect(result.status).toBe('APPLICABLE');
      expect(result.mpeMultiplier).toBe('1.0');
      expect(result.mpeLimit?.value).toBe('5'); // 1.0 * e(5g)
      expect(result.mpeLimit?.unit).toBe('g');
      expect(result.traceability?.explanation).toContain('Class III Table 6 dictates MPE = 1.0e for 500 < m <= 2000 (m = 1000)');
    });

    // Maps exactly to GT-03-PASS-II-BNDRY
    it('Should select 1.0e MPE for Class II with m=20000', () => {
      const ctx = {
        ...baseContext,
        instrument: { ...baseInstrument, accuracyClass: 'II' as const },
        m: '20000',
        e: { value: '0.01', unit: 'g' as const }
      };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('APPLICABLE');
      expect(result.mpeMultiplier).toBe('1.0');
      expect(result.mpeLimit?.value).toBe('0.01'); // 1.0 * e(0.01g)
      expect(result.mpeLimit?.unit).toBe('g');
      expect(result.traceability?.explanation).toContain('Class II Table 6 dictates MPE = 1.0e for 5000 < m <= 20000 (m = 20000)');
    });

    it('Should handle 0.5e lower boundary (Class III, m=500)', () => {
      const ctx = { ...baseContext, m: '500' };
      const result = RuleEngine.evaluate(ctx);
      expect(result.mpeMultiplier).toBe('0.5');
      expect(result.mpeLimit?.value).toBe('2.5'); 
    });

    it('Should handle 1.0e lower limit strict boundary (Class III, m=500.0001)', () => {
      const ctx = { ...baseContext, m: '500.0001' };
      const result = RuleEngine.evaluate(ctx);
      expect(result.mpeMultiplier).toBe('1.0');
    });

    it('Should handle 1.5e upper boundary (Class III, m=2001)', () => {
      const ctx = { ...baseContext, m: '2001' };
      const result = RuleEngine.evaluate(ctx);
      expect(result.mpeMultiplier).toBe('1.5');
    });
    
    it('Should handle out-of-bounds MPE for Class III (m > 10000)', () => {
      const ctx = { ...baseContext, m: '10001' };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('BLOCKED');
      expect(result.reason).toContain('exceeds defined bounds');
    });
  });

  describe('In-Service Verification', () => {
    it('Should double the MPE for In-Service testing', () => {
      const ctx = { ...baseContext, isInitialVerification: false, m: '1000' };
      const result = RuleEngine.evaluate(ctx);
      expect(result.status).toBe('APPLICABLE');
      expect(result.mpeMultiplier).toBe('2.0'); // 1.0 * 2
      expect(result.mpeLimit?.value).toBe('10'); // 1.0e * 2 = 10g
      expect(result.traceability?.explanation).toContain('In-Service MPE scaled by 2x');
    });
  });
});
