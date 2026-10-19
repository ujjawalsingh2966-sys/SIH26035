import request from 'supertest';
import app from '../src/app';
import { buildNativeProgramme, validateProfile } from '../src/services/NativeApplicability';
import { evaluateNative } from '../src/services/NativeEvaluation';
import { EvaluationService } from '../src/services/EvaluationService';
import { assessStoredProgramme } from '../src/services/ProgrammeAssessment';
import { ReportService } from '../src/services/ReportService';
import { saveInstrument } from '../src/services/MasterDataService';
import { manufacturerStore, instrumentStore, testCaseStore, nativeTestStore, observationStore, auditStore } from '../src/repositories';
import { testSession } from './helpers/persistedIdentity';
import type { NativeProfile, NativeSubmission } from '../src/types/native';

const tech = testSession('validation-tech','Technician'), other = testSession('validation-other','Technician'), review = testSession('validation-review','Reviewer');
const profile: NativeProfile = { purpose:'TYPE_EVALUATION',indication:'DIGITAL',zeroDevices:['SEMI_AUTOMATIC'],initialZeroSetting:false,
  eccentricityPossible:true,loadReceptor:'PLATFORM',supportPoints:4,evidenceReference:'SYNTHETIC validation manual' };
const zero: NativeSubmission = { procedureId:'ZERO_SEMI_AUTOMATIC',series:'ACCURACY',readings:[{sequence:1,load:'0',indication:'0',additionalWeights:'1.25',unit:'g'}],
  conditions:{stable:true,sufficientAccuracy:true,zeroInitiatedNearChangeover:true},evidenceReference:'SYNTHETIC calibrated equipment' };
let instrument: ReturnType<typeof saveInstrument>;
const api = (method:string,path:string,payload?:object,token=tech) => (request(app) as any)[method](`/api/v1${path}`).set('Authorization',`Bearer ${token}`).send(payload);
beforeEach(()=>{
  for(const store of [manufacturerStore,instrumentStore,testCaseStore,nativeTestStore,observationStore,auditStore])store.clear();
  manufacturerStore.saveItem({id:'validation-maker',name:'Synthetic manufacturer',address:'Isolated laboratory',identifier:'VALIDATION'});
  instrument=saveInstrument({manufacturerId:'validation-maker',name:'Synthetic validation scale',model:'VALIDATION',serialNumber:'VALIDATION-1',
    accuracyClass:'III',maxCapacity:'15000',minCapacity:'100',e:'5',d:'5',weighingUnit:'g',hasTare:false,isWeighing:true,isManual:true,
    isElectronic:true,isSingleRange:true,hasAuxiliaryIndication:false,isGrading:false,softwareControlled:false},{id:'validation-tech',role:'Technician'});
});
async function createCase(){return (await api('post','/test-cases',{instrumentId:instrument.id}).expect(201)).body.data.id as string;}
const enums = [['purpose','TYPE_EVALUATION'],['indication','DIGITAL'],['loadReceptor','PLATFORM']] as const;
const malformed = (value:string): [string,unknown][] => [['array',[value]],['nested array',[[value]]],['object',{value}],['empty array',[]],['null',null],['number',1],['boolean',true],['empty string',''],['unknown','NOT_SUPPORTED'],['missing',undefined]];
for(const [field,valid] of enums)it.each(malformed(valid))(`rejects ${field} %s at the API without changing programme, revision or history`,async(_name,value)=>{
  const id=await createCase(), before=JSON.stringify({record:testCaseStore.findById(id),audit:auditStore.findAll()});
  const response=await api('put',`/native/${id}/programme`,{expectedRevision:0,profile:{...profile,[field]:value}}).expect(400);
  expect(response.body.error).toMatch(new RegExp(field==='loadReceptor'?'receptor':field,'i'));
  expect(JSON.stringify({record:testCaseStore.findById(id),audit:auditStore.findAll()})).toBe(before);
  expect(nativeTestStore.findAll()).toHaveLength(0);
});
it.each([['nested',[['SEMI_AUTOMATIC']]],['object',[{value:'SEMI_AUTOMATIC'}]],['null entry',[null]],['unknown',['OTHER']]])('rejects %s zero-device inventory entries',(_name,value)=>{
  expect(()=>validateProfile({...profile,zeroDevices:value})).toThrow();
});
it.each(enums)('validates %s again when a caller bypasses the HTTP boundary',(field,value)=>{
  expect(()=>buildNativeProgramme(instrument,{...profile,[field]:[value]} as any,'validation-tech')).toThrow();
  const programme=buildNativeProgramme(instrument,profile,'validation-tech');
  (programme.profile as any)[field]=[value];
  expect(()=>evaluateNative(programme,zero)).toThrow(/invalid|purpose|indication|receptor/i);
});
it.each(enums)('rejects boxed strings for %s in direct validation',(field,value)=>{
  expect(()=>validateProfile({...profile,[field]:new String(value)})).toThrow();
});
it.each([
  ['TYPE_EVALUATION','III','15000',10,['HALF_MAX','MAX']],
  ['TYPE_EVALUATION','III','1000000',3,['HALF_MAX','MAX']],
  ['INITIAL_VERIFICATION','II','15000',6,['EIGHTY_PERCENT']],
  ['INITIAL_VERIFICATION','III','15000',3,['EIGHTY_PERCENT']],
  ['IN_SERVICE_INSPECTION','III','15000',3,['EIGHTY_PERCENT']],
])('keeps verified %s / %s / Max=%s purpose sampling',(purpose,accuracyClass,maxCapacity,count,series)=>{
  const p=buildNativeProgramme({...instrument,accuracyClass,maxCapacity} as any,{...profile,purpose} as NativeProfile,'validation-tech');
  const samples=p.decisions.find(row=>row.id==='REPEATABILITY')!.samples!;
  expect(samples.map(row=>row.series)).toEqual(series);expect(samples.map(row=>row.count)).toEqual((series as string[]).map(()=>count));
});
it('keeps service zero unsupported and does not evaluate a contradictory saved decision',()=>{
  const p=buildNativeProgramme(instrument,{...profile,purpose:'IN_SERVICE_INSPECTION'},'validation-tech');
  expect(()=>evaluateNative(p,zero)).toThrow(/unsupported/i);
  p.decisions.find(row=>row.id==='ZERO_SEMI_AUTOMATIC')!.applicability='REQUIRED';
  p.decisions.find(row=>row.id==='ZERO_SEMI_AUTOMATIC')!.native=true;
  expect(()=>evaluateNative(p,zero)).toThrow(/invalid|unsupported|decision/i);
});

it.each(enums)('blocks malformed persisted %s without rewriting case, evidence or audit',async(field,value)=>{
  const id=await createCase();
  await api('put',`/native/${id}/programme`,{expectedRevision:0,profile}).expect(200);
  await api('put',`/test-cases/${id}/status`,{status:'TESTING',expectedRevision:1}).expect(200);
  await api('put',`/native/${id}/tests/ZERO_SEMI_AUTOMATIC/ACCURACY`,{expectedRevision:2,submission:zero}).expect(200);
  const original=testCaseStore.findById(id)!, damaged=JSON.parse(JSON.stringify(original));
  damaged.nativeProgramme.profile[field]=[value]; testCaseStore.saveItem(damaged);
  const before=JSON.stringify({cases:testCaseStore.findAll(),tests:nativeTestStore.findAll(),audit:auditStore.findAll()});
  const data=(await api('get',`/native/${id}`).expect(200)).body.data;
  expect(data.programme).toBeNull();expect(data.programmeError).toMatch(/invalid/i);
  expect(data.assessment).toMatchObject({overallVerdict:'INCOMPLETE',complete:false,observedOutcome:'UNDETERMINED'});
  expect(Object.values(data.assessment.tests).every((row:any)=>row.status==='UNDETERMINED')).toBe(true);
  expect(data.tests[0].result.status).toBe('PASS'); // Raw history preserved, not a current compliance result.
  await api('put',`/native/${id}/tests/ZERO_SEMI_AUTOMATIC/ACCURACY`,{expectedRevision:3,submission:zero}).expect(409);
  await api('put',`/native/${id}/programme`,{expectedRevision:3,profile}).expect(409);
  await api('post',`/test-cases/${id}/workflow/submit`,{expectedRevision:3}).expect(409);
  expect(JSON.stringify({cases:testCaseStore.findAll(),tests:nativeTestStore.findAll(),audit:auditStore.findAll()})).toBe(before);
  await api('get',`/native/${id}`,undefined,other).expect(403);
});
it.each([null,{},'malformed'])('invalid stored profile %p cannot approve or produce FINAL, and report history remains available',async badProfile=>{
  const id=await createCase();await api('put',`/native/${id}/programme`,{expectedRevision:0,profile}).expect(200);
  const damaged=JSON.parse(JSON.stringify(testCaseStore.findById(id)!));damaged.nativeProgramme.profile=badProfile;
  damaged.status='UNDER_REVIEW';damaged.reviewerId='validation-review';testCaseStore.saveItem(damaged);
  expect(assessStoredProgramme(damaged)).toMatchObject({complete:false,overallVerdict:'INCOMPLETE',observedOutcome:'UNDETERMINED'});
  await api('post',`/test-cases/${id}/workflow/approve`,{expectedRevision:1},review).expect(409);
  // Isolated pre-existing approved-record fixture, not an approval bypass.
  damaged.status='APPROVED';testCaseStore.saveItem(damaged);
  const before=JSON.stringify(testCaseStore.findById(id));
  expect(ReportService.generateReportData(id,'Reviewer').status).toBe('PROTOTYPE');
  expect(ReportService.generateHtmlReport(id,'Reviewer')).toMatch(/invalid/i);
  expect(ReportService.generatePdfReport(id,'Reviewer').toString('latin1')).toMatch(/invalid/i);
  expect(JSON.stringify(testCaseStore.findById(id))).toBe(before);
});
it('missing/corrupt decisions and changed sampling are blocked rather than inferred N/A',async()=>{
  const id=await createCase();await api('put',`/native/${id}/programme`,{expectedRevision:0,profile}).expect(200);
  const original=testCaseStore.findById(id)!;
  for(const decisions of [null,[],[{id:'REPEATABILITY',applicability:'NOT APPLICABLE'}]]){
    const damaged=JSON.parse(JSON.stringify(original));damaged.nativeProgramme.decisions=decisions;
    testCaseStore.saveItem(damaged);
    const assessment=assessStoredProgramme(damaged);
    expect(assessment).toMatchObject({complete:false,overallVerdict:'INCOMPLETE',observedOutcome:'UNDETERMINED'});
    expect(assessment.tests.REPEATABILITY.status).toBe('UNDETERMINED');
  }
});
it('generic observations cannot bypass invalid native-profile blocking or delete saved history',async()=>{
  const id=await createCase();await api('put',`/native/${id}/programme`,{expectedRevision:0,profile}).expect(200);
  await api('put',`/test-cases/${id}/status`,{status:'TESTING',expectedRevision:1}).expect(200);
  const input={testCaseId:id,testType:'WEIGHING',sequence:1,load:'5000',indication:'5000',additionalWeights:'2.5',unit:'g'};
  const saved=(await api('post','/observations',input).expect(201)).body.data;
  const damaged=JSON.parse(JSON.stringify(testCaseStore.findById(id)!));damaged.nativeProgramme.profile.purpose=['TYPE_EVALUATION'];testCaseStore.saveItem(damaged);
  const before=JSON.stringify({cases:testCaseStore.findAll(),rows:observationStore.findAll(),audit:auditStore.findAll()});
  await api('post','/observations',{...input,sequence:2}).expect(409);
  await api('put',`/observations/${saved.id}`,input).expect(409);
  await api('delete',`/observations/${saved.id}`).expect(409);
  expect(JSON.stringify({cases:testCaseStore.findAll(),rows:observationStore.findAll(),audit:auditStore.findAll()})).toBe(before);
});
for(const kind of ['observation','evidence','status'])it.each(malformed(kind==='status'?'TESTING':'WEIGHING'))(`rejects ${kind} enum %s without implicit validator coercion`,async(_name,value)=>{
  const id=await createCase();
  if(kind!=='status')await api('put',`/test-cases/${id}/status`,{status:'TESTING',expectedRevision:0}).expect(200);
  const before=JSON.stringify({record:testCaseStore.findById(id),audit:auditStore.findAll()});
  if(kind==='status')await api('put',`/test-cases/${id}/status`,{status:value,expectedRevision:0}).expect(400);
  else if(kind==='observation')await api('post','/observations',{testCaseId:id,testType:value,sequence:1,load:'5000',indication:'5000',additionalWeights:'2.5',unit:'g'}).expect(400);
  else await api('post','/evidence',{testCaseId:id,testType:value,description:'SYNTHETIC reference',fileName:'synthetic.txt',mimeType:'text/plain',sizeBytes:4}).expect(400);
  expect(JSON.stringify({record:testCaseStore.findById(id),audit:auditStore.findAll()})).toBe(before);
});
it.each([['WEIGHING'],[['WEIGHING']],{value:'WEIGHING'}])('direct generic evaluation rejects malformed testType %p',value=>{
  expect(()=>EvaluationService.evaluateObservation(instrument,{testType:value as any,load:'5000',indication:'5000',additionalWeights:'2.5'},true)).toThrow(/testType/i);
});
