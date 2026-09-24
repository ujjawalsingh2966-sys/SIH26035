import { Decimal } from 'decimal.js';
import { RuleEvaluationContext, RuleEvaluationPackage, InstrumentContext } from './types';

// Enforce high precision matching computations
Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP });

/**
 * Phase 7 - OIML R76 Rule Evaluation Engine.
 * Responsible for verifying context, applying MPE matrices, and yielding an Evaluation Package.
 */
export class RuleEngine {
  public static evaluate(context: Readonly<RuleEvaluationContext>): RuleEvaluationPackage {
    // 1. MVP Instrument Scope verification
    const instrumentCheck = this.checkInstrumentScope(context.instrument);
    if (instrumentCheck) return instrumentCheck;

    // 2. MVP Test Scope verification
    const testCheck = this.checkTestScope(context.testType, context.instrument);
    if (testCheck) return testCheck;

    // 3. MPE Evaluator (Table 6 Logic)
    const mpeLimitResult = this.evaluateMpe(context.instrument.accuracyClass, context.m);
    if (mpeLimitResult.error) {
      return {
        status: 'BLOCKED',
        reason: mpeLimitResult.error
      };
    }

    let multiplier = new Decimal(mpeLimitResult.multiplier!);
    const explanations: string[] = [ mpeLimitResult.explanation! ];

    // 4. In-Service Scaling
    if (!context.isInitialVerification) {
      multiplier = multiplier.times(2);
      explanations.push('In-Service MPE scaled by 2x');
    }

    // Calculate Absolute MPE Limit
    const eVal = new Decimal(context.e.value);
    const mpeLimitValue = eVal.times(multiplier);

    return {
      status: 'APPLICABLE',
      mpeLimit: { value: mpeLimitValue.toString(), unit: context.e.unit },
      mpeMultiplier: multiplier.toFixed(1),
      traceability: {
        ruleId: 'OIML-R76-T6',
        ruleVersion: 'OIML-R76-1-2006-CORE-V1.0.0-MVP',
        sourceDocument: 'OIML R 76-1:2006',
        sourceReference: 'Table 6 / 7th Schedule LM Rules 2011',
        explanation: explanations
      }
    };
  }

  private static checkInstrumentScope(instrument: InstrumentContext): RuleEvaluationPackage | null {
    if (!instrument.isNAWI) return { status: 'BLOCKED', reason: 'REJECT: Automatic Weighing Instrument AWI - OIML R51/134 applies' };
    if (!instrument.isElectronic) return { status: 'BLOCKED', reason: 'REJECT: Mechanical balances out of MVP scope' };
    if (!instrument.isSingleRange) return { status: 'BLOCKED', reason: 'REJECT: Multi-range/Multi-interval deferred from MVP' };
    if (instrument.accuracyClass === 'I') return { status: 'BLOCKED', reason: 'Class I is deferred conceptually post precision-engine stabilization (MVP restriction)' };
    return null;
  }

  private static checkTestScope(testType: string, instrument: InstrumentContext): RuleEvaluationPackage | null {
    // MVP Permitted tests
    const mvpTests = ['TEST-WEIGH', 'TEST-ECC', 'TEST-TARE'];

    if (!mvpTests.includes(testType)) {
      return { status: 'BLOCKED', reason: `Test ${testType} is Deferred from MVP execution context` };
    }

    if (testType === 'TEST-TARE' && !instrument.hasTare) {
      return { status: 'NOT_APPLICABLE', reason: 'Rule-App-01: hasTare is false, TEST-TARE is NOT APPLICABLE' };
    }

    return null;
  }

  private static evaluateMpe(accClass: string, mStr: string): { multiplier?: string, explanation?: string, error?: string } {
    const m = new Decimal(mStr);
    
    // Bounds definitions based on Table 6
    // [lower, upper, multiplier]
    const bounds: Record<string, [number, number, string][]> = {
      'II': [
        [0, 5000, '0.5'],
        [5000, 20000, '1.0'],
        [20000, 100000, '1.5']
      ],
      'III': [
        [0, 500, '0.5'],
        [500, 2000, '1.0'],
        [2000, 10000, '1.5']
      ],
      'IIII': [
        [0, 50, '0.5'],
        [50, 200, '1.0'],
        [200, 1000, '1.5']
      ]
    };

    const classBounds = bounds[accClass];
    if (!classBounds) return { error: `Accuracy class ${accClass} unsupported in MPE bounds.` };

    for (const [lower, upper, mult] of classBounds) {
      // Lower bound is strictly greater than (except for 0, where it's >=)
      // Upper bound is <=
      const isBottom = lower === 0 ? m.greaterThanOrEqualTo(lower) : m.greaterThan(lower);
      const isTop = m.lessThanOrEqualTo(upper);

      if (isBottom && isTop) {
        return { 
          multiplier: mult, 
          explanation: `Class ${accClass} Table 6 dictates MPE = ${mult}e for ${lower === 0 ? '0 <=' : `${lower} <`} m <= ${upper} (m = ${m.toString()})` 
        };
      }
    }

    return { error: `Load multiplier m=${m.toString()} exceeds defined bounds for Class ${accClass}.` };
  }
}
