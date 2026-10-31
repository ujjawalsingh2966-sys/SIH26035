import { ScopedJsonStore } from './ScopedJsonStore';
import { Manufacturer, Instrument, TestCase, ObservationRecord, AuditRecord } from '../types/domain';

export const manufacturerStore = new ScopedJsonStore<Manufacturer>('manufacturers.json');
export const instrumentStore = new ScopedJsonStore<Instrument>('instruments.json');
export const testCaseStore = new ScopedJsonStore<TestCase>('testCases.json');
export const observationStore = new ScopedJsonStore<ObservationRecord>('observations.json');

export const auditStore = new ScopedJsonStore<AuditRecord>('audit.json');
