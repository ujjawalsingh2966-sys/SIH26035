# Phase 2 Open Questions

During the construction of the Phase 2 regulatory specification baseline, the following open questions and statutory edge cases were identified. These do not hinder engine MVP structural development but require domain clarification prior to final V1.0 statutory release.

## 1. Zero-Tracking Enforcement Limits
**Context:** OIML R 76-1:2006 dictates specific allowances for automatic zero-tracking (semi-automatic zeroing mechanics). 
**Question:** Should the Core Engine validate zero-tracking range parameters mathematically (e.g. guaranteeing the zero zone does not exceed $4\%$ of Max), or is this validation purely assumed out-of-scope and left to visual/hardware inspector auditing?
**Impact:** If inside scope, additional fields for Zeroing Bounds must be appended to the Configuration initialization payload.

## 2. Indian LM Rules vs. OIML Discrepancies 
**Context:** Seventh Schedule of LM (General) Rules 2011 is mathematically identical to OIML R 76-1:2006. However, formatting updates in subsequent legal circulars occasionally shift nominal verbiage.
**Question:** Is there a strict necessity to host dual Rule Version instances (e.g. `IND-LM-2011` vs `OIML-2006`) mapping to the exact same logic, or does the architectural pipeline unify under `OIML-R76-CORE` conceptually for simplicity?
**Proposed Setup:** Unify mathematically to avoid engine duplication. Note statutory linkages purely in metadata.

## 3. Decimal Point Position Restrictions
**Context:** Non-lossy string extraction of base units ($e$, $d$) assumes standard floating decimal representation.
**Question:** Are there statutory conditions evaluating comma-based locales (e.g. `10,5` kg instead of `10.5` kg) natively within the core engine input stream, or is localization strictly constrained to the GUI/Client layer?
**Recommendation:** Enforce strict generic numerical payload formatting in the Engine API. The GUI sanitizes locale-based string differences.

## 4. Test Series Abort Propagation
**Context:** A standard audit implies multiple test loads (e.g., Min, 500e, 2000e, Max). If intermediate load test 2 fails MPE boundaries, does the engine mandate a sequence abort payload throwing `BLOCKED` for the series?
**Question:** Should the Engine inherently map relational Sequences tracking failures, or does it exist purely as a one-shot evaluator, leaving the sequence abortion decisions to the Client software tracking the array?
**Recommendation:** Leave Core Engine as one-shot purely stateless. Client logic handles progressive sequence abortion.
