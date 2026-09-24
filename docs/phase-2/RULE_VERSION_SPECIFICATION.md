# Rule Applicability & Versioning Specification

## 1. Rule Applicability Model
What determines strictly how an evaluation rule applies during test execution?

* **Trigger Dimension [Instrument Configuration]:** 
  * Explicit combination of `NAWI` + `Electronic` + `Single Range` guarantees routing to the standard OIML R76-1 Core Engine Evaluator. Out-of-bounds instrument types throw `BLOCKED`.
* **Trigger Dimension [Dynamic Load Context]:** 
  * The actual formula $m = L / e$ maps deterministically exactly to which static MPE rule row the evaluation parses.
* **Trigger Dimension [Test Type Variant]:**
  * Rule sets shift fundamentally based on test. (e.g. `TEST-REP` evaluates differences $E_{max} - E_{min}$, completely distinct from basic `TEST-WEIGH`). The test string context selects the formula processor pipeline.

## 2. Rule Version Model
Changes in legal statutes or software debugging processes force strict isolation. Rule sets governing metrological math and MPE tables MUST map via explicit immutable Rule Version IDs.

### 2.1 Rule Version Schema Architecture
* **RuleSetID:** Conceptual grouping string (e.g., `OIML-R76-1-2006-CORE`).
* **Version String:** Semantic versioning (e.g. `v1.0.0`).
* **Source Bound:** OIML R 76-1:2006, 7th Schedule LM Rules 2011.
* **Active Status Lifecycle:** 
  * `ACTIVE`: Default route for all new testing executions.
  * `DEPRECATED`: Allowed strictly for re-verifying historical frozen traces against their original parameters. Refused execution on new test runs.

### 2.2 Historical Reproducibility Protocol
Testing results (sealed to PASS or FAIL) must forever remain cryptographically reproducible against raw observations. In Phase 3, this mandates that Test Logs formally encode the active `Version String` inside their result payloads. The engine provides deterministic exact-match recreation mathematically by routing historical data directly back into the frozen `DEPRECATED` older engine variant.
