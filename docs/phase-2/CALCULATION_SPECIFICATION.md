# Calculation Specification

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
