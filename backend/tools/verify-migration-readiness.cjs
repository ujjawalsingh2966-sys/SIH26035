#!/usr/bin/env node
'use strict';
// W8LAB offline readiness gate: reads ONLY local files, never connects to PostgreSQL.
// Fails closed if the current source changed after the private verified backup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { auditDirectory } = require('./json-migration-preflight.cjs');
const { loadVerifiedBackup } = require('./import-json-to-postgres.cjs');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function privateFileDigest(dir, name) {
  const filename = path.join(dir, name);
  let status;
  try { status = fs.lstatSync(filename); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('SIGNING_SECRET_UNREADABLE');
  }
  if (!status.isFile() || status.isSymbolicLink() || status.size > 1048576) {
    throw new Error('SIGNING_SECRET_FILE_INVALID');
  }
  return sha256(fs.readFileSync(filename));
}

function verifyReadiness(source, backup) {
  if (!path.isAbsolute(source) || !path.isAbsolute(backup)) {
    throw new Error('ABSOLUTE_SOURCE_AND_BACKUP_PATH_REQUIRED');
  }
  if (fs.realpathSync(source) === fs.realpathSync(backup)) {
    throw new Error('SOURCE_AND_BACKUP_CANNOT_MATCH');
  }
  const current = auditDirectory(source);
  const snapshot = loadVerifiedBackup(backup);
  if (!current.ok || !snapshot.ok ||
      JSON.stringify(current.entries) !== JSON.stringify(snapshot.entries) ||
      !snapshot.recordCount) {
    throw new Error('SOURCE_OR_BACKUP_CHANGED_STOP_AND_REVIEW');
  }
  const currentSecret = privateFileDigest(source, 'authSecrets.json');
  const backupSecret = privateFileDigest(backup, 'authSecrets.json');
  if (!currentSecret || !backupSecret || currentSecret !== backupSecret) {
    throw new Error('SIGNING_SECRET_NOT_IDENTICALLY_BACKED_UP');
  }
  return {
    ready: true,
    snapshotMatchesCurrentSource: true,
    signingSecretBackupMatches: true,
    records: snapshot.recordCount,
    collectionsMissing: snapshot.entries.filter(e => !e.present).map(e => e.table),
  };
}

function run(argv = process.argv.slice(2)) {
  if (argv.length !== 4 || argv[0] !== '--source-dir' || argv[2] !== '--backup-dir') {
    throw new Error('USAGE: --source-dir ABSOLUTE_PATH --backup-dir ABSOLUTE_PATH');
  }
  const report = verifyReadiness(argv[1], argv[3]);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return 0;
}

if (require.main === module) {
  try { process.exitCode = run(); }
  catch (error) {
    process.stderr.write('Migration readiness BLOCKED: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
module.exports = { verifyReadiness, run };
