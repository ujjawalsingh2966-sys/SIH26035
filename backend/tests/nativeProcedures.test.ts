import { clearRepository } from './helpers/persistenceFixtures';
import request from 'supertest';
import fs from 'fs';
import app from '../src/app';
import { buildNativeProgramme, validateProfile } from '../src/services/NativeApplicability';
import { evaluateNative } from '../src/services/NativeEvaluation';
import { assessStoredProgramme } from '../src/services/ProgrammeAssessment';
import { manufacturerStore, instrumentStore, testCaseStore, observationStore, nativeTestStore, auditStore } from '../src/repositories';
import { saveInstrument } from '../src/services/MasterDataService';
import { testSession } from './helpers/persistedIdentity';
import { ReportService } from '../src/services/ReportService';
import type { NativeProfile, NativeSubmission, NativeProgramme } from '../src/types/native';
let tech: string;
let other: string;
let reviewer: string;
beforeAll(async () => {
tech = (await testSession('p3-tech','Technician'));
other = (await testSession('p3-other','Technician'));
reviewer = (await testSession('p3-review','Reviewer'));
});
const registration = { manufacturerId: 'p3-maker', name: 'Synthetic P3 scale', model: 'P3', serialNumber: 'P3-1', accuracyClass: 'III',
  maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', weighingUnit: 'g', hasTare: false,
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false };
const profile: NativeProfile = { purpose: 'INITIAL_VERIFICATION', indication: 'DIGITAL', zeroDevices: ['SEMI_AUTOMATIC'], initialZeroSetting: false,
  eccentricityPossible: true, loadReceptor: 'PLATFORM', supportPoints: 4, evidenceReference: 'Synthetic manual and calibrated-mass record P3' };
const api = (method: string, endpoint: string, payload?: object, token = tech) => (request(app) as any)[method](`/api/v1${endpoint}`).set('Authorization',`Bearer ${token}`).send(payload);
let programme: NativeProgramme, instrument: Awaited<ReturnType<typeof saveInstrument>>;
const conditions = { stable: true, sufficientAccuracy: true, zeroInitiatedNearChangeover: true, outsideAutomaticRange: true, otherAutomaticDevicesDisabled: true, automaticDevicesInOperation: true };
const repetition = (sequence: number, indication = '12000', additionalWeights = '2.5') => ({ sequence, load: '12000', indication, additionalWeights, unit: 'g', unloadedIndication: '0', unloadedAtRest: true, resetToZero: false });
const repeat = (): NativeSubmission => ({ procedureId: 'REPEATABILITY', series: 'EIGHTY_PERCENT', readings: [repetition(1), repetition(2), repetition(3)], conditions, evidenceReference: 'SYNTHETIC-series-record' });
const zero = (delta = '1.25', mechanism = 'SEMI_AUTOMATIC'): NativeSubmission => ({ procedureId: `ZERO_${mechanism}`, series: 'ACCURACY',
  readings: [{ sequence: 1, load: ['AUTOMATIC','ZERO_TRACKING'].includes(mechanism) ? '50' : '0', indication: ['AUTOMATIC','ZERO_TRACKING'].includes(mechanism) ? '50' : '0', additionalWeights: delta, unit: 'g' }], conditions, evidenceReference: 'SYNTHETIC-zero-record' });
beforeEach(async () => {
  for (const store of [manufacturerStore,instrumentStore,testCaseStore,observationStore,nativeTestStore,auditStore]) (await clearRepository(store));
  (await manufacturerStore.saveItem({ id: 'p3-maker', name: 'Synthetic manufacturer', address: 'Test lab', identifier: 'P3-M' }));
  instrument = (await saveInstrument(registration,{id:'p3-tech',role:'Technician'}));
  programme = buildNativeProgramme(instrument, profile, 'p3-tech');
});
it('has explicit unknown/unsupported/N/A distinctions and references, never a whole-standard PASS', () => {
  const unknown = buildNativeProgramme(instrument,{...profile, indication:'UNKNOWN',zeroDevices:null,initialZeroSetting:null,eccentricityPossible:null},'p3-tech');
  expect(unknown.decisions.find(item => item.id === 'REPEATABILITY')!.applicability).toBe('UNDETERMINED');
  expect(unknown.decisions.some(item => item.applicability === 'UNSUPPORTED')).toBe(true);
  expect(programme.decisions.find(item => item.id === 'TARE')!).toMatchObject({applicability:'NOT APPLICABLE',reason:expect.stringContaining('hasTare=false')});
  expect(programme.decisions.every(item => item.clauses.length && item.reason)).toBe(true);
});
it.each([
  ['TYPE_EVALUATION','III','15000',10,2], ['TYPE_EVALUATION','III','1000000',3,2],
  ['INITIAL_VERIFICATION','II','15000',6,1], ['INITIAL_VERIFICATION','III','15000',3,1], ['INITIAL_VERIFICATION','IIII','15000',3,1],
])('derives prescribed repeatability counts for %s class %s Max=%s g', (purpose, accuracyClass,maxCapacity,count,series) => {
  const p = buildNativeProgramme({...instrument,accuracyClass:accuracyClass as any,maxCapacity},{...profile,purpose:purpose as any},'tech');
  const samples = p.decisions.find(item => item.id === 'REPEATABILITY')!.samples!;
  expect(samples).toHaveLength(series as number); expect(samples.every(item => item.count === count)).toBe(true);
});
it.each([{accuracyClass:'I'}, {hasAuxiliaryIndication:true}, {isSingleRange:false}, {isGrading:true}])('blocks unsupported instrument profiles %p', patch => {
  const p = buildNativeProgramme({...instrument,...patch} as any, profile,'tech');
  expect(p.decisions.find(item => item.id === 'REPEATABILITY')!.applicability).toBe('UNSUPPORTED');
  expect(() => evaluateNative(p,repeat())).toThrow(/unsupported/);
});
it('requires evidence for N/A eccentricity and rejects privileged profile fields', () => {
  expect(() => validateProfile({...profile,eccentricityPossible:false})).toThrow(/Justification/);
  expect(() => validateProfile({...profile,complete:true})).toThrow(/Unsupported/);
  const p = buildNativeProgramme(instrument,validateProfile({...profile,eccentricityPossible:false,noEccentricityJustification:'Fixed central load only; fixture drawing'}),'tech');
  expect(p.decisions.find(item => item.id === 'ECCENTRICITY')!.reason).toContain('fixture drawing');
});
it('uses independent repeatability spread and individual-error checks at the exact limit', () => {
  const submission = repeat(); submission.readings[0] = repetition(1,'11995','0'); // E=-2.5
  submission.readings[2] = repetition(3,'12005','2.5'); // E=5; spread=7.5; MPE=1.5e=7.5
  const result = evaluateNative(programme,submission);
  expect(result).toMatchObject({status:'PASS',spreadG:'7.5',limitG:'7.5',minimumErrorG:'-2.5',maximumErrorG:'5'});
  submission.readings[2].additionalWeights='2.4999'; // E=5.0001; spread=7.5001, all individual errors still within MPE.
  expect(evaluateNative(programme,submission)).toMatchObject({status:'FAIL',spreadG:'7.5001',spreadVerdict:'FAIL'});
});
it('a zero spread cannot hide an individual error outside MPE', () => {
  const submission = repeat(); submission.readings = [1,2,3].map(sequence => repetition(sequence,'12010','2.5'));
  expect(evaluateNative(programme,submission)).toMatchObject({status:'FAIL',spreadG:'0',spreadVerdict:'PASS'});
});
it('accepts both prescribed type-evaluation series, not just a generic single reading', () => {
  const p = buildNativeProgramme(instrument,{...profile,purpose:'TYPE_EVALUATION'},'tech');
  for (const [series,load,count,limit] of [['HALF_MAX','7500',10,'5'],['MAX','15000',10,'7.5']] as const) {
    const input = {...repeat(),series,readings:Array.from({length:count},(_,index)=>({...repetition(index+1),load,indication:load}))};
    expect(evaluateNative(p,input)).toMatchObject({status:'PASS',count,requiredCount:count,limitG:limit});
    input.readings.pop(); expect(evaluateNative(p,input).status).toBe('INCOMPLETE');
  }
});
it.each(['NON_AUTOMATIC','SEMI_AUTOMATIC','AUTOMATIC','ZERO_TRACKING'])('evaluates distinct %s accuracy with ±0.25e, not the ordinary MPE', mechanism => {
  const p = buildNativeProgramme(instrument,{...profile,zeroDevices:[mechanism as any]},'tech');
  expect(evaluateNative(p,zero('1.25',mechanism))).toMatchObject({status:'PASS',limitG:'1.25'});
  expect(evaluateNative(p,zero('1.2499',mechanism)).status).toBe('FAIL');
  expect(evaluateNative(p,zero('3.75',mechanism)).status).toBe('PASS');
  expect(evaluateNative(p,zero('3.7501',mechanism)).status).toBe('FAIL');
});
it.each(['mg','kg','t'])('preserves physical %s equivalence for repeatability and zero errors', unit => {
  // Independent literal quantities, not production functions used to generate expectations.
  const quantities:any={mg:{L:'12000000',I:'12005000',D:'2500',Z:'1250'},kg:{L:'12',I:'12.005',D:'0.0025',Z:'0.00125'},t:{L:'0.012',I:'0.012005',D:'0.0000025',Z:'0.00000125'}};
  const q=quantities[unit], r=repeat(); r.readings=r.readings.map(row=>({...row,load:q.L,indication:q.I,additionalWeights:q.D,unit}));
  expect(evaluateNative(programme,r)).toMatchObject({status:'PASS',spreadG:'0',limitG:'7.5'});
  const z=zero(); z.readings[0]={...z.readings[0],unit,additionalWeights:q.Z};
  expect(evaluateNative(programme,z).rows[0].E).toBe('1.25');
});
it.each([{unit:'lb'}, {load:'NaN'}, {indication:'1e3'}, {additionalWeights:'-1'}, {load:'12001'}, {sequence:2}, {indication:'12000.1'}, {additionalWeights:'6'}])('rejects malformed/inconsistent repetition %p', patch => {
  const r=repeat(); r.readings[0]={...r.readings[0],...patch}; expect(()=>evaluateNative(programme,r)).toThrow();
});
it('missing rest/reset or automatic-operation evidence is incomplete, not PASS', () => {
  const r=repeat(); r.readings[0].unloadedAtRest=false; expect(evaluateNative(programme,r).status).toBe('INCOMPLETE');
  r.readings[0]={...repetition(1),unloadedIndication:'5'}; expect(evaluateNative(programme,r).status).toBe('INCOMPLETE');
  const p=buildNativeProgramme(instrument,{...profile,zeroDevices:['AUTOMATIC']},'tech');
  expect(evaluateNative(p,{...repeat(),conditions:{...conditions,automaticDevicesInOperation:false}}).status).toBe('INCOMPLETE');
  expect(evaluateNative(p,{...zero('1.25','AUTOMATIC'),conditions:{...conditions,outsideAutomaticRange:false}}).status).toBe('INCOMPLETE');
});
it('in-service repeat MPE doubles; zero technical-limit interpretation is explicitly unsupported', () => {
  const p=buildNativeProgramme(instrument,{...profile,purpose:'IN_SERVICE_INSPECTION'},'tech');
  expect(evaluateNative(p,repeat()).limitG).toBe('15'); expect(()=>evaluateNative(p,zero())).toThrow(/unsupported/);
});
async function createCase() {
  const created=await api('post','/test-cases',{instrumentId:instrument.id}).expect(201); const id=created.body.data.id;
  await api('put',`/test-cases/${id}/status`,{status:'TESTING',expectedRevision:0}).expect(200); return id;
}
async function configure(id:string,p=profile) { return api('put',`/native/${id}/programme`,{expectedRevision:(await testCaseStore.findById(id))!.revision,profile:p}); }
function checked(response: request.Response, status: number) {
  expect(response.status).toBe(status);
  return response;
}
async function save(id:string,submission=repeat(),token=tech) { return api('put',`/native/${id}/tests/${submission.procedureId}/${submission.series}`,{expectedRevision:(await testCaseStore.findById(id))!.revision,submission},token); }
it('API preserves ownership/roles, strict fields, revision guards and programme freezing', async () => {
  const id=await createCase(); await checked((await configure(id)), 200);
  await api('get',`/native/${id}`,undefined,other).expect(403); await api('get',`/native/${id}`,undefined,reviewer).expect(403);
  await checked((await save(id,repeat(),other)), 403); await checked((await save(id,repeat(),reviewer)), 403);
  await checked((await save(id)), 200); expect((await nativeTestStore.findAll())).toHaveLength(1);
  await api('put',`/native/${id}/tests/REPEATABILITY/EIGHTY_PERCENT`,{expectedRevision:2,submission:repeat()}).expect(409);
  await checked((await configure(id)), 409);
  await checked((await save(id,{...repeat(),result:{status:'PASS'}} as any)), 400);
  const result=(await api('get',`/native/${id}`).expect(200)).body.data; expect(result.tests[0].result.status).toBe('PASS');
});
it('incomplete samples cannot submit; corrections retain the prior native evidence', async () => {
  const id=await createCase(); await checked((await configure(id)), 200); const r=repeat(); r.readings.pop(); await checked((await save(id,r)), 200);
  await api('post',`/test-cases/${id}/workflow/submit`,{expectedRevision:(await testCaseStore.findById(id))!.revision}).expect(409);
  await checked((await save(id)), 200); expect((await auditStore.findAll()).find(row=>row.action==='NATIVE_TEST_CORRECTED')!.metadata!.previous.result.status).toBe('INCOMPLETE');
});
it('rejects non-quantized unloaded indications and retains precision beyond binary floating point', () => {
  const r = repeat(); r.readings[0].unloadedIndication = '0.1';
  expect(() => evaluateNative(programme, r)).toThrow(/Unloaded indications/);
  expect(evaluateNative(programme, zero('1.2499999999999999999999999')).status).toBe('FAIL');
});
it('a completed failed type series stays an observed FAIL while its missing companion is INCOMPLETE', async () => {
  const id = await createCase(); await checked((await configure(id, {...profile,purpose:'TYPE_EVALUATION'})), 200);
  const r = {...repeat(),series:'HALF_MAX',readings:Array.from({length:10},(_,index)=>({...repetition(index+1,'7510'),load:'7500'}))};
  await checked((await save(id,r)), 200);
  const assessment = (await assessStoredProgramme((await testCaseStore.findById(id))!));
  expect(assessment).toMatchObject({overallVerdict:'INCOMPLETE',observedOutcome:'FAIL',complete:false});
  expect(assessment.native!.procedures.find(item=>item.id==='REPEATABILITY')!.status).toBe('INCOMPLETE');
});
it('durable native storage failure cannot acknowledge success or change the revision', async () => {
  const id = await createCase(); await checked((await configure(id)), 200);
  const revision = (await testCaseStore.findById(id))!.revision;
  const spy = jest.spyOn(fs,'renameSync').mockImplementationOnce(()=>{throw new Error('Synthetic write failure');});
  try { await checked((await save(id)), 503); } finally { spy.mockRestore(); }
  expect((await nativeTestStore.findAll())).toHaveLength(0); expect((await testCaseStore.findById(id))!.revision).toBe(revision);
  await checked((await save(id)), 200); expect((await nativeTestStore.findAll())).toHaveLength(1);
});
it('native PASS/FAIL remains INCOMPLETE overall and cannot get final approval; exports retain real failure and frozen metadata', async () => {
  const id=await createCase(); await checked((await configure(id)), 200); const r=repeat(); r.readings[2]=repetition(3,'12010'); await checked((await save(id,r)), 200); await checked((await save(id,zero())), 200);
  expect((await assessStoredProgramme((await testCaseStore.findById(id))!))).toMatchObject({overallVerdict:'INCOMPLETE',observedOutcome:'FAIL',complete:false});
  await api('post',`/test-cases/${id}/workflow/submit`,{expectedRevision:(await testCaseStore.findById(id))!.revision}).expect(200);
  await api('post',`/test-cases/${id}/workflow/start-review`,{expectedRevision:(await testCaseStore.findById(id))!.revision},reviewer).expect(200);
  await api('post',`/test-cases/${id}/workflow/approve`,{expectedRevision:(await testCaseStore.findById(id))!.revision},reviewer).expect(409);
  await checked((await save(id)), 403);
  // Only an isolated legacy-approved export fixture; do not bypass the public native gate.
  (await testCaseStore.saveItem({...(await testCaseStore.findById(id))!,status:'APPROVED'}));
  const data=(await ReportService.generateReportData(id,'Reviewer')); expect(data.status).toBe('PROTOTYPE'); expect(data.nativeTests![0].result.status).toBe('FAIL');
  const html=(await ReportService.generateHtmlReport(id,'Reviewer')); expect(html).toContain('A.4.10'); expect(html).toContain('Synthetic manufacturer');
  const pdf=(await ReportService.generatePdfReport(id,'Reviewer')).toString('latin1'); expect(pdf).toContain('Native programme'); expect(pdf).toContain('/Type /Page');
});
