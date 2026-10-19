// Test-only legacy fixture. Run BEFORE starting the isolated backend. Never
// points at project data and never installs a finalizable programme.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const runRoot = path.resolve(process.env.W8LAB_BROWSER_RUN_DIR || '');
const artifacts = path.join(root, 'artifacts', 'browser-review') + path.sep;
if (!process.env.W8LAB_BROWSER_RUN_DIR || !runRoot.startsWith(artifacts)) throw new Error('Use a new browser-review artifact directory.');
const data = path.join(runRoot, 'data');
if (fs.existsSync(data) && fs.readdirSync(data).length) throw new Error('Refusing to overwrite existing data. Choose a new run directory.');
fs.mkdirSync(data, { recursive: true });
const instrument = {
  id: 'p0-legacy-scale', manufacturerId: 'p0-legacy-maker', name: 'P0 legacy approved fixture', model: 'P0-LEGACY', serialNumber: 'LEGACY-001',
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
  accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: false,
};
const row = { id: 'p0-legacy-observation', testCaseId: 'p0-legacy-approved', testType: 'WEIGHING', sequence: 1,
  load: '5000', indication: '5000', additionalWeights: '2.5', unit: 'g' };
const { EvaluationService } = require('../backend/dist/services/EvaluationService');
row.evaluation = EvaluationService.evaluateObservation(instrument, row, true);
delete row.evaluation.calculationVersion;
delete row.evaluation.inputFingerprint;
const now = new Date().toISOString();
const collections = {
  manufacturers: [{ id: instrument.manufacturerId, name: 'Synthetic legacy manufacturer', address: 'Isolated browser test', identifier: 'P0-M' }],
  instruments: [instrument], observations: [row],
  testCases: [{ id: row.testCaseId, instrumentId: instrument.id, technicianId: 'p0-legacy-other-owner', status: 'APPROVED', revision: 0,
    createdAt: now, updatedAt: now, approvalDate: now,
    laboratoryConditions: { temperature: '20', humidity: '50', pressure: '1013' },
    testConfiguration: { weighing: 'COMPLETE', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED', tare: 'NOT APPLICABLE', zeroSetting: 'NOT STARTED' } }],
};
for (const [name, rows] of Object.entries(collections)) fs.writeFileSync(path.join(data, `${name}.json`), JSON.stringify(rows, null, 2));
console.log('Created isolated, deliberately incomplete legacy APPROVED fixture; no records overwritten.');
