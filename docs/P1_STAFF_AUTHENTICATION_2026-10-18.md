# W8LAB / SIH26035 — P1 staff authentication and RBAC

Implemented and verified locally on 18 October 2026. This report describes persisted laboratory staff authentication, provisioning and revocable sessions. It does **not** claim production hardening, accredited certification or full OIML compliance. The next metrology modules were not implemented.

## Inspection and security findings

The applicable README, project context, P0 verification and confirmed laboratory review policy were inspected, along with auth routes/middleware, account persistence, frontend sessions, staff workflows and Business regressions. No applicable AGENTS.md was found. Existing staged/uncommitted work was preserved. No branch change, pull, reset, stash, commit, push, merge, deployment, record reset or database migration occurred.

The prior staff path accepted one source-code demo password, selected Technician/Reviewer/Administrator from email text and issued signed tokens without persistent staff accounts. Middleware checked an account for Business only; staff claims were accepted without a stored staff identity. Browser logout deleted localStorage but did not revoke credentials. The signing configuration had a public source fallback. Login prefilled credentials and its role cards changed the email. These weaknesses were identified before implementation; the proposed replacement was communicated before editing: persisted staff identities, explicit provisioning, live account/session authorization and operator-only initial bootstrap.

## Architecture and decisions

### Accounts and passwords

- Existing JSON architecture retained. `staffAccounts.json` is a separate strict-persistence collection; existing Business `accounts.json`, laboratory collections, historical IDs and reports are not migrated or overwritten.
- Staff roles are exactly Technician, Reviewer and Administrator at provisioning. New identities receive UUIDs and normalized, unique emails. Roles and identity fields are immutable through the update API; changing a staff member's role later requires a separately authorized policy rather than silently changing historical permissions.
- Passwords are 12–128 characters and salted with 16 random bytes. Asynchronous Node scrypt uses N=131072, r=8, p=1, a 64-byte derived key and timing-safe verification. The work parameters are encoded with the hash; verification accepts only the supported format. Unknown/malformed staff identities still perform the KDF. This follows the scrypt option in [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); no new cryptographic dependency was introduced.
- Password/hash, credential version and private security history are excluded from staff API responses. Validation/login errors never echo password values. Wrong-password and inactive-account login responses are the same generic HTTP 401.
- Administrator-only provisioning, name updates, active/inactive changes, password reset and revoke-all are implemented. Self-deactivation and deactivation of the last active Administrator are blocked. Accounts are deactivated, never deleted by the API. Provision/reset/activation/revocation history is retained inside the same persisted staff object without password/token contents.
- Duplicate checks run again after the asynchronous KDF, preventing overlapping requests from creating duplicate emails within the supported single backend process. Staff/Business email collisions are rejected.

### Sessions and signing

- Existing eight-hour Bearer transport is retained for architectural compatibility. JWTs use HS256, issuer `W8LAB`, audience `W8LAB-web`, expiry and a fresh cryptographically random session ID. Only a SHA-256 digest of that session ID is stored in `sessions.json`; raw JWTs are not stored server-side.
- Every protected request verifies the signature/expiry and resolves the persisted session and current active account. Account ID, role, email, session expiry/revocation and credential version must match. The backend uses the stored identity, not client role payloads. JWT signatures alone no longer authorize access.
- Password reset, activation/deactivation and Administrator revoke-all advance the persisted credential version, invalidating previous staff sessions without a multi-file transaction. Reactivation never revives old tokens. Logout durably revokes the current session; other legitimate sessions remain valid unless revoke-all is requested. This implements server-side invalidation described in [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- Failed session persistence returns HTTP 503 without a usable login token. Failed logout reports failure and permits retry rather than falsely claiming revocation. Strict writes roll back the in-memory change if the write fails.
- Production requires a private `JWT_SECRET` of at least 32 characters and rejects the old public fallback and example placeholder. Local development without an explicit secret creates a private, durable random signing key in ignored `DATA_DIR/authSecrets.json`; it is never returned by APIs. Existing explicit private configuration is not overwritten.
- **Pre-P1 tokens are intentionally invalidated** because they have no server session. Staff and Business users must sign in again; their accounts, passwords and records remain intact. Business account schema/hashes and application functionality were not changed. New Business logins use the same revocation-backed session infrastructure.
- Login attempts have bounded, in-memory per-IP and per-normalized-email limits (100/IP and 20/email in 15 minutes), HTTP 429 and Retry-After. These are single-process protections, not a distributed anti-abuse system. Auth and protected successful responses use `Cache-Control: no-store`.

### Legacy identity preservation

Normal login never derives a role or ID from email text. New staff default to UUIDs. An authorized Administrator may explicitly select `adoptLegacyIdentity` when provisioning a verified, recognized legacy person. The retained historical lookup computes the prior stable ID and verifies recognition by the documented identity set or existing record references. It cannot accept an arbitrary client-supplied owner ID. In particular, the original technician can retain `dev-user-01` without rewriting records. Recognized staff emails remain reserved against Business self-registration.

No automatic recovery of unknown people, ownership reassignment, creation of accounts for arbitrary historical actor IDs, or inferred role migration was attempted. The operator must verify the person and select their role. A new UUID account does not automatically gain access to an old technician's records.

### Permissions and P0 preserved

The confirmed policy is unchanged: owning Technician enters/corrects assigned cases during TESTING; Reviewer and Administrator may claim eligible review records, return them with a reason and approve only their assigned non-self cases. There is no Administrator assignment takeover. Staff management adds no laboratory approval override. Existing record, observation, evidence, audit and data/HTML/PDF report access checks remain active.

All 49 P0 regression tests remain in the full passing suite. No calculation formula, unit normalization rule, MPE table, lifecycle state or completeness rule was changed in P1. Native incomplete/undetermined programmes still cannot receive final approval or a false overall PASS/FINAL report. Browser tests assert rejection; they do not fabricate complete programmes to bypass the safety gate.

## API and frontend

All paths below are relative to `/api/v1`.

| Endpoint | Policy |
| --- | --- |
| `POST /auth/login` | Persisted active account/password only; accepts email/password, rejects role/ID/security-field payloads. |
| `GET /auth/me` | Authoritative current account/session; no credential fields. |
| `POST /auth/logout` | Revokes the current authenticated session. |
| `GET /staff` | Administrator only; sanitized staff list. |
| `POST /staff` | Administrator only; name/email/password/explicit staff role, optional verified legacy adoption. Rejects arbitrary IDs, hashes, active flags and version fields. |
| `PATCH /staff/:id` | Administrator only; name, active and/or password. Role/email/ID/version immutable. |
| `POST /staff/:id/revoke-sessions` | Administrator only; invalidates previous sessions by version. |

There is no public bootstrap, staff registration, delete-account, role-escalation or approval-override endpoint. Existing Business self-registration remains Business-only.

The installed `emil-design-eng` skill was read and used; no new prototype or global redesign was introduced.

| Before | After | Why |
| --- | --- | --- |
| Prefilled demo password and clickable email-changing role cards | Blank credentials, static role descriptions, administrator-provisioned account guidance | The UI cannot imply a user-selected authority. |
| Local-only logout | Confirmed backend revocation, pending guard and retryable outage feedback | Clearing browser state is not server invalidation. |
| Layout trusted decoded local token hints alone | Authoritative `/me` validation, periodic/focus/navigation refresh, 401 invalidation | Stored account and session determine access; UI hints are not authorization. |
| No staff-management screen | Administrator-only `/staff`, persistent labels, creation/activation/reset/revocation feedback | Completes account provisioning without unrelated features. |
| Initial Staff action controls were too small in visual inspection | Local page-scoped 44px targets and visible keyboard focus | Touch/keyboard usability, without changing production global styles. |

The dashboard keeps role navigation and Business isolation. Non-Administrators cannot render Staff controls, and API requests are independently rejected. The layout revalidates on navigation, focus, pageshow and every 60 seconds; revoked credentials are rejected immediately by the backend, even before a passive tab refreshes. Offline verification fails closed with Retry. Emails/form values survive failed requests; synchronous guards prevent overlapping staff creation and logout. Password fields use proper autocomplete and clear after a confirmed save.

## Manual setup

**No main-dataset staff account or reusable password was auto-created.** The main backend now runs P1, so old demo credentials no longer work. An operator must create the first Administrator using private credentials. This is expected setup, not a fallback login.

1. Stop the main backend before the offline command. Use the same working directory, DATA_DIR and signing environment that the backend will use. Never run two JSON writers against one dataset.
2. Build and bootstrap from a local PowerShell terminal. Do not paste the password into shell history, source files, screenshots or chat:

```powershell
# From the repository root; backend must be stopped.
npm.cmd run build --workspace backend
Set-Location backend
$env:W8LAB_BOOTSTRAP_NAME=Read-Host 'Administrator full name'
$env:W8LAB_BOOTSTRAP_EMAIL=Read-Host 'Administrator email'
$p1PrivatePassword=Read-Host 'Private password (12–128 characters)' -AsSecureString
try {
  $env:W8LAB_BOOTSTRAP_PASSWORD=[System.Net.NetworkCredential]::new('', $p1PrivatePassword).Password
  npm.cmd run staff:bootstrap
  if($LASTEXITCODE -ne 0) { throw 'Bootstrap was refused. Review the setup requirements; do not reset existing staff.' }
} finally {
  Remove-Item Env:W8LAB_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:W8LAB_BOOTSTRAP_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:W8LAB_BOOTSTRAP_EMAIL -ErrorAction SilentlyContinue
  $p1PrivatePassword.Dispose()
}
# Start from backend with the same environment/dataset:
npm.cmd start
```

The commands run bootstrap and server from `backend`, loading its existing .env consistently. Keep any custom DATA_DIR identical in both processes. The default DATA_DIR is project `data`.

If, and only if, the initial Administrator is a verified recognized legacy identity, set `W8LAB_BOOTSTRAP_ADOPT_LEGACY=1` before bootstrap and clear it afterwards. Otherwise omit it and receive a new UUID. The CLI accepts no password arguments and refuses once any staff account exists. It cannot reset an existing Administrator. Lost-Administrator recovery is not implemented as an insecure bypass.

3. Sign in at `http://127.0.0.1:3014/login`. Use **Staff accounts** to provision verified Technicians, Reviewers or another Administrator with distinct privately delivered passwords. Use explicit legacy adoption only when needed. Do not create replacements for existing Business users.
4. Protect data-directory ACLs and backups. Do not publish `authSecrets.json`, staff hashes or session storage. In production supply an independently generated private JWT_SECRET, HTTPS and managed secret storage; do not use an example placeholder. A changed signing key invalidates existing sessions.

## Files created or modified by P1

Other P0, design, branding, Business, calculations and workflow edits already existed in the dirty worktree and were preserved. They are not attributed to P1.

| Files | P1 change |
| --- | --- |
| `backend/src/services/StaffService.ts` (new) | Staff collection, explicit provisioning, KDF, active/reset/version controls and embedded private security history. |
| `backend/src/services/SessionService.ts` (new) | Persisted hashed session IDs, JWT issue/resolve, current-account validation and durable logout. |
| `backend/src/routes/staffRoutes.ts` (new) | Administrator-only list/create/update/revoke endpoints and strict field allowlists. |
| `backend/src/cli/staffBootstrap.ts` (new), `backend/package.json` | Offline first-Administrator setup using private environment input; no public/default setup. |
| `backend/src/routes/auth.routes.ts` | Remove shared-password/email-role path; persisted staff login, session issue/me/logout, collision checks and no-store. |
| `backend/src/middlewares/authResolver.ts`, `loginLimiter.ts` (new) | Resolve every identity/session, reject invalid/revoked/inactive credentials, bounded login throttling. |
| `backend/src/config/env.ts`, `backend/.env.example` | Remove public signing fallback, require safe production configuration, private local key and documented setup. |
| `backend/src/repositories/JsonStore.ts` | Load dotenv before resolving DATA_DIR so CLI/server use the configured dataset. Existing strict persistence/rollback retained. |
| `backend/src/services/DevelopmentStaffIdentity.ts` | Clarify legacy-only ownership/reservation lookup, no normal authentication use. |
| `backend/src/app.ts` | Mount protected staff routes; retain existing domain authorization and parser limit. |
| `frontend/app/(auth)/login/page.tsx` | Blank login, remove interactive role selection/dead reset/remember-me controls, useful persisted-account copy/autocomplete. |
| `frontend/app/(dashboard)/layout.tsx` | Server session verification, role-restricted Staff navigation/rendering, revoking guarded logout and retry errors. |
| `frontend/app/(dashboard)/staff/page.tsx` (new) | Actual provision/activation/reset/revoke UI, pending guards, accessible responsive local styles. |
| `frontend/lib/session.ts` (new), `laboratory.ts` | Verified session/logout helpers and clear revoked-credential handling. |
| `frontend/tests/session.test.cjs` (new) | Eight transport/state regressions; existing two runtime tests remain. |
| `backend/tests/staffAuthentication.test.ts` (new) | 53 login, hash, provisioning, role/identity, inactive/revoked/expired, persistence/failure, limiter/bootstrap/configuration cases. |
| `backend/tests/helpers/persistedIdentity.ts` (new), `helpers/developmentStaffPassword.ts` | Persisted test account/session fixtures; in-memory generated test credentials replace reading a removed source password. No authentication middleware bypass. |
| Existing backend `security`, `repository`, `reportListing`, `reportAuthorization`, `p0Integrity`, `businessAccounts`, `businessApplications`, integration `evaluationPipeline` and `laboratoryWorkflow` tests | Replace unbacked JWT fixtures with stored account/server-session fixtures; preserve prior permissions, P0 and Business assertions. No tests removed/skipped. |
| `e2e/p1-browser.cjs`, `p1-main-smoke.cjs` (new) | Managed isolated bootstrap/UI/API/security/restart verification; non-mutating main-app/cache smoke. |
| `e2e/laboratory-browser.cjs`, `p0-integrity-browser.cjs`, `local-staff-env.ps1` | Explicit per-account credentials; no source-password extraction; existing successful workflows use real login. |
| `.gitignore`, `frontend/tsconfig.browser.json` | Independent ignored `.next-p1-review` cache/types. |
| `README.md`, `PROJECT_CONTEXT.md`, `docs/LABORATORY_REVIEW_WORKFLOW.md`, this report | Actual current setup/status and security limitations; historical reports retained. |

No OIML engines, MPE thresholds, programme completeness services, domain ownership fields, finalized reports or Business application functionality were modified in P1.

## Verification results

Final commands and outcomes:

| Command (repository root unless stated) | Actual outcome |
| --- | --- |
| `npm.cmd test --workspace backend -- --runInBand --coverage=false --silent` | **325 PASS / 0 FAIL**, **18/18 suites**; all prior 272 tests plus 53 P1 cases. |
| `npm.cmd test --workspace backend -- --runInBand tests/staffAuthentication.test.ts --coverage=false --silent` | **53 PASS / 0 FAIL**, focused P1 API/service/configuration suite. |
| `npm.cmd test --workspace frontend` | **10 PASS / 0 FAIL**; eight session tests plus two preserved P0 cache tests. |
| `npx.cmd tsc --noEmit -p frontend/tsconfig.browser.json` | PASS. |
| `npm.cmd run build --workspace backend` | PASS; strict backend TypeScript production compilation. |
| `npm.cmd run build` from `frontend` with default local configuration | PASS; 16 pages, including `/staff`, and existing dynamic routes. Production server stopped before rebuilding its cache. |
| `$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:4006'; $env:W8LAB_BROWSER_BUILD_DIR='.next-p1-review'; npm.cmd run build --workspace frontend` | PASS; isolated production build used by the browser. |
| `$env:W8LAB_BROWSER_RUN_DIR=Join-Path (Get-Location) 'artifacts/browser-review/p1-20261018-final'; node e2e/p1-browser.cjs` | **22 PASS / 0 FAIL / 0 BLOCKED**. |
| Nested `node e2e/laboratory-browser.cjs` | **40 PASS / 0 FAIL / 0 BLOCKED** with distinct persisted account passwords. |
| Nested `node e2e/p0-integrity-browser.cjs` | **6 PASS / 0 FAIL / 0 BLOCKED**. |
| Nested `node e2e/instrument-submission.cjs` | **9 PASS / 0 FAIL / 0 BLOCKED**. |
| `node e2e/p1-main-smoke.cjs` | **4 PASS / 0 FAIL / 0 BLOCKED** against actual main services. |
| `git diff --check` | PASS; LF/CRLF normalization notices are not whitespace failures. |

Do not sum wrapper and nested counts: three of the 22 wrapper scenarios assert the nested runner outcomes. No unsupported old 13-report/24-Business standalone counts are reused as fresh P1 evidence. Existing Business account/application backend tests and the full browser's actual Business form regression passed without expanding that workflow.

Next prints the existing extending-tsconfig plugin recommendation despite the plugin being declared in the base config; builds/types pass. No new standalone ESLint configuration or penetration-test/cross-browser coverage is claimed. The first browser attempt was stopped after a harness locator matched Next's empty accessibility announcer; it was fixed, and final fresh isolated runs passed. Visual inspection then improved Staff touch targets and final builds/browser suites were repeated.

### Browser and local evidence

Chromium 156.0.8078.4 / Playwright 1.64.1. Real backend responses, supported CLI and actual forms; no successful-response mocking, invented browser tokens, disabled authentication or final-approval bypass. Deliberately malformed/expired/modified tokens are negative tests only.

Final ignored evidence root: `artifacts/browser-review/p1-20261018-final/`:

- `results.json`: 22 P1 scenarios; `redacted-services.log`: managed child results/logs without passwords or raw tokens.
- `staff-provisioning-desktop.png`, `staff-mobile-light.png`, `staff-mobile-dark.png`: actual UI, sensitive values masked. Light/dark at 390×844, keyboard focus/Tab, reduced-motion preference, 44px action target and no document-wide horizontal overflow checked; screenshots inspected.
- `attempt-2026-10-18T09-09-27-227Z/results.json`: 40 full laboratory scenarios, redacted console/network and saved record/history. Includes legitimate Technician/Reviewer/Administrator login, two correction cycles, stale revision, cross-user/report restrictions, false-final-approval rejection, g/kg entry, immutable legacy report downgrade, actual PDF viewer, duplicate guards and retry.
- `integrity-2026-10-18T09-10-13-184Z/results.json`: six P0 native evaluator/report scenarios. Unsupported repeatability/zero-setting remain BLOCKED and programme INCOMPLETE.
- `submission-2026-10-18T09-10-19-023Z/results.json`: nine submission/lost-response retry scenarios.
- `artifacts/browser-review/p1-20261018-main/results.json` and `login.png`: four main-app smoke scenarios, including dev compilation while production JS/CSS remain 200.

P1 additionally exercises wrong password plus successful form retry; actual Administrator provisioning with overlapping clicks; non-admin staff access rejection; misleading admin-like email retaining Technician role; forbidden payload escalation; inactive account loss of live access; reactivation not reviving tokens; password reset; revoke-all; invalid/expired/legacy credentials; offline logout retry and replay rejection; backend restart preserving valid sessions and revocation. Browser suites had **zero uncaught application exceptions and no missing application JS/CSS**. Intentional 400/401/403/409/offline responses are not misreported as unexpected failures.

The managed runner owns only its isolated 3016/4006 services and stops them afterwards. It refuses occupied ports/existing run roots and preserves previous artifacts. Original project JSON hashes were checked unchanged during isolated runs. Main startup created only its missing private local signing-key file; it did not rewrite existing accounts or domain data.

Main services left running:

- Frontend: **http://127.0.0.1:3014** (`/login`; `/staff` after Administrator setup).
- Backend: **http://127.0.0.1:4000**, health `/api/v1/health`.
- Development frontend: **http://127.0.0.1:3000**, separate `.next-dev` cache.

No main staff account was provisioned without an operator-chosen identity/password. Actual successful login/provisioning was verified on isolated data, not by adding credentials to the user's dataset.

## Remaining security limits and next mandatory phase

1. Bearer JWTs remain in localStorage and can be stolen by XSS; P1 does not supply HttpOnly-cookie/BFF architecture, MFA, password recovery/email verification, device binding or a full production identity provider. Use HTTPS and appropriate deployment controls before external exposure. Eight-hour absolute expiry is retained; inactivity timeout and refresh-token rotation are not implemented.
2. JSON persistence supports **one backend writer**. Atomic strict file replacement/rollback is not a database transaction across collections/processes. Stop the server for CLI bootstrap and do not run concurrent bootstrap operators. Filesystem/backup ACLs, encryption at rest and audited lost-Administrator recovery need operational design. Embedded security history is not tamper-proof against filesystem access.
3. Login limiting is local/in-memory and resets on process restart; distributed rate limits, proxy/IP configuration, comprehensive abuse controls and an authentication event/SIEM pipeline remain deployment work. Old Business password hashes were intentionally not migrated by this staff phase.
4. Explicit legacy adoption requires operator identity verification; unknown legacy actors are not automatically recoverable. Roles are intentionally immutable; a future role-change policy must preserve record ownership and self-review restrictions rather than directly editing data.
5. Expired/revoked session retention cleanup and long-term security-history retention/archival are not implemented. No records were deleted to hide this limitation. Passive UI can show previously loaded content until revalidation; backend access is denied immediately.
6. Chromium desktop/narrow light/dark testing is not a complete browser, screen-reader, TLS/deployment, load or penetration audit. The obsolete standalone Reports runner still requires a future legitimate complete-programme fixture; it was not weakened to permit incomplete approval.
7. P0's mandatory metrology gaps remain: proper manufacturer selection/validation, complete server-owned R76-1 applicability/sampling and missing native evaluators, followed by R76-2 standardized reporting. Native final approval stays blocked until those are verified.

**Recommended next mandatory phase:** manufacturer and instrument master-data integrity/selection, then the verified applicability/sampling/procedure modules and standardized reporting. Do not prioritize Business application expansion, payments, renewals or unrelated inspection/certificate workflows.
