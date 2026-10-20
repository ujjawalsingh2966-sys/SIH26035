// Run the real backend suite without loading workspace .env or project records.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'w8lab-phase2a-tests-'));
const resultFile = path.join(temporary, 'results.json');
const environment = { ...process.env, NODE_ENV: 'test',
  JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  DATA_DIR: path.join(temporary, 'synthetic-data'),
  DOTENV_CONFIG_PATH: path.join(temporary, 'no-environment-file') };
// Never inherit live DB configuration, including libpq/SSL and Supabase credentials.
for (const key of Object.keys(environment)) {
  if (/^(DATABASE_|PG|SUPABASE_)/i.test(key)) delete environment[key];
}
environment.PERSISTENCE_ADAPTER = 'json';
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/jest/bin/jest.js'),
  '--config', path.join(root, 'backend/jest.config.js'), '--runInBand', '--coverage=false', '--silent',
  '--cacheDirectory', path.join(temporary, 'cache'), '--json', '--outputFile', resultFile,
  ...process.argv.slice(2)], { cwd: temporary, env: environment, encoding: 'utf8', timeout: 240000 });
if (fs.existsSync(resultFile)) {
  const report = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  console.log(JSON.stringify({ artifactDirectory: temporary, exitCode: result.status,
    tests: { total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, pending: report.numPendingTests },
    suites: { total: report.numTotalTestSuites, passed: report.numPassedTestSuites, failed: report.numFailedTestSuites },
    failures: report.testResults.filter(s => s.status === 'failed').map(s => ({
      file: path.relative(root, s.name),
      names: s.assertionResults.filter(t => t.status === 'failed').map(t => t.fullName),
      diagnostics: [...(s.message || '').matchAll(/error TS\d+:[^\n]+/g)].map(m => m[0].replace(/\x1b\[[0-9;]*m/g, ''))
    })) }, null, 2));
} else console.log(JSON.stringify({ artifactDirectory: temporary, exitCode: result.status,
  error: result.error?.code || 'No Jest result file; captured output withheld' }));
process.exitCode = result.status ?? 1;
