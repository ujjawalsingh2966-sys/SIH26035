import { JsonStore } from './JsonStore';
import { Manufacturer, Instrument, TestCase, ObservationRecord } from '../types/domain';

export const manufacturerStore = new JsonStore<Manufacturer>('manufacturers.json');
export const instrumentStore = new JsonStore<Instrument>('instruments.json');
export const testCaseStore = new JsonStore<TestCase>('testCases.json');
export const observationStore = new JsonStore<ObservationRecord>('observations.json');
