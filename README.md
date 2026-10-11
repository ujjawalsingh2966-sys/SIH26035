# W8Lab — verification lifecycle prototype

This integration combines the latest laboratory status, refresh and observation-deletion fixes with a business application → administrator assignment → LMO/GATC inspection → QR certificate workflow alongside the existing NAWI laboratory system.

## Implemented

- Business registration and login with unique account IDs and salted scrypt password hashes.
- Administrator-created staff accounts; no public staff/admin role selection or demo-password login.
- Business-owned applications; administrators see the queue; officers see only assigned applications.
- Appointments, field observation entry, persisted evaluations using the existing calculation engine, rejection reasons and application history.
- One immutable prototype certificate per application, generated only after all recorded observations pass. QR links to a public, read-only lookup that omits business address, user IDs and inspection details.
- Live validity status, in-app expiry reminders within 30 days, and linked re-verification applications.
- Responsive business, administrator and officer screens. Certificate printing / browser Save as PDF.
- Atomic JSON file replacement, surfaced persistence failures and isolated test storage.

## Integration with the laboratory workspace

The current dashboard design, six lifecycle statuses, observation entry gating and deletion audit trail are retained. Navigation uses the signed-in account: businesses and officers use Applications; laboratory staff also have Overview, Instruments and Evaluation Queue; only administrators see Staff accounts. Sign-out removes the local token. Application inspection records and laboratory test cases remain separate workflows.

Integration validation: 96 backend tests across 12 suites passed, and both frontend and backend production builds passed. Regression coverage includes real-account login through laboratory test creation, workspace retrieval and observation deletion, plus deletion rollback after a simulated persistence failure. Browser interaction and deployed-environment testing have not been performed for this integration.

## Run locally

Use Node.js 20 or newer. From the repository root:

```sh
npm ci
npm run build --workspace backend
```

Create `backend/.env` (never commit it):

```dotenv
PORT=4000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
CLIENT_URL=http://localhost:3000
PUBLIC_WEB_URL=http://localhost:3000
```

For a deployed pilot, set `PUBLIC_WEB_URL` to the actual frontend URL **before** issuing QR certificates. Set `CLIENT_URL` to the allowed frontend origin(s), comma separated. Production startup refuses a missing/short JWT secret. `DATA_DIR` can point to an absolute directory on a persistent disk.

Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Bootstrap the first administrator **while the backend is stopped**. In PowerShell, at the repository root:

```powershell
$env:ADMIN_EMAIL = "your-admin@example.com"
$env:ADMIN_NAME = "Project Admin"
$secure = Read-Host "Choose an admin password (12+ characters)" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password
npm run create-admin --workspace backend
Remove-Item Env:ADMIN_PASSWORD
```

On Bash, set `ADMIN_EMAIL` and `ADMIN_NAME`, use `read -s ADMIN_PASSWORD`, then `export ADMIN_PASSWORD`; run the same npm command and `unset ADMIN_PASSWORD` afterward. Do not put real passwords in source control or command arguments.

Start these in **two separate terminals**:

```sh
npm run dev --workspace backend
```

```sh
npm run dev --workspace frontend
```

Open http://localhost:3000. The admin can create LMO/GATC staff under **Staff accounts**. Businesses use **New business? Create an account**. Old demo credentials no longer work. Legacy records with `dev-user-01` ownership need an explicit, reviewed ownership migration; the system does not silently reassign them.

## Demo workflow

1. Register a business; submit an electronic single-range NAWI (classes II, III or IIII). Enter every mass parameter in grams.
2. Sign in as administrator; create an LMO or GATC account and schedule the submitted application.
3. Sign in as the assigned officer. Record actual observations for weighing, eccentricity, and tare when applicable. Save the inspection to run the existing calculation/rule/compliance pipeline.
4. If every recorded observation passes, enter a future validity end and issue the prototype certificate. Failed, blocked or inconclusive evaluations cannot be certified. Reject failed applications with a reason.
5. Open the public verification link or scan its QR, without logging in. Businesses can print the certificate and apply for re-verification.

## Validation

```sh
npm test --workspace backend -- --runInBand --coverage=false
npm run build --workspace backend
npm run build --workspace frontend
```

Tests use disposable directories and never clear pilot data. New integration coverage checks registration, identity uniqueness, privilege escalation, ownership, assignment, ordering, missing/failing tests, certificate immutability, QR output, privacy, expiry and duplicate renewals.

## Deliberate pilot limits

- This remains **JSON-backed, single-process storage**, not PostgreSQL/Supabase. Use one backend instance and a persistent disk. Atomic file replacement is not a database transaction system or a multi-instance locking mechanism. Stop the server before running the admin CLI or restoring files.
- Certificates prominently say **PROTOTYPE — not a statutory verification certificate**. They are not officially accredited certificates or digitally signed government documents.
- The existing NAWI engine supports a limited profile. At least one observation per supported required test is enforced, but this is **not** a complete statutory test plan, sampling matrix or full OIML conformity assessment. Other weighing/measuring instrument categories need their own profiles.
- Re-verification uses verification limits; it is not automatically treated as an in-service inspection with doubled MPE. No legal validity period is hardcoded: the officer enters a date under a reviewed pilot policy.
- Notifications are **in-app only**. Email/SMS delivery, document/photo upload in this new application flow, offline field operation, appointment conflict resolution, certificate revocation and password recovery remain follow-up work.
- JWT sessions last eight hours; browser sign-out clears the local token, but there is no server-side session revocation. Tokens remain in browser localStorage, matching the existing frontend. Internet-facing production authentication still needs secure session management, password reset/verification, shared rate limiting and account administration.
- The older laboratory endpoints/screens are retained; this branch is not a full security or UI overhaul of that subsystem.
