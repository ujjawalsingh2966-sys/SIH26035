'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditDirectory, privateBackup, COLLECTIONS } = require('../tools/json-migration-preflight.cjs');
const { loadVerifiedBackup, importTransaction } = require('../tools/import-json-to-postgres.cjs');
function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w8lab-import-'));
  const source = path.join(root, 'source'); fs.mkdirSync(source);
  const put = (table, rows) => fs.writeFileSync(path.join(source, COLLECTIONS.find(c => c.table === table).file), JSON.stringify(rows));
  try { fn({ root, source, put }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('verified backup has exact manifest', () => fixture(({ root, source, put }) => {
  put('manufacturers', [{ id: 'm' }]);
  const report = auditDirectory(source), backup = path.join(root, 'backup');
  privateBackup(source, backup, report);
  assert.equal(loadVerifiedBackup(backup).recordCount, 1);
  fs.writeFileSync(path.join(backup, 'manufacturers.json'), JSON.stringify([{ id: 'changed' }]));
  assert.throws(() => loadVerifiedBackup(backup), /BACKUP_HASH_OR_PREFLIGHT_MISMATCH/);
}));
test('target-nonempty fails before insert and rolls back', async () => {
  let rolledBack = false, inserted = false;
  const client = { query: async sql => {
    if (sql.includes('FROM pg_roles')) return { rows: [{ rolsuper: false, rolbypassrls: false, rolcanlogin: true, member: true, schema_count: 1 }] };
    if (sql.includes('count(*)::bigint')) return { rows: [{ count: '1' }] };
    if (sql === 'ROLLBACK') rolledBack = true;
    if (sql.startsWith('INSERT')) inserted = true;
    return { rows: [], rowCount: 1 };
  } };
  await assert.rejects(importTransaction(client, 'unused', { entries: [] }, () => null, () => []));
  assert.equal(rolledBack, true); assert.equal(inserted, false);
});
test('unsafe connection role fails before BEGIN', async () => {
  let began = false;
  const client = { query: async sql => {
    if (sql === 'BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE') began = true;
    return { rows: [{ rolsuper: true, rolbypassrls: true, rolcanlogin: true, member: true, schema_count: 1 }] };
  } };
  await assert.rejects(importTransaction(client, 'unused', { entries: [] }, () => null, () => []), /RUNTIME_ROLE_NOT_SAFE/);
  assert.equal(began, false);
});
test('synthetic complete import verifies payload before COMMIT', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w8lab-import-'));
  const source = path.join(root, 'source'); fs.mkdirSync(source);
  try {
    const file = COLLECTIONS.find(c => c.table === 'manufacturers').file;
    fs.writeFileSync(path.join(source, file), JSON.stringify([{ id: 'm', name: 'Fixture Maker' }]));
    const audit = auditDirectory(source), backup = path.join(root, 'backup');
    privateBackup(source, backup, audit);
    const counts = new Map(), contents = new Map(); let committed = false;
    const client = { query: async (sql, params = []) => {
      if (sql.includes('FROM pg_roles')) return { rows: [{ rolsuper: false, rolbypassrls: false, rolcanlogin: true, member: true, schema_count: 1 }] };
      const count = /SELECT count\(\*\)::bigint AS count FROM w8lab\.(\w+)/.exec(sql);
      if (count) return { rows: [{ count: String(counts.get(count[1]) || 0) }] };
      const insert = /INSERT INTO w8lab\.(\w+)/.exec(sql);
      if (insert) {
        counts.set(insert[1], (counts.get(insert[1]) || 0) + 1);
        if (insert[1] !== 'identity_keys') contents.set(insert[1], [...(contents.get(insert[1]) || []), params[1]]);
        return { rows: [], rowCount: 1 };
      }
      const select = /SELECT payload_json FROM w8lab\.(\w+) ORDER BY storage_order/.exec(sql);
      if (select) return { rows: (contents.get(select[1]) || []).map(payload_json => ({ payload_json })) };
      if (sql === 'COMMIT') committed = true;
      return { rows: [], rowCount: 1 };
    } };
    const mappingNames = { accountStore: 'business_accounts', staffStore: 'staff_accounts', sessionStore: 'sessions',
      manufacturerStore: 'manufacturers', instrumentStore: 'instruments', testCaseStore: 'test_cases',
      observationStore: 'observations', nativeTestStore: 'native_tests', evidenceStore: 'evidence',
      auditStore: 'audit_events', businessApplicationStore: 'business_applications' };
    await importTransaction(client, backup, loadVerifiedBackup(backup),
      name => ({ table: mappingNames[name], columns: [] }), () => []);
    assert.equal(committed, true); assert.equal(counts.get('manufacturers'), 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});


async function withImportBackup(table, rows, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w8lab-import-regression-'));
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  const file = COLLECTIONS.find(c => c.table === table).file;
  fs.writeFileSync(path.join(source, file), JSON.stringify(rows));
  const backup = path.join(root, 'backup');
  try {
    privateBackup(source, backup, auditDirectory(source));
    await callback(backup, loadVerifiedBackup(backup));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function recorderFor(table, rows, changes = {}) {
  const statements = [];
  const sqlClient = {
    query: async (sql, params = []) => {
      statements.push(sql);
      if (sql.includes('FROM pg_roles'))
        return { rows: [{ rolsuper: false, rolbypassrls: false, rolcanlogin: true, member: true, schema_count: 1 }] };
      const count = /SELECT count\(\*\)::bigint AS count FROM w8lab\.(\w+)/.exec(sql);
      if (count) return { rows: [{ count: String(changes.nonempty === count[1] ? 1 : 0) }] };
      if (sql.startsWith('INSERT INTO w8lab.')) {
        if (changes.rejectInsert) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [] };
      }
      const select = /SELECT payload_json FROM w8lab\.(\w+) ORDER BY storage_order/.exec(sql);
      if (select) return { rows: select[1] === table ? rows.map(r => ({ payload_json: JSON.stringify(r) })) : [] };
      if (sql === 'COMMIT' && changes.rejectCommit) throw new Error('simulated transport lost after COMMIT');
      if (sql === 'ROLLBACK' && changes.rejectRollback) throw new Error('simulated rollback transport failure');
      if (sql === 'SET CONSTRAINTS ALL IMMEDIATE' && changes.rejectDeferredConstraints)
        throw new Error('simulated deferred FK violation');
      return { rows: [], rowCount: 1 };
    }
  };
  return { sqlClient, statements };
}
const simpleMapping = name => ({
  table: {
    accountStore: 'business_accounts', staffStore: 'staff_accounts', sessionStore: 'sessions',
    manufacturerStore: 'manufacturers', instrumentStore: 'instruments', testCaseStore: 'test_cases',
    observationStore: 'observations', nativeTestStore: 'native_tests', evidenceStore: 'evidence',
    auditStore: 'audit_events', businessApplicationStore: 'business_applications'
  }[name],
  columns: name === 'accountStore' ? ['email_normalized', 'active'] : [],
  ...(name === 'accountStore' ? { identityKind: 'business' } : {})
});

test('lost COMMIT acknowledgement is explicitly unknown and never followed by ROLLBACK', async () => {
  await withImportBackup('manufacturers', [{ id: 'm1', name: 'Safe fixture' }], async (backup, report) => {
    const { sqlClient, statements } = recorderFor('manufacturers', [{ id: 'm1', name: 'Safe fixture' }], { rejectCommit: true });
    await assert.rejects(importTransaction(sqlClient, backup, report, simpleMapping, () => []),
      { message: 'COMMIT_OUTCOME_UNKNOWN_STOP_AND_RECONCILE' });
    assert.equal(statements.filter(x => x === 'COMMIT').length, 1);
    assert.equal(statements.includes('ROLLBACK'), false);
  });
});

test('normal pre-COMMIT insert error performs exactly one rollback', async () => {
  await withImportBackup('manufacturers', [{ id: 'm2' }], async (backup, report) => {
    const { sqlClient, statements } = recorderFor('manufacturers', [{ id: 'm2' }], { rejectInsert: true });
    await assert.rejects(importTransaction(sqlClient, backup, report, simpleMapping, () => []),
      { message: 'IMPORT_ROLLED_BACK_CHECK_CONSTRAINTS_AND_LOGS' });
    assert.equal(statements.filter(x => x === 'ROLLBACK').length, 1);
    assert.equal(statements.includes('COMMIT'), false);
  });
});

test('rollback transport failure is classified as uncertain', async () => {
  const { sqlClient, statements } = recorderFor('manufacturers', [], { nonempty: 'identity_keys', rejectRollback: true });
  await assert.rejects(importTransaction(sqlClient, 'unused', { entries: [] }, simpleMapping, () => []),
    { message: 'ROLLBACK_UNCERTAIN_STOP_AND_INSPECT' });
  assert.equal(statements.includes('COMMIT'), false);
});

test('business identity is reserved before account, with pre-COMMIT FK check', async () => {
  const record = { id: 'b1', email: 'UPPER@EXAMPLE.INVALID', active: true };
  await withImportBackup('business_accounts', [record], async (backup, report) => {
    const { sqlClient, statements } = recorderFor('business_accounts', [record]);
    await importTransaction(sqlClient, backup, report, simpleMapping,
      (mapping, item) => mapping.identityKind ? [item.email.trim().toLowerCase(), item.active] : []);
    const identity = statements.findIndex(x => x.startsWith('INSERT INTO w8lab.identity_keys'));
    const account = statements.findIndex(x => x.startsWith('INSERT INTO w8lab.business_accounts'));
    assert(identity >= 0 && account > identity, 'identity reservation must precede account');
    const checked = statements.lastIndexOf('SET CONSTRAINTS ALL IMMEDIATE');
    const committed = statements.lastIndexOf('COMMIT');
    assert(checked >= 0 && committed > checked, 'deferred FK check must precede COMMIT');
  });
});

test('deferred FK violation is caught before COMMIT and rolled back', async () => {
  await withImportBackup('manufacturers', [{ id: 'm3' }], async (backup, report) => {
    const { sqlClient, statements } = recorderFor('manufacturers', [{ id: 'm3' }], { rejectDeferredConstraints: true });
    await assert.rejects(importTransaction(sqlClient, backup, report, simpleMapping, () => []),
      { message: 'IMPORT_ROLLED_BACK_CHECK_CONSTRAINTS_AND_LOGS' });
    assert.equal(statements.includes('COMMIT'), false);
    assert.equal(statements.includes('ROLLBACK'), true);
  });
});
