# Phase 13 - Calculation Validation

Latest P3.1 evidence: **523 backend / 39 frontend tests pass**, including four previously failing purpose/profile rejection regressions, strict native/generic calculation dispatch and malformed-history approval/report guards. Purpose-specific sampling and all existing decimal/MPE tests remain green. See [repair and exact results](../P3_1_VALIDATION_AND_DISPATCH_REPAIR.md); this is not full statutory test coverage.

Current-status correction (P3, 18 October 2026): the historical assertions below do not establish full OIML coverage. MPE means maximum permissible error; native repeatability uses error spread, not standard deviation. See [verified P3 formulas, independent literal examples, supported profiles and test evidence](../P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md). Current automated results are 431 backend tests (37 native) and 39 frontend tests; unimplemented mandatory procedures still block final approval.

## Summary
Validates algorithms defining Minimum Permissible Errors, Repeatability Spread, eccentricity maximums, rounding mechanics.

### Results
- `calculateMPE`: Verified for Class I, II, III, IIII structures.
- `calculateError`: Floating point offsets tested and asserted correctly.
- Passed 100% of mathematical integrity test fixtures.
