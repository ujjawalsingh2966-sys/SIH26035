# Business application blocker investigation — 2026-10-16

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Follow-up: the user subsequently selected **Use cached Business verification prototype** as an additional, separate workflow and approved rejecting known staff-email collisions. The [Business accounts slice](BUSINESS_ACCOUNTS_SLICE_2026-10-16.md) now implements its registration/login foundation only. The account-absence findings below describe the investigation-time checkout; application UI/APIs remain absent and the application-form scenario remains BLOCKED.

The business application scenario remains **BLOCKED**. Its UI, backend API and business-account foundation are absent from the current working tree. A separate prototype exists in locally cached later Git refs; it has not been integrated into this checkout. This is not a wrong link, alternate reachable screen, feature flag, or reviewer-account restriction that can be repaired by a small routing change.

## Workspace and investigation boundaries

- Workspace: `C:\Users\singu\New folder (2)\SIH26035`; branch `main`; HEAD `c3eac34b1f32bcdeec5b93fa5f217293cf9a8ccc`.
- No applicable `AGENTS.md` was found in the workspace, its parents through `C:\`, or nested project directories (excluding dependency/build/Git directories).
- Existing extensive tracked and untracked application changes, browser infrastructure, artifacts and records were preserved. Investigation began with read-only status, route, document and history inspection.
- No application code, configuration, runner assertions or permissions changed. This document and an ignored, read-only diagnostic script/results/screenshots were added. No branch switch, fetch/pull, merge, reset, stash, commit, push or deployment occurred.

## Evidence in the current checkout

| Area | Evidence | Conclusion |
| --- | --- | --- |
| Frontend routes | `frontend/app` contains landing, login, dashboard, instruments, instrument creation, tests, laboratory workspace and reports pages. No `applications`, `staff` or public `verify` page exists. | No hidden or alternate business screen found. |
| Navigation | `frontend/app/(dashboard)/layout.tsx`, `navItems`: Overview, Instruments, Evaluation Queue, Reports. | No mislinked Applications entry to correct. |
| Backend mounts | `backend/src/app.ts`: health, auth, manufacturers, instruments, test-cases, observations, evidence, reports, repository; unmatched paths return `Endpoint Not Found`. | No application API mounted or verification router present. |
| Accounts/roles | `backend/src/routes/auth.routes.ts` development login maps to Technician, Reviewer or Administrator; current source has no `AccountService`, account registration or staff administration endpoints. | A Business, LMO or GATC account cannot be provisioned through this checkout's supported setup. A differently named demo email does not supply those roles. |
| Persistence/model | `backend/src/types/domain.ts` describes laboratory entities; `backend/src/repositories/JsonStore.ts` supports isolated `DATA_DIR`. No business application/account/certificate service or lifecycle store is wired. | Manufacturer metadata and laboratory instruments are reusable pieces, not a business submission workflow. |
| Configuration | `backend/src/config/env.ts` configures port, environment, JWT secret and CORS; `frontend/next.config.js` selects build cache/TypeScript config; frontend fetches use `NEXT_PUBLIC_API_BASE_URL`. Source search found no business feature flag, route rewrite or middleware hiding an installed module. | Enabling a setting cannot supply the absent implementation. Actual browser requests targeted localhost backend 4002. |

The original report [scenario 37](BROWSER_VERIFICATION_2026-10-16.md) records unavailable functionality. At investigation time, `e2e/laboratory-browser.cjs:584` appends a BLOCKED result with this explanation; it does **not** attempt a business URL or business login. The latest [full-run results](../artifacts/browser-review/reports-index-20261016/full/attempt-2026-10-16T17-00-31-073Z/results.json) retain the same scenario. There was no original business-route screenshot/network reproduction; new read-only evidence below supplies that corroboration. No assertion was removed or weakened.

## Requirements versus separate implementation evidence

The current local documents establish laboratory scope:

- `PROJECT_CONTEXT.md` §§1–2 describes technician observations, Reviewing Officer review/correction/approval and reports. “Manufacturer Request -> Test Case Creation” is an initiation description, not a specified applicant-facing form.
- `docs/SRS/SRS_v0.2.md` §§2, 4 describes manual laboratory transcription, evaluation reports and the three laboratory roles. `SIH_NAWI_SRS_and_PhasePlan.md` §§1, 3, 5–6 and phases 8–14 also describe this laboratory workflow. Its certificate/report terminology and phase proposals do not establish a Business/LMO/GATC registration, assignment or renewal contract.
- `docs/phase-3/SCREEN_INVENTORY.md` lists UX-001–014 laboratory screens; no business registration or application screen is listed.
- `docs/phase-0/CRITICAL_BLOCKER_RESOLUTION.md`, blockers 4, 7 and 10, distinguishes the external applicant/Director process, an internal laboratory test report and the external model-approval certificate; it describes an independent laboratory module and manual transfer to the overarching portal. These are local project scope statements, not a new determination of current legal requirements.

The known disagreement in older documents about laboratory Administrator approval has already been resolved by the user's earlier Reviewer + Administrator decision. This investigation does not reopen or modify it. A laboratory Reviewer is not automatically an LMO/GATC field officer. Application states must remain separate from laboratory test-case states.

Local cached history provides a **different business verification prototype**, not proof that it is running or that its product choices are accepted requirements:

| Cached commit/ref | Read-only finding |
| --- | --- |
| `9e430db`, `origin/feat/verification-lifecycle` | Adds account registration, application/inspection/certificate services, application pages, staff UI, QR lookup and lifecycle integration tests. |
| `077f5de`, `origin/integrate/verification-lifecycle` | Integrates that prototype with later laboratory changes. |
| `a72f79f`, cached `origin/main` / `origin/HEAD` | Merge containing the prototype; current `main` is nine commits behind this cached ref, with merge base exactly current HEAD. No network fetch was performed; these refs do not establish the live remote's current state. |

Files inspected with `git show origin/main:<path>` include:

- `README.md`: explicitly calls the system a verification-lifecycle prototype; says its browser interaction was not performed, describes limits and keeps application inspections separate from laboratory test cases.
- `frontend/app/(dashboard)/applications/page.tsx`: `/applications`, Business-only New application form; fetches `/auth/me` and `/verification/applications`. Detail page is `applications/[id]/page.tsx`; additional routes are `/staff` and `/verify/[token]`.
- `backend/src/routes/verificationRoutes.ts`: mounted at `/api/v1/verification` on that ref; applications list/create/detail, assign, inspect, certify, reject, certificate retrieval and public certificate-token lookup.
- `backend/src/services/AccountService.ts` and `backend/src/routes/auth.routes.ts`: persisted accounts, password hashes, Business registration, Administrator-created staff and additional roles Business/LMO/GATC alongside laboratory roles.
- `backend/src/services/VerificationService.ts`: separate `SUBMITTED / SCHEDULED / INSPECTED / CERTIFIED / REJECTED` application lifecycle, owner/assignment filtering, history, prototype certificates and linked re-verification. These were code-inspected, not executed in this task.

The cached application form includes business/location information and a limited NAWI instrument profile. Its scope confirmation, supported classes, grams-based fields, inspection/test requirements and officer-entered validity dates are prototype choices, not adopted requirements for this checkout. No fields, validity periods or lab synchronization were invented or imported here.

## Implemented versus missing here

| Functionality | Current working tree | Cached later prototype |
| --- | --- | --- |
| Laboratory instruments, observation evaluation, review/correction/approval, authorized Reports | Present; latest full browser baseline passes | Also touched by integration, but current local fixes must be preserved |
| Business registration and persisted account identities | Absent | Account service, registration/login and admin bootstrap code |
| Business application form/list/details and owned records | Absent | Applications pages, router and service |
| Administrator allocation and officer appointments/inspection | Absent | Staff/assignment and assigned LMO/GATC inspection implementation |
| Public QR prototype certificate lookup and print | Absent | Public token lookup and certificate UI; explicitly prototype output |
| Renewals/re-verification and expiry reminders | Absent; laboratory `isInitialVerification` evaluation flag is not a renewal workflow | Linked application renewal and in-app reminders |

Classification: **absent from this working tree**, rather than backend-only or partly wired business functionality. Shared laboratory calculations and JSON storage exist but do not constitute that module. Copying only the application page would fail on missing accounts, authenticated APIs and storage; integrating all cached commits would exceed this task and intersect numerous dirty files, including auth, layout, persistence and laboratory workflows.

## Actual browser verification

Reused the already running local frontend **http://127.0.0.1:3011** and backend **http://127.0.0.1:4002**. Local listening/process information tied services to this workspace. No server was restarted. Prior documented isolation was corroborated by matching the real Reviewer repository API's approved IDs against `artifacts/browser-review/reports-index-20261016/full/data/testCases.json` (two approved records), not by creating or editing data. Both this isolated directory and project `data` JSON hashes were unchanged after the probe. No deployed requests, response mocks or fake successful APIs were used.

Tooling: Playwright **1.64.1**, Chromium **156.0.8078.4**, headless desktop, actual login forms and backend. Supported local account credentials were read at runtime from the existing setup guide; no credentials, JWTs or saved sessions were logged. External origins were blocked. The Business role itself cannot be tested because its supported setup is absent.

| Diagnostic | Result |
| --- | --- |
| Technician `/applications`, refresh, authenticated `/api/v1/verification/applications`; no Applications navigation | Confirmed absent: HTTP 404 / 404 |
| Reviewer same checks | Confirmed absent: HTTP 404 / 404 |
| Administrator same checks | Confirmed absent: HTTP 404 / 404 |
| Real backend health and approved IDs match existing isolated saved records | PASS |
| `/api/v1/auth/me` and `/api/v1/auth/staff`, authenticated Administrator | Both HTTP 404 |
| Prototype `/staff`, `/verify/discovery-token` frontend paths and public-certificate API path | HTTP 404; placeholder token used only to corroborate absent route, not test certificate validity |
| Project and isolated JSON record hashes unchanged | PASS |
| Business form interaction/submission | **BLOCKED — UI, APIs and Business account support absent** |

The probe's eight successful **diagnostic assertions confirm the absence**; they are not eight completed business workflow scenarios and do not convert the BLOCKED scenario to PASS.

Evidence: [JSON results and request/status log](../artifacts/browser-review/business-discovery-20261016/probe-2026-10-16T17-18-07-190Z/results.json), [Technician 404](../artifacts/browser-review/business-discovery-20261016/probe-2026-10-16T17-18-07-190Z/technician-applications-404.png), [Reviewer 404](../artifacts/browser-review/business-discovery-20261016/probe-2026-10-16T17-18-07-190Z/reviewer-applications-404.png), [Administrator 404](../artifacts/browser-review/business-discovery-20261016/probe-2026-10-16T17-18-07-190Z/administrator-applications-404.png), [Administrator navigation](../artifacts/browser-review/business-discovery-20261016/probe-2026-10-16T17-18-07-190Z/administrator-navigation.png). Masked navigation screenshots for the other roles are beside these files.

Exact focused command:

```powershell
node artifacts/browser-review/business-discovery-20261016/probe.cjs
```

Result: exit 0, eight diagnostic assertions passed, business scenario retained as BLOCKED. Browser execution required the normal Windows sandbox escalation for local Chromium/process access. Initial sandboxed process inspection returned `Access denied`; read-only inspection succeeded with escalation. No setup blocker remains for the diagnostic browser run.

The full runner was **not rerun**: no application or runner fix was made. Builds and backend suites were also not rerun for this investigation/documentation-only result. The latest actual full result remains **36 PASS / 0 FAIL / 1 BLOCKED**, from the linked prior Reports run; these are not newly executed full-suite counts. `git diff --check` is the final whitespace validation for this task.

## Smallest next implementation task and scope question

Recommended first implementation slice, **if the cached business verification scope is chosen**: add Business registration/login with stable persisted account identities and focused authentication/ownership regressions, using the cached account implementation as a reference while explicitly preserving current laboratory identities, access guards and test storage. Do not add application allocation, officer inspection, QR certificates, validity/renewal policy or synchronize laboratory records in that slice. The business form depends on this missing identity foundation; a navigation-only change cannot unblock it.

One requirement decision is needed before that implementation: should the new business module follow the cached **Business → Administrator assignment → LMO/GATC verification prototype**, or the current documents' **manufacturer model-approval request / external Director process**? These are different workflows and must not be silently combined. The user requested that this question be repeated and then selected **“Decide after reviewing the investigation.”** That latest answer leaves the baseline undecided and supersedes the earlier manufacturer-workflow selection. No implementation is authorized by this investigation. Registration/application field contracts and subsequent officer/certificate policy must be specified for the chosen scope before their own implementation tasks. The cached-prototype implementation slice above is conditional, not a decision to adopt that scope.

All existing laboratory and Reports fixes remain untouched. Successful laboratory browser scenarios do not establish completion of the broader business project.
