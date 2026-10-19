// Managed by p1-browser.cjs with W8LAB_BROWSER_P3=1. Successful operations
// always use the real, isolated API. Never save passwords or bearer tokens.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const frontend = process.env.W8LAB_BROWSER_FRONTEND, backend = process.env.W8LAB_BROWSER_BACKEND;
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const roles = {
  tech: [process.env.W8LAB_BROWSER_TECHNICIAN, process.env.W8LAB_BROWSER_PASSWORD],
  other: [process.env.W8LAB_BROWSER_OTHER_TECHNICIAN, process.env.W8LAB_BROWSER_OTHER_TECHNICIAN_PASSWORD],
  reviewer: [process.env.W8LAB_BROWSER_REVIEWER, process.env.W8LAB_BROWSER_REVIEWER_PASSWORD],
};
if (!frontend || !backend || !runRoot || Object.values(roles).flat().some(value => !value)) throw new Error('Use the managed local browser runner.');
for (const origin of [frontend, backend]) if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local verification only.');
const output = path.join(runRoot, 'p3'); fs.mkdirSync(output, { recursive: true });
const scrub = value => Object.values(roles).flat().reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const results = [], errors = [], assetErrors = [], consoleErrors = [], pages = {};
const read = name => JSON.parse(fs.readFileSync(path.join(runRoot, 'data', `${name}.json`), 'utf8'));
let browser, caseId, typeCase, retryCase, lostCase, maker, instrument;
async function api(page, endpoint, method = 'GET', payload) {
  return page.evaluate(async ({ url, method, payload }) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}`, 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  }, { url: `${backend}/api/v1${endpoint}`, method, payload });
}
async function state(id = caseId, page = pages.tech) { const response = await api(page, `/native/${id}`); expect(response.status).toBe(200); return response.body.data; }
async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input[type=password],input[type=email]'), ...Object.values(roles).map(([email]) => page.getByText(email, { exact: true }))] });
}
async function scenario(name, operation) {
  try { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: scrub(error.message) }); console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 450)}`); await screenshot(pages.tech, `failure-${results.length}`).catch(() => {}); }
}
async function createCase() {
  const created = await api(pages.tech, '/test-cases', 'POST', { instrumentId: instrument.id }); expect(created.status).toBe(201);
  const id = created.body.data.id;
  expect((await api(pages.tech, `/test-cases/${id}/laboratory-conditions`, 'PUT', { temperature: '20', humidity: '50', pressure: '1013' })).status).toBe(200);
  const current = (await api(pages.tech, '/test-cases')).body.data.find(row => row.id === id);
  expect((await api(pages.tech, `/test-cases/${id}/status`, 'PUT', { status: 'TESTING', expectedRevision: current.revision })).status).toBe(200);
  return id;
}
async function configure(id, purpose = 'INITIAL_VERIFICATION', unknown = false) {
  const page = pages.tech;
  await page.goto(`${frontend}/test-cases/${id}/programme`);
  await page.getByLabel(/^Test purpose/).selectOption(purpose);
  if (!unknown) {
    await page.getByLabel(/^Indication type/).selectOption('DIGITAL');
    await page.getByLabel(/^Zero-device inventory/).selectOption('LIST');
    for (const device of ['NON AUTOMATIC','SEMI AUTOMATIC','AUTOMATIC','ZERO TRACKING']) await page.getByLabel(device, { exact: true }).check();
    await page.getByLabel(/^Initial zero-setting device/).selectOption('NO');
    await page.getByLabel(/^Eccentric loading possible/).selectOption('YES');
    await page.getByLabel(/^Load receptor/).selectOption('PLATFORM');
    await page.getByLabel(/^Support points/).fill('4');
  }
  await page.getByLabel('Instrument documentation / evidence reference', { exact: true }).fill('SYNTHETIC P3 manual / isolated equipment evidence');
  await page.getByRole('button', { name: 'Define programme', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Applicability matrix & sampling overview', exact: true })).toBeVisible();
}
async function select(procedure, series, unit = 'g') {
  const page = pages.tech;
  await page.getByLabel(/^Native procedure \/ series/).selectOption(`${procedure}/${series}`);
  const control = page.getByLabel(/^Observation unit/);
  if (await control.isEnabled()) await control.selectOption(unit);
}
async function fillRows(procedure, count, load, delta, unit, indications) {
  const page = pages.tech;
  for (let index = 0; index < count; index++) {
    await page.locator(`#native-${procedure}-${index}-load`).fill(load);
    await page.locator(`#native-${procedure}-${index}-indication`).fill(indications?.[index] || load);
    await page.locator(`#native-${procedure}-${index}-additionalWeights`).fill(delta);
    if (procedure === 'REPEATABILITY') {
      await page.locator(`#native-${procedure}-${index}-unloadedIndication`).fill('0');
      await page.getByLabel(`Unloaded instrument came to rest — reading ${index + 1}`, { exact: true }).check();
    }
  }
  for (const checkbox of await page.locator('form[aria-busy] > fieldset > label input[type=checkbox]').all()) await checkbox.check();
  await page.getByLabel('Observation / calibrated equipment evidence reference', { exact: true }).fill(`SYNTHETIC P3 ${procedure} ${unit} calibrated mass record`);
}
async function save(id, procedure, series, rapid = false) {
  const page = pages.tech;
  const response = page.waitForResponse(res => res.url() === `${backend}/api/v1/native/${id}/tests/${procedure}/${series}` && res.request().method() === 'PUT');
  const button = page.getByRole('button', { name: 'Save native evidence', exact: true });
  if (rapid) await button.evaluate(button => { button.click(); button.click(); button.form.requestSubmit(); }); else await button.click();
  const res = await response; expect(res.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Native evidence saved' })).toBeVisible();
  return (await res.json()).data;
}
async function main() {
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  for (const [role, [email, password]] of Object.entries(roles)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin) ? route.abort() : route.continue();
    });
    const page = pages[role] = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(scrub(error.message)));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push({ text: scrub(message.text()), url: message.location().url });
    });
    page.on('response', response => { if (response.url().includes('/_next/') && response.status() >= 400) assetErrors.push({ status: response.status(), url: response.url() }); });
    await page.goto(`${frontend}/login`); await page.getByLabel('Email Address', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await page.waitForURL('**/dashboard');
  }
  const page = pages.tech;
  await scenario('Create real P2 master records and Technician-owned case using authenticated APIs', async () => {
    const suffix = Date.now();
    let response = await api(page, '/manufacturers', 'POST', { name: 'Synthetic P3 manufacturer', address: 'Isolated verification laboratory', identifier: `SYNTHETIC-P3-${suffix}` }); expect(response.status).toBe(201); maker = response.body.data;
    response = await api(page, '/instruments', 'POST', { manufacturerId: maker.id, name: 'Synthetic P3 balance', model: 'SYNTHETIC-P3', serialNumber: `P3-${suffix}`, accuracyClass: 'III', maxCapacity: '15', minCapacity: '0.1', e: '0.005', d: '0.005', weighingUnit: 'kg', isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, hasTare: false, hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false }); expect(response.status).toBe(201); instrument = response.body.data;
    caseId = await createCase();
  });
  await scenario('Actual declaration form creates traceable matrix and prescribed verification sampling', async () => {
    await configure(caseId); const data = await state();
    expect(data.programme.standard).toBe('OIML R 76-1:2006');
    expect(data.programme.instrument.maxCapacity).toBe('15000');
    expect(data.programme.decisions.find(row => row.id === 'REPEATABILITY').samples).toEqual([{ series: 'EIGHTY_PERCENT', loadG: '12000', count: 3, minimumOnly: false }]);
    expect(data.assessment.overallVerdict).toBe('INCOMPLETE');
    await screenshot(page, 'applicability-desktop');
  });
  await scenario('Empty observations stay blank and browser required validation prevents save', async () => {
    await select('REPEATABILITY', 'EIGHTY_PERCENT', 'kg');
    await expect(page.locator('#native-REPEATABILITY-0-load')).toHaveValue('');
    await page.getByRole('button', { name: 'Save native evidence', exact: true }).click();
    expect(await page.locator('#native-REPEATABILITY-0-load').evaluate(input => input.validity.valueMissing)).toBe(true);
    expect((await state()).tests).toHaveLength(0);
  });
  await scenario('Partial sampling persists as INCOMPLETE and cannot submit for review', async () => {
    await page.getByRole('button', { name: 'Remove last reading', exact: true }).click();
    await fillRows('REPEATABILITY', 2, '12', '0.0025', 'kg');
    expect((await save(caseId, 'REPEATABILITY', 'EIGHTY_PERCENT')).result.status).toBe('INCOMPLETE');
    const data = await state(); expect((await api(page, `/test-cases/${caseId}/workflow/submit`, 'POST', { expectedRevision: data.testCase.revision })).status).toBe(409);
  });
  await scenario('Completed kg series calculates expected error and guards rapid duplicate submissions', async () => {
    await page.getByRole('button', { name: 'Add reading', exact: true }).click();
    await fillRows('REPEATABILITY', 3, '12', '0.0025', 'kg');
    const record = await save(caseId, 'REPEATABILITY', 'EIGHTY_PERCENT', true);
    expect(record.result).toMatchObject({ status: 'PASS', spreadG: '0', limitG: '7.5', count: 3 });
    expect(record.result.rows.every(row => row.E === '0' && row.loadG === '12000')).toBe(true);
    expect(read('nativeTests').filter(row => row.testCaseId === caseId)).toHaveLength(1);
    expect(read('audit').filter(row => row.testCaseId === caseId && row.action === 'NATIVE_TEST_CORRECTED')).toHaveLength(1);
  });
  await scenario('Programme freezes after evidence, and stale/forged/invalid-unit requests are rejected', async () => {
    const data = await state(), record = data.tests[0];
    expect((await api(page, `/native/${caseId}/programme`, 'PUT', { expectedRevision: data.testCase.revision, profile: data.programme.profile })).status).toBe(409);
    const endpoint = `/native/${caseId}/tests/REPEATABILITY/EIGHTY_PERCENT`;
    expect((await api(page, endpoint, 'PUT', { expectedRevision: data.testCase.revision - 1, submission: record.submission })).status).toBe(409);
    expect((await api(page, endpoint, 'PUT', { expectedRevision: data.testCase.revision, submission: { ...record.submission, result: { status: 'PASS' } } })).status).toBe(400);
    const invalid = structuredClone(record.submission); invalid.readings[0].unit = 'lb';
    expect((await api(page, endpoint, 'PUT', { expectedRevision: data.testCase.revision, submission: invalid })).status).toBe(400);
    expect((await state()).tests[0]).toEqual(record);
  });
  await scenario('All four zero mechanisms use distinct real forms and the 0.25e boundary', async () => {
    for (const mechanism of ['NON_AUTOMATIC','SEMI_AUTOMATIC','AUTOMATIC','ZERO_TRACKING']) {
      const procedure = `ZERO_${mechanism}`, load = ['AUTOMATIC','ZERO_TRACKING'].includes(mechanism) ? '50' : '0';
      await select(procedure, 'ACCURACY'); await fillRows(procedure, 1, load, '1.25', 'g');
      const record = await save(caseId, procedure, 'ACCURACY');
      expect(record.result).toMatchObject({ status: 'PASS', limitG: '1.25' }); expect(record.result.rows[0].E).toBe('1.25');
    }
    await screenshot(page, 'native-calculation-traces');
  });
  await scenario('A completed failed zero test remains FAIL while overall programme remains INCOMPLETE', async () => {
    await select('ZERO_SEMI_AUTOMATIC', 'ACCURACY');
    await page.locator('#native-ZERO_SEMI_AUTOMATIC-0-additionalWeights').fill('1.2499');
    expect((await save(caseId, 'ZERO_SEMI_AUTOMATIC', 'ACCURACY')).result.status).toBe('FAIL');
    expect((await state()).assessment).toMatchObject({ observedOutcome: 'FAIL', overallVerdict: 'INCOMPLETE', complete: false });
  });
  await scenario('Reload preserves frozen programme, observations, verdicts and audit correction history', async () => {
    const before = await state(); await page.reload();
    await expect(page.getByRole('heading', { name: 'Calculated results, traces & missing requirements', exact: true })).toBeVisible();
    expect((await state()).programme).toEqual(before.programme); expect((await state()).tests).toEqual(before.tests);
    expect(read('audit').some(row => row.testCaseId === caseId && row.action === 'NATIVE_TEST_CORRECTED' && row.metadata.previous.result.status === 'PASS' && row.metadata.record.result.status === 'FAIL')).toBe(true);
  });
  await scenario('Cross-Technician and unassigned Reviewer cannot read or change restricted native records', async () => {
    for (const role of ['other','reviewer']) {
      expect((await api(pages[role], `/native/${caseId}`)).status).toBe(403);
      expect((await api(pages[role], `/native/${caseId}/programme`, 'PUT', {})).status).toBe(403);
    }
  });
  await scenario('Completed failed procedures may enter review, but missing programme requirements block approval', async () => {
    let data = await state(); expect((await api(page, `/test-cases/${caseId}/workflow/submit`, 'POST', { expectedRevision: data.testCase.revision })).status).toBe(200);
    const eligible = await state(caseId, pages.reviewer);
    expect((await api(pages.reviewer, `/test-cases/${caseId}/workflow/start-review`, 'POST', { expectedRevision: eligible.testCase.revision })).status).toBe(200);
    data = await state(caseId, pages.reviewer);
    expect((await api(pages.reviewer, `/test-cases/${caseId}/workflow/approve`, 'POST', { expectedRevision: data.testCase.revision })).status).toBe(409);
    await pages.reviewer.goto(`${frontend}/test-cases/${caseId}/programme`);
    await expect(pages.reviewer.getByText('Overall programme: INCOMPLETE.', { exact: false })).toBeVisible();
    await expect(pages.reviewer.getByRole('button', { name: 'Edit programme declaration before observations', exact: true })).toHaveCount(0);
    await pages.reviewer.getByLabel(/^Native procedure \/ series/).selectOption('REPEATABILITY/EIGHTY_PERCENT');
    await expect(pages.reviewer.getByRole('button', { name: 'Save native evidence', exact: true })).toBeDisabled();
    expect((await api(pages.other, `/reports/${caseId}/data`)).status).toBe(403);
    expect((await api(pages.reviewer, `/reports/${caseId}/data`)).status).toBe(400);
  });
  await scenario('Unknown characteristics remain UNDETERMINED and may be corrected before native evidence', async () => {
    typeCase = await createCase(); await configure(typeCase, 'TYPE_EVALUATION', true);
    expect((await state(typeCase)).programme.decisions.find(row => row.id === 'REPEATABILITY').applicability).toBe('UNDETERMINED');
    await page.getByRole('button', { name: 'Edit programme declaration before observations', exact: true }).click();
    await page.getByLabel(/^Indication type/).selectOption('DIGITAL'); await page.getByLabel(/^Zero-device inventory/).selectOption('NONE');
    await page.getByRole('button', { name: 'Define programme', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Applicability matrix & sampling overview', exact: true })).toBeVisible();
    expect((await state(typeCase)).programme.decisions.find(row => row.id === 'REPEATABILITY').samples.map(row => row.count)).toEqual([10,10]);
  });
  await scenario('Actual type-evaluation forms record both prescribed ten-reading series', async () => {
    for (const [series, load, limit] of [['HALF_MAX','7500','5'],['MAX','15000','7.5']]) {
      await select('REPEATABILITY', series); await fillRows('REPEATABILITY', 10, load, '2.5', 'g');
      expect((await save(typeCase, 'REPEATABILITY', series)).result).toMatchObject({ status: 'PASS', count: 10, spreadG: '0', limitG: limit });
    }
    expect((await state(typeCase)).assessment.native.procedures.find(row => row.id === 'REPEATABILITY').status).toBe('PASS');
    await screenshot(page, 'type-evaluation-two-series');
  });
  await scenario('Confirmed backend rejection preserves observations and permits a corrected retry', async () => {
    retryCase = await createCase(); await configure(retryCase);
    await select('REPEATABILITY', 'EIGHTY_PERCENT'); await fillRows('REPEATABILITY', 3, '12001', '2.5', 'g', ['12000','12000','12000']);
    const rejected = page.waitForResponse(res => res.url().includes(`/native/${retryCase}/tests/`) && res.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save native evidence', exact: true }).click(); expect((await rejected).status()).toBe(400);
    await expect(page.locator('#native-REPEATABILITY-0-load')).toHaveValue('12001');
    await expect(page.getByRole('alert').filter({ hasText: 'nominal load' })).toBeVisible();
    await fillRows('REPEATABILITY', 3, '12000', '2.5', 'g'); expect((await save(retryCase, 'REPEATABILITY', 'EIGHTY_PERCENT')).result.status).toBe('PASS');
  });
  await scenario('Lost response after real commit stops resend and reload reveals one saved record', async () => {
    lostCase = await createCase(); await configure(lostCase); await select('ZERO_SEMI_AUTOMATIC', 'ACCURACY');
    await fillRows('ZERO_SEMI_AUTOMATIC', 1, '0', '1.25', 'g');
    const url = `${backend}/api/v1/native/${lostCase}/tests/ZERO_SEMI_AUTOMATIC/ACCURACY`;
    let requests = 0;
    await page.route(url, async route => { if (route.request().method() === 'PUT') { requests++; await route.fetch(); return route.abort('connectionfailed'); } return route.continue(); });
    await page.getByRole('button', { name: 'Save native evidence', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Unknown save outcome' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save native evidence', exact: true })).toBeDisabled();
    await expect(page.locator('#native-ZERO_SEMI_AUTOMATIC-0-additionalWeights')).toHaveValue('1.25');
    expect(requests).toBe(1); await page.unroute(url); await page.reload();
    await expect(page.getByRole('heading', { name: 'Calculated results, traces & missing requirements', exact: true })).toBeVisible();
    expect((await state(lostCase)).tests).toHaveLength(1);
  });
  await scenario('Native forms and matrix fit mobile light/dark layouts with keyboard and reduced motion', async () => {
    await page.goto(`${frontend}/test-cases/${retryCase}/programme`); await select('ZERO_NON_AUTOMATIC', 'ACCURACY');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['light','dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.locator('#native-ZERO_NON_AUTOMATIC-0-load').focus(); await page.keyboard.press('Tab');
      await expect(page.locator('#native-ZERO_NON_AUTOMATIC-0-indication')).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const style = await page.locator('#native-ZERO_NON_AUTOMATIC-0-indication').evaluate(input => ({ color: getComputedStyle(input).color, background: getComputedStyle(input).backgroundColor, outline: getComputedStyle(input).outlineStyle, shadow: getComputedStyle(input).boxShadow }));
      expect(style.color).not.toBe(style.background); expect(style.outline !== 'none' || style.shadow !== 'none').toBe(true);
      const matrix = page.getByRole('region', { name: 'Applicability matrix, scroll horizontally on narrow screens', exact: true });
      await matrix.focus(); await page.keyboard.press('ArrowRight');
      await expect.poll(() => matrix.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      await screenshot(page, `native-mobile-${theme}`);
    }
  });
  await scenario('Native production route assets and browser runtime have no errors', async () => {
    for (const url of await page.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => node.src || node.href))) expect((await page.request.get(url)).status()).toBe(200);
    expect(errors).toEqual([]); expect(assetErrors).toEqual([]);
    // Failed requests are deliberate validation/RBAC/lost-delivery probes.
    // Any other console error, including React/runtime errors, fails the run.
    expect(consoleErrors.filter(item => !item.url.startsWith(backend)
      || !/^Failed to load resource: (the server responded with a status of (400|401|403|404|409|422|503)\b|net::ERR_(CONNECTION_FAILED|FAILED))/.test(item.text))).toEqual([]);
  });
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ browser: browser.version(), results, errors, assetErrors, consoleErrors }, null, 2));
  console.log(`P3 TOTAL ${JSON.stringify(results.reduce((sum, item) => ({ ...sum, [item.status]: (sum[item.status] || 0) + 1 }), {}))}`);
  if (results.some(item => item.status === 'FAIL')) process.exitCode = 1;
}
main().catch(error => { console.error(scrub(error.stack)); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
