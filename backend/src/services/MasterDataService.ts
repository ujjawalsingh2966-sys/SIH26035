import { unitOfWork } from '../repositories/persistence';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { manufacturerStore, instrumentStore, testCaseStore } from '../repositories';
import { convertToUnit, finiteDecimal, isMassUnit } from '../calculations/unitConversion';
import type { Instrument, Manufacturer, TestCase } from '../types/domain';

export class MasterDataError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type Actor = { id: string; role: string };
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
function text(value: unknown, field: string, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new MasterDataError(`${field} is required (maximum ${max} characters)`);
  return value.trim().replace(/\s+/g, ' ');
}
function allow(input: object, fields: string[]) {
  if (Object.keys(input).some(key => !fields.includes(key))) throw new MasterDataError('Unsupported or privileged master-data fields');
}
function mayEdit(record: { createdBy?: string }, actor: Actor) {
  if (actor.role !== 'Administrator' && (actor.role !== 'Technician' || record.createdBy !== actor.id)) throw new MasterDataError('Only its creating Technician or an Administrator may edit this record', 403);
}
function revision(record: { revision?: number }, supplied: unknown) {
  if (!Number.isSafeInteger(supplied) || supplied !== (record.revision ?? 0)) throw new MasterDataError('The record has changed. Refresh before retrying.', 409);
}
export async function saveManufacturer(input: Record<string, unknown>, actor: Actor, id?: string) {
  return unitOfWork.write(async () => {
    allow(input, ['name', 'address', 'identifier', ...(id ? ['expectedRevision'] : [])]);
    const current = id ? (await manufacturerStore.findById(id)) : undefined;
    if (id && !current) throw new MasterDataError('Manufacturer not found', 404);
    if (current) { mayEdit(current, actor); revision(current, input.expectedRevision); if (current.active === false) throw new MasterDataError('Archived manufacturers cannot be edited', 409); }
    const name = text(input.name, 'Manufacturer name'), address = text(input.address, 'Address', 600), identifier = text(input.identifier, 'Manufacturer identifier', 100);
    if ((await manufacturerStore.findAll()).some(item => item.id !== id && (normalized(item.identifier) === normalized(identifier)
      || normalized(item.name) === normalized(name) && normalized(item.address) === normalized(address)))) throw new MasterDataError('Manufacturer identifier or name/address already exists', 409);
    if (current) {
      const linked = (await instrumentStore.findAll()).filter(item => item.manufacturerId === current.id);
      if (linked.length && normalized(identifier) !== normalized(current.identifier)) throw new MasterDataError('Linked manufacturer identity is protected; identifier cannot change', 409);
      if ((await testCaseStore.findAll()).some(tc => linked.some(item => item.id === tc.instrumentId) && !tc.masterDataSnapshot)) throw new MasterDataError('Legacy test cases lack a frozen manufacturer snapshot; edits are blocked to preserve historical reports', 409);
    }
    const now = new Date().toISOString();
    return (await manufacturerStore.saveItem({ ...current, id: current?.id || `mfr_${randomUUID()}`, name, address, identifier, active: true,
      createdBy: current?.createdBy || actor.id, createdAt: current?.createdAt || now, updatedAt: now, revision: current ? (current.revision ?? 0) + 1 : 0,
      history: [...(current?.history || []), { action: current ? 'UPDATED' : 'CREATED', actorId: actor.id, timestamp: now,
        ...(current ? { previous: { name: current.name, address: current.address, identifier: current.identifier } } : {}) }] }));
  });
}
export async function archiveManufacturer(id: string, expectedRevision: unknown, actor: Actor) {
  return unitOfWork.write(async () => {
    const current = (await manufacturerStore.findById(id));
    if (!current) throw new MasterDataError('Manufacturer not found', 404);
    mayEdit(current, actor); revision(current, expectedRevision);
    if (current.active === false || (await instrumentStore.findAll()).some(item => item.manufacturerId === id)) throw new MasterDataError('Archived or linked manufacturers cannot be removed', 409);
    const now = new Date().toISOString();
    return (await manufacturerStore.saveItem({ ...current, active: false, revision: (current.revision ?? 0) + 1, updatedAt: now,
      history: [...(current.history || []), { action: 'ARCHIVED', actorId: actor.id, timestamp: now }] }));
  });
}

/** Registration checks for declared single-range graduated instruments. This is
 * metadata validation, never test-programme determination or certification. */
export async function validateInstrument(input: Record<string, unknown>): Promise<Omit<Instrument, 'id'>> {
  return unitOfWork.read(async () => {
    const fields = ['manufacturerId', 'name', 'model', 'serialNumber', 'isWeighing', 'isManual', 'isElectronic', 'isSingleRange',
      'accuracyClass', 'maxCapacity', 'minCapacity', 'e', 'd', 'hasTare', 'weighingUnit', 'n', 'hasAuxiliaryIndication', 'isGrading',
      'softwareControlled', 'softwareIdentification', 'typeApprovalMark', 'technicalNotes', 'expectedRevision'];
    allow(input, fields);
    const manufacturerId = text(input.manufacturerId, 'Manufacturer');
    const manufacturer = (await manufacturerStore.findById(manufacturerId));
    if (!manufacturer || manufacturer.active === false) throw new MasterDataError('Select an existing active manufacturer');
    const name = text(input.name, 'Instrument name'), model = text(input.model, 'Model'), serialNumber = text(input.serialNumber, 'Serial number');
    for (const flag of ['isWeighing', 'isManual', 'isElectronic', 'isSingleRange', 'hasTare', 'hasAuxiliaryIndication', 'isGrading', 'softwareControlled']) {
      if (typeof input[flag] !== 'boolean') throw new MasterDataError(`${flag} must be explicitly declared as true or false`);
    }
    if (![input.isWeighing, input.isManual, input.isElectronic, input.isSingleRange].every(value => value === true)) throw new MasterDataError('OUT_OF_SCOPE: automatic, mechanical or multi-range/multi-interval configurations are not supported. No instrument was saved.', 422);
    if (!['I', 'II', 'III', 'IIII'].includes(input.accuracyClass as string)) throw new MasterDataError('Select accuracy class I, II, III or IIII');
    if (!isMassUnit(input.weighingUnit)) throw new MasterDataError('Unsupported weighing unit; use mg, g, kg or t');
    const quantities: Record<string, Decimal> = {};
    for (const key of ['maxCapacity', 'minCapacity', 'e', 'd']) {
      const value = input[key];
      if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value) || value.length > 40) throw new MasterDataError(`${key} must be a positive decimal string (no exponent or binary notation)`);
      quantities[key] = convertToUnit({ value, unit: input.weighingUnit }, 'g').value;
      if (!quantities[key].gt(0)) throw new MasterDataError(`${key} must be greater than zero`);
    }
    const { maxCapacity: max, minCapacity: min, e, d } = quantities;
    if (!min.lt(max) || d.gt(e)) throw new MasterDataError('Require 0 < Min < Max and 0 < d ≤ e');
    const step = (value: Decimal) => /^[125](?:\.0+)?e[+-]?\d+$/.test(value.toExponential());
    if (!step(e) || !step(d)) throw new MasterDataError('Scale intervals must be 1, 2 or 5 times a power of ten');
    const n = max.div(e);
    if (!max.mod(e).isZero() || !n.isInteger()) throw new MasterDataError('Max must be an integer multiple of e; n = Max/e');
    if (input.n !== undefined && (!/^\d+$/.test(String(input.n)) || typeof input.n !== 'string' || !finiteDecimal(input.n).eq(n))) throw new MasterDataError('Declared n must equal Max/e exactly');
    const cls = input.accuracyClass;
    let minN: number, maxN: number | undefined, factor: number;
    if (cls === 'I') { if (e.lt('0.001')) throw new MasterDataError('Class I with e below 1 mg requires a specialist profile not implemented here', 422); minN = 50000; factor = 100; }
    else if (cls === 'II') { if (e.lt('0.001')) throw new MasterDataError('Class II e must be at least 0.001 g'); minN = e.lte('0.05') ? 100 : 5000; maxN = 100000; factor = e.lte('0.05') ? 20 : 50; }
    else if (cls === 'III') { if (e.lt('0.1')) throw new MasterDataError('Class III e must be at least 0.1 g'); minN = e.lte(2) ? 100 : 500; maxN = 10000; factor = 20; }
    else { if (e.lt(5)) throw new MasterDataError('Class IIII e must be at least 5 g'); minN = 100; maxN = 1000; factor = 10; }
    const auxiliary = input.hasAuxiliaryIndication === true;
    if (auxiliary) {
      if (!['I', 'II'].includes(cls as string) || !d.lt(e) || !/^1e[+-]?\d+$/.test(e.toExponential()) || e.gt(d.times(10))) throw new MasterDataError('Auxiliary indication requires class I/II, power-of-ten e and d < e ≤ 10d; specialist exceptions are not supported');
    } else if (!d.eq(e)) throw new MasterDataError('Graduated instruments without auxiliary indication require e = d');
    if (n.lt(minN) || maxN !== undefined && n.gt(maxN)) throw new MasterDataError('n is outside the supported accuracy-class interval range (R76-1 Table 3)');
    if (input.isGrading === true && cls !== 'III' && cls !== 'IIII') throw new MasterDataError('Special grading profiles for this class are not implemented', 422);
    const minLimit = (auxiliary ? d : e).times(input.isGrading === true ? 5 : factor);
    if (min.lt(minLimit)) throw new MasterDataError('Min is below the applicable declared-profile lower limit');
    const softwareIdentification = input.softwareControlled ? text(input.softwareIdentification, 'Software identification', 160) : undefined;
    const optional = (key: string, limit = 160) => input[key] === undefined || input[key] === '' ? undefined : text(input[key], key, limit);
    if (input.softwareControlled === false && input.softwareIdentification) throw new MasterDataError('Software identification contradicts the declared non-software-controlled profile');
    return { manufacturerId, name, model, serialNumber, isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
      accuracyClass: cls as Instrument['accuracyClass'], maxCapacity: max.toString(), minCapacity: min.toString(), e: e.toString(), d: d.toString(),
      weighingUnit: 'g', n: n.toString(), hasTare: input.hasTare as boolean, hasAuxiliaryIndication: auxiliary, isGrading: input.isGrading as boolean,
      softwareControlled: input.softwareControlled as boolean, softwareIdentification, typeApprovalMark: optional('typeApprovalMark'), technicalNotes: optional('technicalNotes', 1000),
      declaredSpecifications: { unit: input.weighingUnit, maxCapacity: input.maxCapacity as string, minCapacity: input.minCapacity as string, e: input.e as string, d: input.d as string } };
  });
}
export function evaluationSupport(instrument: Instrument) {
  const reasons: string[] = [];
  if (instrument.accuracyClass === 'I') reasons.push('Class I evaluation is not implemented');
  if (instrument.hasAuxiliaryIndication === true) reasons.push('Auxiliary indicating-device evaluation is not implemented');
  if (instrument.isGrading === true) reasons.push('Special grading-instrument evaluation is not implemented');
  if (!instrument.declaredSpecifications || !instrument.n) reasons.push('Legacy metadata has not been validated under the current registration schema');
  return { supported: reasons.length === 0, reasons };
}
export async function saveInstrument(input: Record<string, unknown>, actor: Actor, id?: string) {
  return unitOfWork.write(async () => {
    const current = id ? (await instrumentStore.findById(id)) : undefined;
    if (id && !current) throw new MasterDataError('Instrument not found', 404);
    if (current) {
      mayEdit(current, actor); revision(current, input.expectedRevision);
      if ((await testCaseStore.findAll()).some(tc => tc.instrumentId === id)) throw new MasterDataError('Instrument specifications are protected once linked to a test case', 409);
    }
    const validated = (await validateInstrument(input));
    if ((await instrumentStore.findAll()).some(item => item.id !== id && item.manufacturerId === validated.manufacturerId && normalized(item.serialNumber) === normalized(validated.serialNumber))) throw new MasterDataError('This manufacturer/serial identity is already registered', 409);
    const now = new Date().toISOString();
    return (await instrumentStore.saveItem({ ...validated, id: current?.id || `inst_${randomUUID()}`, createdBy: current?.createdBy || actor.id,
      revision: current ? (current.revision ?? 0) + 1 : 0, createdAt: current?.createdAt || now, updatedAt: now }));
  });
}
export async function caseMasterData(testCase: TestCase): Promise<{ instrument: Instrument | undefined; manufacturer: Manufacturer | undefined; source: 'SNAPSHOT' | 'LEGACY_LIVE_REFERENCE' }> {
  return unitOfWork.read(async () => {
    if (testCase.masterDataSnapshot) return { instrument: testCase.masterDataSnapshot.instrument, manufacturer: testCase.masterDataSnapshot.manufacturer, source: 'SNAPSHOT' };
    const instrument = (await instrumentStore.findById(testCase.instrumentId));
    return { instrument, manufacturer: instrument && (await manufacturerStore.findById(instrument.manufacturerId)), source: 'LEGACY_LIVE_REFERENCE' };
  });
}
