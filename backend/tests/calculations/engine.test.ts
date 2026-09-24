import { CalculationEngine } from '../../src/calculations/engine';
import { ObservationState, MetrologicalQuantity } from '../../src/calculations/types';

describe('Metrological Calculation Engine (Phase 6)', () => {
  it('Should accurately calculate GT-01-PASS-III-NOR', () => {
    const state: ObservationState = {
      L: { value: '5', unit: 'kg' },
      I: { value: '5005', unit: 'g' },
      deltaL: { value: '3', unit: 'g' },
      e: { value: '5', unit: 'g' },
      E0: { value: '0', unit: 'g' }
    };

    const result = CalculationEngine.calculate(state);

    // Derived Analog
    // P = 5004.5g
    expect(result.P).toEqual({ value: '5004.5', unit: 'g' });
    // E = 4.5g
    expect(result.E).toEqual({ value: '4.5', unit: 'g' });
    // Ec = 4.5g
    expect(result.Ec).toEqual({ value: '4.5', unit: 'g' });
    // m = 1000
    expect(result.m).toEqual('1000');

    // Assure precision
    expect(result.P.value).not.toContain('5004.499999');

    // Check traces exist
    expect(result.traces).toHaveLength(4);
    expect(result.traces.find(t => t.calcId === 'CALC-P')?.output).toBe('5004.5 g');
  });

  it('Should accurately calculate GT-02-FAIL-III-NOR', () => {
    const state: ObservationState = {
      L: { value: '5', unit: 'kg' },
      I: { value: '5010', unit: 'g' },
      deltaL: { value: '2', unit: 'g' },
      e: { value: '5', unit: 'g' },
      E0: { value: '0', unit: 'g' }
    };

    const result = CalculationEngine.calculate(state);

    expect(result.P).toEqual({ value: '5010.5', unit: 'g' });
    expect(result.E).toEqual({ value: '10.5', unit: 'g' });
    expect(result.Ec).toEqual({ value: '10.5', unit: 'g' });
    expect(result.m).toEqual('1000');
  });

  it('Should accurately calculate GT-03-PASS-II-BNDRY (Extreme precision)', () => {
    // Tests JavaScript float limitations to ensure decimal.js behaves correctly
    const state: ObservationState = {
      L: { value: '200', unit: 'g' },
      I: { value: '200.00', unit: 'g' },
      deltaL: { value: '0.00', unit: 'g' },
      e: { value: '0.01', unit: 'g' },
      E0: { value: '0.005', unit: 'g' } // E0 at zero-load state
    };

    const result = CalculationEngine.calculate(state);

    expect(result.P).toEqual({ value: '200.005', unit: 'g' });
    expect(result.E).toEqual({ value: '0.005', unit: 'g' });
    expect(result.Ec).toEqual({ value: '0', unit: 'g' }); // decimal.js strips trailing zeros in toString() by default for zero
    expect(result.m).toEqual('20000');
  });

  it('Should successfully map complex mixed units', () => {
    const state: ObservationState = {
      L: { value: '1', unit: 't' }, // 1000000 g
      I: { value: '1000', unit: 'kg' }, // 1000000 g
      deltaL: { value: '500', unit: 'g' },
      e: { value: '100', unit: 'g' },
      E0: { value: '200', unit: 'g' }
    };

    const result = CalculationEngine.calculate(state);

    // Everything is localized to e unit ('g')
    // P = 1000000 + 50 - 500 = 999550
    expect(result.P).toEqual({ value: '999550', unit: 'g' });
    // E = 999550 - 1000000 = -450
    expect(result.E).toEqual({ value: '-450', unit: 'g' });
    // Ec = -450 - 200 = -650
    expect(result.Ec).toEqual({ value: '-650', unit: 'g' });
    // m = 1000000 / 100 = 10000
    expect(result.m).toEqual('10000');
  });

  it('Should throw or retain extreme precision for non-terminating decimals safely', () => {
    // L = 1/3 normalized
    const state: ObservationState = {
      L: { value: '1', unit: 'g' },
      I: { value: '1', unit: 'g' },
      deltaL: { value: '0', unit: 'g' },
      e: { value: '3', unit: 'g' }, // Will set m = 1/3 (0.333...)
      E0: { value: '0', unit: 'g' }
    };

    const result = CalculationEngine.calculate(state);
    expect(result.P.value).toEqual('2.5'); // 1 + 1.5 - 0
    expect(result.E.value).toEqual('1.5');
    // decimal set to ~100 precisions
    expect(result.m.startsWith('0.333')).toBe(true);
  });
});
