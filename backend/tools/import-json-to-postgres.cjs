#!/usr/bin/env node
'use strict';
// Offline, operator-only import from a verified private JSON backup. Never used by the HTTP server.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { auditDirectory, COLLECTIONS } = require('./json-migration-preflight.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const STORES = Object.freeze({
  business_accounts: 'accountStore', staff_accounts: 'staffStore', sessions: 'sessionStore',
  manufacturers: 'manufacturerStore', instruments: 'instrumentStore', test_cases: 'testCaseStore',
  observations: 'observationStore', native_tests: 'nativeTestStore', evidence: 'evidenceStore',
  audit_events: 'auditStore', business_applications: 'businessApplicationStore'
});
function loadVerifiedBackup(dir) {
  if (!path.isAbsolute(dir)) throw new Error('BACKUP_PATH_NOT_ABSOLUTE');
  const filename = path.join(dir, 'manifest.json');
  if (!fs.lstatSync(filename).isFile() || fs.lstatSync(filename).isSymbolicLink()) throw new Error('MANIFEST_INVALID');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const actual = auditDirectory(dir);
  if (!manifest.ok || !actual.ok || manifest.version !== 'W8LAB-JSON-PREFLIGHT-1' ||
    JSON.stringify(manifest.entries) !== JSON.stringify(actual.entries)) throw new Error('BACKUP_HASH_OR_PREFLIGHT_MISMATCH');
  return actual;
}
async function importTransaction(client, backupDir, manifest, mappingFor, projections) {
  const who = await client.query("SELECT r.rolsuper, r.rolbypassrls, r.rolcanlogin, pg_has_role(current_user,'w8lab_runtime','MEMBER') AS member, (SELECT count(*)::integer FROM pg_namespace WHERE nspname='w8lab') AS schema_count FROM pg_roles r WHERE r.rolname=current_user");
  const role = who.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls || !role.rolcanlogin || !role.member || role.schema_count !== 1)
    throw new Error('RUNTIME_ROLE_NOT_SAFE');
  let inTransaction=false,commitAttempted=false;
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE'); inTransaction=true;
    await client.query('SET LOCAL ROLE w8lab_runtime');
    await client.query("SET LOCAL lock_timeout = '5000ms'");
    await client.query("SET LOCAL statement_timeout = '10000ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15000ms'");
    await client.query('SELECT pg_advisory_xact_lock(26035,2202)');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    const allTables=['identity_keys',...COLLECTIONS.map(e=>e.table)];
    for (const table of allTables) {
      const exists=await client.query('SELECT count(*)::bigint AS count FROM w8lab.'+table);
      if (BigInt(exists.rows[0]?.count ?? -1)!==0n) throw new Error('TARGET_NOT_EMPTY');
    }
    const entryByTable=new Map(manifest.entries.map(e=>[e.table,e]));
    const plans=new Map();
    for (const entry of COLLECTIONS) {
      if (!entryByTable.get(entry.table).present) { plans.set(entry.table,[]); continue; }
      const records=JSON.parse(fs.readFileSync(path.join(backupDir,entry.file),'utf8'));
      if (hash(Buffer.from(JSON.stringify(records),'utf8'))!==entryByTable.get(entry.table).serializedSha256)
        throw new Error('SOURCE_CHANGED');
      plans.set(entry.table,records);
    }
    for (const entry of COLLECTIONS) {
      const table=entry.table,mapping=mappingFor(STORES[table]);
      if (!mapping || mapping.table!==table || mapping.columns.some(c=>!/^[a-z_]+$/.test(c)))
        throw new Error('MAPPING_MISMATCH');
      const columns=['id','payload_json','storage_order',...mapping.columns];
      const placeholders=columns.map((_,i)=>'$'+(i+1)).join(', ');
      let order=0;
      for (const record of plans.get(table)) {
        const projected=projections(mapping,record);
        const values=[record.id,JSON.stringify(record),String(++order),...projected];
        // Match the production adapter: reserve normalized identity *before* the account.
        // Both writes share this transaction; on any failure ROLLBACK removes the reservation.
        if (mapping.identityKind) {
          if (mapping.columns[0] !== 'email_normalized' || typeof projected[0] !== 'string')
            throw new Error('IDENTITY_MAPPING_INVALID');
          const reservation=await client.query('INSERT INTO w8lab.identity_keys (kind,account_id,email_normalized) VALUES ($1,$2,$3)',
            [mapping.identityKind,record.id,projected[0]]);
          if (reservation.rowCount!==1) throw new Error('IDENTITY_NOT_ACKNOWLEDGED');
        }
        const inserted=await client.query('INSERT INTO w8lab.'+table+' ('+columns.join(', ')+') VALUES ('+placeholders+')',values);
        if (inserted.rowCount!==1) throw new Error('INSERT_NOT_ACKNOWLEDGED');
      }
    }
    for (const entry of COLLECTIONS) {
      const current=await client.query('SELECT payload_json FROM w8lab.'+entry.table+' ORDER BY storage_order');
      const copy=current.rows.map(row=>JSON.parse(row.payload_json));
      if (copy.length!==entryByTable.get(entry.table).count ||
        hash(Buffer.from(JSON.stringify(copy),'utf8'))!==(entryByTable.get(entry.table).serializedSha256||hash(Buffer.from('[]'))))
        throw new Error('RECONCILIATION_FAILED');
    }
    // Force deferred FK validation while we still control the transaction.
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    // Once COMMIT is sent, a transport error cannot prove whether it committed.
    // Never ROLLBACK, retry or classify this as a known failure without reconciliation.
    commitAttempted=true;
    await client.query('COMMIT');
    inTransaction=false;
  } catch {
    if (commitAttempted) throw new Error('COMMIT_OUTCOME_UNKNOWN_STOP_AND_RECONCILE');
    if (inTransaction) {
      try { await client.query('ROLLBACK'); }
      catch { throw new Error('ROLLBACK_UNCERTAIN_STOP_AND_INSPECT'); }
    }
    throw new Error('IMPORT_ROLLED_BACK_CHECK_CONSTRAINTS_AND_LOGS');
  }
}
async function run(argv=process.argv.slice(2)) {
  if (![3,4].includes(argv.length) || argv[0]!=='--backup-dir' || !path.isAbsolute(argv[1]) ||
    argv[2]!=='--apply' || (argv.length===4&&argv[3]!=='--acknowledge-missing-collections'))
    throw new Error('USAGE_REQUIRES_VERIFIED_BACKUP_AND_EXPLICIT_APPLY');
  const backupDir=fs.realpathSync(argv[1]),report=loadVerifiedBackup(backupDir);
  if (!report.recordCount) throw new Error('EMPTY_BACKUP_NOT_IMPORTABLE');
  if (report.entries.some(e=>!e.present)&&argv[3]!=='--acknowledge-missing-collections')
    throw new Error('MISSING_SOURCE_COLLECTIONS_REQUIRE_REVIEW');
  const { mappingFor, projections }=require('../dist/repositories/postgres/mappings.js');
  const { readDatabaseConfig }=require('../dist/config/database.js');
  require('dotenv').config({path:path.resolve(__dirname,'../.env'),override:false,quiet:true});
  const { Pool }=require('pg');
  const pool=new Pool(readDatabaseConfig());
  let client;
  try {
    client=await pool.connect();
    await importTransaction(client,backupDir,report,mappingFor,projections);
  } finally {
    if (client) { try { client.release(true); } catch {} }
    await pool.end();
  }
  process.stdout.write(JSON.stringify({importCommitted:true,records:report.recordCount,
    message:'Import committed. Application remains JSON-backed until separately verified cutover.'})+'\n');
}
if (require.main===module) {
  run().catch(()=>{process.stderr.write('Migration failed or commit uncertain. Do not retry automatically; reconcile database state before any next action.\n');process.exitCode=1;});
}
module.exports={loadVerifiedBackup,importTransaction,run};
