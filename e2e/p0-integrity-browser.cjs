// Focused P0 checks against real local services. Native procedures stay BLOCKED;
// no fabricated programme, token, metrology result or successful API response.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const frontend = process.env.W8LAB_BROWSER_FRONTEND;
const backend = process.env.W8LAB_BROWSER_BACKEND;
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const tech = process.env.W8LAB_BROWSER_TECHNICIAN;
const reviewer = process.env.W8LAB_BROWSER_REVIEWER;
const password = process.env.W8LAB_BROWSER_PASSWORD;
const reviewerPassword = process.env.W8LAB_BROWSER_REVIEWER_PASSWORD || password;
if (![frontend, backend, runRoot, tech, reviewer, password].every(Boolean)) throw new Error('Supply documented local browser variables.');
for (const url of [frontend, backend]) if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Local services only.');
const out = path.join(runRoot, `integrity-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(out, { recursive: true });
const results = [], errors = [];
const scrub = text => [tech, reviewer, password, reviewerPassword].reduce((value, secret) => value.split(secret).join('[REDACTED]'), String(text));
const read = name => JSON.parse(fs.readFileSync(path.join(runRoot, 'data', `${name}.json`), 'utf8'));
let browser, page, caseId;
async function scenario(name, operation) {
  try { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: scrub(error.message) }); console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 300)}`); }
}
async function api(endpoint, method = 'GET', payload) {
  return page.evaluate(async ({ url, method, payload }) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}`, 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body };
  }, { url: `${backend}/api/v1${endpoint}`, method, payload });
}
async function login(email) {
  await page.goto(`${frontend}/login`);
  await page.locator('input[type=email]').fill(email); await page.locator('input[type=password]').fill(email === reviewer ? reviewerPassword : password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await page.waitForURL('**/dashboard');
}
async function saveObservation(type, indication, unit = 'g') {
  await page.getByRole('button', { name: new RegExp(`^${type}`) }).click();
  await page.getByLabel(/^Unit/).selectOption(unit);
  await page.getByPlaceholder('e.g., 100.00', { exact: true }).fill(unit === 'g' ? '5000' : '5');
  await page.getByPlaceholder('e.g., 100.02', { exact: true }).fill(indication);
  await page.getByPlaceholder('e.g., 0.00', { exact: true }).fill(unit === 'g' ? '2.5' : '0.0025');
  const response = page.waitForResponse(res => res.url() === `${backend}/api/v1/observations` && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Record Observation', exact: true }).click();
  const saved = await response; expect(saved.status()).toBe(201); return (await saved.json()).data;
}
async function shot(name) {
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true, animations: 'disabled',
    mask: [page.getByText(tech, { exact: true }), page.getByText(reviewer, { exact: true }), page.locator('input[type=email],input[type=password]')] });
}
async function main() {
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  page = await browser.newPage({ acceptDownloads: true });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(scrub(error.message)));
  await scenario('Configured technician login and authenticated manufacturer/instrument/case setup', async () => {
    await login(tech);
    const manufacturer = await api('/manufacturers', 'POST', { name: 'Synthetic P0 maker', address: 'Isolated P0 site', identifier: 'P0-INTEGRITY' });
    expect(manufacturer.status).toBe(201);
    const instrument = await api('/instruments', 'POST', { manufacturerId: manufacturer.body.data.id,
      name: 'Native P0 procedure probe', model: 'P0-REAL-API', serialNumber: 'P0-NATIVE', isWeighing: true, isManual: true,
      isElectronic: true, isSingleRange: true, accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: false,
      weighingUnit: 'g', hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false });
    expect(instrument.status).toBe(201);
    const created = await api('/test-cases', 'POST', { instrumentId: instrument.body.data.id }); expect(created.status).toBe(201);
    caseId = created.body.data.id;
    expect((await api(`/test-cases/${caseId}/status`, 'PUT', { status: 'TESTING', expectedRevision: 0 })).status).toBe(200);
    expect((await api(`/test-cases/${caseId}/laboratory-conditions`, 'PUT', { temperature: '20', humidity: '50', pressure: '1013' })).status).toBe(200);
    await page.goto(`${frontend}/test-cases/${caseId}/workspace`);
  });
  await scenario('Native repeatability and zero-setting remain visibly INCOMPLETE, not PASS or N/A', async () => {
    for (const type of ['REPEATABILITY', 'ZERO_SETTING']) {
      const saved = await saveObservation(type, '5000');
      expect(saved.evaluation.compliance.verdict).toBe('BLOCKED');
      const record = await api(`/repository/records/${caseId}`);
      expect(record.status).toBe(200);
      expect(record.body.data.programme.tests[type].status).toBe('INCOMPLETE');
      expect(record.body.data.programme.overallVerdict).toBe('INCOMPLETE');
      await expect(page.locator('tbody tr')).toContainText('BLOCKED');
    }
    await shot('native-blocked-is-incomplete');
  });
  await scenario('Failed g/kg rows retain identical exact calculations; overall stays INCOMPLETE', async () => {
    const g = await saveObservation('WEIGHING', '5010');
    const kg = await saveObservation('WEIGHING', '5.010', 'kg');
    expect(kg.evaluation.calculation).toEqual(g.evaluation.calculation);
    expect(kg.evaluation.rulePackage).toEqual(g.evaluation.rulePackage);
    expect(kg.evaluation.compliance.verdict).toBe('FAIL');
    const { body } = await api(`/repository/records/${caseId}`);
    expect(body.data.programme).toMatchObject({ complete: false, overallVerdict: 'INCOMPLETE', observedOutcome: 'FAIL' });
    expect(body.data.programme.tests.TARE).toMatchObject({ status: 'NOT APPLICABLE', reason: expect.stringContaining('hasTare=false') });
    await page.reload(); await expect(page.locator('#programme-status')).toContainText('INCOMPLETE');
    await shot('failed-observations-incomplete-programme');
  });
  await scenario('Review and direct API cannot finalize a failed but incomplete native programme', async () => {
    const revision = () => read('testCases').find(row => row.id === caseId).revision;
    expect((await api(`/test-cases/${caseId}/workflow/submit`, 'POST', { expectedRevision: revision() })).status).toBe(200);
    await login(reviewer);
    expect((await api(`/test-cases/${caseId}/workflow/start-review`, 'POST', { expectedRevision: revision() })).status).toBe(200);
    await page.goto(`${frontend}/test-cases/${caseId}/workspace`);
    await expect(page.getByRole('button', { name: 'Approve Record', exact: true })).toBeDisabled();
    const auditBefore = read('audit');
    const denied = await api(`/test-cases/${caseId}/workflow/approve`, 'POST', { expectedRevision: revision() });
    expect(denied.status).toBe(409); expect(denied.body.error).toContain('INCOMPLETE'); expect(read('audit')).toEqual(auditBefore);
    expect((await api(`/reports/${caseId}/data`)).status).toBe(400);
  });
  await scenario('Legacy HTML preview and PDF correctly warn PROTOTYPE/INCOMPLETE and retain stored history', async () => {
    const stored = JSON.stringify({ cases: read('testCases'), observations: read('observations') });
    await page.goto(`${frontend}/reports`);
    const report = page.getByRole('article', { name: 'Report p0-legacy-approved', exact: true });
    await report.getByRole('button', { name: 'Preview report', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Report preview p0-legacy-approved"]');
    await expect(frame.locator('body')).toContainText('not a final compliance report');
    await expect(frame.locator('body')).toContainText('INCOMPLETE');
    await shot('legacy-incomplete-html-preview');
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    const downloaded = page.waitForEvent('download');
    await report.getByRole('button', { name: 'Download PDF', exact: true }).click();
    const pdfPath = path.join(out, 'legacy-incomplete.pdf'); await (await downloaded).saveAs(pdfPath);
    const pdf = fs.readFileSync(pdfPath).toString('latin1');
    expect(pdf).toContain('Status: PROTOTYPE'); expect(pdf).toContain('Overall: INCOMPLETE'); expect(pdf).not.toContain('Status: FINAL');
    expect(JSON.stringify({ cases: read('testCases'), observations: read('observations') })).toBe(stored);
  });
  await scenario('No uncaught browser application exceptions', async () => { expect(errors).toEqual([]); });
  await browser.close();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ browser: 'Chromium', frontend, backend, caseId, results, errors }, null, 2));
  console.log(`RESULTS ${out}`); console.log(`TOTAL ${JSON.stringify(results.reduce((sum, item) => ({ ...sum, [item.status]: (sum[item.status] || 0) + 1 }), {}))}`);
  if (results.some(item => item.status === 'FAIL')) process.exitCode = 1;
}
main().catch(async error => { console.error(scrub(error.message)); await browser?.close(); process.exitCode = 1; });
