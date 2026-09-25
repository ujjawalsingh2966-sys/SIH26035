# Error Handling Design

## 1. Zero Exception Policy
The Compliance Engine explicitly refuses to act via an `Error`-throwing mechanism whenever feasible, treating data failure states as `BLOCKED` verdicts rather than raw program exceptions. The logic mandates that "a failure to compute is just another computable state."

## 2. Guard Conditions
The primary operations of the engine isolate failure vectors natively:
1. **Empty / Undefined Scope Values:** Null or unsupported limits natively drop out into the `BLOCKED` status payload cleanly.
2. **Missing Input Data Structures:** Phase 6 payloads lacking calculated Corrected Error values trigger an immediate fallback to `BLOCKED`.
3. **Invalid Contexts:** Tightly controlled string enums in upstream types force Typescript compiler limitations over unstructured text inputs coming in.

## 3. Mathematical Overflows & Float Precision Risk
Javascript floating-point precision logic risks misinterpreting tiny limit bounds operations. E.g. $(0.1 + 0.2) = 0.30000000000000004$. When comparing microscopic metric values against legal limits, such overflow leads to an unintended `FAIL`. The engine leverages `decimal.js` spanning arbitrarily wide limits defensively against calculation artifacts from downstream dependencies.
