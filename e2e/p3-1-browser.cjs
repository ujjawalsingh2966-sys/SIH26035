const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const frontend=process.env.W8LAB_BROWSER_FRONTEND, backend=process.env.W8LAB_BROWSER_BACKEND, run=process.env.W8LAB_BROWSER_RUN_DIR;
const roles={tech:[process.env.W8LAB_BROWSER_TECHNICIAN,process.env.W8LAB_BROWSER_PASSWORD],other:[process.env.W8LAB_BROWSER_OTHER_TECHNICIAN,process.env.W8LAB_BROWSER_OTHER_TECHNICIAN_PASSWORD],reviewer:[process.env.W8LAB_BROWSER_REVIEWER,process.env.W8LAB_BROWSER_REVIEWER_PASSWORD]};
if(!run||!frontend||!backend||Object.values(roles).flat().some(value=>!value))throw new Error('Managed local browser setup required.');
for(const url of [frontend,backend])if(!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Local verification only.');
const output=path.join(run,'p3-1');fs.mkdirSync(output,{recursive:true});
const read=name=>JSON.parse(fs.readFileSync(path.join(run,'data',`${name}.json`),'utf8'));
const scrub=value=>Object.values(roles).flat().reduce((text,secret)=>text.split(secret).join('[REDACTED]'),String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_TOKEN]');
const results=[],errors=[],consoleErrors=[],assetErrors=[],pages={};let browser,id,instrument;
const profile={purpose:'TYPE_EVALUATION',indication:'DIGITAL',zeroDevices:['SEMI_AUTOMATIC'],initialZeroSetting:false,eccentricityPossible:true,loadReceptor:'PLATFORM',supportPoints:4,evidenceReference:'SYNTHETIC P3.1 manual'};
async function api(page,endpoint,method='GET',payload){return page.evaluate(async({url,method,payload})=>{const response=await fetch(url,{method,headers:{Authorization:`Bearer ${localStorage.getItem('nawi_token')}`,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});return{status:response.status,body:await response.json()};},{url:`${backend}/api/v1${endpoint}`,method,payload});}
async function scenario(name,operation){try{await operation();results.push({name,status:'PASS'});console.log(`PASS ${name}`);}catch(error){results.push({name,status:'FAIL',error:scrub(error.message)});console.log(`FAIL ${name}: ${scrub(error.message).slice(0,400)}`);}}
async function screenshot(page,name){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true,animations:'disabled',mask:[page.locator('input[type=email],input[type=password]'),...Object.values(roles).map(([email])=>page.getByText(email,{exact:true}))]});}
async function createCase(){const response=await api(pages.tech,'/test-cases','POST',{instrumentId:instrument.id});expect(response.status).toBe(201);return response.body.data.id;}
const digest=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(run,'data',`${name}.json`))).digest('hex');
async function main(){
  browser=await chromium.launch({headless:true,channel:'chromium'});
  for(const[role,[email,password]]of Object.entries(roles)){
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*',route=>{const url=new URL(route.request().url());return ['http:','https:'].includes(url.protocol)&&![frontend,backend].includes(url.origin)?route.abort():route.continue();});
    const page=pages[role]=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',error=>errors.push(scrub(error.message)));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push({text:scrub(message.text()),url:message.location().url});});
    page.on('response',response=>{if(response.url().includes('/_next/')&&response.status()>=400)assetErrors.push({url:response.url(),status:response.status()});});
    await page.goto(`${frontend}/login`);await page.getByLabel('Email Address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');
  }
  const page=pages.tech;
  instrument=read('instruments').find(row=>row.name==='Synthetic P3 balance');if(!instrument)throw new Error('P3 instrument fixture missing.');
  await scenario('Actual declaration form rejects malformed enums without mutation and preserves values for retry',async()=>{
    id=await createCase();await page.goto(`${frontend}/test-cases/${id}/programme`);
    await page.getByLabel(/^Test purpose/).selectOption('TYPE_EVALUATION');await page.getByLabel(/^Indication type/).selectOption('DIGITAL');
    await page.getByLabel(/^Zero-device inventory/).selectOption('LIST');await page.getByLabel('SEMI AUTOMATIC',{exact:true}).check();
    await page.getByLabel(/^Initial zero-setting device/).selectOption('NO');await page.getByLabel(/^Eccentric loading possible/).selectOption('YES');
    await page.getByLabel(/^Load receptor/).selectOption('PLATFORM');await page.getByLabel(/^Support points/).fill('4');
    await page.getByLabel('Instrument documentation / evidence reference',{exact:true}).fill(profile.evidenceReference);
    for(const patch of [{purpose:['TYPE_EVALUATION']},{purpose:[['IN_SERVICE_INSPECTION']]},{indication:{value:'DIGITAL'}},{loadReceptor:['PLATFORM']}]){
      const before=[digest('testCases'),digest('nativeTests'),digest('audit')],url=`${backend}/api/v1/native/${id}/programme`;
      await page.route(url,route=>route.continue({postData:JSON.stringify({...route.request().postDataJSON(),profile:{...route.request().postDataJSON().profile,...patch}})}),{times:1});
      const response=page.waitForResponse(res=>res.url()===url&&res.request().method()==='PUT');
      await page.getByRole('button',{name:'Define programme',exact:true}).click();expect((await response).status()).toBe(400);
      await expect(page.getByRole('alert').filter({hasText:'primitive string'})).toBeVisible();
      await expect(page.getByLabel(/^Test purpose/)).toHaveValue('TYPE_EVALUATION');
      await expect(page.getByLabel('Instrument documentation / evidence reference',{exact:true})).toHaveValue(profile.evidenceReference);
      expect([digest('testCases'),digest('nativeTests'),digest('audit')]).toEqual(before);
    }
  });
  await scenario('Valid retry creates exactly the type programme, with two ten-reading series',async()=>{
    await page.getByRole('button',{name:'Define programme',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Applicability matrix & sampling overview',exact:true})).toBeVisible();
    const data=(await api(page,`/native/${id}`)).body.data;
    expect(data.programme.profile.purpose).toBe('TYPE_EVALUATION');
    expect(data.programme.decisions.find(row=>row.id==='REPEATABILITY').samples.map(row=>[row.series,row.count])).toEqual([['HALF_MAX',10],['MAX',10]]);
    await page.getByLabel(/^Native procedure \/ series/).selectOption('REPEATABILITY/HALF_MAX');
    expect(await page.locator('input[id$="-load"]').count()).toBe(10);
    await screenshot(page,'valid-type-programme');
  });
  await scenario('Valid service inspection retains three repeats and double MPE but zero remains unsupported',async()=>{
    const service=await createCase();let response=await api(page,`/native/${service}/programme`,'PUT',{expectedRevision:0,profile:{...profile,purpose:'IN_SERVICE_INSPECTION'}});expect(response.status).toBe(200);
    expect(response.body.data.decisions.find(row=>row.id==='ZERO_SEMI_AUTOMATIC').applicability).toBe('UNSUPPORTED');
    expect((await api(page,`/test-cases/${service}/status`,'PUT',{status:'TESTING',expectedRevision:1})).status).toBe(200);
    const submission={procedureId:'REPEATABILITY',series:'EIGHTY_PERCENT',readings:[1,2,3].map(sequence=>({sequence,load:'12000',indication:'12000',additionalWeights:'2.5',unit:'g',unloadedIndication:'0',unloadedAtRest:true,resetToZero:false})),conditions:{stable:true,sufficientAccuracy:true},evidenceReference:'SYNTHETIC service inspection'};
    response=await api(page,`/native/${service}/tests/REPEATABILITY/EIGHTY_PERCENT`,'PUT',{expectedRevision:2,submission});expect(response.status).toBe(200);expect(response.body.data.result.limitG).toBe('15');
    response=await api(page,`/native/${service}/tests/ZERO_SEMI_AUTOMATIC/ACCURACY`,'PUT',{expectedRevision:3,submission:{...submission,procedureId:'ZERO_SEMI_AUTOMATIC',series:'ACCURACY'}});expect(response.status).toBe(422);
    await page.goto(`${frontend}/test-cases/${service}/programme`);
    await expect(page.getByLabel(/^Native procedure \/ series/).locator('option[value="ZERO_SEMI_AUTOMATIC/ACCURACY"]')).toHaveCount(0);
  });
  await scenario('Malformed historical profiles show a clear read-only error without changing traces or records',async()=>{
    for(const suffix of ['purpose','indication','receptor','null']){
      const historic=`p31-malformed-${suffix}`,before=[digest('testCases'),digest('nativeTests'),digest('audit')];
      const response=await api(page,`/native/${historic}`);expect(response.status).toBe(200);expect(response.body.data.programme).toBeNull();
      expect(response.body.data.assessment).toMatchObject({complete:false,overallVerdict:'INCOMPLETE',observedOutcome:'UNDETERMINED'});
      expect(response.body.data.tests.length).toBeGreaterThan(0);
      await page.goto(`${frontend}/test-cases/${historic}/programme`);
      await expect(page.locator('main section[role=alert]')).toContainText('Stored native programme is invalid');
      await expect(page.getByRole('button',{name:'Define programme',exact:true})).toHaveCount(0);
      await expect(page.getByRole('button',{name:'Save native evidence',exact:true})).toHaveCount(0);
      expect((await api(page,`/native/${historic}/programme`,'PUT',{expectedRevision:0,profile})).status).toBe(409);
      expect((await api(page,`/native/${historic}/tests/ZERO_SEMI_AUTOMATIC/ACCURACY`,'PUT',{expectedRevision:0,submission:{procedureId:'ZERO_SEMI_AUTOMATIC',series:'ACCURACY'}})).status).toBe(409);
      expect((await api(page,'/observations','POST',{testCaseId:historic,testType:'WEIGHING',sequence:1,load:'5000',indication:'5000',additionalWeights:'2.5',unit:'g'})).status).toBe(409);
      expect((await api(page,`/test-cases/${historic}/workflow/submit`,'POST',{expectedRevision:0})).status).toBe(409);
      expect([digest('testCases'),digest('nativeTests'),digest('audit')]).toEqual(before);
    }
    await screenshot(page,'invalid-history-desktop');
  });
  await scenario('Assigned Reviewer cannot finalize invalid historical declarations',async()=>{
    const response=await api(pages.reviewer,'/test-cases/p31-malformed-review/workflow/approve','POST',{expectedRevision:0});expect(response.status).toBe(409);
    expect(read('testCases').find(row=>row.id==='p31-malformed-review').status).toBe('UNDER_REVIEW');
  });
  await scenario('Legacy approved malformed history exports as PROTOTYPE with errors, while saved traces remain intact',async()=>{
    const before=[digest('testCases'),digest('nativeTests')], auditBefore=read('audit');
    const response=await api(pages.reviewer,'/reports/p31-malformed-approved/data');expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('PROTOTYPE');expect(response.body.data.complianceSummary.overallVerdict).toBe('INCOMPLETE');
    expect(response.body.data.programme.issues.join(' ')).toContain('invalid');
    const token=await pages.reviewer.evaluate(()=>localStorage.getItem('nawi_token'));
    for(const format of ['html','pdf']){
      const download=await pages.reviewer.request.get(`${backend}/api/v1/reports/p31-malformed-approved/${format}`,{headers:{Authorization:`Bearer ${token}`}});
      expect(download.status()).toBe(200);expect((await download.body()).toString(format==='pdf'?'latin1':'utf8')).toMatch(/invalid/i);
    }
    expect([digest('testCases'),digest('nativeTests')]).toEqual(before);
    const auditAfter=read('audit');expect(auditAfter.slice(0,auditBefore.length)).toEqual(auditBefore);
    expect(auditAfter.slice(auditBefore.length).map(row=>[row.testCaseId,row.action])).toEqual([
      ['p31-malformed-approved','REPORT_GENERATED'],['p31-malformed-approved','REPORT_GENERATED'],
    ]);
  });
  await scenario('Existing role and cross-user restrictions apply to valid and malformed programmes',async()=>{
    for(const record of [id,'p31-malformed-purpose']){
      expect((await api(pages.other,`/native/${record}`)).status).toBe(403);
      expect((await api(pages.other,`/native/${record}/programme`,'PUT',{expectedRevision:0,profile})).status).toBe(403);
      expect((await api(pages.reviewer,`/native/${record}/programme`,'PUT',{expectedRevision:0,profile})).status).toBe(403);
    }
  });
  await scenario('Laboratory observation, evidence and lifecycle enums reject arrays before any mutation',async()=>{
    const record=await createCase();let before=[digest('testCases'),digest('nativeTests'),digest('audit')];
    expect((await api(page,`/test-cases/${record}/status`,'PUT',{status:['TESTING'],expectedRevision:0})).status).toBe(400);
    expect([digest('testCases'),digest('nativeTests'),digest('audit')]).toEqual(before);
    expect((await api(page,`/test-cases/${record}/status`,'PUT',{status:'TESTING',expectedRevision:0})).status).toBe(200);
    before=[digest('testCases'),digest('nativeTests'),digest('audit')];
    expect((await api(page,'/observations','POST',{testCaseId:record,testType:['WEIGHING'],sequence:1,load:'5000',indication:'5000',additionalWeights:'2.5',unit:'g'})).status).toBe(400);
    expect((await api(page,'/evidence','POST',{testCaseId:record,testType:['GENERAL'],description:'SYNTHETIC evidence',fileName:'synthetic.txt',mimeType:'text/plain',sizeBytes:4})).status).toBe(400);
    expect([digest('testCases'),digest('nativeTests'),digest('audit')]).toEqual(before);
  });
  await scenario('Read-only historical error is readable on mobile light/dark reduced-motion layouts',async()=>{
    await page.goto(`${frontend}/test-cases/p31-malformed-purpose/programme`);await page.setViewportSize({width:390,height:844});
    for(const theme of ['light','dark']){
      await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await expect(page.locator('main section[role=alert]')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.getByRole('link',{name:'Back to observation workspace',exact:true}).focus();await expect(page.getByRole('link',{name:'Back to observation workspace',exact:true})).toBeFocused();
      await screenshot(page,`invalid-history-mobile-${theme}`);
    }
  });
  await scenario('No missing assets, uncaught exceptions or unexpected console errors',async()=>{
    for(const url of await page.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes=>nodes.map(node=>node.src||node.href)))expect((await page.request.get(url)).status()).toBe(200);
    expect(errors).toEqual([]);expect(assetErrors).toEqual([]);
    expect(consoleErrors.filter(item=>!item.url.startsWith(backend)||!/^Failed to load resource: the server responded with a status of (400|401|403|404|409|422)\b/.test(item.text))).toEqual([]);
  });
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browser.version(),results,errors,assetErrors,consoleErrors},null,2));
  console.log(`P3.1 TOTAL ${JSON.stringify(results.reduce((sum,row)=>({...sum,[row.status]:(sum[row.status]||0)+1}),{}))}`);
  if(results.some(row=>row.status==='FAIL'))process.exitCode=1;
}
main().catch(error=>{console.error(scrub(error.stack));process.exitCode=1;}).finally(async()=>{await browser?.close();});
