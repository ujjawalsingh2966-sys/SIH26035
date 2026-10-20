import { encodeRecord, decodeRecord, detachRecord } from '../src/repositories/postgres/serialization';
import { PersistenceError } from '../src/repositories/PersistenceError';
import { createRepositories } from '../src/repositories/createRepositories';
import { instrumentFingerprint, buildNativeProgramme, nativeProgrammeIssue } from '../src/services/NativeApplicability';
import { nativeFingerprint, evaluateNative } from '../src/services/NativeEvaluation';
import { validatePerformance } from '../src/services/PerformancePlan';
import type { Instrument } from '../src/types/domain';
import type { NativeProfile, NativeSubmission, PerformanceProfile } from '../src/types/native';
import { FakePg } from './helpers/fakePg';

const instrument: Instrument = {
  id: 'serialization-instrument', manufacturerId: 'serialization-maker', name: 'Synthetic scale', model: 'SERIAL', serialNumber: 'SERIAL-ONLY',
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, accuracyClass: 'III',
  maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', n: '3000', weighingUnit: 'g', hasTare: false,
  hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false,
  declaredSpecifications: { unit: 'g', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5' },
};
const profile: NativeProfile = { purpose: 'TYPE_EVALUATION', indication: 'DIGITAL', zeroDevices: ['SEMI_AUTOMATIC'],
  initialZeroSetting: false, eccentricityPossible: true, loadReceptor: 'PLATFORM', supportPoints: 4,
  evidenceReference: 'SYNTHETIC serialization evidence' };
const submission: NativeSubmission = { procedureId: 'ZERO_SEMI_AUTOMATIC', series: 'ACCURACY',
  readings: [{ sequence: 1, load: '0', indication: '0', additionalWeights: '1.25', unit: 'g' }],
  conditions: { stable: true, sufficientAccuracy: true, zeroInitiatedNearChangeover: true }, evidenceReference: 'SYNTHETIC calibration record' };
const performance: PerformanceProfile = {
  selfIndicating: true, devices: ['DISPLAY'], tareKind: 'NONE', maximumTareG: null, tareWeighingDevice: false,
  combinedZeroTare: false, mobile: false, adjacentSupports: false, rollingSections: null, rollingReverse: null,
  rollingLoadG: null, initialZeroRangeG: null, stabilityFunctions: [], stabilityDocumentation: '', stabilityWorstCase: '', stabilityLoadsG: {},
};
const reload = <T extends { id: string }>(record: T): T => decodeRecord<T>(encodeRecord(record), record.id);

it('retains own undefined during staging, and uses explicit legacy JSON-reload semantics durably', () => {
  const record = { id: 'presence', optional: undefined, explicitNull: null, nested: { optional: undefined, text: 'kept' }, values: [undefined, , null] };
  const detached = detachRecord(record), restored = reload(record);
  expect(Object.prototype.hasOwnProperty.call(detached, 'optional')).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(detached.nested, 'optional')).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(restored, 'optional')).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(restored.nested, 'optional')).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(restored, 'explicitNull')).toBe(true);
  expect(restored.values).toEqual([null, null, null]);
  expect(restored).toEqual(JSON.parse(JSON.stringify(record)));
  expect(JSON.stringify(restored)).toBe(JSON.stringify(record));
});

it('preserves insertion-key order, decimal lexemes, timestamps and string identifiers without normalization', () => {
  const record = { id: '00042', z: '0001.2500', a: '9007199254740993', m: '0.00000001',
    timestamp: '2026-01-02T03:04:05.123+05:30', nested: { z: 1, a: 2 }, optional: undefined };
  const restored = reload(record);
  expect(Object.keys(restored)).toEqual(['id', 'z', 'a', 'm', 'timestamp', 'nested']);
  expect(encodeRecord(restored)).toBe(JSON.stringify(record));
  expect(restored.timestamp).toBe(record.timestamp); expect(restored.a).toBe(record.a);
  expect(Object.keys(restored.nested)).toEqual(['z', 'a']);
});

it.each([null, [], { id: 12 }, { id: 'x', value: 1n }, { id: 'x', value: () => 'unsupported' }])(
  'rejects invalid/non-detachable records without leaking values (%#)', value => {
    expect(() => detachRecord(value as any)).toThrow(PersistenceError);
  });
it('rejects circular serialization with the sanitized error', () => {
  const value: any = { id: 'circular' }; value.self = value;
  expect(() => encodeRecord(value)).toThrow('Stored record could not be represented safely');
});
it.each(['null', '[]', '{"id":"other"}', '{malformed', { id: 'x' }])('rejects invalid durable payload (%#)', payload => {
  expect(() => decodeRecord(payload, 'x')).toThrow(PersistenceError);
});

it('preserves instrument/native input fingerprints and native evaluations across an adapter reload', async () => {
  const fake = new FakePg(), make = () => createRepositories({ environment: { PERSISTENCE_ADAPTER: 'postgres' }, postgresPool: fake });
  const bundle = make(), programme = buildNativeProgramme(instrument, profile, 'synthetic-technician');
  const result = evaluateNative(programme, submission), fingerprint = nativeFingerprint(programme, submission);
  await bundle.instrumentStore.saveItem(instrument);
  await bundle.nativeTestStore.saveItem({ id: 'native-row', testCaseId: 'case', programmeId: programme.id,
    submission, result, inputFingerprint: fingerprint, createdAt: programme.createdAt, createdBy: 'synthetic-technician' });
  // The frozen programme lives inside a case payload, not in a newly invented table.
  const restoredProgramme = reload(programme), restoredInstrument = (await make().instrumentStore.findById(instrument.id))!;
  const restoredTest = (await make().nativeTestStore.findById('native-row'))!;
  expect(instrumentFingerprint(restoredInstrument)).toBe(instrumentFingerprint(instrument));
  expect(nativeFingerprint(restoredProgramme, restoredTest.submission)).toBe(fingerprint);
  expect(restoredTest.result).toEqual(result); expect(nativeProgrammeIssue(restoredProgramme)).toBeUndefined();
});

it('valid explicit-null performance declarations retain own fields and identical validation', () => {
  const wrapped = { id: 'declaration', performance }, restored = reload(wrapped);
  expect(Object.keys(restored.performance)).toEqual(Object.keys(performance));
  expect(validatePerformance(restored.performance, instrument)).toEqual(validatePerformance(performance, instrument));
});
it.each(['selfIndicating', 'maximumTareG', 'stabilityFunctions', 'rollingSections'])('required own-property %s cannot be undefined before OR after serialization', field => {
  const malformed = { ...performance, [field]: undefined };
  expect(Object.prototype.hasOwnProperty.call(malformed, field)).toBe(true);
  expect(() => validatePerformance(malformed, instrument)).toThrow();
  expect(() => validatePerformance(reload({ id: 'invalid-declaration', performance: malformed }).performance, instrument)).toThrow();
});
