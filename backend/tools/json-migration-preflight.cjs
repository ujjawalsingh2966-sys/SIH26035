#!/usr/bin/env node
'use strict';
// Offline source audit: no .env, DB or authentication imports. Stop all writers before use.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const COLLECTIONS = Object.freeze([
  { table: 'business_accounts', file: 'accounts.json', refs: [] },
  { table: 'staff_accounts', file: 'staffAccounts.json', refs: [] },
  { table: 'sessions', file: 'sessions.json', refs: [['accountId', 'identity']] },
  { table: 'manufacturers', file: 'manufacturers.json', refs: [] },
  { table: 'instruments', file: 'instruments.json', refs: [['manufacturerId', 'manufacturers']] },
  { table: 'test_cases', file: 'testCases.json', refs: [['instrumentId', 'instruments']] },
  { table: 'observations', file: 'observations.json', refs: [['testCaseId', 'test_cases']] },
  { table: 'native_tests', file: 'nativeTests.json', refs: [['testCaseId', 'test_cases']] },
  { table: 'evidence', file: 'evidence.json', refs: [['testCaseId', 'test_cases']] },
  { table: 'audit_events', file: 'audit.json', refs: [['testCaseId', 'test_cases']] },
  { table: 'business_applications', file: 'applications.json', refs: [['ownerId', 'business_accounts']] },
]);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, table, index) => ({ code, ...(table ? { table } : {}), ...(index === undefined ? {} : { index }) });
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const normEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : null;

function auditDirectory(directory) {
  const absolute = path.resolve(directory);
  if (!path.isAbsolute(directory) || !fs.statSync(absolute).isDirectory() || fs.realpathSync(absolute) !== absolute) {
    throw new Error('SOURCE_DIRECTORY_INVALID');
  }
  const records = new Map(), errors = [], entries = [];
  let existing = 0;
  for (const entry of COLLECTIONS) {
    const filename = path.join(absolute, entry.file);
    let content, parsed;
    try {
      const stat = fs.lstatSync(filename);
      if (!stat.isFile() || stat.isSymbolicLink()) { errors.push(fail('SOURCE_NOT_REGULAR_FILE', entry.table)); continue; }
      if (stat.size > 268435456) { errors.push(fail('SOURCE_FILE_TOO_LARGE', entry.table)); continue; }
      content = fs.readFileSync(filename);
      existing++;
      parsed = JSON.parse(content.toString('utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        entries.push({ table: entry.table, file: entry.file, present: false, count: 0 });
      } else errors.push(fail('SOURCE_UNREADABLE_OR_INVALID_JSON', entry.table));
      continue;
    }
    if (!Array.isArray(parsed)) { errors.push(fail('COLLECTION_NOT_ARRAY', entry.table)); continue; }
    const byId = new Map();
    parsed.forEach((item, index) => {
      if (!isRecord(item) || typeof item.id !== 'string' || !item.id.length) {
        errors.push(fail('RECORD_ID_INVALID', entry.table, index));
      } else if (byId.has(item.id)) {
        errors.push(fail('DUPLICATE_ID', entry.table, index));
      } else byId.set(item.id, item);
    });
    entries.push({ table: entry.table, file: entry.file, present: true,
      count: parsed.length, sourceSha256: hash(content),
      serializedSha256: hash(Buffer.from(JSON.stringify(parsed), 'utf8')) });
    records.set(entry.table, byId);
  }
  if (!existing) errors.push(fail('NO_SOURCE_COLLECTION_FILES'));
  const identity = new Map(), emails = new Set();
  for (const [table, kind] of [['staff_accounts', 'staff'], ['business_accounts', 'business']]) {
    for (const record of (records.get(table) || new Map()).values()) {
      const email = normEmail(record.email);
      if (!email || !email.includes('@')) errors.push(fail('IDENTITY_EMAIL_INVALID', table));
      else if (emails.has(email)) errors.push(fail('DUPLICATE_IDENTITY_EMAIL', table));
      else emails.add(email);
      identity.set(kind + '\0' + record.id, true);
    }
  }
  for (const entry of COLLECTIONS) {
    for (const record of (records.get(entry.table) || new Map()).values()) {
      for (const [field, destination] of entry.refs) {
        const value = record[field];
        if (typeof value !== 'string' || value.length === 0) {
          errors.push(fail('REFERENCE_INVALID', entry.table)); continue;
        }
        if (destination === 'identity') {
          if (!['staff', 'business'].includes(record.kind) || !identity.has(record.kind + '\0' + value)) {
            errors.push(fail('IDENTITY_REFERENCE_MISSING', entry.table));
          }
        } else if (!(records.get(destination) || new Map()).has(value)) {
          errors.push(fail('REFERENCE_MISSING', entry.table));
        }
      }
    }
  }
  return { ok: errors.length === 0, version: 'W8LAB-JSON-PREFLIGHT-1',
    entries, errors, existingCollections: existing, recordCount: entries.reduce((n, item) => n + item.count, 0) };
}
function privateBackup(source, destination, audit) {
  if (!audit.ok) throw new Error('PREFLIGHT_FAILED');
  const root = fs.realpathSync(source), target = path.resolve(destination);
  if (!path.isAbsolute(destination) || target === root || target.startsWith(root + path.sep)) {
    throw new Error('BACKUP_DIRECTORY_INVALID');
  }
  const parent = fs.realpathSync(path.dirname(target));
  if (parent === root || parent.startsWith(root + path.sep)) throw new Error('BACKUP_DIRECTORY_INVALID');
  fs.mkdirSync(target, { mode: 0o700 });
  for (const entry of audit.entries.filter(e => e.present)) {
    const from = path.join(root, entry.file), to = path.join(target, entry.file);
    if (!fs.lstatSync(from).isFile() || fs.lstatSync(from).isSymbolicLink()) throw new Error('SOURCE_CHANGED');
    if (hash(fs.readFileSync(from)) !== entry.sourceSha256) throw new Error('SOURCE_CHANGED');
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); fs.chmodSync(to, 0o600);
    if (hash(fs.readFileSync(to)) !== entry.sourceSha256 || hash(fs.readFileSync(from)) !== entry.sourceSha256) {
      throw new Error('BACKUP_VERIFICATION_FAILED');
    }
  }
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(audit, null, 2) + '\n',
    { mode: 0o600, flag: 'wx' });
  return { backedUpCollections: audit.entries.filter(e => e.present).length };
}
function run(argv = process.argv.slice(2)) {
  let source, backup;
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === '--data-dir' && value && !value.startsWith('--')) { source = value; i++; }
    else if (argv[i] === '--backup-dir' && value && !value.startsWith('--')) { backup = value; i++; }
    else throw new Error('INVALID_OPTIONS');
  }
  if (!source) throw new Error('DATA_DIR_REQUIRED');
  const audit = auditDirectory(source);
  if (backup && audit.ok) privateBackup(source, backup, audit);
  const report = { ok: audit.ok, version: audit.version,
    counts: audit.entries.map(({ table, present, count }) => ({ table, present, count })),
    errors: audit.errors, backupVerified: !!(backup && audit.ok) };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return audit.ok ? 0 : 2;
}
if (require.main === module) {
  try { process.exitCode = run(); }
  catch { process.stderr.write('Migration preflight could not complete. Check private source and destination configuration.\n'); process.exitCode = 1; }
}
module.exports = { COLLECTIONS, auditDirectory, privateBackup, run };
