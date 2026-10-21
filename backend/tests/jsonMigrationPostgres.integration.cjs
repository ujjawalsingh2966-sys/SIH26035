'use strict';
// Runs only against an explicitly selected disposable PostgreSQL 17 instance.
// Never point this test at Supabase, production or a persistent developer database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
const { auditDirectory, privateBackup } = require('../tools/json-migration-preflight.cjs');
const { importTransaction, loadVerifiedBackup } = require('../tools/import-json-to-postgres.cjs');
const { mappingFor, projections } = require('../dist/repositories/postgres/mappings.js');

test('real PostgreSQL 17 private-schema import and deferred FK enforcement (ephemeral only)',
  { skip: process.env.W8LAB_ISOLATED_PG_TEST !== '1' }, async () => {
  if (process.env.CI !== 'true' || process.env.W8LAB_DB_IS_DISPOSABLE !== 'true') {
    throw new Error('ISOLATED_DATABASE_ATTESTATION_REQUIRED');
  }
  const password = process.env.W8LAB_TEST_POSTGRES_PASSWORD;
  if (!password || process.env.DATABASE_URL) {
    throw new Error('REJECT_LIVE_DATABASE_OR_MISSING_FIXTURE_CONFIG');
  }
  const config = {
    host: '127.0.0.1', port: 5432, database: 'postgres',
    password, ssl: false, connectionTimeoutMillis: 3000, max: 1,
  };
  const admin = new Pool({ ...config, user: 'postgres' });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w8lab-pg-ephemeral-'));
  let app;
  try {
    // Roles normally supplied by Supabase; fixture database starts with none.
    for (const name of ['anon', 'authenticated', 'service_role']) {
      await admin.query('CREATE ROLE ' + name + ' NOLOGIN');
    }
    const migrationPath = path.resolve(__dirname,
      '../../database/migrations/20261020115959_w8lab_phase_2b3_private_repository_schema.sql');
    await admin.query(fs.readFileSync(migrationPath, 'utf8'));
    await admin.query("CREATE ROLE w8lab_app LOGIN NOINHERIT PASSWORD 'ci-test-role-only-not-a-real-secret'");
    await admin.query('GRANT w8lab_runtime TO w8lab_app WITH INHERIT FALSE, SET TRUE');
    await admin.query('GRANT CONNECT ON DATABASE postgres TO w8lab_app');
    app = new Pool({
      ...config, user: 'w8lab_app', password: 'ci-test-role-only-not-a-real-secret'
    });

    const record = { id: 'ci-business-1', email: 'DEMO@EXAMPLE.INVALID', active: true, displayName: 'Synthetic Fixture' };
    const source = path.join(root, 'source');
    const backup = path.join(root, 'backup');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'accounts.json'), JSON.stringify([record], null, 2));
    const report = auditDirectory(source);
    assert.equal(report.ok, true);
    assert.equal(report.recordCount, 1);
    privateBackup(source, backup, report);
    const verified = loadVerifiedBackup(backup);
    assert.equal(verified.entries.filter(e => !e.present).length, 10);

    const client = await app.connect();
    try {
      await importTransaction(client, backup, verified, mappingFor, projections);
    } finally {
      client.release(true);
    }
    const accounts = await admin.query('SELECT id,payload_json,email_normalized FROM w8lab.business_accounts');
    const identity = await admin.query('SELECT kind,account_id,email_normalized FROM w8lab.identity_keys');
    assert.equal(accounts.rowCount, 1);
    assert.deepEqual(JSON.parse(accounts.rows[0].payload_json), record);
    assert.equal(accounts.rows[0].email_normalized, 'demo@example.invalid');
    assert.equal(identity.rowCount, 1);
    assert.deepEqual(identity.rows[0], {
      kind: 'business', account_id: 'ci-business-1', email_normalized: 'demo@example.invalid'
    });
    assert.equal((await admin.query(
      "SELECT has_table_privilege('anon','w8lab.business_accounts','SELECT') AS access"
    )).rows[0].access, false);

    // Repeat import must reject an already populated target without changing it.
    const retry = await app.connect();
    try {
      await assert.rejects(importTransaction(retry, backup, verified, mappingFor, projections),
        { message: 'IMPORT_ROLLED_BACK_CHECK_CONSTRAINTS_AND_LOGS' });
    } finally {
      retry.release(true);
    }
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM w8lab.business_accounts')).rows[0].count, 1);

    // A deferred FK must be enforced by SET CONSTRAINTS ALL IMMEDIATE.
    const fk = await app.connect();
    try {
      await fk.query('BEGIN');
      await fk.query('SET LOCAL ROLE w8lab_runtime');
      const orphan = {
        id: 'ci-orphan-session', accountId: 'ci-missing-identity', kind: 'business'
      };
      await fk.query(
        'INSERT INTO w8lab.sessions (id,payload_json,storage_order,account_id,kind) VALUES ($1,$2,$3,$4,$5)',
        [orphan.id,JSON.stringify(orphan),1,orphan.accountId,orphan.kind]
      );
      await assert.rejects(fk.query('SET CONSTRAINTS ALL IMMEDIATE'), error => error.code === '23503');
    } finally {
      try { await fk.query('ROLLBACK'); } finally { fk.release(true); }
    }
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM w8lab.sessions')).rows[0].count, 0);
  } finally {
    if (app) await app.end();
    await admin.end();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
