# W8LAB evaluator demo: one browser profile, one 24-hour sandbox

## What the evaluator gets

- Open the landing site's **Evaluator demo** action, or open the Next.js **/login** page.
- Select **Generate / Resume Demo ID**. The backend creates a random server-side demo session with one visible ID: `W8-DEMO-…`.
- The initial role is **Lab Technician**. Switch to **Reviewing Officer** (backend role: `Reviewer`) or **System Administrator** (`Administrator`) from the application shell.
- All three role identities share the same demo sandbox and session ID; role changes don't reset the expiry.
- Every demo expires exactly 24 hours after it is created. Expired tokens are rejected even if the browser retains them.
- The demo starts with a clearly marked demonstration manufacturer, one electronic scale, and a draft test case. The evaluator can enter observations and follow the normal workflow using this sandbox.
- Demo actions never write to production account, instrument, test-case, evidence, audit or verification application stores.

## Merge review — 31 October 2026

- PR #14 is integrated against the redesigned `main`; its paper theme, responsive navigation and existing ordinary account flows are preserved.
- Browser Web Locks serialize initial demo creation across same-origin tabs; repeated starts in one tab share one pending request. The resume token is read after acquiring the lock.
- Demo launch and ordinary sign-in use the same synchronous submit guard, preventing an in-flight response from silently replacing the other session.
- The desktop sidebar can scroll so the demo role picker and sign-out remain accessible in shorter windows.
- Verified locally: 103 backend tests across 13 suites, backend TypeScript build, Next.js production build/type checking/build lint, landing TypeScript/Vite build, and `git diff --check`.
- Ten targeted client/React checks passed with mocked networking, including duplicate starts, two initial tabs, retry after failure, authenticated role switching, ordinary sign-in coexistence, role UI and error feedback.
- New API regression coverage checks observation/evidence/report namespace separation, demo staff isolation, the exact server expiry boundary and invalid signed token claims.
- JWT timestamps round up to a whole second while the server checks the original millisecond deadline. API access is tested at one millisecond before expiry and at expiry, preventing early replacement IDs without extending the session.
- These checks do not constitute live browser acceptance, cross-site cookie validation or production activation. Production stays disabled unless its backend explicitly sets `DEMO_ACCESS_ENABLED=true`; no service settings or production data are changed by this merge review.

## Technical architecture

- Backend: `POST /api/v1/auth/demo/start`, `POST /api/v1/auth/demo/switch`.
- Signed short-lived role tokens include `demo: true`, `demoId` and the role's exact demo account ID.
- The server validates the token, active session record, role and account mapping on **every** authenticated request.
- An `AsyncLocalStorage` context selects persistent JSON stores under `DATA_DIR/demo-sandboxes/<uuid>/` for demo requests only. Ordinary requests continue to use the original stores under `DATA_DIR`.
- Auth, staff, manufacturer, instrument, test, observation, evidence, audit, repository and application code all use the existing business logic; only the data namespace differs.
- A separate unscoped `demoSessions.json` tracks creation time, expiry time and the mapped three demo account IDs. The private role passwords are randomly generated and not provided to the browser.
- Expired session records and their private sandbox files are purged opportunistically when a new demo starts. Regular stores are not touched. This is not a wall-clock scheduled deletion guarantee.
- The browser keeps a signed resume token under `w8lab_demo_access` in `localStorage`, and the backend also sets a signed `HttpOnly` cookie for supported browsers. The currently selected role token is stored under the application's existing `nawi_token`.
- The ordinary `/auth/login` path cannot authenticate a demo account because it reads only the real-account store.
- There are no device fingerprints, persistent hardware IDs or MAC-address claims.

## Security and honest limitations

This is **one demo per browser profile on a best-effort basis**, not a guaranteed physical-device quota. Users who clear cookies/storage, use a private window or a different browser may obtain another ID. On browsers that support Web Locks, first-time starts in separate tabs are serialized and reuse the first saved token. Browsers without Web Locks still coalesce repeated starts in one tab; simultaneous first-time requests in separate tabs can create different sessions there. A strict real-device identity is not available to a standard web app without an additional verified identity or controlled device enrollment scheme.

The demo has **no permissions over real records** even when its selected role is Administrator. The signed role token and server-side sandbox are the security boundaries, not front-end button visibility.

**Before production:**
1. Set `DEMO_ACCESS_ENABLED=true` explicitly; production defaults to disabled.
2. Configure a secret `JWT_SECRET` with at least 32 characters, HTTPS, and the exact trusted frontend origin(s) in `CLIENT_URL`.
3. Configure a **persistent, nonpublic** `DATA_DIR` and backup/retention policy. If storage is ephemeral or per instance, 24-hour resume cannot be guaranteed across restarts or replicas. Run one backend instance or move the demo session registry and sandbox storage to a shared database/filesystem with proper concurrency control.
4. Cross-site cookies can be restricted by browsers (e.g. Vercel frontend + Render backend), so the browser's signed resume token is the fallback. Consider a same-origin BFF proxy for stronger cookie behavior.
5. Rate-limit the public demo start endpoint at the edge as well as in the existing Express pilot limiter. Configure session creation quotas and periodic expiry cleanup before broad public access.
6. Review and test the actual deployment's CORS and RBAC, including staff creation as demo Administrator and cross-demo isolation.
7. Keep the prototype certificate disclaimer. Public certificate verification intentionally reads only the regular public store; demo sandbox certificates are not published to the real verification endpoint.
8. Do not merge/deploy while tests or browser checks fail.

## Local testing

The user has local uncommitted work. Do not reset that work. Instead, from an existing **clean preview worktree**, fetch the branch:

```powershell
git fetch https://github.com/ujjawalsingh2966-sys/SIH26035.git feat/24h-browser-demo-isolation-20261031
git worktree add -b preview/24h-evaluator-demo "..\SIH26035-demo-preview" FETCH_HEAD
cd "..\SIH26035-demo-preview"
npm ci
npm install --prefix landing
```

Open terminals in the new preview worktree (adjust paths as needed):

```powershell
# Terminal 1 — backend
$env:PORT = "4100"
$env:CLIENT_URL = "http://localhost:3100"
$env:PUBLIC_WEB_URL = "http://localhost:3100"
$env:DATA_DIR = Join-Path (Get-Location) "backend\demo-preview-data"
$env:DEMO_ACCESS_ENABLED = "true"
npm run dev --workspace backend
```

```powershell
# Terminal 2 — Next.js
$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:4100"
npm run dev --workspace frontend -- --port 3100
```

```powershell
# Terminal 3 — landing
$env:VITE_APP_URL = "http://localhost:3100"
npm run dev --prefix landing
```

Open **http://localhost:4173** or **http://localhost:3100/login**. Start a demo twice and verify that the ID and expiry remain constant. Switch among all three roles, create a demo instrument/test, and ensure nothing appears in a separate real-user login. For the automated checks, stop the dev server before the Next.js production build:

```powershell
npm run build --workspace frontend
npm run build --prefix landing
npm test --workspace backend -- --runInBand --coverage=false
```
