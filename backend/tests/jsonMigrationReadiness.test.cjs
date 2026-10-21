'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditDirectory, privateBackup } = require('../tools/json-migration-preflight.cjs');
const { verifyReadiness } = require('../tools/verify-migration-readiness.cjs');

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w8lab-readiness-'));
  const source = path.join(root, 'data'), backup = path.join(root, 'backup');
  fs.mkdirSync(source);
  const record = { id: 'test-business-1', email: 'fixture@example.invalid' };
  fs.writeFileSync(path.join(source, 'accounts.json'), JSON.stringify([record]));
  fs.writeFileSync(path.join(source, 'authSecrets.json'), JSON.stringify({ fixture: 'never-a-real-secret' }));
  const audit = auditDirectory(source);
  privateBackup(source, backup, audit);
  fs.copyFileSync(path.join(source, 'authSecrets.json'), path.join(backup, 'authSecrets.json'));
  try { return fn({ root, source, backup, record }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('unchanged 1-account source and private backup pass without exposing secret content', () => fixture(({ source, backup }) => {
  const report = verifyReadiness(source, backup);
  assert.equal(report.ready, true);
  assert.equal(report.records, 1);
  assert.equal(report.collectionsMissing.length, 10);
  assert.equal(report.signingSecretBackupMatches, true);
  assert.equal(JSON.stringify(report).includes('never-a-real-secret'), false);
  assert.equal(JSON.stringify(report).includes('fixture@example.invalid'), false);
}));
test('source record modified after snapshot fails closed', () => fixture(({ source, backup }) => {
  fs.writeFileSync(path.join(source, 'accounts.json'),
    JSON.stringify([{ id: 'test-business-1', email: 'changed@example.invalid' }]));
  assert.throws(() => verifyReadiness(source, backup), /SOURCE_OR_BACKUP_CHANGED_STOP_AND_REVIEW/);
}));
test('newly created source collection fails closed', () => fixture(({ source, backup }) => {
  fs.writeFileSync(path.join(source, 'manufacturers.json'), '[]');
  assert.throws(() => verifyReadiness(source, backup), /SOURCE_OR_BACKUP_CHANGED_STOP_AND_REVIEW/);
}));
test('private signing secret mismatch fails closed', () => fixture(({ source, backup }) => {
  fs.writeFileSync(path.join(source, 'authSecrets.json'), JSON.stringify({ changed: true }));
  assert.throws(() => verifyReadiness(source, backup), /SIGNING_SECRET_NOT_IDENTICALLY_BACKED_UP/);
}));
test('missing signing secret backup fails closed', () => fixture(({ source, backup }) => {
  fs.unlinkSync(path.join(backup, 'authSecrets.json'));
  assert.throws(() => verifyReadiness(source, backup), /SIGNING_SECRET_NOT_IDENTICALLY_BACKED_UP/);
}));
test('mutated backup manifest fails before readiness', () => fixture(({ source, backup }) => {
  fs.writeFileSync(path.join(backup, 'manifest.json'), '{"ok":true}');
  assert.throws(() => verifyReadiness(source, backup), /BACKUP_HASH_OR_PREFLIGHT_MISMATCH/);
}));
