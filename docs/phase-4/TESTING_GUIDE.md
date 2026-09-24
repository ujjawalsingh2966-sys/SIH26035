# TESTING GUIDE

## Requirement
Minimum 80% coverage on backend integration boundaries. Strict test-driven design is requested for the OIML rule calculations moving forward.

## Suite
- Backend: `Jest` running across Express supertest modules.
- Command: `npm test -w @nawi/backend`

## Writing Domain Tests
Future Phase 2 tests (MPE limits, Error offsets) must use `test.each` table-driven test configurations asserting statically mapped pass/fails against the matrices in `docs/phase-2/GOLDEN_TEST_CASES.md`.
