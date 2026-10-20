# Phase 2A: asynchronous repository boundary with retained JSON storage

20 October 2026. SIH26035 / W8LAB. Implemented locally; no commit or deployment.

## Authorized scope and prerequisite

The working tree was clean at `3a18b03` before source changes. A fresh baseline ran before implementation: **603 PASS / 0 FAIL / 0 skipped, 24 suites**. These are fresh results, not the historical P4A counts substituted for a run.

Phase 2A introduces asynchronous persistence interfaces only, with object isolation, staging, process-local write serialization and failure tests. JSON remains active. No dependencies were installed, external network or Supabase accessed, SQL migrations run, or existing project data opened/modified by verification. Populated environment files and real signing keys were not read by the test runner.

Phase 2B's durable journal and PostgreSQL integration are **not implemented or authorized**. No compliance/accreditation claim follows from these changes. Existing P4A browser blockers remain open.

## Architecture and behavior

- `Repository.ts`: Promise-based read/write repository and unit-of-work contracts.
- `persistence.ts`: explicit JSON-only unit-of-work binding.
- `JsonRepository.ts`: async adapter over retained `JsonStore`; clones inputs before queueing and clones all results. Changes to returned objects, nested snapshots or original save inputs cannot change persisted state implicitly.
- `JsonUnitOfWork.ts`: transaction-local Maps in AsyncLocalStorage. Nested services join the existing context. A FIFO queue serializes reads and writes so readers do not see a partial in-process commit. Reads see a consistent snapshot and writes see their own staged changes.
- Nested write failures mark the context rollback-only, even if a caller catches the exception. Read-only contexts reject writes. Closed contexts cannot be reused by escaped asynchronous work.
- Services and routes await repository results. The HTTP wrapper buffers `json`/`send`/`end` until commit. Existing error response bodies discard staging; successful exports are withheld if their audit commit fails. Transmission errors after commit are forwarded, not misreported as a failed storage transaction.
- Session validity and expected revisions are checked again after the request leaves the queue. Existing authentication claims, password work factors/formats, IDs, role/owner policies and revision request fields remain unchanged.
- Observation/native/evidence changes share a write boundary with case revision and existing audit records. Workflow actions share a boundary with their state/revision/audit. No audit event types or lifecycle transitions are added.
- Native assessment now receives already-loaded native records explicitly. Calculations, completeness rules, MPE dispatch and final-approval restrictions remain unchanged.
- Report inputs are loaded under one context. Collection insertion order, decimal strings, snapshot resolution, seal serialization and HTML/PDF generators are retained. A regression compares the report seal with the original serialization expression.

There are eleven async application repositories: manufacturers, instruments, cases, observations, audits, native tests, evidence, Business accounts, staff accounts, sessions and existing Business applications. The twelfth JSON collection, the local signing-key configuration store, intentionally retains its existing synchronous bootstrap path. No key rotation, Supabase Auth switch or new authentication system is introduced.

## Exact persistence guarantees and limits

1. A callback rejection before commit discards staging without writing its changes.
2. Application-adapter commits now use the existing **strict** temporary-file/replacement/error path for every changed collection, including laboratory collections that previously swallowed save errors. This is an intentional integrity improvement, not a claim that existing file-replacement failures are fixed.
3. Memory is published only after all attempted collection writes succeed. A normal write failure triggers compensating writes of the previous record sets. Successful compensation restores the prior records before the queue is released.
4. If compensation fails, subsequent adapter reads and writes fail closed. An operator must inspect and recover the dataset from trusted evidence/backups before restarting service. Restarting alone is not a verified repair.
5. There is **no multi-file crash atomicity, durable journal, automatic recovery, fsync durability guarantee or exactly-once HTTP delivery**. A crash or failed compensation may leave mixed files on disk.
6. This remains a single-writer, single-process adapter with one active repository instance per collection. It does not coordinate other processes or external JSON editors. File operations and initial loading remain synchronous internally despite Promise-based interfaces. Long operations can hold the queue; throughput optimization is outside this slice.
7. Existing non-strict collection-load behavior is not repaired or silently reclassified. This phase does not establish a tamper-proof audit database, signed certificates or complete OIML coverage.
8. The real Windows `rename EPERM` issue was not independently reproduced or resolved. Synthetic injected rename failures test rollback, not the root cause of that platform issue.

## Verification

`backend/tools/test-isolated.cjs` runs the real Jest/Supertest suites from a newly created OS temporary working directory with a synthetic signing configuration and no populated `.env` path. Existing Jest storage isolation forces synthetic JSON even when a test changes NODE_ENV or DATA_DIR. It prints only counts, failed test names and diagnostic metadata, never session values or credentials. No main application service was started against project data.

| Check | Fresh result |
| --- | --- |
| Pre-change backend baseline | 603 PASS, 0 FAIL, 0 skipped; 24 suites |
| Final full backend suite | **626 PASS, 0 FAIL, 0 skipped; 26 suites** |
| New regression coverage included in full total | 16 JSON repository/UoW tests + 7 real Express API tests |
| Final focused persistence/API rerun | 23 PASS, 0 FAIL; 2 suites |
| Backend TypeScript, no emit | PASS, exit 0 |
| Backend test-source TypeScript, no emit | PASS, exit 0 |
| `git diff --check` | PASS, exit 0 |
| Browser / frontend / production builds | Not run in this backend-only phase; not implied by Jest or TypeScript |

Intermediate conversion runs exposed async fixture/assertion errors; they were corrected without removing scenarios or weakening status/authorization/completeness assertions. Existing parameterized account tokens are now resolved after awaited setup. Tests that previously inspected a live stored reference now explicitly reread persistence. Competing requests remain concurrent rather than being sequentially awaited inside Promise.all.

Commands from the repository root:

```powershell
node backend/tools/test-isolated.cjs
node backend/tools/test-isolated.cjs tests/jsonRepositories.test.ts tests/phase2aPersistenceApi.test.ts
node node_modules/typescript/bin/tsc --project backend/tsconfig.json --noEmit --incremental false
$testSources = @(rg --files backend/tests -g '*.ts')
node node_modules/typescript/bin/tsc --noEmit --strict --esModuleInterop --skipLibCheck --target es2022 --module commonjs @testSources
git diff --check
```

OS-temp evidence directories from this run:

- Baseline: `w8lab-phase2a-baseline-MHHIPj/results.json`.
- Final full run: `w8lab-phase2a-tests-SrOOGJ/results.json`.
- Final focused rerun: `w8lab-phase2a-tests-B1Y6j5/results.json`.

Regression coverage includes detached inputs/results, raw-adapter isolation, staging/read-your-writes, rejected callbacks, failed save/delete/clear and retry, second-file compensation, compensation failure/fail-closed access, nested rollback-only behavior, closed contexts, concurrent increments, queued reader isolation and legacy JSON/hash/order/reload compatibility. API tests exercise case creation, observations, correction history, competing review claims, evidence rollback/reload, report seals and failed export audit delivery. Existing authentication, Business isolation, P0 units/completeness, native/P4A calculations and protected-report tests remain in the full suite.

## Changed-file inventory

New files:

```text
backend/src/repositories/Repository.ts
backend/src/repositories/JsonRepository.ts
backend/src/repositories/JsonUnitOfWork.ts
backend/src/repositories/persistence.ts
backend/src/middlewares/withPersistence.ts
backend/tests/jsonRepositories.test.ts
backend/tests/phase2aPersistenceApi.test.ts
backend/tools/test-isolated.cjs
docs/PHASE_2A_ASYNC_PERSISTENCE.md
```

Modified source files (paths relative to `backend/src/`):

```text
cli/staffBootstrap.ts
middlewares/authResolver.ts
middlewares/testCaseAccess.ts
repositories/JsonStore.ts
repositories/index.ts
routes/auth.routes.ts
routes/businessApplicationRoutes.ts
routes/evidenceRoutes.ts
routes/instrumentRoutes.ts
routes/manufacturerRoutes.ts
routes/nativeRoutes.ts
routes/observationRoutes.ts
routes/reportRoutes.ts
routes/repositoryRoutes.ts
routes/staffRoutes.ts
routes/testCaseRoutes.ts
services/AccountService.ts
services/AuditService.ts
services/BusinessApplicationService.ts
services/DevelopmentStaffIdentity.ts
services/EvidenceService.ts
services/MasterDataService.ts
services/ProgrammeAssessment.ts
services/ReportService.ts
services/RepositoryService.ts
services/SessionService.ts
services/StaffService.ts
services/TestCaseRevision.ts
services/WorkflowService.ts
```

Modified tests (paths relative to `backend/tests/`):

```text
businessAccounts.test.ts
businessApplications.test.ts
helpers/developmentStaffPassword.ts
helpers/persistedIdentity.ts
integration/evaluationPipeline.test.ts
integration/laboratoryWorkflow.test.ts
integration/phase10.test.ts
integration/phase9.test.ts
masterData.test.ts
nativeProcedures.test.ts
nativeValidation.test.ts
p0Integrity.test.ts
performanceApi.test.ts
reportAuthorization.test.ts
reportListing.test.ts
repository.test.ts
security.test.ts
staffAuthentication.test.ts
```

Other modified documentation: `README.md`, `ARCHITECTURE.md`, `PROJECT_CONTEXT.md`. One-shot conversion tools were removed after use; only the reusable isolated runner remains. No frontend, dependency manifest/lockfile, environment, database, metrology-engine or report-renderer file was changed.

## Next step — separate approval required

Review Phase 2A's diff, callback boundaries and failure guarantees. Then decide whether to authorize Phase 2B's recoverable JSON commit journal or a separately designed PostgreSQL adapter phase. Do not assume either is approved. Before any real database integration, define transaction/connection lifecycle, database constraints/RLS, historical serialization preservation and safe copy-only import/rollback verification. Resolve the historical Windows/browser prerequisite independently; this phase does not close P4A acceptance.
