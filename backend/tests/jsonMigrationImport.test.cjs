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
