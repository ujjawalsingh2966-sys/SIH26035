# W8LAB persistence contract — Phase 2B.2

20 October 2026. Workspace: `SIH26035`, not the separate NAWI checkout.

## Status and authorization boundary

The PostgreSQL adapter is implemented and verified against a strict **fake driver only**. JSON remains the default and active persistence choice unless an operator explicitly configures otherwise. No real database connection, health check, query, schema migration, import/export, package installation, deployment, commit or staging operation was performed in this phase. Secret files and populated application data were not opened. Existing dirty Phase 2A and connection-plumbing work was preserved.

This is not a completed database migration or a claim of production readiness, RLS correctness, crash-tested PostgreSQL behavior or full OIML compliance. Do not activate `postgres` until the separately approved Phase 2B.3 prerequisites below are met. The historical JSON `rename EPERM` and P4A browser blockers remain unresolved by this work.

## Selection and construction contract

- `PERSISTENCE_ADAPTER=json` is the documented explicit default; an absent value also selects JSON. Only exact `json` and `postgres` values are accepted. Empty, unknown, padded or differently cased values fail with a fixed configuration error that does not echo the supplied value.
- The selector is server-only and does not read files, dotenv, JWT configuration or credentials.
- A factory creates all eleven repositories and their unit of work as one bundle. `getRepositories()` selects that bundle once per module/process. Changing environment selection later does not switch existing instances; there is no request-level selection or hybrid bundle.
- Existing repository imports, the five formerly service-owned stores and `persistence.ts` resolve to the same selected instances. Identity/application interfaces were moved to type modules and re-exported at their original service locations without changing their shapes.
- JSON construction retains filenames, strict-load flags, storage labels, IDs and the Phase 2A implementation. JSON selection neither imports the PostgreSQL pool nor requires `DATABASE_URL`.
- PostgreSQL configuration is validated at factory creation, but pool creation/acquisition is lazy. No startup query or schema installation is performed. Internal fake-pool injection is test infrastructure, not an HTTP option. Production uses the existing bounded, certificate-verifying pool; no TLS settings or credentials were changed.
- PostgreSQL configuration, acquisition, query, transaction or cleanup failures never instantiate JSON application stores or fall back to JSON. Missing tables are failures, not a signal to create them.
- `authSecrets.json` remains a separate local signing-configuration mechanism. It is not a twelfth application repository, and signing material is not placed in application tables. Its bootstrap behavior was not changed.

## Repository operations and representation

The existing Promise-based port remains unchanged:

```typescript
findById(id: string): Promise<T | undefined>
findAll(): Promise<T[]>
saveItem(item: T, requireDurable?: boolean): Promise<T>
deleteItem(id: string): Promise<void>
```

Reads and save results are detached. Save input is copied **before** waiting for a queued operation. A missing lookup returns `undefined`; deleting a missing ID is a no-op. Saves upsert by the original string ID; updating preserves position, while deleting/reinserting moves a record to the end. The optional durability flag remains accepted; PostgreSQL saves always use the transaction boundary and do not offer a weaker non-durable path.

The compatibility-first adapter stores ordered `JSON.stringify` text in `payload_json`, not a reconstructed `jsonb` object. Existing decimal strings, timestamps, IDs, nested key ordering, evidence base64, frozen snapshots, evaluation traces and native records are not normalized or recalculated. `storage_order` preserves collection insertion order; internal `row_version` is separate from the API's domain revision. The standard pg bigint-as-string behavior is required and validated.

### Qualified undefined/own-property behavior

During a staged transaction, `structuredClone` retains own properties whose value is `undefined`. On durable reload, legacy JSON semantics apply: object `undefined` fields disappear and undefined/holes in arrays become `null`; explicit object `null` remains present. PostgreSQL rereads deserialize durable text, whereas the existing JSON adapter may retain own-undefined fields in its published in-memory Map until restart. This is **JSON serialization/reload parity**, not a claim of identity for arbitrary non-JSON JavaScript objects at every intermediate moment.

Relevant production callers were inspected. `validatePerformance()` requires own fields but rejects an own `undefined` value as well as an absent required field; valid explicit-null declarations survive unchanged. `SessionService` checks presence of `credentialVersion`: valid staff records have a required numeric version, Business accounts omit the field and sessions use the existing zero version. Both account types and their sessions are exercised through the real authentication code. Other inspected own-key checks validate supported observation/test-type keys rather than optional persistence fields. No valid inspected caller depended on retaining an own-undefined field after reload, so no caller or validation rule was changed. If a future caller introduces that dependency, stop and review its representation contract before deployment.

Tests compare the original instrument/native fingerprint functions and report seal expressions, including native report payloads. Seal/fingerprint formulas were not edited. Invalid roots, ID mismatches, corrupted envelopes and non-representable records fail with sanitized persistence errors. Generic adapter validation does not replace existing domain validation or validate arbitrary manually imported records.

## Future physical table contract — not installed

All table identifiers come from a fixed allowlist under the proposed **private `w8lab` schema**. No request controls SQL identifiers. SQL values use positional parameters, with no named prepared statements or persistent connection-session state.

Every application table must provide `id text PRIMARY KEY`, `payload_json text NOT NULL`, `storage_order bigint NOT NULL` and `row_version bigint NOT NULL DEFAULT 1`. Future migrations must constrain positive order/version, unique order per collection and payload/envelope consistency. Relational projection columns below support future relationships/constraints/indexes; they do not replace the original payload. Optional projections use SQL NULL without adding null properties to the payload.

| Repository / existing JSON file | Proposed table | Projection columns |
| --- | --- | --- |
| `manufacturerStore` / `manufacturers.json` | `manufacturers` | `identifier_normalized`, `name_normalized`, `address_normalized` |
| `instrumentStore` / `instruments.json` | `instruments` | `manufacturer_id`, `serial_normalized` |
| `testCaseStore` / `testCases.json` | `test_cases` | `instrument_id`, `technician_id`, `reviewer_id`, `status`, `revision` |
| `observationStore` / `observations.json` | `observations` | `test_case_id`, `test_type`, `sequence` |
| `auditStore` / `audit.json` | `audit_events` | `test_case_id`, `actor_id`, `action`, `occurred_at` |
| `nativeTestStore` / `nativeTests.json` | `native_tests` | `test_case_id`, `programme_id`, `procedure_id`, `series` |
| `evidenceStore` / `evidence.json` | `evidence` | `test_case_id`, `uploaded_by` |
| `accountStore` / `accounts.json` | `business_accounts` | `email_normalized`, `active` |
| `staffStore` / `staffAccounts.json` | `staff_accounts` | `email_normalized`, `active`, `role`, `credential_version` |
| `sessionStore` / `sessions.json` | `sessions` | `account_id`, `kind`, `expires_at`, `revoked_at` |
| `businessApplicationStore` / `applications.json` | `business_applications` | `owner_id`, `submission_key`, `status` |

An additional relational registry, `identity_keys(kind, account_id, email_normalized)`, reserves normalized email across staff and Business tables. It needs a `(kind, account_id)` key and unique normalized email, and must be populated and checked during the separately reviewed import. Identity writes/deletes are staged in the same transaction as their account changes. This auxiliary registry does not create new identities, roles or authentication behavior.

The frozen manufacturer/instrument snapshot and native programme stay nested in the case payload. Existing applications retain their nested instrument and owner-scoped retry key; they are not merged with laboratory instruments/cases. Reports continue to be derived from authorized stored case/evidence/evaluation data; this phase does not invent a report table, certificate lifecycle or database signing-key table.

Relationship targets for future migrations include instrument→manufacturer, case→instrument, observations/native/evidence/audit→case, sessions→identity registry and application→Business account. Staff references and historical IDs need orphan analysis before any enforcing FK is approved. Do not silently create synthetic identities, cascade-delete evidence/history or require new generic observation-sequence uniqueness: duplicate sequences are currently permitted. Exact SQL types, deferred constraints, audit retention privileges and import handling remain Phase 2B.3 review items, not installed guarantees.

## Unit-of-work contract

1. An outer read/write acquires one client and executes one transaction; all statements use that client. Nested operations join it, see staged writes and never commit independently or create savepoints.
2. Reads load each participating collection once into a transaction-local Map. Writes modify detached staged Maps; domain callback rejection discards them before flushing. Nested write rejection marks the context rollback-only even when caught. Write-inside-read and escaped/closed contexts are rejected.
3. Outer operations are serialized locally. Across cooperating PostgreSQL workers, one fixed transaction advisory lock serializes writes; reads use its shared form. Transactions use READ COMMITTED, and collection loads occur only after obtaining the lock. This supplies consistent cross-collection reads only when **all writers honor that protocol**. It does not promise global HTTP-request FIFO ordering or protection against arbitrary external SQL.
4. SQL mutations flush only after the callback succeeds: child-first removals, then parent-first saves. All flush participants share the transaction, including revisions, audit events, evidence, sessions and the email registry. Internal old-row-version predicates must affect exactly one row for updates/deletes or the transaction fails closed as a conflict. Domain expected-revision/session checks remain inside the existing HTTP write boundary.
5. Bounds: local queue and pool acquisition each 5 seconds; lock wait 5 seconds; each statement at most 10 seconds; total application transaction work, including setup/callback/flush/COMMIT, at most 30 seconds; rollback attempt at most 5 seconds. PostgreSQL-local idle-in-transaction timeout is 15 seconds. Timers bound application waiting; they do not claim to cancel every server operation synchronously. Late acquisitions are destroyed, and unusable/uncertain clients are discarded.
6. Existing HTTP buffering is reused unchanged: terminal success is delivered only after commit; an error response discards staging. An export audit failure withholds the export and removes download headers. Route-specific status/envelope handling is preserved rather than mapping every storage error globally to 503.
7. Domain errors remain domain errors. Raw driver errors, SQL, parameter values and connection diagnostics are not retained on public persistence errors or logged by the adapter. Configuration errors are fixed messages. Existing auth/error-handler response policies are not broadened.
8. COMMIT or post-commit cleanup failure is reported conservatively as **commit unknown**; no automatic retry occurs. A failed acknowledgement does not prove rollback. A successful commit is also not exactly-once HTTP delivery: operators/clients must refresh and reconcile before retrying ambiguous operations.

The existing JSON adapter remains single-process, synchronous-file-backed internally, without a durable journal, multi-file crash atomicity, multi-writer coordination or guaranteed recovery after process loss. Its original filesystem/rename/failure tests are retained. No claim is made that the historical Windows rename problem is repaired.

## Verification performed

All backend runs use `backend/tools/test-isolated.cjs`: a fresh OS-temp working directory, synthetic signing/data settings, no real `.env`, inherited `DATABASE_*`, `PG*`, `SUPABASE_*` settings removed, and JSON forced as the baseline adapter. PostgreSQL suites explicitly inject a fake pool. The fake models the generated SQL protocol and rollback/lock scheduling; it is not a PostgreSQL server, parser, MVCC implementation, RLS policy or FK/constraint verifier.

Commands from the project root:

```powershell
node backend/tools/test-isolated.cjs
node backend/tools/test-isolated.cjs tests/persistenceContract.test.ts tests/persistenceSelection.test.ts tests/postgresRepositories.test.ts tests/postgresUnitOfWork.test.ts tests/postgresSerialization.test.ts tests/persistenceHttpCompatibility.test.ts
node backend/tools/test-isolated.cjs tests/persistenceHttpCompatibility.test.ts
node node_modules/typescript/bin/tsc --project backend/tsconfig.json --noEmit --incremental false
$testSources = @(rg --files backend/tests -g '*.ts')
node node_modules/typescript/bin/tsc --noEmit --strict --esModuleInterop --skipLibCheck --target es2022 --module commonjs @testSources
node --test frontend/tests/session.test.cjs frontend/tests/runtime-config.test.cjs frontend/tests/masterData.test.cjs frontend/tests/native.test.cjs frontend/tests/performance.test.cjs
node node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit --incremental false
git diff --check
```

Fresh pre-change baseline: **697 passed, 0 failed, 0 skipped, 27 suites**, `w8lab-phase2a-tests-AlDxfg/results.json` under the OS temp directory. A subsequent retained-regression run also passed 697/697 after construction changes. The following are fresh results, not historical phase counts substituted for execution.

| Final check | Result | OS-temp evidence where applicable |
| --- | --- | --- |
| Complete backend suite | **822 passed / 0 failed / 0 skipped; 33 suites** | `w8lab-phase2a-tests-o9KEgg/results.json` |
| Focused new adapter/contract/HTTP suites (included in full total) | **125 passed / 0 failed / 0 skipped; 6 suites** | `w8lab-phase2a-tests-jdtFz1/results.json` |
| Focused real Express + fake database HTTP suite | **15 passed / 0 failed; 1 suite** | `w8lab-phase2a-tests-bFMEAy/results.json` |
| Existing frontend unit tests | **54 passed / 0 failed / 0 skipped** | Node test output; no browser implied |
| Backend source TypeScript | PASS, exit 0 | `--noEmit --incremental false` |
| Backend test-source TypeScript | PASS, exit 0 | Explicit strict test-source command above |
| Frontend TypeScript | PASS, exit 0 | `--noEmit --incremental false` |
| `git diff --check` | PASS, native Git exit 0 | Existing LF→CRLF warnings are not whitespace failures |

Intermediate isolated run ledger (directory suffixes all refer to `w8lab-phase2a-tests-<suffix>/results.json` in OS temp):

| Run | Tests passed / failed | Suites passed / failed | Meaning |
| --- | --- | --- | --- |
| `AlDxfg` | 697 / 0 | 27 / 0 | Pre-change baseline |
| `kclH6t` | 697 / 0 | 27 / 0 | Retained JSON suites after construction changes |
| `i5rHi2` | 71 / 1 | 3 / 1 | Late-acquisition test needed promise-chain draining |
| `kPcUUf` | 104 / 1 | 5 / 1 | Native synthetic fixture lacked required declared specifications |
| `Jgxrm2` | 784 / 0 | 32 / 1 | One new suite did not compile due to test-only generic cast; not a successful full run |
| `eyxVWY` | 817 / 0 | 33 / 0 | Full suite before final added regressions |
| `Ymxkvr` | 121 / 0 | 6 / 0 | Focused suite before native/evidence and insert-acknowledgement additions |
| `bFMEAy` | 15 / 0 | 1 / 0 | Native/evidence HTTP checks included |
| `mLVzMN` | 820 / 0 | 33 / 0 | Full suite before insert-acknowledgement checks |
| `g4ejSS` | 822 / 0 | 33 / 0 | Insert safeguards verified |
| `rNaWo3` | 125 / 0 | 6 / 0 | Final focused rerun |
| `3xrDkI` | 822 / 0 | 33 / 0 | Final full rerun, including frozen factory bundles |
| `jdtFz1` | 125 / 0 | 6 / 0 | Final focused rerun, including no-process browser-like VM selector rejection |
| `o9KEgg` | 822 / 0 | 33 / 0 | Final full rerun after the server-only guard qualification |

Early TypeScript checks caught and corrected a factory generic-inference issue and new fake/test fixture typing issues; final source and strict test checks pass. An initial shell invocation that suppressed Git's CRLF warnings returned shell exit 1 despite native Git exit 0; an explicit captured native-exit check confirmed `git diff --check` succeeds. No warning was suppressed by changing repository line-ending configuration. No test was removed, skipped or weakened to obtain the final results.

Coverage includes both adapter contracts, all eleven mapping/CRUD paths, detached values, insertion/reinsert ordering, read-your-writes, nesting/rollback-only, stale row versions, fake cross-worker locking, acquisition/setup/query/flush/commit/rollback/release failures, transaction deadline and late acquisition cleanup. Real Express/Supertest compatibility checks use actual KDF/JWT/session logic, staff/Business login, invalid/inactive/expired/revoked credentials, role escalation restrictions, cross-user access, competing reviewer revisions, unit normalization, incomplete/native approval gates, reportable synthetic complete FAIL, native evidence/audit rollback, evidence-upload rollback, report seals, export authorization/audit failure and commit-before-response.

Intermediate new-test runs exposed a late-acquisition assertion that needed its promise chain drained, an incomplete synthetic native instrument, a test-only generic typing error and an undefined-rejection handling edge in the new unit of work. They were corrected without changing domain rules or weakening existing assertions. The first isolated baseline invocation was blocked by sandbox subprocess EPERM before tests executed; the authorized local subprocess rerun passed. That is not a reproduction or repair of the separate JSON rename EPERM problem.

No real browser or real PostgreSQL integration was run. No production build was needed for this backend persistence-boundary phase; TypeScript checks do not imply a browser or database integration result. No frontend file was edited. Existing P4A blockers remain open.

## Exact change inventory for this phase

New production files (relative to `backend/src`):

```text
config/persistence.ts
types/identity.ts
types/businessApplication.ts
repositories/RepositoryBundle.ts
repositories/createRepositories.ts
repositories/createJsonRepositories.ts
repositories/PersistenceError.ts
repositories/postgres/PostgresRepository.ts
repositories/postgres/PostgresUnitOfWork.ts
repositories/postgres/mappings.ts
repositories/postgres/serialization.ts
```

Modified production construction/type-export files: `repositories/index.ts`, `repositories/persistence.ts`, and `services/{AccountService,StaffService,SessionService,EvidenceService,BusinessApplicationService}.ts`. Service business-function bodies and domain rules were not rewritten for the adapter.

New tests: `helpers/fakePg.ts`, `helpers/persistenceFixtures.ts`, `persistenceContract.test.ts`, `persistenceSelection.test.ts`, `postgresRepositories.test.ts`, `postgresUnitOfWork.test.ts`, `postgresSerialization.test.ts`, `persistenceHttpCompatibility.test.ts` (relative to `backend/tests`).

Existing JSON fixture calls were adjusted to the test-only `clearRepository` helper in fourteen files: `businessAccounts`, `businessApplications`, `masterData`, `nativeProcedures`, `nativeValidation`, `p0Integrity`, `phase2aPersistenceApi`, `reportAuthorization`, `reportListing`, `repository`, `security`, `staffAuthentication`, `integration/evaluationPipeline`, `integration/laboratoryWorkflow` (each `.test.ts`). This retains the JSON clear/filesystem failure path without adding `clear` to the production repository port or casting application stores to a concrete adapter.

Other changes: the isolated runner's environment scrub; placeholder-only default selection comments in `backend/.env.example`; `README.md`, `ARCHITECTURE.md`, `PROJECT_CONTEXT.md` and this contract report. Existing dependency manifests/lockfile, JSON implementation, pool/config plumbing, routes/middleware, metrology/workflow/report logic, frontend and historical reports are preserved from the starting snapshot. Aggregate `git diff` also contains pre-existing Phase 2A/plumbing work and must not be mistaken for this phase's changes alone.

Phase-only inventory: **20 new files and 26 updated existing files**, including documentation and fixture adjustments. SHA-256 comparison against the 318-file pre-change source/test/documentation snapshot identified only those 26 expected updated files; **292 captured files were unchanged**. In particular, existing JSON implementations, authentication middleware/routes, calculation/compliance/workflow/report implementations, pool/config plumbing, frontend and manifest/lockfile work were not rewritten. This comparison does not claim to have opened or audited secret files or populated data; those were excluded deliberately.

The complete phase-only source/test/documentation changes were reviewed. A supplemental scan of these 46 files found no obvious private-key, literal JWT, credentialed PostgreSQL-URL or Supabase-secret-key patterns; new files also passed an explicit trailing-whitespace scan because untracked files are not included by `git diff --check`. Pattern scanning is not a comprehensive security audit. The installed Supabase and PostgreSQL best-practice skills informed client-bound transaction handling, parameterized SQL, bounded waits and the least-privilege/RLS prerequisites; they were not used to connect to Supabase or change the database.

## Phase 2B.3 prerequisites — separate approval required

- Approve reviewed DDL/schema versioning, constraints, normalized identity registry and import projection validation; no adapter-driven auto-migration.
- Define a least-privilege non-owner runtime database role, schema/table grants and RLS/force-RLS strategy. Reused application JWTs do **not** automatically set PostgreSQL/Supabase claims. No service-role or owner credential should be treated as an RLS boundary. Keep `w8lab` out of exposed Data API schemas and retain Express authorization. Validate connection-pooler grants and policy behavior with a dedicated test role; these are not implemented here.
- Decide how append-only audit privileges/triggers and immutable evidence/history will coexist with generic repository compatibility and non-destructive import/maintenance. This phase's generic audit adapter preserves existing upsert/delete semantics; it does not establish a tamper-proof ledger.
- Obtain explicit approval before connecting to any real database, running SQL/migrations, inspecting/importing populated JSON or changing an environment selector. Use a disposable database and sanitized synthetic fixtures first, with real SQL syntax, timeouts, locks, constraints, disconnects/ambiguous commit, RLS and multi-process tests.
- Design copy-only, resumable import/reconciliation with trusted backups and a manifest. Preserve IDs, password hashes/credential versions, timestamps, collection/key order, evidence bytes, stored evaluations and original seal inputs. Check orphans, duplicates, registry uniqueness and payload/projection equality without normalizing old report inputs or inventing users.
- Prove seal/fingerprint/row-count parity and full authorized API/browser workflows against the real test database. Define cutover freeze, schema availability checks and a maintenance window. Never dual-write implicitly.
- Approve rollback: keep JSON originals untouched and compare manifests before cutover; once PostgreSQL accepts new writes, switching back to old JSON is **not** a lossless rollback. Define reconciliation/reverse-copy approval before reopening traffic.
- Load-test the coarse cooperative advisory lock and whole-collection reads. They favor contract fidelity, not high throughput. RLS must not silently filter a collection into a partial state that the adapter mistakes for the complete repository. Non-cooperating SQL writers and independent backend bundles are outside the concurrency contract.
- Review serverless execution duration, per-instance pool limits/total connection budget, warm-instance lifecycle and private JWT/TLS/key management for deployment. A bounded `pg` pool alone is not a Vercel deployment.

Stop after local Phase 2B.2 review. Do not automatically proceed to Phase 2B.3.
