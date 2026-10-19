# Calculation Specification

## Current P4A note — 19 October 2026

The [P4A report](../P4A_METROLOGICAL_PERFORMANCE.md) documents local versioned performance calculations, exact nominal sampling, decimal normalization, zero correction, independent examples and supported/unsupported profiles. **P4A is partial and browser verification is blocked**; this note is not a compliance/completion claim. P3 calculations and historical results retain their own ruleset. Remaining unsupported/undetermined programme requirements still prevent FINAL approval. The historical specification below is not proof of implemented coverage.

P3.1 validation update: native purpose/indication/receptor values must be actual supported primitive strings at request and calculation boundaries. Purpose dispatch is exhaustive; invalid persisted programmes cannot be evaluated or finalized and are not silently reinterpreted as verification. Generic observation test-type dispatch is also strict. This repair does not alter P/E, MPE, spread or zero limits. See [validation contracts and independent regression evidence](../P3_1_VALIDATION_AND_DISPATCH_REPAIR.md).

Current P3 scope: see [native methodology, independent results and coverage](../P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md). The generic formulas below remain historical base calculations, not a complete test programme. Native repeatability compares individual uncorrected E values and their spread; it does not subtract a separately measured E0 between repetitions. Zero accuracy uses its own 0.25e limit and mechanism-specific conditions. P0/P3 normalize observation units independently of the instrument e stored in grams, with 100-digit decimal precision. Incomplete/unsupported procedures cannot produce overall PASS or final approval.

This specification dictates the absolute, unalterable formulae that future backend rule engines must map verbatim. All operations must utilize arbitrary-precision decimals.

## 1. Primary Digital Error Calculations

| Calculation ID | CALC-P |
| :--- | :--- |
| **Name** | True Indication ($P$) |
| **Purpose** | Eliminate rounding errors inherent in digital readouts to find continuous analog equivalents prior to scale changeover. |
| **Inputs** | $I$ (Indication), $e$ (Verification interval), $\Delta L$ (Additional weights restoring indication) |
| **Formula** | $P = I + 0.5e - \Delta L$ |
| **Units** | Consistent mass representation (e.g., all expressed in g or kg matching $e$) |
| **Rounding** | NONE. Must mathematically persist exactly as evaluated in arbitrary precision. |
| **Source** | OIML R 76-1:2006, Clause A.4.4.3 |

| Calculation ID | CALC-E |
| :--- | :--- |
| **Name** | Initial Error ($E$) |
| **Purpose** | Determine uncorrected discrepancy between true indication and applied load. |
| **Inputs** | $P$ (True Indication), $L$ (Nominal Load injected) |
| **Formula** | $E = P - L$ |
| **Units** | Consistent units matching $e$. |
| **Rounding** | NONE. |
| **Source** | OIML R 76-1:2006, Clause A.4.4.3 |

| Calculation ID | CALC-EC |
| :--- | :--- |
| **Name** | Corrected Error ($E_c$) |
| **Purpose** | Eliminate inherent zero-setting instrumentation error establishing absolute load-based deviation limit. |
| **Inputs** | $E$ (Initial Error), $E_0$ (Error evaluated exactly at zero-load state) |
| **Formula** | $E_c = E - E_0$ |
| **Units** | Consistent units matching $e$. |
| **Rounding** | NONE. |
| **Source** | OIML R 76-1:2006, Clause A.4.4.3 |

## 2. Threshold Conversion Calculation

| Calculation ID | CALC-M |
| :--- | :--- |
| **Name** | MPE Load Multiplier ($m$) |
| **Purpose** | Express load purely as a multiplier of $e$ so Table 6 MPE limits can execute dynamic selections. |
| **Inputs** | $L$ (Nominal Load), $e$ (Verification Scale Interval) |
| **Formula** | $m = L / e$ |
| **Units** | Dimensionless integer multiplier |
| **Rounding** | Conceptually exact (no mathematical truncation). |
| **Source** | Derived requirement integrating Table 6 logic implicitly. |
