-- W8LAB Phase 2B.3: establish a DISABLED, non-owner runtime login identity.
-- Applied only after 20261020115959_w8lab_phase_2b3_private_repository_schema.
-- The login has NO password and cannot connect until an operator privately enables it.
-- No JSON data migration, no application adapter switch, no production deployment.
DO $w8lab$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'w8lab_app') THEN
    CREATE ROLE w8lab_app NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$w8lab$;

GRANT w8lab_runtime TO w8lab_app WITH INHERIT FALSE, SET TRUE;
GRANT CONNECT ON DATABASE postgres TO w8lab_app;

-- When approved, generate a strong unique secret and enable privately, not via Git:
--   ALTER ROLE w8lab_app LOGIN PASSWORD '<PRIVATE_PASSWORD>';
-- Prefer an interactive password tool where possible to avoid SQL history.
-- Role must remain NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE.
-- Supavisor shared pooler username is w8lab_app.<PROJECT_REF>.
-- Configure DATABASE_URL as a secret only; never publish in NEXT_PUBLIC_*.
-- Do not run --apply on actual data before private login, TLS, backup and
-- independent record-count/payload reconciliation have been verified.
