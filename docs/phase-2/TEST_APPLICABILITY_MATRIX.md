# Test Applicability Matrix

Defines exactly which functional metrology tests apply to a given instrument classification inside the Phase 2 MVP scope.

| Instrument Type | Accuracy Class | Weighing (TEST-WEIGH) | Eccentricity (TEST-ECC) | Repeatability (TEST-REP) | Tare (TEST-TARE) | Zero-Setting (TEST-ZERO) | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INST-E-SR-I** | Class I | MANDATORY | MANDATORY | MANDATORY | CONDITIONAL | MANDATORY | Tare only if equipped |
| **INST-E-SR-II** | Class II | MANDATORY | MANDATORY | MANDATORY | CONDITIONAL | MANDATORY | Tare only if equipped |
| **INST-E-SR-III** | Class III | MANDATORY | MANDATORY | MANDATORY | CONDITIONAL | MANDATORY | Tare only if equipped |
| **INST-E-SR-IIII**| Class IIII | MANDATORY | MANDATORY | MANDATORY | CONDITIONAL | MANDATORY | Tare only if equipped |

### Applicability Logic Rules
* **Rule-App-01:** If the instrument configuration boolean `hasTare` is `false`, `TEST-TARE` is automatically derived as `NOT APPLICABLE`.
* **Rule-App-02:** All electronic single-range instruments MUST undergo `TEST-WEIGH`, `TEST-ECC`, and `TEST-REP`.
* **Rule-App-03:** Applicability checks are state-blocking; missing a `MANDATORY` test prevents transition out of testing status.
