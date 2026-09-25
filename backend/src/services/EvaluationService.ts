import { CalculationEngine } from '../calculations/engine';
import { RuleEngine } from '../rules/engine';
import { ComplianceEngine } from '../compliance/engine';
import { ObservationState, Unit } from '../calculations/types';
import { InstrumentContext, RuleEvaluationContext } from '../rules/types';
import { Instrument, ObservationEvaluation, ObservationType } from '../types/domain';

// Maps the persistence-layer ObservationType (used by observationRoutes) to the
// RuleEngine's TestType identifiers (used by rules/engine.ts checkTestScope).
const TEST_TYPE_MAP: Record<ObservationType, string> = {
  WEIGHING: 'TEST-WEIGH',
  ECCENTRICITY: 'TEST-ECC',
  REPEATABILITY: 'TEST-REP',
  TARE: 'TEST-TARE',
  ZERO_SETTING: 'TEST-ZERO'
};

export interface RawObservationInput {
  testType: ObservationType;
  load: string;
  indication: string;
  additionalWeights: string;
  unit?: Unit;
  zeroError?: string;
}

/**
 * Wires the existing, independently-tested CalculationEngine -> RuleEngine -> ComplianceEngine
 * pipeline into the live application. Does not alter any formula, MPE table, or comparison
 * logic in those engines - this is orchestration/glue only.
 */
export class EvaluationService {
  public static evaluateObservation(
    instrument: Instrument,
    observation: RawObservationInput,
    isInitialVerification: boolean
  ): ObservationEvaluation {
    const accuracyClass = instrument.accuracyClass;
    const eValue = instrument.e;

    if (!accuracyClass || !eValue) {
      throw new Error(
        'Instrument is missing required metrological parameters (accuracyClass and/or e) needed for evaluation'
      );
    }

    const testType = TEST_TYPE_MAP[observation.testType];
    if (!testType) {
      throw new Error(`Unsupported observation testType: ${observation.testType}`);
    }

    const unit: Unit = observation.unit || 'g';

    const state: ObservationState = {
      L: { value: observation.load, unit },
      I: { value: observation.indication, unit },
      deltaL: { value: observation.additionalWeights, unit },
      e: { value: eValue, unit },
      E0: { value: observation.zeroError || '0', unit }
    };

    // 1. Calculation Engine - P, E, Ec, m (unchanged, reused as-is)
    const calculation = CalculationEngine.calculate(state);

    // Instrument.isManual is the existing domain flag used elsewhere (instrumentRoutes.ts)
    // to gate Non-Automatic Weighing Instruments; it maps directly to RuleEngine's isNAWI.
    // isGraduated/scaleType are not consulted by RuleEngine.checkInstrumentScope today, so
    // they are populated from the closest available fields without affecting the verdict.
    const instrumentContext: InstrumentContext = {
      isNAWI: instrument.isManual,
      isElectronic: instrument.isElectronic,
      isSingleRange: instrument.isSingleRange,
      isGraduated: true,
      scaleType: instrument.isManual ? 'Manual' : 'Automatic',
      accuracyClass,
      hasTare: !!instrument.hasTare
    };

    const ruleContext: RuleEvaluationContext = {
      instrument: instrumentContext,
      testType,
      isInitialVerification,
      m: calculation.m,
      e: state.e
    };

    // 2. Rule Engine - MPE selection / scope gating (unchanged, reused as-is)
    const rulePackage = RuleEngine.evaluate(ruleContext);

    // 3. Compliance Engine - PASS/FAIL/INCONCLUSIVE/BLOCKED verdict (unchanged, reused as-is)
    const compliance = ComplianceEngine.evaluate({
      calculationResult: calculation,
      rulePackage,
      load: state.L,
      instrumentId: instrument.id
    });

    return {
      calculation,
      rulePackage,
      compliance,
      evaluatedAt: new Date().toISOString()
    };
  }
}
