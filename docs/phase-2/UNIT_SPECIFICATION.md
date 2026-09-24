# Measurement Unit Specification

## 1. Domain Units

The NAWI testing domain evaluates raw mass interactions constrained by strictly specified precision intervals.

| Unit | Meaning | Valid Concept Status | Allowed Use |
| :--- | :--- | :--- | :--- |
| **kg** | Kilograms | VERIFIED | Primary heavy equipment indication standard |
| **g** | Grams | VERIFIED | Secondary, finer scale metric format |
| **mg** | Milligrams | VERIFIED | Ultra-fine laboratory format (Class I/II limits) |
| **t** | Metric Tonnes (1000kg) | VERIFIED | Max scale boundaries representation |

## 2. Unit Normalization Concept Logic

The calculation engine functions MUST NOT blend abstract scaling metrics during calculation strings.

* **Rule-Unit-1 [Base Synchronization]:** Before evaluating $E = I + 0.5e - \Delta L - L$, ALL parameters ($I$, $e$, $\Delta L$, $L$) MUST be converted to the explicit unit boundary of the verification scale interval `$e$`. If $e = 10 g$, all arrays must translate to base grams.
* **Rule-Unit-2 [Non-lossy Translation]:** Since metric translation implies merely decimal point shifting (multiplying/dividing by strings of $10^x$), translations must be executed mathematically via precise arbitrary power mechanisms shifting without float truncation.
* **Rule-Unit-3 [Input Ambiguity Resolution]:** The JSON request wrapper passing inputs dictates the unit of that given field array explicitly (`value`, `unitCode`).
