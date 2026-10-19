const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/native.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: m, exports: m.exports });
const { emptyPerformanceProfile, blankPerformanceReading, nativeFormIssue } = m.exports;
test('unknown characteristics stay unknown instead of defaulting to N/A', () => { const p = emptyPerformanceProfile(true); assert.equal(p.selfIndicating, null); assert.equal(p.mobile, null); assert.equal(p.stabilityFunctions, null); assert.equal(p.tareKind, 'UNKNOWN'); assert.equal(p.maximumTareG, null); });
test('frozen absence of tare is preserved without inventing a capacity', () => { const p = emptyPerformanceProfile(false); assert.equal(p.tareKind, 'NONE'); assert.equal(p.maximumTareG, null); assert.equal(p.tareWeighingDevice, false); });
for (const id of ['WEIGHING', 'ECCENTRICITY', 'TARE', 'TARE_ACCURACY', 'TARE_COMPARISON', 'DISCRIMINATION', 'CREEP', 'ZERO_RETURN', 'EQUILIBRIUM', 'MULTIPLE_INDICATORS', 'SUPPLEMENTARY_WEIGHING'])
    test(`${id} blank row contains no invented mass or timestamp`, () => { const r = blankPerformanceReading(1, 'kg', id, { loadG: '5000', phase: 'UP', position: 'QUARTER_1', tareG: '3000' }, 2); assert.equal(r.load, ''); assert.equal(r.indication, ''); assert.equal(r.additionalWeights, ''); assert.ok(!r.timestamp); assert.ok(!r.continuousBlocked); if (r.zero)
        assert.equal(r.zero.indication, ''); if (r.deviceIndications)
        assert.equal(r.deviceIndications[0].indication, ''); });
test('position and phase targets are retained as metadata, not observed quantities', () => { const r = blankPerformanceReading(2, 'g', 'ECCENTRICITY', { loadG: '5000', position: 'QUARTER_2' }); assert.equal(r.position, 'QUARTER_2'); assert.equal(r.load, ''); assert.equal(r.zero.additionalWeights, ''); });
test('client invalid quantity failure preserves the original input', () => { const r = blankPerformanceReading(1, 'lb', 'WEIGHING', { loadG: '5000' }); r.load = '5000'; r.indication = '5000'; r.additionalWeights = '2.5'; const s = { readings: [r], evidenceReference: 'Synthetic evidence' }, before = JSON.stringify(s); assert.match(nativeFormIssue(s, false), /unit/); assert.equal(JSON.stringify(s), before); });
