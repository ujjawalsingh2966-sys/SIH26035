# W8LAB Phase 2B.3 — Offline JSON preflight and PostgreSQL import runbook

**Status (20 October 2026):** Supabase schema migration `20261020115959_w8lab_phase_2b3_private_repository_schema` has already been applied. The connected database was inspected: 12 private tables with forced RLS, zero application rows. These scripts are migration tools, **not evidence of actual user-data import**. `PERSISTENCE_ADAPTER=json` remains active.

## Scope

The scripts cover the eleven JSON collections defined in `backend/src/repositories/createJsonRepositories.ts` and mapped in `backend/src/repositories/postgres/mappings.ts`: business and staff accounts, sessions, manufacturers, instruments, test cases, observations, native tests, evidence, audit events and business applications. No application calculations, native OIML rules, authentication, workflows, report seals, routes or frontend files are changed.

`authSecrets.json` is a **separate sensitive signing configuration file**. It is **not** accessed, copied or migrated by this tool; protect and migrate signing material through private secret-management procedures.

## Step 1 — Stop all writers and audit locally

Determine the *actual* `DATA_DIR` first; never guess. Shut down every W8LAB backend process, scheduled worker or other writer. On Windows PowerShell, from the repository root:

```powershell
node backend/tools/json-migration-preflight.cjs --data-dir 'C:\private\W8LAB-data'
```

The default command reads but does not modify JSON or connect to PostgreSQL. It fails closed on unreadable files, wrong root format, duplicate IDs, malformed/missing references, duplicate normalized identity emails, invalid session owner references and absent source collections. It reports table counts and generic error codes only, never password hashes, addresses, emails, observations, identifiers or private paths.

**Important limitations:** This is a structural preflight, not complete historical-domain or OIML compliance verification. It does not repair old orphan records, invent accounts, fix report fingerprints or certify a clean cutover. Missing files may mean intentionally empty collections or a wrong source directory; review every missing-file entry before proceeding.

## Step 2 — Create a private byte-verified backup

Choose an existing parent directory **outside the source tree and Git checkout**, on a protected disk. The backup subfolder must not exist yet:

```powershell
node backend/tools/json-migration-preflight.cjs --data-dir 'C:\private\W8LAB-data' --backup-dir 'D:\private\W8LAB-backup-20261020'
```

The tool creates a private directory, copies each existing JSON source file without overwriting any source, checks SHA-256 on the original and backup, and writes a manifest with counts and original/serialized hashes. The manifest and backup contain sensitive operational metadata/data: **never push them to GitHub, paste into chat, or put them in a publicly accessible drive**. Keep a second independent offline backup. Stop all writers throughout snapshot creation; per-file hashes alone do not establish a crash-atomic multi-file snapshot while writes continue.

## Step 3 — Configure dedicated database credentials privately

Supabase already has the private `w8lab` schema and an intentionally non-login `w8lab_runtime` role. A database administrator must privately provision a dedicated **non-owner LOGIN role** with membership of `w8lab_runtime`, without SUPERUSER/BYPASSRLS, with a unique password in private secret management. Do not use the admin `postgres` login for import. Verify TLS, grants, transaction pooler and RLS with this login. Keep `w8lab` out of Supabase exposed Data API schemas, and retain Express RBAC.

Configure `DATABASE_URL` **server-side only** in a private backend environment, using the actual Supabase transaction-pooler URL and correctly encoded credentials. Never set `NEXT_PUBLIC_DATABASE_URL` or disclose database passwords.

Before import, verify the Node.js backend can actually connect:

```powershell
npm.cmd ci
npm.cmd run build --workspace backend
npm.cmd run db:health --workspace backend -- --connect
```

The existing `db:health` is a read-only `SELECT 1` probe; successful health does not prove schema, RLS or record parity.

## Step 4 — Explicit import from the frozen, verified backup

**Not executed in this session; local/private source data and production login credentials are not available.** Only after reviewing source and target backups, all legacy orphans, missing collections, private role setup, recovery procedures and a maintenance window:

```powershell
node backend/tools/import-json-to-postgres.cjs --backup-dir 'D:\private\W8LAB-backup-20261020' --apply
```

If source collections are **intentionally and independently verified as absent/empty**, `--acknowledge-missing-collections` is required as a fourth argument. Do not use this flag to conceal missing or corrupted data.

The importer never auto-runs on application startup. It checks the backup manifest, refuses an empty snapshot or nonempty database, rejects owner/superuser/bypass-RLS connections, explicitly assumes the restricted runtime role, obtains the same advisory lock used by the PostgreSQL adapter, imports records using the adapter's fixed projection mapping, verifies per-collection serialized payload digests and insertion order **inside one SQL transaction**, and commits only after all comparisons succeed. SQL/constraint/integrity failures trigger rollback attempts. After an uncertain COMMIT/rollback, **stop and inspect target state before any retry**. The original source JSON remains untouched.

## Step 5 — Mandatory post-import and cutover gates

- Independently reconcile original source vs backup vs PostgreSQL: counts, exact JSON serialization hashes, all identities, evidence bytes, evaluation traces, approved-report seals and fingerprints.
- Run integration tests with a dedicated non-owner connection against an isolated/synthetic DB before real records. Test database disconnects, RLS, row-version conflicts, advisory locks, password/session workflows and HTTP RBAC.
- Run full existing backend/frontend suites, production builds and real browser tests. Existing P4A/browser and Windows rename EPERM issues are *not* fixed by these scripts.
- Preserve separately secured signing keys, bootstrap requirements, frozen report history and a rollback/recovery plan. Once new PostgreSQL writes occur, flipping back to old JSON **is not lossless rollback**.
- Do **not** change `PERSISTENCE_ADAPTER=json` until a separately reviewed cutover and all verification gates pass.

## Automated test evidence

```powershell
node --test backend/tests/jsonMigrationPreflight.test.cjs backend/tests/jsonMigrationImport.test.cjs
```

Authoring environment: **13 synthetic/fake-driver tests PASS, 0 FAIL**; tested source preflight, checksum-protected backups, bad input/duplicate/orphan/identity rejection, unsafe runtime roles, nonempty-target rollback and a synthetic import with pre-COMMIT reconciliation. These are **not** actual PostgreSQL import or browser verification. The connected Supabase management session could not `SET ROLE w8lab_runtime` (permission denied); runtime LOGIN provisioning and real-credential tests therefore remain pending.
