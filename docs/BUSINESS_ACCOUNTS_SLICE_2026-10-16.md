# Business accounts prototype slice — 2026-10-16

Publication note: raw browser artifacts linked below are retained locally and excluded from Git. See the [published verification summary](verification/2026-10-16/SNAPSHOT_VERIFICATION.md) for selected redacted evidence and fresh snapshot checks. Account-import snippets now use the local demo environment loader instead of publishing passwords.

Implemented Business self-registration, login, session reload and logout in the existing local application. The user selected the **cached Business verification prototype** as an additional workflow, separate from manufacturer model approval and laboratory test-case states. Only its account foundation was extracted; applications, assignments, inspections, QR certificates and renewals remain unimplemented.

Workspace: `C:\Users\singu\New folder (2)\SIH26035`, branch `main`, HEAD `c3eac34`. Applicable instruction discovery found no `AGENTS.md`. Existing dirty source, tests, artifacts and records were preserved. Cached Git objects were read with `git show`; no commits were restored/cherry-picked, and no branch switch, pull, reset, stash, commit, push, merge or deployment occurred.

## Implementation and decisions

The cached `origin/main` account service/auth routes at `a72f79f` (feature originally `9e430db`) provided the established fields and rules: required name (2–120 characters), email (maximum 254), password (12–128), normalized email uniqueness, random UUIDs, salted scrypt hashes and timing-safe password comparison. Those account rules were reused. Public account responses omit hashes; request validation no longer echoes or logs submitted values.

The current checkout had temporary staff demo login and signed eight-hour JWTs in localStorage, but no account registry or password hashing service. Replacing all authentication with the cached account lookup would invalidate existing laboratory identities and sessions. The extraction therefore:

- Persists **only Business** accounts in `accounts.json`, using the existing `JsonStore`/`DATA_DIR` isolation.
- Uses the shared `POST /api/v1/auth/login`, eight-hour HS256 JWT and `nawi_token` session key. Stored Business accounts are checked first and never fall back to demo staff authentication on a wrong password, including Business emails containing `admin`/`reviewer`.
- Keeps Technician/Reviewer/Administrator demo login, role mapping and stable IDs unchanged. No staff-account creation/management API, LMO or GATC role was added.
- Adds `POST /api/v1/auth/register`, always assigning Business server-side. Any supplied role other than Business is rejected with 403, including empty/null/array values. Extra `id`, `active` and `passwordHash` payload fields cannot override server values.
- Adds authenticated `GET /api/v1/auth/me` with `Cache-Control: no-store`. Business tokens must resolve to an active persisted account with the expected email/role. Staff sessions continue their existing validation path.
- Uses a shared staff-role boundary on all seven laboratory API mounts, then retains existing endpoint-specific roles, ownership, state and report guards. Business cannot list or mutate laboratory resources or retrieve report representations.

The user explicitly resolved the collision question: **reject known staff-email collisions**. Registration reserves the four documented staff emails and candidate emails whose existing development IDs are referenced by test-case technician/reviewer, audit actor or evidence uploader fields. Duplicate/conflict responses use the same existing-account message and never reassign ownership. The identity mapping was extracted unchanged to one helper used by staff login and collision detection.

`JsonStore` previously swallowed write errors. Its new opt-in strict mode is used for accounts only: atomic temporary-file replacement, surfaced storage failure, and memory rollback on failed account creation. Registration returns a safe 503 and can be retried after a confirmed write failure. Existing laboratory persistence defaults and the earlier Jest isolation fix were retained. Account files are not served through an HTTP static-file route.

## UI and URLs

Verified frontend: **http://127.0.0.1:3012**; backend: **http://127.0.0.1:4003**.

- `/register`: name, email address, password; associated persistent labels, password-length hint, pending/disabled controls, synchronous submission guard, validation/conflict/network feedback and preserved inputs on failure. Successful registration clears the password and offers Business sign in.
- `/business/login`: Business sign in through the shared authentication API.
- `/account`: authenticated Business account details loaded from the backend; loading/error/retry states, current-account rendering and the existing layout's logout. Business navigation contains Account; direct laboratory URLs display access denied without mounting staff forms or their requests.
- Existing `/login` links to registration and Business sign in. Logging a Business in from that shared page also leads to `/account`. Staff still land at `/dashboard`.
- The shared header Sign Out button now has an accessible name when its mobile text is hidden. Logout retains current browser-local token removal and protected-route redirect behavior.

Screenshot inspection caught low contrast in the **new** headings: a global heading color overrode inherited section text. Before correction, the registration heading painted `rgb(15,23,42)` on the same color, **1:1**. Explicit heading colors and the new shared component directory's Tailwind content path fixed the new screens without global CSS overrides. Measured registration/account heading contrast: **17.85:1 light** (`#0f172a` / white), **16.30:1 dark** (`#f1f5f9` / `#0f172a`). Focused browser assertions now enforce at least 4.5:1. Existing instrument contrast/labels/submission/retry behavior remains covered by the full runner.

## Files changed in this slice

| Files | Purpose |
| --- | --- |
| `backend/src/services/AccountService.ts` (new) | Business account model, persisted storage, hashing and safe public shape |
| `backend/src/services/DevelopmentStaffIdentity.ts` (new) | Existing staff ID mapping and approved collision policy |
| `backend/src/routes/auth.routes.ts` | Registration, Business login branch, `/me`; retain staff behavior |
| `backend/src/middlewares/authResolver.ts` | Business account/session resolution; HS256 verification |
| `backend/src/middlewares/validateRequest.ts` | Safe errors without credential values or request-body logs |
| `backend/src/repositories/JsonStore.ts` | Opt-in strict account persistence and creation rollback |
| `backend/src/app.ts` | Shared staff-only boundary on laboratory APIs |
| `backend/src/services/EvidenceService.ts` | Export the existing evidence store for staff-reference collision checks |
| `frontend/components/BusinessAccountForm.tsx` (new) | Shared Business registration/login form |
| `frontend/app/(auth)/register/page.tsx`, `frontend/app/(auth)/business/login/page.tsx` (new) | Account routes |
| `frontend/app/(dashboard)/account/page.tsx` (new) | Authenticated Business destination |
| Existing login and dashboard layout | Entry links, destination, role-separated navigation/route rendering, mobile logout label |
| `frontend/tailwind.config.ts` | Discover shared component classes |
| `.gitignore`, `frontend/tsconfig.browser.json` | Separate ignored verification build cache/types |
| `backend/tests/businessAccounts.test.ts` (new) | 47 account/persistence/permission/staff-compatibility regression cases |
| `e2e/business-accounts-browser.cjs` (new) | Real-browser account/session/permission/request-count/contrast regression |
| This document and discovery follow-up note | Scope selection, evidence, commands and limits |

Earlier local changes to report guards, observations, workflow, instrument forms and tests were retained. The existing laboratory browser runner and its BLOCKED assertion were not changed.

## Verification results

| Check | Actual result |
| --- | --- |
| Focused account + report authorization + laboratory workflow backend tests | **117 PASS**, 3 suites, exit 0 |
| Complete backend suite | **201 PASS**, 14 suites, exit 0 |
| Backend production build | PASS, exit 0 |
| Frontend no-emit TypeScript check | PASS, exit 0 |
| Final frontend production build, including its lint/type checks | PASS, exit 0 |
| New focused real-browser runner, final build | **15 PASS / 0 FAIL / 1 BLOCKED**, exit 0 |
| Existing full real-browser runner, once on final theme-corrected build | **36 PASS / 0 FAIL / 1 BLOCKED**, exit 0 |
| Browser runner syntax and `git diff --check` | PASS, exit 0 |

Focused browser cases verify registration, real validation/conflict/401/403 responses, duplicate and privileged-role rejection, documented staff-email collisions, single-request/single-saved-account rapid submission, pending controls, failure/retry, account reload, logout/protected navigation, second-account separation, staff API/page denial, light/dark narrow screens and no JavaScript exceptions. Exactly **two** Business accounts were saved by that final focused run (two intentional distinct registrations). Privileged/invalid/conflicting requests saved none. A delayed registration emitted **one** POST and persisted **one** intended account.

The full runner verifies the existing technician → review → correction → resubmission → approval workflow, Administrator approval, saved history and locks, report content/download/authorization, duplicate instrument submission, persistent labels, contrast and reviewer navigation. Its final counts remain unchanged from the previous baseline. Focused counts and full-run counts are separate suites, not a combined project-completion score.

The business application-form workflow remains **BLOCKED** because no application UI/API exists in this slice. A focused diagnostic asserting HTTP 404 is not completion of that workflow. Existing laboratory lifecycle, report formulas and approval authority were not changed.

Tooling: **Playwright 1.64.1 / Chromium 156.0.8078.4**, real browser against the built frontend and real backend. External requests were blocked. Browser credentials were generated in memory or read from the established local setup guide; no passwords, JWTs, saved login state or credential-bearing request bodies were written to screenshots/network logs. Project `data` JSON hashes remained unchanged.

Failure injection was explicit: one registration request was aborted before forwarding, and one real request was delayed by at least 700 ms while disabled-state assertions ran. No successful registration/login/API response was mocked. A backend test simulated rename failure and proved safe 503, unchanged persisted account count, memory rollback and successful retry.

Initial development attempts of the new browser runner had locator ambiguity with Next's route announcer and an inapplicable fieldset disabled assertion; one attempt ended with a response-waiter timeout. These harness issues were corrected with scoped locators and assertions on actual disabled inputs/buttons, retaining request/persistence expectations. Another attempt exposed the missing mobile logout accessible name; its subsequent unauthenticated-login assertion also failed because logout had not executed. New-heading contrast was then found by screenshot inspection and measured before fixing. Earlier attempt artifacts and datasets were preserved. Two earlier full runs passed before those final UI refinements; the table above identifies the final build's actual run.

Expected failed-request console messages for injected network failure and deliberately exercised 400/401/403/409/404 responses are retained in the focused evidence. There were no browser JavaScript exceptions. The frontend build retains the pre-existing informational warning about automatically adding the Next TypeScript plugin to an extending config; it did not fail the build.

## Evidence

Final account browser evidence: [results/network/console/colors](../artifacts/browser-review/business-accounts-20261016/verified/accounts-2026-10-16T17-43-48-967Z/results.json), [light account](../artifacts/browser-review/business-accounts-20261016/verified/accounts-2026-10-16T17-43-48-967Z/account-light.png), [dark mobile account](../artifacts/browser-review/business-accounts-20261016/verified/accounts-2026-10-16T17-43-48-967Z/account-dark-mobile.png), [populated dark mobile registration](../artifacts/browser-review/business-accounts-20261016/verified/accounts-2026-10-16T17-43-48-967Z/registration-dark-mobile-populated.png), [duplicate feedback](../artifacts/browser-review/business-accounts-20261016/verified/accounts-2026-10-16T17-43-48-967Z/duplicate-feedback.png), [mobile staff denial](../artifacts/browser-review/business-accounts-20261016/verified/accounts-2026-10-16T17-43-48-967Z/mobile-staff-denial.png), [second account without stale identity](../artifacts/browser-review/business-accounts-20261016/verified/accounts-2026-10-16T17-43-48-967Z/second-account-no-stale-identity.png).

Before-heading measurement: [computed colors](../artifacts/browser-review/business-accounts-20261016/before-new-heading-contrast.json). Earlier dark screenshots under `final/accounts-2026-10-16T17-41-03-565Z` show the heading defect before correction.

Final laboratory evidence: [results](../artifacts/browser-review/business-accounts-20261016/verified/attempt-2026-10-16T17-44-10-899Z/results.json), [network](../artifacts/browser-review/business-accounts-20261016/verified/attempt-2026-10-16T17-44-10-899Z/network.json), [console](../artifacts/browser-review/business-accounts-20261016/verified/attempt-2026-10-16T17-44-10-899Z/console.json). Downloaded PDF and screenshots are beside those files.

## Exact commands and local setup

Final isolated dataset: `artifacts/browser-review/business-accounts-20261016/verified/data`. Existing services on 3011/4002 and earlier ports were preserved. Only this task's 3012/4003 services were restarted for UI rebuilds/fresh datasets; no records were cleared. Services remain running on 3012/4003 for local review.

```powershell
npm.cmd run test --workspace backend -- --runInBand tests/businessAccounts.test.ts tests/reportAuthorization.test.ts tests/integration/laboratoryWorkflow.test.ts --coverageReporters=text-summary --coverageReporters=json
npm.cmd run test --workspace backend -- --runInBand --silent --coverageReporters=text-summary --coverageReporters=json
npm.cmd run build --workspace backend
node node_modules/typescript/bin/tsc --noEmit --incremental false -p frontend/tsconfig.browser.json

$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4003'
$env:W8LAB_BROWSER_BUILD_DIR='.next-business-accounts'
npm.cmd run build --workspace frontend
npm.cmd run start --workspace frontend -- --hostname 127.0.0.1 --port 3012
```

Backend in a separate terminal, after creating the fresh data directory:

```powershell
$env:PORT='4003'
$env:CLIENT_URL='http://127.0.0.1:3012'
$env:DATA_DIR=Join-Path (Get-Location) 'artifacts/browser-review/business-accounts-20261016/verified/data'
$env:NODE_ENV='development'
node backend/dist/index.js
```

Browser terminal:

```powershell
$env:W8LAB_BROWSER_FRONTEND='http://127.0.0.1:3012'
$env:W8LAB_BROWSER_BACKEND='http://127.0.0.1:4003'
$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/business-accounts-20261016/verified'
node e2e/business-accounts-browser.cjs

# Import the documented staff credentials without logging them.
. .\e2e\local-staff-env.ps1
node e2e/laboratory-browser.cjs
node --check e2e/business-accounts-browser.cjs
git diff --check
```

For another full run, select a new empty laboratory dataset and restart only the isolated backend with it; do not delete these records. Jest always selects temporary storage and does not touch these datasets even if `DATA_DIR` is inherited.

## Limits retained

- This remains a local prototype. Staff demo authentication is deliberately unchanged; this slice does not make it production authentication. In particular, the old fallback accepts arbitrary unregistered staff emails with the development credential. The approved collision rule can reserve documented/referenced identities, not discover every email ever used in an unrecorded demo session.
- JSON account writes and duplicate detection assume a single backend writer. Atomic replacement is not multi-process locking. Ambiguous browser delivery may mean an account was saved; retrying the same normalized email cannot create another account and returns conflict, after which the user can sign in. No password reset, email verification, distributed limiter or account migration was introduced.
- Logout clears the browser-local JWT as before; there is no server-side token revocation. Browser testing covered Chromium desktop/390px and media-based light/dark preferences, not Firefox/WebKit, native autofill, assistive technology or production deployment.
- Applications, officers, assignments, inspections, certificate issuance/public QR lookup and renewals remain absent. There is no remaining account-slice policy question; future slices need their own confirmed contracts.
