-- W8LAB Phase 2B.3: compatibility schema for the exact PostgresRepository mappings.
-- Private server-side schema. No migration of JSON data and NO adapter activation.
-- Originally applied to Supabase W8LAB on 2026-10-20 as migration 20261020115959.
-- IMPORTANT: This file records an ALREADY APPLIED migration; do not replay it on that project.
-- Designed for PostgreSQL 17 / Supabase; never expose w8lab in the Data API.
CREATE SCHEMA IF NOT EXISTS w8lab;
REVOKE ALL ON SCHEMA w8lab FROM PUBLIC, anon, authenticated, service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'w8lab_runtime') THEN
    CREATE ROLE w8lab_runtime NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA w8lab TO w8lab_runtime;
CREATE TABLE IF NOT EXISTS w8lab.identity_keys (
  kind text NOT NULL CHECK (kind IN ('staff','business')),
  account_id text NOT NULL CHECK (length(account_id) > 0),
  email_normalized text NOT NULL CHECK (email_normalized <> '' AND email_normalized = lower(btrim(email_normalized))),
  PRIMARY KEY (kind, account_id),
  UNIQUE (email_normalized)
);

CREATE TABLE IF NOT EXISTS w8lab.business_accounts (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  email_normalized text, active boolean,
  UNIQUE (storage_order),
  CONSTRAINT business_accounts_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.staff_accounts (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  email_normalized text, active boolean, role text, credential_version bigint,
  UNIQUE (storage_order),
  CONSTRAINT staff_accounts_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.sessions (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  account_id text, kind text, expires_at text, revoked_at text,
  UNIQUE (storage_order),
  CONSTRAINT sessions_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.manufacturers (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  identifier_normalized text, name_normalized text, address_normalized text,
  UNIQUE (storage_order),
  CONSTRAINT manufacturers_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.instruments (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  manufacturer_id text, serial_normalized text,
  UNIQUE (storage_order),
  CONSTRAINT instruments_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.test_cases (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  instrument_id text, technician_id text, reviewer_id text, status text, revision bigint,
  UNIQUE (storage_order),
  CONSTRAINT test_cases_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.observations (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  test_case_id text, test_type text, sequence bigint,
  UNIQUE (storage_order),
  CONSTRAINT observations_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.native_tests (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  test_case_id text, programme_id text, procedure_id text, series text,
  UNIQUE (storage_order),
  CONSTRAINT native_tests_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.evidence (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  test_case_id text, uploaded_by text,
  UNIQUE (storage_order),
  CONSTRAINT evidence_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.audit_events (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  test_case_id text, actor_id text, action text, occurred_at text,
  UNIQUE (storage_order),
  CONSTRAINT audit_events_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

CREATE TABLE IF NOT EXISTS w8lab.business_applications (
  id text PRIMARY KEY CHECK (length(id) > 0),
  payload_json text NOT NULL,
  storage_order bigint NOT NULL CHECK (storage_order > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  owner_id text, submission_key text, status text,
  UNIQUE (storage_order),
  CONSTRAINT business_applications_payload_consistent CHECK (jsonb_typeof(payload_json::jsonb) = 'object' AND payload_json::jsonb ->> 'id' = id)
);

-- Strict relationships: import must diagnose/repair historical orphans BEFORE writing.
ALTER TABLE w8lab.instruments ADD CONSTRAINT instruments_manufacturer_fk FOREIGN KEY (manufacturer_id) REFERENCES w8lab.manufacturers(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE w8lab.test_cases ADD CONSTRAINT test_cases_instrument_fk FOREIGN KEY (instrument_id) REFERENCES w8lab.instruments(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE w8lab.observations ADD CONSTRAINT observations_test_case_fk FOREIGN KEY (test_case_id) REFERENCES w8lab.test_cases(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE w8lab.native_tests ADD CONSTRAINT native_tests_test_case_fk FOREIGN KEY (test_case_id) REFERENCES w8lab.test_cases(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE w8lab.evidence ADD CONSTRAINT evidence_test_case_fk FOREIGN KEY (test_case_id) REFERENCES w8lab.test_cases(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE w8lab.audit_events ADD CONSTRAINT audit_events_test_case_fk FOREIGN KEY (test_case_id) REFERENCES w8lab.test_cases(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE w8lab.business_applications ADD CONSTRAINT business_applications_owner_fk FOREIGN KEY (owner_id) REFERENCES w8lab.business_accounts(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE w8lab.sessions ADD CONSTRAINT sessions_identity_fk FOREIGN KEY (kind,account_id) REFERENCES w8lab.identity_keys(kind,account_id) DEFERRABLE INITIALLY DEFERRED;

-- Role isolation: browser/anon/authenticated/service_role are not granted access.
REVOKE ALL ON ALL TABLES IN SCHEMA w8lab FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA w8lab TO w8lab_runtime;
ALTER TABLE w8lab.business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.business_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.business_accounts FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.staff_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.staff_accounts FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.sessions FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.manufacturers FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.manufacturers FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.instruments FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.instruments FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.test_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.test_cases FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.observations FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.observations FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.native_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.native_tests FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.native_tests FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.evidence FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.audit_events FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.business_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.business_applications FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.business_applications FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
ALTER TABLE w8lab.identity_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE w8lab.identity_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_private_adapter ON w8lab.identity_keys FOR ALL TO w8lab_runtime USING (true) WITH CHECK (true);
-- The dedicated server login must be provisioned privately and granted w8lab_runtime.
-- Express authorization remains the user-level security boundary.
