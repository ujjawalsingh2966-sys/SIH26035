# UX Principles

These core principles define what the application experience must optimize for under Phase 3, ensuring strict adherence to the regulatory bounds mapped in Phase 1 and Phase 2.

## 1. Prioritize Accuracy over Speed
The system represents a laboratory testing workflow where incorrect statutory evaluation has legal consequences. The UI will prioritize correct data entry and preventing user mistakes over rapid, frictionless submission.

## 2. Decouple Raw Observations from System Calculations
Users must never be confused about which values they entered manually versus which values the mathematical engine calculated. Visual hierarchy must explicitly separate physical observations ($I, \Delta L, E_0$) from derived values ($P, E, E_c, \text{MPE}$).

## 3. Transparency of State and Traceability
Compliance validation errors and internal verdicts (`PASS`, `FAIL`, `BLOCKED`) must be fully explainable. The UX will display why an error triggered and what statutory rule version forced the outcome.

## 4. Safety in Retesting and Review
Technicians require explicit boundaries for safe correction without overwriting historical traces. Reviewers hold final authority and their workspace must prioritize audit confidence.

## 5. Domain Rigidity 
The UX must forcefully block unsupported paths (e.g. Mechanical scales, AWIs) at the absolute earliest point in the workflow via explicit "Blocked" empty states. It will not allow unmapped rules to evaluate.

## 6. Zero-Ambiguity Metrics
Values are never displayed without their attached base units. All numerical inputs will carry visual unit signifiers tied to Phase 2 unit-normalization rules.
