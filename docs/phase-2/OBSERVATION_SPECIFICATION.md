# Observation Specification

Defines exactly what a metrology technician observes from the instrument, how it is recorded, and separates RAW inputs from CALCULATED derivations.

## 1. Raw Observations
These are the exact numerical values visually transcribed by the technician directly from the instrument's display during the test sequence.

| Observation ID | Concept | Definition | Unit | Sequence | Required Metadata | Conditions | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OBS-IND** | Indication ($I$) | The raw reading shown on the scale display. | Matched to $e$ | For every nominal load $L$ | Instrument stable | Nominal load applied | VERIFIED |
| **OBS-DL** | Additional weights ($\Delta L$) | The small fractional weights (usually 0.1d steps) added to exactly trigger the next physical scale increment. | Matched to $e$ | Captured simultaneously with $I$ | Scale incremented visually | Manual changeover method used | VERIFIED |
| **OBS-E0** | Error at Zero ($E_0$) | The intrinsic error calculating load at exactly 0. | Matched to $e$ | First observation of a sequence | Calculated mathematically (see Sec 2) | Empty scale after Zero setting | VERIFIED |

## 2. Calculated / Derived Observations
These are NEVER directly observed by the user. They are solely produced by the deterministic engine.

| Derivation ID | Concept | Definition | Dependent On | Trigger | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DER-P** | True Indication ($P$) | Exact internal reading prior to digital rounding: $P = I + 0.5e - \Delta L$ | $I$, $\Delta L$, $e$ | Rule execution | VERIFIED |
| **DER-E** | Initial Error ($E$) | Error without zero correction: $E = P - L$ | $P$, $L$ | Rule execution | VERIFIED |
| **DER-EC** | Corrected Error ($E_c$) | Final error checked against MPE: $E_c = E - E_0$ | $E$, $E_0$ | Rule execution | VERIFIED |

**CRITICAL DOMAIN DIRECTIVE:**
Under no circumstances should the software UI request the technician to input $E_c$ or $P$. The UI collects ONLY $L$, $I$, and $\Delta L$. The backend engine performs all derivations inside the rule sandbox.
