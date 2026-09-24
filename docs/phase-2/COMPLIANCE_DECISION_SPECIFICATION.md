# Compliance Decision & Explainability Specification

## 1. Compliance Decision Model

This dictates the strict pipeline through which raw inputs resolve into authoritative `PASS`/`FAIL` markers.

**The Conceptual Evaluation Chain:**
`Raw Observation Matrix` $\rightarrow$ `Base Normalization (Unit Alignment)` $\rightarrow$ `Derived Error Generation (P, E, Ec)` $\rightarrow$ `Load Multiplier Factor (m)` $\rightarrow$ `Rule Table Search via (Class + m)` $\rightarrow$ `Applicable Limit Determination (MPE)` $\rightarrow$ `Boolean Limit Comparison (|Ec| <= MPE)` $\rightarrow$ `Final Result (PASS/FAIL)`.

### 1.1 Allowed Terminal Verification States:
* `PASS`: $|E_c| \le$ MPE limit. The specific reading conforms seamlessly to legal boundaries.
* `FAIL`: $|E_c| >$ MPE limit. The reading breaches statutory allowance and forces corrective rejection workflows.
* `BLOCKED`: Core dependencies are fundamentally damaged, undefined, missing or outside the rule version's capability mapping matrix. Evaluators MUST halt and abandon process.

## 2. Explainability Specification (The Trace Output)

When an evaluation executes, it MUST produce an explainable trace output attached directly internally to the final Result array. This allows subsequent verification (lawyers, inspectors, or system validators).

### 2.1 Concept of the Trace
The trace is an immutable JSON-style contextual record detailing **exactly why** a decision fell to PASS or FAIL.

**Trace Output Conceptual Requirements:**
1. **Instrument Identity:** Hash or ID referencing Class, Max, Min, e, d.
2. **Applied Load ($L$):** The nominal weight vector context.
3. **Internal Math Array:** Explicit records of $P$, $E$, and $E_c$ at arbitrary precision limits prior to evaluation matching.
4. **Active MPE Ceiling:** What the system evaluated the statutory Limit at.
5. **Applicable Requirement:** A string citing why (e.g. `OIML R76 Table 6, Class II, m>5000 -> 1.0e`).
6. **Rule Engine Version (UID):** Hex hash binding this trace directly to the governing software state logic module deployed.
7. **Resolution Comparison Statement:** `Absolute(Ec: 0.8) <= MPELimit(1.0) -> TRUE`.
