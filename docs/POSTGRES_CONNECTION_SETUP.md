# PostgreSQL connection plumbing (JSON remains active)

20 October 2026. W8LAB / SIH26035.

This slice installs `pg` and adds connection configuration, a bounded pool and an opt-in health-check CLI. It does **not** replace repositories, authenticate through Supabase, change APIs/calculations/report seals, create tables, migrate records or deploy the application. Prior uncommitted Phase 2A work is preserved.

## Files and dependencies

The approved scope is limited to:

| File | Purpose |
| --- | --- |
| `backend/package.json` | Runtime `pg`, development `@types/pg`, `db:health` script |
| `package-lock.json` | Existing root workspace lockfile; no second lockfile |
| `backend/src/config/database.ts` | Lazy server-only environment validation and verified TLS settings |
| `backend/src/database/pool.ts` | One reusable pool per module instance, safe errors, read-only connection probe and explicit shutdown |
| `backend/src/cli/databaseHealth.ts` | Explicit opt-in, private backend environment loading and sanitized CLI output |
| `backend/tests/databaseConnection.test.ts` | Mocked driver/environment tests; no real database access |
| `backend/.env.example` | Commented placeholders only |
| `README.md` | Connection setup link and JSON-active clarification |
| `docs/POSTGRES_CONNECTION_SETUP.md` | This setup and verification guide |

Installed versions: `pg` **8.23.1**, `@types/pg` **8.23.1**. Installation used the existing backend npm workspace with lifecycle scripts disabled. No ORM, Supabase client SDK or Vercel package was added.

## Private configuration

After a separate approval to make a real connection, privately configure the following in `backend/.env` or the backend process environment. Do not paste the populated URL into chat, source files, `.env.example`, logs or frontend variables.

- `DATABASE_URL`: copy the transaction-pooler connection string from the project's Supabase Connect dialog, with the correct database password percent-encoded. Use `postgres://` or `postgresql://`; include the host, account, password and database. Do not guess the pooler host or username.
- `DATABASE_POOL_MAX`: optional integer **1–5**, default **2**. This bounds each running Node.js instance, not the entire deployment.
- `DATABASE_SSL_CA`: optional trusted PEM CA certificate or certificate bundle if the endpoint needs a custom trust root. Actual newlines and literal `\n` escapes are supported. Only certificates are accepted, not client keys or certificate file paths.

Injected process variables take precedence over a local environment file. Only the explicit CLI loads `backend/.env`, relative to the backend directory rather than the working directory. Configuration and pool imports do not load `.env`, initialize JWT signing keys, instantiate JSON stores or open a socket.

The new module is not imported by application startup, repository selection or the existing HTTP health route. Missing database configuration therefore does not break the currently JSON-backed application.

## TLS, pooling and timeouts

| Setting | Value |
| --- | --- |
| Maximum connections | Default 2; validated override 1–5 per instance |
| Minimum connections | 0; no eager connection creation |
| Connection/acquisition timeout | 5,000 ms |
| Client query timeout | 10,000 ms |
| Idle connection timeout | 5,000 ms |
| TLS minimum | TLS 1.2 |
| Certificate verification | Always `rejectUnauthorized: true` |

Default system trust is used unless a valid custom CA is supplied. There is no fallback to plaintext or disabled certificate verification. A client query timeout is not a general guarantee that every server-side operation has been cancelled; this phase executes only a constant read-only probe.

Only the URL query option `sslmode=require` or `sslmode=verify-full` is accepted. These values are removed from the URL before passing it to `pg`, while the explicit verified TLS object is retained. In particular, `require` does **not** downgrade this implementation to encryption without identity verification. Other options, including insecure SSL modes, `sslrootcert`/`sslcert`/`sslkey` file paths, alternate hosts and timeout overrides, are rejected with a fixed configuration error. Configure CA trust and pool limits through the documented server-only variables instead.

This avoids [node-postgres's documented connection-string SSL override](https://node-postgres.com/features/ssl). Transaction pooling is appropriate for short-lived serverless connections, but named prepared statements and session-dependent features require care; see [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres). The connection probe uses no prepared-statement name, session settings or pipelining. No global PostgreSQL type parsers are installed.

Pool construction is lazy and reused within the module instance. Do not create a pool per request, log its configuration, or call `closeDatabasePool()` after every web request. Explicit cleanup coalesces concurrent shutdown calls. If shutdown fails, further pool allocation fails closed rather than creating additional pools while old sockets might remain open. Background driver errors use a fixed log message; raw driver errors, their causes, result rows and connection objects are never logged by this plumbing.

## Health-check command — real execution requires separate approval

The command is deliberately gated. Without exactly `--connect`, it exits **2** before loading configuration, constructing a pool or executing SQL. Do not run a real check until its separate connection approval is given.

After approval, build the backend using the existing documented build workflow and run from the repository root:

```powershell
npm.cmd run build --workspace backend
npm.cmd run db:health --workspace backend -- --connect
```

The CLI runs only `SELECT 1 AS ok`. It does not query application tables, inspect account records or perform schema writes. It verifies the expected constant result, closes the pool and only then reports success. Exit **0** means the connection probe and cleanup succeeded; exit **1** means configuration, TLS, connection, query or cleanup failed. Failure output is fixed text without the URL, credentials, host, database username, driver stack or raw error details. No automatic retry is performed.

This implementation has **not** executed the real command or verified project connectivity, certificate trust, pooler permissions or database availability. Those require the separately approved check.

## Vercel compatibility and remaining deployment work

Use a **Node.js runtime**, not an Edge runtime, for this `pg` module. Configure `DATABASE_URL` and any CA privately in the appropriate Vercel backend environments; never make them public build variables. The pool can be reused by concurrent invocations in a warm instance. The initial maximum of 2 is a conservative starting budget for future Fluid Compute usage, not a universally correct production size. Validate instance scaling and the Supabase connection budget before deployment.

When a real Vercel entry point is designed, attach the pool to Vercel's suspension lifecycle using the documented `attachDatabasePool` integration where applicable. That dependency and deployment wiring are intentionally not added here. See [Vercel's pooling guidance](https://vercel.com/kb/guide/connection-pooling-with-functions).

Connection plumbing alone does not make the existing JSON-backed application deployment-ready. Its single-writer persistence, local signing-key startup and data migration need a separately reviewed database/storage deployment plan. No `vercel.json`, application entry point, repository adapter, authentication policy or schema is changed in this slice.

## Local verification (no database connection)

The test suite mocks `pg.Pool` and dotenv loading before exercising configuration, query and CLI paths. Synthetic URLs and generated test-only credential material exist only in memory; no real environment file or project data is used. Existing backend regressions run using the isolated runner's synthetic data/configuration.

```powershell
node backend/tools/test-isolated.cjs tests/databaseConnection.test.ts
node backend/tools/test-isolated.cjs
node node_modules/typescript/bin/tsc --project backend/tsconfig.json --noEmit --incremental false
$testSources = @(rg --files backend/tests -g '*.ts')
node node_modules/typescript/bin/tsc --noEmit --strict --esModuleInterop --skipLibCheck --target es2022 --module commonjs @testSources
git diff --check
```

Coverage includes strict TLS defaults and URL option handling, encoded credentials, bounded configuration, CA validation, server-only guards, inert imports, lazy pool reuse, constant read-only SQL, sanitized errors, background errors, cleanup/concurrent cleanup, failed-shutdown allocation guards, explicit CLI opt-in and mocked CLI success/failure/cleanup.

Actual final results:

| Check | Result |
| --- | --- |
| Focused mocked database suite | **71 PASS / 0 FAIL / 0 skipped**, 1 suite |
| Full isolated backend suite | **697 PASS / 0 FAIL / 0 skipped**, 27 suites; includes all 626 existing tests |
| Backend TypeScript, no emit | PASS, exit 0 |
| Backend test-source TypeScript, no emit | PASS, exit 0 |
| `git diff --check` | PASS, exit 0 |
| Real database connection / health check | NOT RUN; requires separate approval |
| Production build / browser / Vercel deployment | NOT RUN; outside this mocked connection-plumbing verification |

The first development test attempt failed TypeScript compilation because two new parameterized fixture tables had incorrect argument shapes; those tables were corrected. The final runs above had no failures. No existing regression was removed or weakened.

The existing isolated runner retains its historical directory prefix. Evidence is under the OS temporary directory: full run `w8lab-phase2a-tests-yewnHO/results.json`, focused rerun `w8lab-phase2a-tests-SnXoND/results.json`. No browser, deployment or real connectivity result is implied by mocked tests.

Diff review confirmed the approved nine-file scope, preserved the pre-existing Phase 2A file contents outside the approved README additions, and found no credential material in the new changes. The lockfile adds the required driver/type dependency graph without upgrading existing package versions; its existing `xtend` entry becomes a runtime dependency as well as a development dependency through the PostgreSQL driver graph.

## Next approval boundary

Review this connection-only diff. Separately approve a single real, read-only Supabase connectivity check before running the gated CLI. Table design, restricted database roles/RLS, persistence-adapter integration, JSON import, durable transactions and deployment remain separate phases requiring their own review. No migration journal or Supabase authentication migration has been started.
