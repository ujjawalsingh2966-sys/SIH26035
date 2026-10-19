# Architecture & Technical Design

## P3.1 validation boundary — 18 October 2026

Native profile inputs are constructed from runtime-validated primitive enums rather than a string-coerced input cast. `nativePurposePolicy` explicitly dispatches the three supported purposes; other values cannot fall back to verification. Before native evaluation, read/assessment, review submission or approval, persisted programme validity is checked against its supported version, profile, frozen instrument fingerprint and canonical decisions. Invalid declarations are retained as history, not migrated: an authorized safe view supplies `programmeError`, INCOMPLETE/UNDETERMINED assessment and no native write controls. Generic observation mutations also reject invalid native declarations. Report headings use assessed metadata while raw saved traces remain unchanged; final status cannot become FINAL for invalid history.

Laboratory observation/evidence/status API enums require actual strings before membership checks, and direct generic evaluation checks primitive own-map keys before dispatch. `native:audit` performs an operator-scoped read-only JSON audit. Existing valid ruleset/fingerprints, metrology formulas, JSON architecture and staff/case policies remain unchanged. See [repair design, API behavior and verification](docs/P3_1_VALIDATION_AND_DISPATCH_REPAIR.md). No P4 procedures are implemented by this extension.

## Implemented P3 extension — 18 October 2026

`NativeApplicability` freezes purpose, explicit instrument characteristics, clause decisions, sampling and ruleset against the P2 case snapshot. `NativeEvaluation` evaluates prescribed repeatability series and mechanism-specific zero accuracy using existing decimal normalization/MPE support. `nativeTests.json` uses the existing strict JSON atomic-write/rollback path; programme and native revisions request durable saves without changing ordinary legacy write behavior. `NativeAssessment` feeds the existing shared final-approval/report gate, preserving completed failed series independently of incomplete programme coverage.

Authenticated `/api/v1/native/:id` routes reuse existing case RBAC and optimistic revisions. Only the owning Technician in TESTING writes native observations; programme declarations may be corrected before evidence and freeze afterwards. The `/test-cases/[id]/programme` UI provides declaration, applicability, sampling, actual observation capture and traces. Reports include frozen programme/native evidence in their data and seal; unsupported mandatory groups still block final approval. JSON remains single-writer and has no cross-collection transaction guarantee. See [P3 coverage, formulas, API and verification](docs/P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md). This extension does not establish full R76-1 or R76-2 conformity.

## Implemented architecture — P2, 18 October 2026

This current-status section takes precedence over the historical proposal below. W8LAB is a Next.js/Express local prototype with single-writer JSON persistence, not an offline PWA, database ledger, signed certification service or production-hardened deployment. P1 persisted staff/session checks and P0 fail-closed completeness remain unchanged.

`MasterDataService` owns registration validation, normalized identity checks, creator/Administrator edits, optimistic revisions and non-destructive manufacturer archive. The existing `JsonStore` strict atomic-write/rollback option now also applies to manufacturers/instruments. Existing files, IDs and records are retained with additive optional schema fields; no database migration or backfill runs.

Instrument declared decimal strings/unit are retained; canonical Max/Min/e/d are grams and n is derived. Registration support and evaluator support are separate. Class I, auxiliary and grading metadata do not authorize native testing. Existing calculation and MPE rules are unchanged.

At case creation the server deep-copies both master records into a versioned `masterDataSnapshot`. `caseMasterData()` is the shared resolver for observation evaluation, programme assessment, repository joins/detail and report output. Existing cases without snapshots continue to resolve legacy references; API edits that could change their historical metadata are blocked. Any instrument with a linked case is immutable through the registration API. Manufacturer edits may affect current catalogs but never new-case snapshots. Reports read saved observation evaluations, not recalculated readings, and include resolved metadata and provenance. See [API contract](docs/MASTER_DATA_API.md) and [P2 evidence/limitations](docs/P2_MANUFACTURER_INSTRUMENT_MANAGEMENT.md).

Catalog access remains shared among staff, while history and case/report access reuse the existing record policy. Creation remains Technician-only for instruments; manufacturer creation is Technician/Administrator; editing unlinked master records is creator Technician/Administrator. Reviewer assignment, separation of duties and native final-approval blockers are not loosened.

## Historical proposed design (not implementation claims)

## 1. High-Level Architecture Overview
To meet the stringent regulatory, mathematical, and offline-capability requirements, a separated and modular layered architecture is proposed. Considering the offline-first requirement for laboratory networks, a client-site cached Progressive Web App (PWA) backed by a mature state-machine driven backend fits the use case.

### Architecture Layers
1. **Presentation & Application Layer (Client):** 
   - A Progressive Web App (PWA) facilitating local observation caching and optimistic UI capabilities to operate during intermittent network drops.
   - Synchronizes raw entries and cached states to the central ledger upon reconnection.
2. **Business Logic & Rules Engine (Backend):**
   - Headless state machine processing REST/GraphQL inputs. 
   - Enforces decoupled testing algorithms specifically decoupled from the database layers.
3. **Cryptography & PDF Subsystem:**
   - Standalone internal service managing SHA-256 seal generation and digitally signed PDF test case printing matching standard metrology templates.
4. **Data Persistence Ledger (Database):**
   - Stores master instrument data, audit states, rules, and mathematically exact numerical representations.

## 2. Technical Constraints
* **Precision Mathematics:** Strictly no standard `float` or `double` data types are permitted for computational metrics. Backends must use arbitrarily exact implementations (e.g., `BigDecimal` in Java/C#, `decimal.js` in Node). 
* **State Immutability:** Once a record is marked `Approved`, the system must prevent all updates. It should lock at a database configuration level or intercept all ORM writes to that test case.
* **Deterministic Execution:** The Rule Engine must perform as a pure function: `eval(InputData, Rules, e, d) -> PASS/FAIL Trace`. It must be untethered from side effects.
* **Hardware Interfacing Scope:** No physical serial port or IoT integrations should be present natively in MVP.

## 3. Data Models & Storage Requirements
The application maps the following domain relations. To avoid data erosion, observation results are bound strictly to specific Rule Engine entries.

* **User:** `id`, `name`, `password_hash`, `role` (Technician, ReviewingOfficer, SystemAdmin), `lab_location`.
* **Instrument Definition:** `id`, `manufacturer`, `model`, `class` (I, II, III, IIII), `max`, `min`, `verification_scale_interval (e)`, `actual_scale_interval (d)`.
* **Rule Engine Version (Immutable):** `id`, `version_label`, `activation_date`, `deactivation_date`, `config_payload` (JSON blob of MPE matrices and parameters).
* **Test Case:** `id`, `state` (Draft/Testing/Submitted/Returned/Approved/Archived), `instrument_id`, `assigned_rule_version_id`, `environment_conditions`, `cryptographic_hash`.
* **Observation:** `id`, `test_case_id`, `test_type` (Eccentricity, Repeatability, etc.), `applied_load`, `screen_indication`, `calculated_error`, `local_compliance_result`.
* **Attachment:** `id`, `test_case_id`, `blob_uri`, `content_type`.
* **Audit Trail:** `id`, `entity_reference`, `user_id`, `timestamp`, `old_state`, `new_state`, `action_type`. (Append-only storage).

## 4. APIs, External Dependencies & Services
* **Authentication/RBAC Service:** Manages JWT creation with embedded scopes, capable of revoking/expiring session tokens reliably.
* **Mathematical Eval Service:** Independent encapsulated domain processing testing criteria on exact decimals.
* **PDF Compilation Service:** Ingests the finalized test parameters and renders legally formatted reports. 
* **Cryptographic Oracle:** An internal routine that consumes finalized observation strings and constructs SHA-256 validation seals avoiding external third-party service latency where possible. 

## 5. Security, Privacy, Offline, and Reliability Configurations
* **Offline Capabilities:** The UI shall be built to withstand laboratory deadzones. It will write observation drafts to `IndexedDB`/`localStorage` (Offline Cache) dynamically. It cannot, however, initiate the 'Submit to Reviewer' phase offline since that demands synchronized rule-checksum validation.
* **Security & Roles:** Strict separation of duties. Users cannot self-escalate authorization levels. Sessions must be short-lived.
* **Immutability & Tamper Protection:**
  - Generating an Approved record produces a `SHA-256` signature encompassing: `hash(all_raw_observations + errors + rule_version)`.
  - Background integrity triggers will periodically re-hash the ledger data; if `current_hash != stored_hash`, the database will automatically flag the test case as physically tampered/corrupted.  
* **Audit Log:** An event-sourcing style append-only mechanism to strictly track what review officer signed which test at what specific UTC instance. Ensure `Audit Trail` records cannot be traditionally deleted by the application user.
