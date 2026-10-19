// Deliberately malformed historical fixtures, never a successful native
// approval. Run only through the managed runner while its backend is stopped.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), run = path.resolve(process.env.W8LAB_BROWSER_RUN_DIR || '');
if (!process.env.W8LAB_BROWSER_RUN_DIR || !run.startsWith(path.join(root,'artifacts/browser-review') + path.sep)
  || path.resolve(process.env.DATA_DIR || '') !== path.join(run,'data')) throw new Error('Managed isolated DATA_DIR required.');
const read = name => JSON.parse(fs.readFileSync(path.join(run,'data',`${name}.json`),'utf8'));
const cases = read('testCases'), tests = read('nativeTests'), staff = read('staffAccounts');
if (cases.some(row=>row.id.startsWith('p31-malformed-'))) throw new Error('Refusing to overwrite historical fixtures.');
const source = cases.find(row=>row.nativeProgramme && row.nativeProgramme.profile.zeroDevices?.includes('SEMI_AUTOMATIC'));
const reviewer = staff.find(row=>row.role==='Reviewer');
if (!source || !reviewer) throw new Error('Complete P3 setup first.');
for (const [suffix,field,value,status] of [
  ['purpose','purpose',['TYPE_EVALUATION'],'TESTING'],
  ['indication','indication',{value:'DIGITAL'},'TESTING'],
  ['receptor','loadReceptor',[['PLATFORM']],'TESTING'],
  ['null','profile',null,'TESTING'],
  ['review','purpose',['IN_SERVICE_INSPECTION'],'UNDER_REVIEW'],
  ['approved','purpose',['IN_SERVICE_INSPECTION'],'APPROVED'],
]) {
  const row = structuredClone(source); row.id=`p31-malformed-${suffix}`; row.status=status;row.revision=0;
  delete row.reviewerId;
  if (status!=='TESTING') row.reviewerId=reviewer.id;
  if (field==='profile') row.nativeProgramme.profile=value; else row.nativeProgramme.profile[field]=value;
  cases.push(row);
  for (const record of tests.filter(item=>item.testCaseId===source.id)) {
    const historical = structuredClone(record); historical.testCaseId=row.id;
    historical.id=`${row.id}:${historical.submission.procedureId}:${historical.submission.series}`;
    tests.push(historical);
  }
}
fs.writeFileSync(path.join(run,'data/testCases.json'),JSON.stringify(cases,null,2));
fs.writeFileSync(path.join(run,'data/nativeTests.json'),JSON.stringify(tests,null,2));
console.log('Installed six isolated malformed-history fixtures; existing records and traces preserved.');
