const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/masterData.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports, require });
const { registrationIssue } = moduleUnderTest.exports;
const valid = { manufacturerId: 'synthetic-manufacturer', name: 'Synthetic balance', model: 'Example III', serialNumber: 'SYNTHETIC-01',
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, hasTare: false,
  accuracyClass: 'III', maxCapacity: '3000', minCapacity: '20', e: '1', d: '1', weighingUnit: 'g',
  hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false, softwareIdentification: '' };
test('client accepts an explicitly declared supported registration', () => assert.equal(registrationIssue(valid), undefined));
test('client preserves g/kg physical equivalence with exact decimals', () => assert.equal(registrationIssue({ ...valid, weighingUnit: 'kg', maxCapacity: '3', minCapacity: '0.02', e: '0.001', d: '0.001' }), undefined));
for (const [name, patch] of [
  ['missing manufacturer', { manufacturerId: '' }], ['missing identity', { serialNumber: ' ' }],
  ['invalid unit', { weighingUnit: 'lb' }], ['zero interval', { e: '0' }], ['malformed decimal', { e: '1e0' }],
  ['nonintegral n', { maxCapacity: '3000.1' }], ['invalid step', { e: '3', d: '3' }],
  ['inconsistent intervals', { d: '0.5' }], ['Min below limit', { minCapacity: '19.999' }],
  ['n outside class range', { maxCapacity: '10001' }], ['unconfirmed flag', { hasTare: undefined }],
  ['unsupported configuration', { isManual: false }], ['missing software identification', { softwareControlled: true }],
  ['contradictory software identification', { softwareIdentification: 'SYNTHETIC-1' }],
]) test(`client rejects ${name}`, () => assert.equal(typeof registrationIssue({ ...valid, ...patch }), 'string'));
test('client permits exact Min/n boundaries', () => assert.equal(registrationIssue({ ...valid, maxCapacity: '10000' }), undefined));
test('client distinguishes register-only class I metadata from engine support', () => assert.equal(registrationIssue({ ...valid, accuracyClass: 'I', maxCapacity: '50000', minCapacity: '100' }), undefined));
