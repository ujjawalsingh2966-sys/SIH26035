# W8LAB P4: OIML test coverage and prerequisite audit

18 October 2026. SIH26035. **Historical prerequisite audit:** its original blocker was repaired in P3.1. The subsequent [19 October P4A handoff](P4A_METROLOGICAL_PERFORMANCE.md) is partial and blocked by recurring browser staff-persistence failures; P4B/P4C/P4D have not started. This document retains the historical findings/preliminary gap inventory, not a completed P4 coverage matrix or conformity declaration.

[P3.1 repair evidence](P3_1_VALIDATION_AND_DISPATCH_REPAIR.md): all four previously failing checks now pass; full backend 523/0, frontend 39/0, focused P3.1 browser 10/0/0 and managed regression wrapper 25/0/0. Validation, exhaustive purpose dispatch and non-mutating invalid-history guards are implemented. The original findings, red-phase commands and gap inventory below are retained as historical evidence, not current claims that the defect remains unfixed.

The P4 brief explicitly requires stopping when P3 prerequisites are incomplete. Independent input-validation checks reproduced a P3 defect that the previous green regression suites did not cover. No production implementation was changed during this audit.

## Inspection and verification

Inspected the dirty worktree, README, PROJECT_CONTEXT, P3 implementation/evidence, applicability/profile types, native evaluator and assessment, authenticated native routes, role/revision checks, P2 registration, staff provisioning/login and existing tests. No applicable AGENTS.md was found in the project or direct ancestors. Previous local changes and records were preserved.

Primary references opened: [OIML R76-1:2006](https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf) and [OIML R76-2:2007](https://www.oiml.org/en/files/pdf_r/r076-2-e07.pdf). In particular, R76-1 A.4.10 distinguishes type-evaluation and verification sampling. For Max below 1000 kg, the implemented type path should prescribe two ten-reading series; a class III verification path instead uses one three-reading series. P3's deliberately narrower nominal-load support remains documented in its report; that declared limitation is not itself the newly discovered blocker.

Fresh commands and actual results:

```powershell
# Executed before adding the new prerequisite regression suite:
npm.cmd test --workspace backend -- --runInBand --coverage=false --silent --json --outputFile=../artifacts/browser-review/p4-prerequisite-results.json
# 431 PASS, 0 FAIL, 20 suites. Includes P0/P1/P2/P3, auth/RBAC,
# report authorization, workflow, unit/MPE and 37 native procedure tests.

npm.cmd test --workspace frontend
# 39 PASS, 0 FAIL. Node subprocess permission was enabled.

# New independent API regression tests:
npm.cmd test --workspace backend -- --runInBand tests/p4PrerequisiteAudit.test.ts --coverage=false --silent --json --outputFile=../artifacts/browser-review/p4-profile-audit-results.json
# 1 PASS, 4 FAIL, 5 tests in 1 suite. Exit 1 is the reproduced blocker.

git diff --check
# PASS; existing Windows line-ending advisories only.
```

The fresh existing-suite result does not make the prerequisite green: the four added checks fail. These tests retain the required HTTP 400 expectation and must not be changed to accept HTTP 200. They use disposable Jest storage, supported private-random-password Administrator bootstrap, actual Administrator staff provisioning and actual Technician password login. All API requests pass through Express authentication, case ownership and revisions. No successful response or token is fabricated, and credentials are not printed.

No fresh browser run or production build was performed after discovering the failed prerequisite. P3's previous 17 native browser scenarios and other browser evidence remain historical results, not verification of the malformed-input paths found here. No P4 UI or production-code changes require a new build at this stopping point.

Evidence files: [existing regression results](../artifacts/browser-review/p4-prerequisite-results.json), [new failing prerequisite results](../artifacts/browser-review/p4-profile-audit-results.json), [reproduction test source](../backend/tests/p4PrerequisiteAudit.test.ts).

## Confirmed blocker: profile enum coercion changes the test programme

Root cause: `validateProfile()` in `backend/src/services/NativeApplicability.ts` checks `String(input.purpose)`, `String(input.indication)` and `String(input.loadReceptor)` against supported enum strings, but returns a deep copy of the **original input**. A one-element JSON array stringifies to its contained text and passes validation. Downstream code uses strict equality against strings; the stored array then takes a different branch. TypeScript casts do not validate request JSON at runtime.

### Reproduction and actual impact

The isolated instrument is a valid P2 class III digital single-range electronic NAWI: Max=15000 g, Min=100 g, e=d=5 g. Each request creates its own Technician-owned case with a frozen P2 snapshot and uses the current revision.

| Profile value sent to PUT `/api/v1/native/:id/programme` | Required response | Actual response and consequence |
| --- | --- | --- |
| `purpose: "TYPE_EVALUATION"` | 200, two ten-reading series | Positive control passes: HALF_MAX=7500 g / 10, MAX=15000 g / 10 |
| `purpose: ["TYPE_EVALUATION"]` | 400, no saved programme/revision change | 200; array retained; EIGHTY_PERCENT=12000 g / 3 selected instead of the type programme |
| `indication: ["DIGITAL"]` | 400 | 200; array retained; applicability/native-support branching no longer reflects a valid indication enum |
| `loadReceptor: ["PLATFORM"]` | 400 | 200; array retained; receptor-dependent classification no longer uses a valid receptor enum |
| `purpose: ["IN_SERVICE_INSPECTION"]` | 400 before any evaluation | 200; array retained; ZERO_SEMI_AUTOMATIC marked REQUIRED instead of P3's explicitly UNSUPPORTED service-inspection policy |

The last test then starts TESTING through the real owner API and submits synthetic direct-zero observations L=I=0 g, additional weights=1.25 g with the required conditions/evidence. The backend returns **HTTP 200 and individual PASS**. These are clearly labeled synthetic test observations, not actual laboratory results.

This is a procedure-selection and applicability-integrity defect, not evidence that the decimal formula itself is wrong. P3's documented service-zero limitation is bypassed by the invalid purpose type. It also undermines the claimed strict profile schema and purpose-dependent sampling.

The native final-approval gate has not been loosened. Other unsupported/undetermined mandatory sections continue to block whole-programme completion; the audit does **not** demonstrate an overall PASS or FINAL approval bypass. Existing authentication/ownership tests pass. The defect requires an authenticated owning Technician; it is not an anonymous privilege-escalation finding.

### Required repair and exit criteria before P4

1. Reject non-string enum values before membership checks; never validate a coerced representation while retaining an unvalidated value. Construct a validated profile with explicit field types.
2. Make purpose-based dispatch exhaustive so unexpected stored values cannot silently fall back to verification or enable an unsupported procedure.
3. Add read/assessment protection for malformed persisted declarations, failing closed without automatically rewriting historical data or reinterpreting measurements. Inspect any affected records under an explicit remediation policy.
4. Verify HTTP 400 causes no programme, case-revision or audit mutation. Keep all four new rejection regressions and the valid-profile control.
5. Verify valid TYPE_EVALUATION still requires prescribed capacity-dependent series; valid service inspection still preserves its supported repeat-MPE context and unsupported zero policy. Re-run malformed service/type submissions and final-approval rejection.
6. Re-run backend/frontend, API, P0-P3 browser regressions, TypeScript, builds and whitespace checks. Only after this gate passes should P4A implementation begin.

No repair is claimed or implemented in this audit: the brief explicitly asks to stop and report a failed P3 prerequisite. No existing records are reset, migrated, overwritten or deleted.

## P4 milestone readiness and remaining requirements

All milestones are **NOT STARTED** pending the prerequisite repair. These are preliminary code-level gaps identified from the current P3 register and the official clause headings. They are not the full Step 1 matrix: configuration-specific observations, equipment, exact severities, acceptance criteria, chronological conditioning and R76-2 form mappings still require detailed verification before implementation.

| Milestone / procedure | R76-1 references | Current code-level status | Required next work |
| --- | --- | --- | --- |
| Existing repeatability | 3.6/3.6.1, A.4.10, A.4.4.3 | PARTIALLY_IMPLEMENTED | Normal-path calculations/series pass; malformed-purpose dispatch must be repaired before reuse |
| Existing zero accuracy | 4.5.2, A.4.2.3.1/.2 | PARTIALLY_IMPLEMENTED | Four normal mechanisms tested; enforce the declared unsupported service context |
| P4A weighing performance / initial zero | A.4.3, A.4.4.1/.3, 3.5 | PARTIALLY_IMPLEMENTED | Generic row arithmetic exists; native ascending/descending load/transition coverage and zero-error capture missing |
| P4A supplementary weighing / partial self-indication | A.4.4.2, A.4.5 | UNDETERMINED or UNSUPPORTED | Capture relevant device/range characteristics; do not infer exemptions |
| P4A eccentricity, weights/rolling loads | 3.6.2, A.4.7 | UNSUPPORTED | Receptor/support/position-specific native observations, loads, sketches, coverage and evaluation |
| P4A discrimination | 3.8, A.4.8, 8.3.3 | UNSUPPORTED when applicable | Purpose/digital-interval-dependent decision; implement prescribed load/changeover sequences; retain justified digital-verification exclusions |
| P4A sensitivity | 6.1, A.4.9 | UNSUPPORTED configuration | Non-self-indicating protocol is outside the current native digital profile; verify explicit indication attributes before declaring N/A |
| P4A zero return / creep | 3.9.4, A.4.11 | UNSUPPORTED | Chronological loaded/unloaded readings and verified time-dependent acceptance |
| P4A equilibrium | 4.4.2, A.4.12 | UNSUPPORTED | Repeated action/print/storage/stability observations and prescribed acceptance |
| P4A tilting | 3.9.1.1, A.5.1 | UNDETERMINED or UNSUPPORTED | Level indicator/tilt sensor/use configuration, reference/tilted positions and load series |
| P4A tare weighing | 4.6, A.4.6 | UNSUPPORTED when fitted | Tare type/capacity, net/gross context and prescribed series; no-tare declaration remains distinct |
| P4A warm-up | 5.3.5, A.5.2 | UNSUPPORTED | Supply-disconnection/connection timing, no-load/loaded chronological evidence |
| P4B static temperature / no-load temperature effects | 3.9.2, A.5.3.1/.2 | UNSUPPORTED | Declared range, chamber/equipment evidence, stabilization and temperature sequences |
| P4B voltage variations | 3.9.3, A.5.4.1-.4 | UNDETERMINED or UNSUPPORTED | Power-supply type/ranges and verified supply-specific severity and observations |
| P4B other relevant influences | 3.9.5 | UNDETERMINED | Configuration/use attributes and evidence-based applicable procedure selection |
| P4C electrical disturbances | 5.3.4, 5.4.3, B.3 | UNDETERMINED or UNSUPPORTED | Supply/interfaces/ports, separate disturbance configurations, equipment, severity and significant-fault evidence |
| P4C damp heat | B.2 | UNSUPPORTED | Environmental conditioning chronology and actual observations |
| P4C span stability | B.4 | UNSUPPORTED | Dated repeated determinations and conditioning/equipment evidence |
| P4C endurance | A.6 | UNDETERMINED or UNSUPPORTED | Applicability, loading cycles, chronology and before/after observations |
| P4D construction / markings | 4, 7, A.1-A.3 | UNSUPPORTED | Clause-specific unanswered/answered checklists with evidence and no inferred PASS |
| P4D electronics / software | 5, especially 5.5 | UNDETERMINED or UNSUPPORTED | Device/software/interface traits and evidence-backed examinations |
| P4D module compatibility | Annex C-G | UNDETERMINED or UNSUPPORTED | Actual module configuration, approvals and compatibility evidence |
| P4D remaining zero controls / ranges | 4.5.1, 4.5.4-.7, A.4.2.1/.2 | UNSUPPORTED | Device-specific control, range, indicator and rate evidence, separate from accuracy |
| Whole-programme completion / reporting | 8; R76-2:2007 | PARTIALLY_IMPLEMENTED | Preserve fail-closed gate, frozen history and reports; complete applicability and later official template coverage |

The current P3 engine records some explicit device/purpose-based non-applicability. None of the missing implementations above may become NOT_APPLICABLE_WITH_JUSTIFICATION merely because no observations exist. Supported native scope remains the documented limited electronic/digital/single-range graduated II/III/IIII profile with d=e; this audit does not expand it or certify its entire test programme.

## Files changed in this audit

- `backend/tests/p4PrerequisiteAudit.test.ts`: one passing control plus four failing API regressions exposing the existing defect, with actual staff login and isolated storage.
- `docs/P4_COMPLETE_OIML_TEST_COVERAGE.md`: this prerequisite report, evidence and preliminary gap inventory.
- `README.md`, `PROJECT_CONTEXT.md`, `docs/INDEX.md`: current blocked readiness and report link.
- `docs/P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md`: qualification of the earlier completion statement with this newly reproduced finding; earlier verification evidence retained.

No backend/frontend production code, calculations, persistence schema, global styles, API permissions, reports or real records were changed. No commit, push, deployment, reset, pull, stash or branch operation occurred.

Current recommendation after P3.1: the strict-profile/dispatch prerequisite repair has passed. Resume P4 with the complete configuration-specific Step 1 matrix, then independently verified P4A, P4B, P4C and P4D milestones. P3.1 did not implement P4A or establish full OIML conformity.
