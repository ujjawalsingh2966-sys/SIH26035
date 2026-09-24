import { Decimal } from 'decimal.js';
import {
  ObservationState,
  CalculationResult,
  CalculationTrace,
  MetrologicalQuantity,
  DecimalQuantity
} from './types';
import { normalizeQuantities, toMetrologicalQuantity } from './unitConversion';

/**
 * Metrological Calculation Engine
 * Converts raw observations into derived calculated parameters (P, E, Ec, m)
 * Implements strict arbitrary precision per Phase 2 specifications.
 */
export class CalculationEngine {
  /**
   * Executes the calculation pipeline for a single observation state.
   */
  public static calculate(state: Readonly<ObservationState>): CalculationResult {
    // 1. Establish absolute unit baseline matching `e` (Verification scale interval)
    const baseUnit = state.e.unit;

    // Normalize all input parameters to baseUnit
    const normalized = normalizeQuantities(
      {
        L: state.L,
        I: state.I,
        deltaL: state.deltaL,
        e: state.e,
        E0: state.E0
      },
      baseUnit
    );

    const L = normalized.L;
    const I = normalized.I;
    const deltaL = normalized.deltaL;
    const e = normalized.e;
    const E0 = normalized.E0;

    const traces: CalculationTrace[] = [];

    // 2. CALC-P: True Indication
    // P = I + 0.5e - deltaL
    const P_val = I.value.plus(e.value.times(0.5)).minus(deltaL.value);
    const P: DecimalQuantity = { value: P_val, unit: baseUnit };

    traces.push(this.buildTrace(
      'CALC-P',
      'True Indication (P)',
      'P = I + 0.5e - deltaL',
      {
        I: `${I.value.toString()} ${I.unit}`,
        e: `${e.value.toString()} ${e.unit}`,
        deltaL: `${deltaL.value.toString()} ${deltaL.unit}`
      },
      `${P_val.toString()} ${baseUnit}`
    ));

    // 3. CALC-E: Initial Error
    // E = P - L
    const E_val = P.value.minus(L.value);
    const E: DecimalQuantity = { value: E_val, unit: baseUnit };

    traces.push(this.buildTrace(
      'CALC-E',
      'Initial Error (E)',
      'E = P - L',
      {
        P: `${P.value.toString()} ${P.unit}`,
        L: `${L.value.toString()} ${L.unit}`
      },
      `${E_val.toString()} ${baseUnit}`
    ));

    // 4. CALC-EC: Corrected Error
    // Ec = E - E0
    const Ec_val = E.value.minus(E0.value);
    const Ec: DecimalQuantity = { value: Ec_val, unit: baseUnit };

    traces.push(this.buildTrace(
      'CALC-EC',
      'Corrected Error (Ec)',
      'Ec = E - E0',
      {
        E: `${E.value.toString()} ${E.unit}`,
        E0: `${E0.value.toString()} ${E0.unit}`
      },
      `${Ec_val.toString()} ${baseUnit}`
    ));

    // 5. CALC-M: MPE Load Multiplier
    // m = L / e
    const m_val = L.value.dividedBy(e.value);

    traces.push(this.buildTrace(
      'CALC-M',
      'MPE Load Multiplier (m)',
      'm = L / e',
      {
        L: `${L.value.toString()} ${L.unit}`,
        e: `${e.value.toString()} ${e.unit}`
      },
      m_val.toString() // Dimensionless
    ));

    // Return the immutable calculated results with standard quantity interface
    return {
      P: toMetrologicalQuantity(P),
      E: toMetrologicalQuantity(E),
      Ec: toMetrologicalQuantity(Ec),
      m: m_val.toString(),
      traces
    };
  }

  private static buildTrace(
    calcId: string,
    name: string,
    formula: string,
    inputs: Record<string, string>,
    output: string
  ): CalculationTrace {
    return {
      calcId,
      name,
      formula,
      inputs,
      output
    };
  }
}
