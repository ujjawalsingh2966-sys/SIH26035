# Laboratory review and correction workflow

P3 update (18 October 2026): `/test-cases/[id]/programme` provides frozen applicability/sampling and native repeatability/zero-accuracy evidence. Recorded native series must be complete before review submission; completed FAIL series may be reviewed. Unsupported mandatory programme sections continue to block final approval. Existing owner, assigned-reviewer, revision and correction policies below remain in force. See [P3 API, coverage and verification](P3_OIML_APPLICABILITY_AND_NATIVE_TESTS.md).

P2 update (18 October 2026): instrument creation now selects a real active manufacturer, validates declared units/specifications and freezes manufacturer/instrument metadata when creating a case. Instrument-wise history reuses the same case authorization below. Linked technical specifications cannot be edited. No legacy records are migrated and native finalization remains blocked by P0. See [current master-data API](MASTER_DATA_API.md) and [P2 implementation report](P2_MANUFACTURER_INSTRUMENT_MANAGEMENT.md).

Current-status note (P1, 18 October 2026): the historical demo login/setup below is obsolete. Use [persistent staff provisioning and session setup](P1_STAFF_AUTHENTICATION_2026-10-18.md); there is no demo password or email-selected role. P0 also blocks final approval for incomplete/undetermined programmes, so the historical single-row approval walkthrough is not a current approval test. The confirmed permission policy and correction/assignment rules below remain in force. Historical results are retained as historical evidence, not current claims.

Local implementation and verification notes, 16 October 2026. Workspace: `C:\Users\singu\New folder (2)\SIH26035`, branch `main`. No branch change, pull, commit, push, PR, merge or deployment was performed.

## Confirmed policy

The user resolved the conflicting local approval requirements during this task:

- **Reviewer and Administrator** can start review and approve. Both must claim the record through Start Review, be its assigned reviewer, and differ from its owning technician. There is no administrator assignment override.
- Only the owning **Technician**, during **TESTING**, may edit or delete observations. The full prior observation, including its saved evaluation, is retained in the audit event. An edit also records the replacement snapshot.
- Returning a record requires a nonblank text reason. The technician must explicitly Resume Testing before correction and resubmission.

These decisions govern this implementation where older SRS/phase documents conflict. Laboratory records remain separate from business applications and QR certificates.

## Baseline and changes

The local backend already had the six laboratory states, submission evaluation checks, reviewer assignment, latest review notes, workflow audit events, persisted calculation/rule/compliance output, repository record access rules and report-time SHA-256 output. The calculation engines, MPE tables and report seal generation were preserved.

The local frontend used obsolete state names, lacked working review/resume actions, had placeholder instrument information, and contained a placeholder frontend error calculation. Its delete button targeted an absent backend endpoint. Accounts integration was not present: the development login assigned every role the same user ID, making the existing self-review guard block normal reviewer use.

Implemented:

- Existing `/tests` queue and `/test-cases/[id]/workspace` route now use backend states. Reviewer/admin queues initially show records awaiting review; the status filter exposes other accessible records.
- Record details reuse `/api/v1/repository/records/:id` and the observations API, showing instrument metadata, laboratory conditions, available evidence, persisted E/Ec/MPE/verdicts, evaluation details and audit history.
- Start/Resume Testing, Submit, Start Review, Return for Correction and Approve are connected with role/state controls, duplicate-click protection, clear request failures and success-only state refresh.
- Reviewer feedback remains visible through repeated correction cycles; prior reasons and observation snapshots remain available in audit history.
- Observation edit/delete endpoints enforce technician ownership and TESTING. Laboratory condition changes are audited. Evidence uploads also enforce ownership and TESTING.
- Queue, observation, audit and evidence reads reuse repository record authorization. Reviewers cannot access draft/testing records; technicians cannot read another technician's record.
- Each test case has a monotonic `revision` (legacy records default to 0). All state-transition requests require `expectedRevision`; a stale version returns 409 even if a later correction cycle has reached the same state. Raw observation, laboratory-condition and evidence changes also advance the revision.
- Development login now returns distinct stable identities. `technician@example.com` keeps legacy ID `dev-user-01`; other demo emails receive distinct IDs. No records are migrated. Existing sessions should sign out and back in after restarting the backend.
- Jest always uses a new temporary data directory, including when an external NODE_ENV or DATA_DIR is configured. Non-test local servers may use DATA_DIR to run isolated manual trials. The normal data directory remains the default otherwise.

## API contract

All paths below are under `/api/v1` and require the existing Bearer token. State actions need `{ "expectedRevision": <revision read from record> }`:

| Action | Endpoint | State and actor |
| --- | --- | --- |
| Start / resume | `PUT /test-cases/:id/status` with `status: "TESTING"` | DRAFT or RETURNED_FOR_CORRECTION; owner technician |
| Submit / resubmit | `POST /test-cases/:id/workflow/submit` | TESTING; owner technician |
| Claim review | `POST /test-cases/:id/workflow/start-review` | READY_FOR_REVIEW; Reviewer/Administrator, not owner |
| Return | `POST /test-cases/:id/workflow/return` with `reason` | UNDER_REVIEW; assigned Reviewer/Administrator |
| Approve | `POST /test-cases/:id/workflow/approve` | UNDER_REVIEW; assigned Reviewer/Administrator |
| Edit observation | `PUT /observations/:observationId` | TESTING; owner technician; load, indication, additionalWeights required, unit and zeroError optional |
| Delete observation | `DELETE /observations/:observationId` | TESTING; owner technician; prior snapshot retained in audit |

Malformed input returns 400, prohibited access 403, missing records 404 and invalid/stale state transitions 409. Existing API callers of workflow/status endpoints must now include the revision. Direct resubmission from RETURNED_FOR_CORRECTION is rejected.

## Verification

Commands run from the repository root:

```powershell
npm.cmd run test --workspace backend -- --runInBand tests/integration/laboratoryWorkflow.test.ts tests/integration/phase9.test.ts tests/integration/evaluationPipeline.test.ts
npm.cmd run test --workspace backend -- --runInBand --coverageReporters=text-summary --coverageReporters=json
npm.cmd run build --workspace backend
npm.cmd run build --workspace frontend
git diff --check
```

The targeted run passed **44/44 tests**. Its default HTML coverage reporter encountered a Windows `file:` source-map path issue; the full suite uses text/JSON coverage reporters to avoid that exporter. The final full suite passed **101/101 tests across 11 suites**, with 91.96% line coverage. Backend build, frontend production build (including lint/type checks), and `git diff --check` passed. Frontend build initially hit sandbox child-process `EPERM`, then ran successfully with the required execution permission.

Regression coverage includes both permitted approval roles, two correction/resubmission cycles, server evaluation of edits, persisted audit snapshots, invalid feedback, cross-record reads/writes, locked-state mutations, missing/stale revisions, competing reviewers, repeated actions, self-review rejection, demo identities and protection of existing data during Jest runs.

Browser testing was not performed: no browser automation tool or installed Playwright package was available. HTTP regression tests exercise the Express application and real evaluation services; production compilation is not a browser workflow test.

## Isolated local walkthrough

Use two VS Code terminals in this repository. Stop any old development backend using port 4000 before starting the isolated instance. Do not use an existing project dataset for trial corrections.

Terminal 1:

```powershell
$env:DATA_DIR = Join-Path $env:TEMP ('w8lab-review-' + [guid]::NewGuid().ToString())
npm.cmd run dev --workspace backend
```

Terminal 2:

```powershell
npm.cmd run dev --workspace frontend
```

The frontend's existing `.env.local` points to `http://localhost:4000`. Open the frontend's printed URL (normally `http://localhost:3000`). Use separate browser profiles for concurrent technician/reviewer sessions, or Sign Out between role changes; the existing login token uses localStorage.

| Role | Demo email | Password |
| --- | --- | --- |
| Technician | `technician@example.com` | `<local-demo-password>` |
| Reviewer | `reviewer@example.com` | `<local-demo-password>` |
| Administrator | `admin@example.com` | `<local-demo-password>` |
| Different technician | `technician2@example.com` | `<local-demo-password>` |

Password values are intentionally omitted from publishable documentation. The local staff demo login already contains its development-only default in source; the existing login page pre-fills it. For browser tests, dot-source `e2e/local-staff-env.ps1` to load that local default without printing it. These example identities are synthetic demo fixtures, not provisioned production accounts. Business accounts now use their separately implemented persisted registration/login; see [the account slice](BUSINESS_ACCOUNTS_SLICE_2026-10-16.md).

1. Open `/login` as the technician. `/instruments/new` creates an instrument and its draft test case. Use a synthetic name/model/serial, Class III, Max `15000`, Min `100`, e `5`, d `5`; leave the four classification checkboxes checked.
2. The app opens `/test-cases/<id>/workspace`. Click **Start Testing**, save laboratory conditions, and record a WEIGHING observation: load `5000`, indication `5005`, additional weights `3`, unit `g`, zero error `0`. The backend's saved Ec should be `4.5 g`, MPE `5 g`, verdict PASS.
3. Click **Submit for Review**. Confirm READY_FOR_REVIEW and locked mutation controls.
4. Sign in as reviewer, open `/tests`, then the same record. Click **Start Review**, inspect the saved values, enter a correction reason and click **Return for Correction**.
5. Return to the owning technician. Refresh/open that record from `/tests`; verify the feedback. Click **Resume Testing**. Edit the row to indication `5000` and additional weights `2.5`; save. The backend now saves Ec `0 g`. Inspect the audit event containing the previous evaluation.
6. To test deletion, delete a row while TESTING, inspect the retained snapshot, then record a replacement observation. The submission gate rejects a record with no observations.
7. Submit again. As reviewer, refresh `/tests`, Start Review and Approve. The status is APPROVED; raw edits, deletion, evidence upload and resume remain locked on the backend.
8. Repeat with `admin@example.com` to verify the permitted administrator review path. An admin cannot take over another reviewer's claimed record. `technician2@example.com` cannot view or change the first technician's test case.
9. For a stale-tab check, retain an old reviewer workspace tab across another correction/resubmission cycle, then attempt its old action. The API rejects its revision; refresh before continuing.

## Remaining limits

- Submission validation intentionally remains: at least one observation, and all observations evaluated. It does not establish required test types, row counts, completeness of laboratory conditions, or a new approval gate for FAIL/BLOCKED verdicts. Those metrology/business rules require separate requirements.
- Authentication remains the existing development/demo mechanism, not an accounts or password-storage redesign. Nondefault historical demo emails formerly shared `dev-user-01`; no automatic ownership migration was attempted.
- The existing cryptographic output is generated when building report data. No separate persisted approval-time seal or new integrity scheme was added.
- Persistence remains the existing JSON store; database transactions and multi-process write coordination were not introduced.

## Files changed by this task

- `backend/src/middlewares/testCaseAccess.ts`
- `backend/src/repositories/JsonStore.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/evidenceRoutes.ts`
- `backend/src/routes/observationRoutes.ts`
- `backend/src/routes/testCaseRoutes.ts`
- `backend/src/services/TestCaseRevision.ts`
- `backend/src/services/WorkflowService.ts`
- `backend/src/types/domain.ts`
- `backend/tests/integration/laboratoryWorkflow.test.ts`
- `backend/tests/integration/evaluationPipeline.test.ts`
- `backend/tests/integration/phase9.test.ts`
- `backend/tests/testDataIsolation.test.ts`
- `frontend/lib/laboratory.ts`
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(dashboard)/layout.tsx`
- `frontend/app/(dashboard)/dashboard/page.tsx`
- `frontend/app/(dashboard)/tests/page.tsx`
- `frontend/app/(dashboard)/test-cases/[id]/workspace/page.tsx`
- `docs/LABORATORY_REVIEW_WORKFLOW.md`

The pre-existing instrument-form contrast changes, global mesh background/typography, Tailwind changes and workspace Link import were preserved. This task did not edit the instrument form, global CSS or Tailwind configuration.
