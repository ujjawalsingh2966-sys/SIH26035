'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditDirectory, privateBackup, COLLECTIONS } = require('../tools/json-migration-preflight.cjs');
function scenario(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w8lab-migration-test-'));
  const source = path.join(root, 'data'); fs.mkdirSync(source);
  function put(table, rows) {
    const file = COLLECTIONS.find(x => x.table === table).file;
    fs.writeFileSync(path.join(source, file), JSON.stringify(rows, null, 2));
  }
  try { fn({ root, source, put }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('valid hierarchy and identity return digest-only report', () => scenario(({ source, put }) => {
  put('manufacturers', [{ id: 'm1', name: 'Demo Co', identifier: 'DEMO' }]);
  put('instruments', [{ id: 'i1', manufacturerId: 'm1' }]);
  put('test_cases', [{ id: 't1', instrumentId: 'i1' }]);
  put('observations', [{ id: 'o1', testCaseId: 't1' }]);
  put('staff_accounts', [{ id: 's1', email: 'EXAMPLE@EXAMPLE.invalid' }]);
  put('sessions', [{ id: 'ss1', kind: 'staff', accountId: 's1' }]);
  const a = auditDirectory(source);
  assert.equal(a.ok, true); assert.equal(a.recordCount, 6);
  assert.match(a.entries[0].file, /\.json$/);
  assert.equal(JSON.stringify(a).includes('EXAMPLE@'), false);
}));
test('duplicate IDs fail closed', () => scenario(({ source, put }) => {
  put('manufacturers', [{ id: 'm1' }, { id: 'm1' }]);
  assert(auditDirectory(source).errors.some(e => e.code === 'DUPLICATE_ID'));
}));
test('orphans fail closed', () => scenario(({ source, put }) => {
  put('instruments', [{ id: 'i1', manufacturerId: 'missing' }]);
  assert(auditDirectory(source).errors.some(e => e.code === 'REFERENCE_MISSING'));
}));
test('invalid session owner blocks import', () => scenario(({ source, put }) => {
  put('sessions', [{ id: 'ss', kind: 'business', accountId: 'unknown' }]);
  assert(auditDirectory(source).errors.some(e => e.code === 'IDENTITY_REFERENCE_MISSING'));
}));
test('normalized identity email conflicts across staff and business', () => scenario(({ source, put }) => {
  put('staff_accounts', [{ id: 's', email: ' STAFF@Example.invalid ' }]);
  put('business_accounts', [{ id: 'b', email: 'staff@example.invalid' }]);
  assert(auditDirectory(source).errors.some(e => e.code === 'DUPLICATE_IDENTITY_EMAIL'));
}));
test('missing all files fails', () => scenario(({ source }) => {
  assert(auditDirectory(source).errors.some(e => e.code === 'NO_SOURCE_COLLECTION_FILES'));
}));
test('backup produces byte-identical private files and manifest; originals unchanged', () => scenario(({ root, source, put }) => {
  put('manufacturers', [{ id: 'm1', name: 'Demo' }]);
  const input = fs.readFileSync(path.join(source, 'manufacturers.json'));
  const a = auditDirectory(source), dest = path.join(root, 'backup');
  const b = privateBackup(source, dest, a); assert.equal(b.backedUpCollections, 1);
  assert.deepEqual(fs.readFileSync(path.join(dest, 'manufacturers.json')), input);
  assert.deepEqual(fs.readFileSync(path.join(source, 'manufacturers.json')), input);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'))).ok, true);
  assert.throws(() => privateBackup(source, dest, a));
}));
test('backup refuses directory inside source', () => scenario(({ source, put }) => {
  put('manufacturers', [{ id: 'm1' }]);
  const a = auditDirectory(source);
  assert.throws(() => privateBackup(source, path.join(source, 'backup'), a), /BACKUP_DIRECTORY_INVALID/);
}));
test('bad JSON and nonarrays cannot silently become empty collections', () => scenario(({ source }) => {
  fs.writeFileSync(path.join(source, 'manufacturers.json'), '{ broken');
  assert(auditDirectory(source).errors.some(e => e.code === 'SOURCE_UNREADABLE_OR_INVALID_JSON'));
}));
