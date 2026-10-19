// Read-only audit. No migration, store save or record-content output.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function main() {
  const directory = path.resolve(process.env.DATA_DIR || path.resolve(__dirname, '../../../data'));
  const file = path.join(directory, 'testCases.json');
  if (!fs.existsSync(directory)) throw new Error('The requested data directory does not exist');
  if (!fs.existsSync(file)) {
    console.log(JSON.stringify({ testCasesPresent: false, cases: 0, nativeProgrammes: 0, invalid: [] }));
    return;
  }
  const records: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(records)) throw new Error('Test-case storage is not an array');
  // Import after confirming storage exists; JsonStore constructors cannot create
  // a missing directory during this audit. No store mutation methods are called.
  const { nativeProgrammeIssue } = await import('../services/NativeApplicability');
  const native = records.filter(record => record && typeof record === 'object' && record.nativeProgramme !== undefined);
  const invalid = native.flatMap(record => {
    const issue = nativeProgrammeIssue(record.nativeProgramme);
    return issue ? [{ caseId: typeof record.id === 'string' ? record.id : 'MALFORMED_ID', issue }] : [];
  });
  console.log(JSON.stringify({ testCasesPresent: true, cases: records.length, nativeProgrammes: native.length, invalid }));
  if (invalid.length) process.exitCode = 2;
}
main().catch(() => { console.error('Native profile audit could not read/validate the requested data directory. No records were changed.'); process.exitCode = 1; });
