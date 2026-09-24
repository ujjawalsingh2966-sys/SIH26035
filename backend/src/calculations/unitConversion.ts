import { Decimal } from 'decimal.js';
import { Unit, DecimalQuantity, MetrologicalQuantity } from './types';

// Enforce high precision across all mathematical conversions
// Standard metrology scales precision guarantees
Decimal.set({ precision: 100, rounding: Decimal.ROUND_HALF_UP });

// Conversion factors to standard gram (Base Unit)
const GRAM_FACTORS: Record<Unit, Decimal> = {
  mg: new Decimal('0.001'),
  g: new Decimal('1'),
  kg: new Decimal('1000'),
  t: new Decimal('1000000'),
};

/**
 * Converts any MetrologicalQuantity to a target unit natively via precise power multiplication/division.
 * This satisfies Rule-Unit-1 and Rule-Unit-2.
 */
export function convertToUnit(
  source: MetrologicalQuantity,
  targetUnit: Unit
): DecimalQuantity {
  const value = new Decimal(source.value);

  if (source.unit === targetUnit) {
    return { value, unit: targetUnit };
  }

  const sourceFactor = GRAM_FACTORS[source.unit];
  const targetFactor = GRAM_FACTORS[targetUnit];

  // (source_value * source_factor) / target_factor
  // Utilizing arbitrary precision
  const targetValue = value.times(sourceFactor).dividedBy(targetFactor);

  return {
    value: targetValue,
    unit: targetUnit
  };
}

/**
 * Converts DecimalQuantity to standard MetrologicalQuantity
 */
export function toMetrologicalQuantity(qty: DecimalQuantity): MetrologicalQuantity {
  return {
    value: qty.value.toString(),
    unit: qty.unit
  };
}

/**
 * Normalizes all inputs into the unit of verification scale interval (e).
 */
export function normalizeQuantities(
  quantities: Record<string, MetrologicalQuantity>,
  targetUnit: Unit
): Record<string, DecimalQuantity> {
  const normalized: Record<string, DecimalQuantity> = {};
  for (const [key, qty] of Object.entries(quantities)) {
    normalized[key] = convertToUnit(qty, targetUnit);
  }
  return normalized;
}
