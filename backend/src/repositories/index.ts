import { JsonStore } from './JsonStore';
import { Manufacturer, Instrument, TestCase, ObservationRecord, AuditRecord } from '../types/domain';

export const manufacturerStore = new JsonStore<Manufacturer>('manufacturers.json', true, 'Manufacturer');
export const instrumentStore = new JsonStore<Instrument>('instruments.json', true, 'Instrument');
export const testCaseStore = new JsonStore<TestCase>('testCases.json');
export const observationStore = new JsonStore<ObservationRecord>('observations.json');

export const auditStore = new JsonStore<AuditRecord>('audit.json');
export const nativeTestStore = new JsonStore<import('../types/native').NativeTestRecord>('nativeTests.json', true, 'Native test');
