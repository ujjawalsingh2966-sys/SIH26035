import { Decimal } from 'decimal.js';

export type Unit = 'mg' | 'g' | 'kg' | 't';

export interface MetrologicalQuantity {
  value: string; // Stored as string to prevent JSON float instantiation
  unit: Unit;
}

export interface DecimalQuantity {
  value: Decimal;
  unit: Unit;
}

export interface CalculationTrace {
  calcId: string;
  name: string;
  formula: string;
  inputs: Record<string, string>;
  output: string;
}

export interface CalculationResult {
  P: MetrologicalQuantity;
  E: MetrologicalQuantity;
  Ec: MetrologicalQuantity;
  m: string; // Dimensionless Number encoded as string
  traces: CalculationTrace[];
}

export interface ObservationState {
  L: MetrologicalQuantity; // Nominal Load
  I: MetrologicalQuantity; // Indication
  deltaL: MetrologicalQuantity; // Additional weights restoring indication
  e: MetrologicalQuantity; // Verification interval
  E0: MetrologicalQuantity; // Error evaluated exactly at zero-load state
}
