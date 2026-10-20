# W8LAB — SIH26035 project context
## Project Context

The current user-facing application name is **W8LAB**; **SIH26035** remains the project identifier. The original requirements below use Automated NAWI Compliance & Reporting System (ANCRS). They describe the broader proposed system, not a checklist of completed features. Use [README](README.md) for current scope and verification.

### Persistence Phase 2B.2 — 20 October 2026 (current)

The approved PostgreSQL adapter implementation is complete locally with mocked-driver verification only. A server-side selector/factory binds all eleven repositories and their unit of work; JSON remains the explicit default and PostgreSQL never falls back to JSON. Staging/detachment/nested rollback, ordering/JSON reload representation, identity/password/session contracts, revision/owner policies, native approval gates and existing seal formulas are retained. Fresh isolated results: **822/822 backend tests in 33 suites**, **125/125 focused adapter tests** (included in the full total), **54/54 frontend tests**, all source/test TypeScript checks and `git diff --check` pass. No real database connection, query, schema/RLS migration, import, frontend change, deployment or commit occurred. Existing uncommitted Phase 2A and pool plumbing were preserved. Read the [contract/report](docs/PHASE_2B_PERSISTENCE_CONTRACT.md) before any real integration; Phase 2B.3 needs separate approval. Existing JSON rename and P4A browser blockers remain open, and full OIML compliance is not claimed. Prior phase results below are historical.

### Persistence migration Phase 2A — 20 October 2026

The approved preparation phase is implemented locally: Promise-based repository and unit-of-work ports with JSON still active, detached inputs/results, staged writes, a process-wide FIFO queue, strict application-file replacement and best-effort compensating rollback. HTTP success/export responses wait for commit; existing session and revision checks are repeated after queueing. Failed compensation blocks further adapter access until operator recovery; there is no durable journal or automatic crash recovery. No production records, signing keys, password formats, metrology formulas, lifecycle rules or report seal formats were migrated. Business functionality was preserved, not expanded. Fresh isolated baseline: 603/603 tests; final: 626/626 across 26 suites, with backend and test-source TypeScript checks passing. Real browser verification was not rerun; existing P4A/Windows `rename EPERM` blockers remain open. See [Phase 2A report and file inventory](docs/PHASE_2A_ASYNC_PERSISTENCE.md). Stop for review before Phase 2B or PostgreSQL work.

### Laboratory readiness — 19 October 2026 (partial P4A, blocked)

P4A's initial automated prerequisite gate passed freshly: 523 backend/39 frontend tests. Local opt-in `W8LAB-R76-2006-P4A-1` declarations, performance evaluations and procedure forms were then added with versioned P3-history preservation. P4A is **not complete**: repeated real-browser staff provisioning returned HTTP 503 with strict JSON `rename EPERM`. One completed managed attempt passed prior P0–P3.1 browser regressions but failed the new P4A declaration and dependent scenarios. Explicit accessible names were repaired; the fresh rerun failed at staff provisioning before acceptance. Per the requested stop rule, no authentication/storage workaround was implemented and P4A production work stopped. Main records/services were not migrated or reset. See [partial implementation, coverage and actual evidence](docs/P4A_METROLOGICAL_PERFORMANCE.md); resolve the persistence prerequisite and complete P4A verification before P4B. Native final approval remains fail-closed.

### Previous readiness — 18 October 2026 (P3.1 repair)

P3.1 fixes the P4 audit's profile enum coercion and implicit laboratory enum validation. Primitive-string validation and explicit purpose dispatch protect API construction and calculation boundaries. Persisted programmes are checked against validated profile, edition/ruleset, frozen instrument and sampling decisions; invalid history remains unchanged and is blocked from evaluation, new observation mutations and final approval. The UI explains invalid history, and authorized legacy exports remain PROTOTYPE/INCOMPLETE with original traces. The read-only `native:audit` command found no native programmes in main data and confirmed all four prior P3 cached programmes remain valid. No automatic historical repair or migration occurred.

Final verification: 523 backend tests/22 suites, 39 frontend tests, all TypeScript/build/whitespace checks passed. Chromium: P3.1 10/0/0, P3 17/0/0, P2 16/0/0, laboratory 40/0/0, P0 6/0/0, retry 9/0/0, managed wrapper 25/0/0 (not additive), main smoke 6/0/0. All four original failed prerequisite checks now pass without weaker assertions. [P3.1 report](docs/P3_1_VALIDATION_AND_DISPATCH_REPAIR.md) records paths, files, sampling rules, results, screenshots and limitations. P4A's P3 prerequisites now pass, but P4A was not implemented in this run; native final approval still awaits mandatory procedure coverage.

### Previous readiness — 18 October 2026 (P4 prerequisite audit, subsequently repaired)

P4 stopped at Step 0 under the user's explicit prerequisite rule. The existing 431 backend and 39 frontend regressions pass, but a new independent API suite has 1 passing control and 4 failing rejection checks. `validateProfile()` validates string-coerced enums but stores the original values: array-valued TYPE_EVALUATION selects verification sampling, and array-valued IN_SERVICE_INSPECTION enables zero accuracy that the declared P3 policy leaves unsupported. Existing case authentication, ownership and final-approval gates remain intact; no overall approval bypass is claimed. No P4 production implementation or P3 repair was performed. See [P4 blocker/evidence/repair report](docs/P4_COMPLETE_OIML_TEST_COVERAGE.md). Repair strict enum validation and exhaustive dispatch, rerun the P0-P3 prerequisite gate, then resume the full P4 coverage matrix and milestones.

### Previous implementation — 18 October 2026 (P3, followed by P3.1 validation repair)

P3 adds a frozen, server-owned applicability/sampling programme and native repeatability/zero-accuracy evaluation at `/test-cases/[id]/programme`. Supported calculation scope: electronic digital single-range graduated NAWIs, classes II/III/IIII with d=e. Purpose, zero-device inventory and other unknown characteristics are explicit. The matrix distinguishes REQUIRED, justified NOT APPLICABLE, UNDETERMINED and UNSUPPORTED; saved series distinguish NOT STARTED, INCOMPLETE, PASS and FAIL. Exact nominal repeat loads are a narrower supported selection, not an invented OIML tolerance.

Native repeatability uses R76-1 3.6/3.6.1 and A.4.10 (type half/full Max series, prescribed capacity-dependent counts; verification 80% series with class-dependent counts). Four separate zero mechanisms use 4.5.2/A.4.2.3.1/.2 accuracy determinations, not an aggregate claim for all zero controls. Decimal gram normalization, individual errors/spread and traceable references are persisted in existing JSON storage. Programme declarations freeze after native evidence; case ownership/revision checks, corrections/audit and review policies remain authoritative. Missing companion series cannot hide a completed failed series.

Unsupported mandatory groups still block overall PASS and final approval. Native evidence/report assembly does not establish full R76-2 coverage; no approval gate is bypassed. Existing Business/P0/P1/P2 behavior and original records are preserved. Verification: 431 backend tests/20 suites (37 native), 39 frontend tests, both TypeScript checks/builds; Chromium P3 17/0/0, laboratory 40/0/0, P0 6/0/0, retry 9/0/0, P2 16/0/0, managed wrapper 24/0/0 (not additive). See [P3 coverage, methodology, files, evidence and limitations](docs/P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md). Next is native weighing-series/zero-reference coverage, then eccentricity/tare and remaining mandatory examinations before complete R76-2 reporting.

### Previous implementation — 18 October 2026 (P2)

Manufacturer directory/create/edit/search/select and instrument details/history/registration are now implemented with real manufacturer references, independent client/server validation, exact decimal normalization to grams, declared-unit retention and derived n. Manufacturer creation permits Technician/Administrator; edits require creator Technician/Administrator; Reviewer is read-only. Instrument creation remains Technician-only, editing is creator Technician/Administrator before any linked case. Business workflows were not expanded. The [master-data API](docs/MASTER_DATA_API.md) defines current fields/permissions/errors.

New laboratory cases freeze a versioned manufacturer/instrument snapshot used by evaluation, repository/workspace, completeness assessment and reports. Linked instruments cannot change; legacy manufacturer references without snapshots block edits rather than silently changing past reports. Unreferenced manufacturers can be soft-archived, not deleted. Original data is not migrated. Class I/auxiliary/grading metadata registration is explicitly separate from evaluator support; multi-range/automatic/mechanical profiles are rejected, not certified. P0 native final approval remains blocked. See [P2 implementation and verification](docs/P2_MANUFACTURER_INSTRUMENT_MANAGEMENT.md) for commands, counts, screenshots, files and limitations. Next mandatory phase is applicability/sampling and missing native evaluations, then R76-2 report completeness.

P2 verification: 394/394 backend tests in 19 suites; 28/28 frontend tests; both TypeScript checks/builds passed. Actual Chromium: P2 16/0/0, laboratory 40/0/0, P0 integrity 6/0/0, retry 9/0/0; security/P2 wrapper 23/0/0 includes nested runner checks and is not additive; main smoke 5/0/0. No original project JSON file changed. Main production frontend/backend were restarted locally on 3014/4000; development 3000 remains available. Main staff setup still requires private operator bootstrap; isolated verification did not create main accounts.

### Previous implementation — 18 October 2026 (P1)

Staff authentication is now persisted and role-based: Technician, Reviewer and Administrator accounts use salted scrypt hashes, active controls, immutable IDs/roles and server-checked revocable eight-hour sessions. No normal demo-password or email-text role assignment remains. Only Administrators may provision/update staff or revoke their sessions. The first Administrator requires the offline `staff:bootstrap` CLI with operator-chosen private credentials, while the backend is stopped. Main project staff accounts were not auto-created. Existing Business accounts/hashes and all laboratory owner IDs remain intact; explicit verified legacy identity adoption during provisioning avoids rewriting records. All pre-P1 legacy tokens require reauthentication.

P1 keeps the JSON architecture, P0's separate frontend caches, decimal unit normalization and fail-closed final approval. No Business application features or OIML rules were implemented/changed. Backend checks: 325/325 across 18 suites, frontend 10/10, TypeScript/builds passed. Browser suites: P1 22/0/0, nested laboratory 40/0/0, P0 integrity 6/0/0, instrument retry 9/0/0; wrapper counts are not additive. [P1 implementation report](docs/P1_STAFF_AUTHENTICATION_2026-10-18.md) contains commands, setup, files, evidence and remaining security limits. Next mandatory work is manufacturer/instrument validation/selection, then complete verified applicability/sampling/native evaluations and standardized reporting. LocalStorage, single-writer JSON, deployment TLS/key/ACL management and distributed protections remain limitations, not claims of production accreditation.

### Previous implementation — 18 October 2026 (P0)

SIH26035 priorities are NAWI testing, calculation/evaluation integrity and reporting. Business verification remains a separate, preserved prototype, not the next mandatory module. P0 fixes concurrent Next dev/production cache corruption (`.next-dev` / `.next-production`), normalizes observation units independently of instrument `e` stored in grams, and blocks final approval for incomplete/undetermined applicable programmes. Current native finalization remains blocked until a server-owned applicability/sampling module and missing evaluators exist. Manufacturer/instrument/environment gaps, missing tests and BLOCKED/legacy evaluations are never implicitly PASS or N/A. Completed determined FAIL programmes remain reportable; backend contract fixtures demonstrate this without inventing native repeatability/zero metrology. Legacy APPROVED data stays unchanged; incomplete newly generated exports are PROTOTYPE / INCOMPLETE. PDF pages no longer overlap.

P0 verification: 272 backend tests / 17 suites; 2 frontend runtime tests; TypeScript and builds passed. Browser: full laboratory 40/0/0, native integrity 6/0/0, runtime/cache isolation 4/0/0, instrument retry 9/0/0. [P0 implementation report](docs/P0_STABILIZATION_2026-10-18.md) contains exact commands, files, evidence and remaining limitations. Secure staff authentication is recommended next; it was not implemented in P0. No Business expansion, data migration, record reset, commit or deployment occurred.

### Previous implementation — 17 October 2026 (historical)

The laboratory prototype supports technician-owned measurements, saved decimal evaluations, reviewer/Administrator claim, correction and approval, and authorized reports. Its calculations, lifecycle states and report guards remain unchanged by the Business application slice. Original requirements below that exclude Administrator approval or imply complete statutory coverage are historical; the implemented permission policy and limitations are documented in README.

The selected cached **Business verification prototype** now supports registration/login → `/applications` → create and submit → own list/details/history at `/applications/[id]`. Business accounts have Applications and Account navigation and no laboratory actions. Required fields are business name/address, instrument name/model/serial, class II/III/IIII, Max/Min/e/d in grams, tare-device status and the supported non-automatic/electronic/single-range profile. Ownership, timestamps, IDs, `INITIAL` type, `SUBMITTED` state and submission history are assigned by the backend. There is no draft or editing after submission in this baseline. Applications use a separate JSON collection, existing persistence, and owner-scoped retry keys.

This Business lifecycle is separate from both laboratory test cases and manufacturer/Director model approval. Officer assignment, inspection evaluation, certificates/QR, renewals, payments and notifications remain future phases. See the [application contract, changed files, commands and evidence](docs/BUSINESS_APPLICATION_SLICE_2026-10-17.md). Current completion results are 223 backend tests, 24/0/0 Business browser scenarios and 37/0/0 full laboratory browser scenarios. Historical reports retain their original blocked findings.

## Original requirements baseline (historical)

### 1. System Vision & Problem Statement
ANCRS is a secure, web-based regulatory compliance platform designed to digitize the physical testing workflows of NAWIs (e.g., retail scales, weighbridges). Currently, manual test calculations are prone to errors and lack standardized compliance evaluation. The system solves this by:
* Eliminating manual test calculation errors via a deterministic exact-precision calculation engine.
* Generating standardized, historically reproducible, and legally acceptable PDF test reports tailored for Legal Metrology.
* Preventing historical data corruption by inextricably linking past records to rule engine versions at the time of calculation.
* Enforcing strict workflows moving from Draft to Approved.

### 2. Users and User Workflows

#### 2.1. System Roles
* **Laboratory Technician:** Operates the instrument, conducts physical tests, inputs raw observations, and uploads attachments. They submit test records for review but cannot approve them or modify underlying rules.
* **Reviewing Officer:** Validates technician data, checks compliance outputs, and either grants final approval to freeze data or returns the record to the technician for corrections. They export the final PDF.
* **System Administrator:** Modifies OIML/Legal metrology rule sets and manages user roles. Excluded from processing or approving tests.

#### 2.2. End-to-End Workflow
1. **Initiation:** Manufacturer Request -> Test Case Creation.
2. **Setup:** Enter Instrument metadata (Class, Max, Min, e, d) -> Setup Lab Conditions -> Select Tests.
3. **Execution (Technician):** Add observations for specific tests (e.g., Eccentricity, Repeatability, Weighing tests).
4. **Validation (System):** System validates inputs, computes derived errors, compares against configured Rule Version based on MPE limit, and marks PASS/FAIL dynamically.
5. **Review:** Technician submits to Reviewing Officer. Record is locked to Technician.
6. **Approval:** Reviewing Officer reviews and either Returns for Correction or Approves.
7. **Finalization:** Approved record is cryptographically sealed, and a standard PDF report is generated and archived.

### 3. Functional Requirements (FR)

#### Instrument & Test Case Management
* **FR-INST-01:** System requires defining Instrument Class (I, II, III, IIII) before any test initialization.
* **FR-INST-02:** System requires Max, Min, e, and d parameters prior to test generation.
* **FR-INST-03:** Enforce logical constraints matching the active Rule Version selected.

#### Observation Entry & Validation
* **FR-OBS-01:** Provide specialized grids mapped mapped to OIML R76 tests.
* **FR-OBS-02:** Validate mandatory numeric input against mathematical invalidation (e.g., character injection in number fields).

#### Calculation Engine
* **FR-CALC-01:** Calculate Indication Error accurately based strictly on OIML Annex procedures.
* **FR-CALC-02:** Ensure absolute precision by operating natively in exact decimals, avoiding floating-point rounding deterioration.

#### Rule Engine & Compliance Evaluation
* **FR-RULE-01:** Dynamically select applicable MPE limit dynamically based on active rules.
* **FR-RULE-02:** Deliver discrete compliance states (PASS/FAIL) for individual observation rows.
* **FR-RULE-03:** Aggregate row-level compliance for overall section outcomes.

#### Review, Approval & Audit
* **FR-REV-01:** Reviewing Officers can transition states (Approved vs Returned).
* **FR-REV-02:** Freeze all raw test and evaluation data immediately upon approval.

#### Report Generation
* **FR-REP-01:** Generate comprehensive unified PDF reports (Manufacturer, Inputs, Results).
* **FR-REP-02:** Print the specific Rule Version employed on the report.
* **FR-REP-03:** Provide unique traceable document identifiers for the PDFs.

#### Rule Versioning
* **FR-VER-01:** Ensure every created Test Case is irrevocably assigned a specific Rule Version ID.

### 4. Non-Functional Requirements (NFR)
* **NFR-SEC-01 (Security):** Strict separation of duties via RBAC and hashed password/credentials.
* **NFR-PERF-01 (Performance):** Compute compliance metrics for a test suite in <2 seconds.
* **NFR-DATA-01 (Data Integrity):** Floating-point values must use explicitly exact decimal data types (BigDecimal).
* **NFR-REP-01 (Reproducibility):** Recalculating a past test record must identically reproduce results based on the historic rule settings applied initially.
* **NFR-AUD-01 (Auditability):** Every action requires UTC-timestamped, user-attributed transition logging.

### 5. Identified Screens & Modules
1. **Instrument Master / Classification Screen:** Checks instrument traits (must be NAWI), captures baseline specs.
2. **Dashboard / Test Queue:** Lists Test Cases pending draft, review, or archival.
3. **Observation Entry Grid:** Real-time data entry UI specific to OIML tests (Eccentricity, Repeatability, etc.) returning live indication error flags.
4. **Compliance Review Interface:** Transparent audit page showing applied load, derivation limits (MPE), explicit rule trace ("Calculated Error 1.8g > MPE Limit 1.5g for Class III under RuleSet v1.2").
5. **Workflow & State Management Subsystem:** Hides/Shows actions (Approve, Return, Submit) based on current state and user RBAC.
6. **Rule Generation / versioning Engine (Admin):** Interface for defining threshold rules and activating constraints.
7. **Document Management:** Preview and fetch finalized PDF tests with digital watermarking.

### 6. Scope Boundaries
* **In Scope:** Electronic NAWIs, manual observation grids, logic evaluation, versioned reports, Offline cache resilience for standard testing.
* **Out of Scope (MVP):** Automatic Weighing Instruments (AWI), IoT automation / direct serial data port pulling, AI-driven evaluation engines, extraction of legacy un-digitized data, explicit multi-interval instruments (Phase 2).
