/* Real-browser verification against separately started, isolated local dev servers.
 * Accounts/password are supplied through W8LAB_BROWSER_* environment variables.
 * No response mocking, production endpoints, HAR, trace or saved login state.
 */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { textContrast } = require('./contrast.cjs');

const root = path.resolve(__dirname, '..');
const runRoot = path.resolve(process.env.W8LAB_BROWSER_RUN_DIR || path.join(root, 'artifacts/browser-review/local'));
const dataDir = path.join(runRoot, 'data');
const output = path.join(runRoot, `attempt-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3010';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4001';
const api = `${backend}/api/v1`;
const legacyCaseId = process.env.W8LAB_BROWSER_LEGACY_CASE || 'p0-legacy-approved';
const accounts = {
  technician: process.env.W8LAB_BROWSER_TECHNICIAN,
  reviewer: process.env.W8LAB_BROWSER_REVIEWER,
  administrator: process.env.W8LAB_BROWSER_ADMINISTRATOR,
  otherTechnician: process.env.W8LAB_BROWSER_OTHER_TECHNICIAN,
};
const password = process.env.W8LAB_BROWSER_PASSWORD;
const rolePasswords = {
  technician: process.env.W8LAB_BROWSER_TECHNICIAN_PASSWORD || password,
  reviewer: process.env.W8LAB_BROWSER_REVIEWER_PASSWORD || password,
  administrator: process.env.W8LAB_BROWSER_ADMINISTRATOR_PASSWORD || password,
  otherTechnician: process.env.W8LAB_BROWSER_OTHER_TECHNICIAN_PASSWORD || password,
};
const businessPassword = crypto.randomBytes(24).toString('base64url');
const businessEmail = `full-run-business-${crypto.randomUUID()}@example.test`;
if (!password || Object.values(accounts).some(value => !value)) throw new Error('Supply the five documented W8LAB_BROWSER account/password environment variables.');
for (const origin of [frontend, backend]) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Only local origins are permitted.');
}
if (!fs.existsSync(dataDir)) throw new Error('Start the isolated backend with DATA_DIR=<W8LAB_BROWSER_RUN_DIR>/data first.');
fs.mkdirSync(output, { recursive: true });

const scenarios = [];
const traffic = [];
const consoleEvents = [];
const blockedExternal = [];
const redacted = [password, ...Object.values(rolePasswords), businessPassword, businessEmail, ...Object.values(accounts)];
let currentScenario = 'setup';
let activePage;
let browser;
let caseId;
let observationId;
let instrumentName;
let staleReview;
let browserVersion;
const contexts = [];

function scrub(value) {
  let text = String(value);
  for (const secret of redacted) text = text.split(secret).join('[REDACTED]');
  return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
}
function collection(name) {
  const file = path.join(dataDir, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}
function record() { return collection('testCases').find(row => row.id === caseId); }
function need(value, explanation) {
  if (!value) { const error = new Error(explanation); error.blocked = true; throw error; }
}
function count(method, pathname) {
  return traffic.filter(item => item.type === 'request' && item.method === method && item.path === pathname).length;
}
async function screenshot(page, name) {
  if (!page || page.isClosed()) return undefined;
  const file = `${name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.png`;
  const mask = [page.locator('input[type=email],input[type=password]')];
  for (const secret of redacted) mask.push(page.getByText(secret, { exact: true }));
  await page.screenshot({ path: path.join(output, file), fullPage: true, mask, animations: 'disabled', timeout: 30000 });
  return file;
}
async function scenario(name, operation) {
  currentScenario = name;
  const started = Date.now();
  try {
    const detail = await operation();
    scenarios.push({ name, status: 'PASS', detail: detail || '', milliseconds: Date.now() - started });
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    const status = error.blocked ? 'BLOCKED' : 'FAIL';
    let evidence;
    try { evidence = await screenshot(activePage, `${scenarios.length + 1}-${status}-${name}`); } catch {}
    scenarios.push({ name, status, detail: scrub(error.message).slice(0, 2200), screenshot: evidence, milliseconds: Date.now() - started });
    console.log(`${status} ${name}: ${scrub(error.message).slice(0, 300)}`);
    return false;
  }
}
async function newPage(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light', acceptDownloads: true });
  contexts.push(context);
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin)) {
      blockedExternal.push({ origin: url.origin, path: url.pathname });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  context.on('page', page => observePage(page, label));
  return context.newPage();
}
function observePage(page, label) {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  page.on('dialog', dialog => dialog.accept());
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) consoleEvents.push({ page: label, scenario: currentScenario, type: message.type(), text: scrub(message.text()) });
  });
  page.on('pageerror', error => consoleEvents.push({ page: label, scenario: currentScenario, type: 'pageerror', text: scrub(error.message) }));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === backend) traffic.push({ type: 'request', page: label, scenario: currentScenario, method: request.method(), origin: url.origin, path: url.pathname });
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === backend || response.status() >= 400) traffic.push({ type: 'response', page: label, scenario: currentScenario, method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status() });
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    traffic.push({ type: 'failed', page: label, scenario: currentScenario, method: request.method(), origin: url.origin, path: url.pathname, failure: scrub(request.failure()?.errorText || '') });
  });
}
async function login(page, role) {
  activePage = page;
  await page.goto(`${frontend}/login`);
  await page.locator('input[type=email]').fill(accounts[role]);
  await page.locator('input[type=password]').fill(rolePasswords[role]);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.locator('nav')).toBeVisible();
}
async function openWorkspace(page) {
  need(caseId, 'Main test case was not created.');
  activePage = page;
  await page.goto(`${frontend}/test-cases/${caseId}/workspace`);
  await expect(page.getByRole('heading', { name: /Observation Workspace|Laboratory Review/ })).toBeVisible();
}
async function clickMutation(page, name, suffix, method = 'POST', duplicate = false) {
  activePage = page;
  const response = page.waitForResponse(r => r.url() === `${api}${suffix}` && r.request().method() === method);
  const button = page.getByRole('button', { name, exact: true });
  if (duplicate) await button.evaluate(element => { element.click(); element.click(); });
  else await button.click();
  const result = await response;
  if (result.status() >= 400) throw new Error(`Expected successful ${method} ${suffix}, received ${result.status()}: ${scrub(await result.text())}`);
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Saving' })).toHaveCount(0);
  return result.json();
}
async function browserFetch(page, endpoint, method = 'GET', payload) {
  return page.evaluate(async ({ url, method, payload }) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nawi_token')}` }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const text = await response.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body };
  }, { url: `${api}${endpoint}`, method, payload });
}
async function fillInstrument(page, suffix) {
  activePage = page;
  await page.goto(`${frontend}/instruments/new`);
  await page.getByRole('button', { name: 'CONTINUE TO METADATA' }).click();
  const values = {
    'Name (e.g. Sartorius 200)': `Browser Verification ${suffix}`,
    Model: `BV-${suffix}`, 'Serial Number': `ISOLATED-${suffix}`,
    'Max Capacity (String strictly)': '15000', 'Min Capacity': '100',
    'Verification Scale Interval (e)': '5', 'Actual Scale Interval (d)': '5',
  };
  for (const [placeholder, value] of Object.entries(values)) await page.getByPlaceholder(placeholder, { exact: true }).fill(value);
  await page.getByLabel('Accuracy Class', { exact: true }).selectOption('III');
  const manufacturers = await browserFetch(page, '/manufacturers');
  const ownMaker = manufacturers.body.data.find(item => item.identifier === 'FULL-LAB-P2');
  const maker = ownMaker || (await browserFetch(page, '/manufacturers', 'POST', { name: 'Full laboratory maker', address: 'Synthetic laboratory site', identifier: 'FULL-LAB-P2' })).body.data;
  await page.getByRole('button', { name: 'Refresh manufacturers', exact: true }).click();
  await expect(page.locator('#instrument-manufacturer option').filter({ hasText: maker.name })).toBeAttached();
  await page.getByLabel('Manufacturer', { exact: true }).selectOption(maker.id);
  return values['Name (e.g. Sartorius 200)'];
}
async function fillObservation(page, indication = '5005', weights = '3') {
  await page.getByPlaceholder('e.g., 100.00', { exact: true }).fill('5000');
  await page.getByPlaceholder('e.g., 100.02', { exact: true }).fill(indication);
  await page.getByPlaceholder('e.g., 0.00', { exact: true }).fill(weights);
}
async function fillBusinessApplication(page) {
  await page.getByLabel('Business name').fill('Full Runner Business');
  await page.getByLabel('Installation address').fill('21 Isolated Workflow Road');
  await page.getByLabel('Instrument name').fill('Full runner scale');
  await page.getByLabel('Model').fill('FULL-APP-1');
  await page.getByLabel('Serial number').fill('FULL-APP-SERIAL-1');
  await page.getByLabel('Accuracy class').selectOption('III');
  await page.getByLabel('Maximum capacity, Max (g)').fill('30000');
  await page.getByLabel('Minimum capacity, Min (g)').fill('200');
  await page.getByLabel('Verification interval, e (g)').fill('10');
  await page.getByLabel('Scale interval, d (g)').fill('10');
  await page.getByLabel('I confirm this instrument matches the supported profile.').check();
}
async function savedState(page, state) {
  await expect.poll(() => record()?.status).toBe(state);
  await expect(page.locator('span').filter({ hasText: new RegExp(`^${state.replaceAll('_', ' ')}$`) })).toBeVisible();
}

async function main() {
  const originalFiles = fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json'));
  const projectDataBefore = Object.fromEntries(originalFiles.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  browserVersion = browser.version();
  console.log(`BROWSER Chromium ${browserVersion}; frontend=${frontend}; backend=${backend}`);
  const technician = await newPage('owning-technician');
  const reviewer = await newPage('reviewer');
  const other = await newPage('second-technician');
  const admin = await newPage('administrator');
  const business = await newPage('business');

  await scenario('Technician signs in through the login form', async () => {
    await login(technician, 'technician');
    expect(await technician.evaluate(() => !!localStorage.getItem('nawi_token'))).toBe(true);
  });
  await scenario('Queue loading indicator and empty state use a real delayed request', async () => {
    activePage = technician;
    await technician.route(`${api}/test-cases`, async route => { await new Promise(resolve => setTimeout(resolve, 900)); await route.continue(); });
    await technician.getByRole('link', { name: /Evaluation queue/i }).click();
    await expect(technician.getByText('Loading evaluation queue...')).toBeVisible();
    await expect(technician.getByText('No test cases found')).toBeVisible();
    await technician.unroute(`${api}/test-cases`);
    await screenshot(technician, 'empty-queue');
  });
  await scenario('Instrument form values and placeholders readable in both themes', async () => {
    await fillInstrument(technician, 'MAIN');
    const styles = {};
    for (const theme of ['light', 'dark']) {
      await technician.emulateMedia({ colorScheme: theme });
      await technician.waitForTimeout(250); // Let the form's color transition finish before measuring.
      styles[theme] = await technician.getByPlaceholder('Name (e.g. Sartorius 200)', { exact: true }).evaluate(input => ({ text: getComputedStyle(input).color, background: getComputedStyle(input).backgroundColor, placeholder: getComputedStyle(input, '::placeholder').color, value: input.value }));
      expect(styles[theme].text).not.toBe(styles[theme].background);
      await screenshot(technician, `instrument-${theme}`);
    }
    await technician.emulateMedia({ colorScheme: 'light' });
    fs.writeFileSync(path.join(output, 'form-colors.json'), JSON.stringify(styles, null, 2));
    return JSON.stringify(styles);
  });
  await scenario('Metadata fields keep identifiable labels after entering values', async () => {
    const missing = await technician.locator('main input:not([type=checkbox])').evaluateAll(inputs => inputs.filter(input => !input.labels?.length && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')).map(input => ({ placeholder: input.placeholder, labelCount: input.labels?.length || 0 })));
    expect(missing, 'Metadata fields need persistent visible/accessible field names after placeholder disappears.').toEqual([]);
    for (const control of await technician.locator('main input:not([type=checkbox]), main select').all()) {
      const label = await control.evaluate(element => ({ id: element.id, count: element.labels.length, text: element.labels[0]?.textContent.trim(), for: element.labels[0]?.htmlFor }));
      expect(label.count, 'An aria-label alone does not provide a persistent visible label.').toBe(1);
      expect(label.id).not.toBe('');
      expect(label.for).toBe(label.id);
      await expect(technician.locator(`label[for="${label.id}"]`)).toBeVisible();
      await expect(control).toHaveAccessibleName(label.text);
    }
  });
  await scenario('Dark-theme page headings and checkbox labels remain readable', async () => {
    activePage = technician;
    await technician.emulateMedia({ colorScheme: 'dark' });
    try {
      await technician.waitForTimeout(250);
      const colors = [];
      for (const step of [2, 1]) {
        if (step === 1) await technician.getByRole('button', { name: 'BACK', exact: true }).click();
        for (const selector of ['h1', 'h2', 'label span']) {
          for (const element of await technician.locator(`form[aria-busy] ${selector}`).all()) {
            const measured = await textContrast(element);
            colors.push({ step, selector, ...measured });
          }
        }
        await screenshot(technician, step === 2 ? 'dark-heading-and-checkbox-contrast' : 'dark-classification-contrast');
      }
      await technician.getByRole('button', { name: 'CONTINUE TO METADATA', exact: true }).click();
      fs.writeFileSync(path.join(output, 'dark-heading-colors.json'), JSON.stringify(colors, null, 2));
      for (const color of colors) {
        expect(color.approximate, `${color.text}: use the actual opaque surface, not the distant mesh base`).toBe(false);
        expect(color.contrast, `${color.text}: contrast against its painted background`).toBeGreaterThanOrEqual(color.selector === 'label span' ? 4.5 : 3);
      }
    } finally { await technician.emulateMedia({ colorScheme: 'light' }); }
  });
  await scenario('Create an isolated instrument and draft test case via UI', async () => {
    instrumentName = await technician.getByPlaceholder('Name (e.g. Sartorius 200)', { exact: true }).inputValue();
    await technician.getByRole('button', { name: 'SUBMIT & INITIATE TEST' }).click();
    await technician.waitForURL('**/test-cases/*/workspace');
    caseId = /\/test-cases\/([^/]+)\/workspace/.exec(technician.url())[1];
    await expect(technician.getByRole('heading', { name: 'Observation Workspace' })).toBeVisible();
    await savedState(technician, 'DRAFT');
    expect(collection('instruments').find(item => item.id === record().instrumentId).name).toBe(instrumentName);
    await screenshot(technician, 'draft-locked');
  });
  await scenario('DRAFT blocks observation input in UI and real backend', async () => {
    need(record(), 'Draft creation did not complete.');
    await expect(technician.getByRole('button', { name: 'Record Observation', exact: true })).toHaveCount(0);
    const result = await browserFetch(technician, '/observations', 'POST', { testCaseId: caseId, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5005', additionalWeights: '3' });
    expect(result.status).toBe(403);
    expect(collection('observations').filter(item => item.testCaseId === caseId)).toHaveLength(0);
  });
  await scenario('Start Testing duplicate clicks produce one transition', async () => {
    need(record()?.status === 'DRAFT', 'A draft case is needed.');
    const endpoint = `/test-cases/${caseId}/status`;
    const before = count('PUT', `/api/v1${endpoint}`);
    await clickMutation(technician, 'Start Testing', endpoint, 'PUT', true);
    await savedState(technician, 'TESTING');
    await expect(technician.getByRole('button', { name: 'Record Observation', exact: true })).toBeVisible();
    expect(count('PUT', `/api/v1${endpoint}`) - before).toBe(1);
  });
  await scenario('Save laboratory conditions through UI', async () => {
    need(record()?.status === 'TESTING', 'Testing state required.');
    const inputs = technician.locator('.card').filter({ has: technician.getByRole('heading', { name: 'Laboratory Conditions', exact: true }) }).locator('input');
    for (const [index, value] of ['20', '50', '1013'].entries()) await inputs.nth(index).fill(value);
    await clickMutation(technician, 'Save Conditions', `/test-cases/${caseId}/laboratory-conditions`, 'PUT');
    expect(record().laboratoryConditions).toEqual({ temperature: '20', humidity: '50', pressure: '1013' });
  });
  await scenario('Submission validation shows backend failure for empty observations', async () => {
    const response = technician.waitForResponse(r => r.url().endsWith(`/test-cases/${caseId}/workflow/submit`));
    await technician.getByRole('button', { name: 'Submit for Review', exact: true }).click();
    expect((await response).status()).toBe(400);
    await expect(technician.getByRole('alert').filter({ hasText: 'no observations' })).toBeVisible();
    expect(record().status).toBe('TESTING');
    await screenshot(technician, 'empty-submission-validation');
  });
  await scenario('Invalid observation shows saved-evaluation API error and preserves data', async () => {
    await fillObservation(technician, 'not-a-number');
    const response = technician.waitForResponse(r => r.url() === `${api}/observations` && r.request().method() === 'POST');
    await technician.getByRole('button', { name: 'Record Observation', exact: true }).click();
    expect((await response).status()).toBe(400);
    await expect(technician.getByRole('alert').filter({ hasText: 'Evaluation failed' })).toBeVisible();
    expect(collection('observations').filter(item => item.testCaseId === caseId)).toHaveLength(0);
    await screenshot(technician, 'invalid-observation-feedback');
  });
  await scenario('Valid observation persists exact backend evaluation with duplicate-click protection', async () => {
    await fillObservation(technician);
    const before = count('POST', '/api/v1/observations');
    const response = await clickMutation(technician, 'Record Observation', '/observations', 'POST', true);
    observationId = response.data.id;
    const row = technician.locator('tbody tr').filter({ hasText: '5005' });
    await expect(row).toContainText('Ec: 4.5 g');
    await expect(row).toContainText('MPE: 5 g');
    await expect(row).toContainText('PASS');
    expect(count('POST', '/api/v1/observations') - before).toBe(1);
    expect(collection('observations').filter(item => item.testCaseId === caseId)).toHaveLength(1);
    expect(collection('observations').find(item => item.id === observationId).evaluation.calculation.Ec.value).toBe('4.5');
    await screenshot(technician, 'testing-saved-evaluation');
  });
  await scenario('Reload preserves laboratory conditions, readings and evaluation', async () => {
    need(observationId, 'A saved observation is required.');
    await technician.reload();
    await expect(technician.locator('tbody tr')).toContainText('Ec: 4.5 g');
    await expect(technician.locator('.card').filter({ has: technician.getByRole('heading', { name: 'Laboratory Conditions', exact: true }) }).locator('input').first()).toHaveValue('20');
  });
  await scenario('P0 gram/kilogram form entries produce identical exact calculations and verdicts', async () => {
    const gram = collection('observations').find(item => item.id === observationId).evaluation;
    await technician.getByLabel(/^Unit/).selectOption('kg');
    await technician.getByPlaceholder('e.g., 100.00', { exact: true }).fill('5');
    await technician.getByPlaceholder('e.g., 100.02', { exact: true }).fill('5.005');
    await technician.getByPlaceholder('e.g., 0.00', { exact: true }).fill('0.003');
    const saved = await clickMutation(technician, 'Record Observation', '/observations', 'POST', true);
    expect(saved.data.unit).toBe('kg');
    expect(saved.data.evaluation.calculation).toEqual(gram.calculation);
    expect(saved.data.evaluation.rulePackage).toEqual(gram.rulePackage);
    expect(saved.data.evaluation.compliance.verdict).toBe('PASS');
    await expect(technician.locator('tbody tr').filter({ hasText: '5.005' })).toContainText('Ec: 4.5 g');
    await screenshot(technician, 'p0-equivalent-units');
    await clickMutation(technician, 'Delete observation 2', `/observations/${saved.data.id}`, 'DELETE');
    await technician.getByLabel(/^Unit/).selectOption('g');
  });
  await scenario('P0 invalid unit/conditions APIs reject without mutation or audit', async () => {
    const before = JSON.stringify({ case: record(), observations: collection('observations'), audit: collection('audit') });
    expect((await browserFetch(technician, '/observations', 'POST', { testCaseId: caseId, testType: 'WEIGHING', sequence: 2,
      load: '5', indication: '5.005', additionalWeights: '0.003', unit: 'lb' })).status).toBe(400);
    expect((await browserFetch(technician, `/test-cases/${caseId}/laboratory-conditions`, 'PUT',
      { temperature: '20', humidity: '101', pressure: '1013', expectedRevision: record().revision })).status).toBe(400);
    expect(JSON.stringify({ case: record(), observations: collection('observations'), audit: collection('audit') })).toBe(before);
  });
  await scenario('P0 completeness is persistent and readable on narrow light/dark keyboard layouts', async () => {
    const panel = technician.locator('section[aria-labelledby="programme-status"]');
    try {
      await technician.setViewportSize({ width: 390, height: 844 });
      for (const theme of ['light', 'dark']) {
        await technician.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await expect(panel).toContainText('INCOMPLETE');
        await expect(panel).toContainText('NOT STARTED');
        await expect(panel).toContainText('UNDETERMINED');
        await technician.getByLabel(/^Unit/).focus();
        await technician.keyboard.press('ArrowDown');
        await expect(technician.getByLabel(/^Unit/)).toHaveValue('kg');
        await technician.getByLabel(/^Unit/).selectOption('g');
        await screenshot(technician, `p0-mobile-${theme}`);
        expect(await technician.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
    } finally {
      await technician.setViewportSize({ width: 1440, height: 1100 });
      await technician.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
    }
  });
  await scenario('Available evidence renders and downloads from real persisted evidence', async () => {
    need(record()?.status === 'TESTING', 'Testing state required for supported evidence upload API.');
    const contents = 'Isolated browser verification evidence. No real laboratory data.';
    const uploaded = await browserFetch(technician, '/evidence', 'POST', { testCaseId: caseId, testType: 'GENERAL', description: 'Synthetic setup evidence', fileName: 'synthetic-evidence.txt', mimeType: 'text/plain', sizeBytes: Buffer.byteLength(contents), fileData: Buffer.from(contents).toString('base64') });
    expect(uploaded.status).toBe(201);
    await technician.reload();
    await expect(technician.locator('section').filter({ has: technician.getByRole('heading', { name: 'Available evidence', exact: true }) }).getByText('synthetic-evidence.txt', { exact: false }).first()).toBeVisible();
    const download = technician.waitForEvent('download');
    await technician.getByRole('button', { name: 'Download evidence', exact: true }).click();
    const file = await download;
    await file.saveAs(path.join(output, 'synthetic-evidence.txt'));
    expect(fs.readFileSync(path.join(output, 'synthetic-evidence.txt'), 'utf8')).toBe(contents);
    return 'Evidence fixture submitted through supported API from browser; display/download exercised through UI. No upload UI exists.';
  });
  await scenario('Submit for review locks technician editing and sends one request', async () => {
    const endpoint = `/test-cases/${caseId}/workflow/submit`;
    const before = count('POST', `/api/v1${endpoint}`);
    await clickMutation(technician, 'Submit for Review', endpoint, 'POST', true);
    await savedState(technician, 'READY_FOR_REVIEW');
    await expect(technician.getByRole('button', { name: 'Record Observation', exact: true })).toHaveCount(0);
    await expect(technician.getByRole('button', { name: 'Save Conditions', exact: true })).toHaveCount(0);
    expect(count('POST', `/api/v1${endpoint}`) - before).toBe(1);
    await screenshot(technician, 'submitted-technician-locked');
  });
  await scenario('Second technician cannot view or mutate the first technician record', async () => {
    await login(other, 'otherTechnician');
    await other.goto(`${frontend}/tests`);
    await expect(other.getByText('No test cases found')).toBeVisible();
    await other.goto(`${frontend}/test-cases/${caseId}/workspace`);
    await expect(other.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();
    const before = JSON.stringify(record());
    const result = await browserFetch(other, `/observations/${observationId}`, 'PUT', { load: '5000', indication: '5000', additionalWeights: '2.5' });
    expect(result.status).toBe(403);
    expect(JSON.stringify(record())).toBe(before);
    await screenshot(other, 'cross-technician-access-denied');
  });
  await scenario('Reviewer finds submitted record and sees instrument, conditions, evaluations, evidence', async () => {
    await login(reviewer, 'reviewer');
    await reviewer.getByRole('link', { name: /Evaluation queue/i }).click();
    const row = reviewer.locator('tbody tr').filter({ hasText: caseId });
    await expect(row).toContainText('READY FOR REVIEW');
    await row.getByRole('link', { name: 'Open Workspace' }).click();
    await expect(reviewer.getByRole('heading', { name: 'Laboratory Review' })).toBeVisible();
    await expect(reviewer.getByText(instrumentName, { exact: true })).toBeVisible();
    await expect(reviewer.locator('tbody tr')).toContainText('Ec: 4.5 g');
    await expect(reviewer.locator('tbody tr')).toContainText('MPE: 5 g');
    await expect(reviewer.getByText('Synthetic setup evidence', { exact: true })).toBeVisible();
    const conditionInputs = reviewer.locator('.card').filter({ has: reviewer.getByRole('heading', { name: 'Laboratory Conditions', exact: true }) }).locator('input');
    await expect(conditionInputs.first()).toHaveValue('20');
    await expect(conditionInputs.first()).toBeDisabled();
    staleReview = await reviewer.context().newPage();
    await staleReview.goto(reviewer.url());
    await expect(staleReview.getByRole('button', { name: 'Start Review', exact: true })).toBeVisible();
    await screenshot(reviewer, 'reviewer-details');
  });
  await scenario('Reviewer claims record and return requires a correction reason', async () => {
    await clickMutation(reviewer, 'Start Review', `/test-cases/${caseId}/workflow/start-review`, 'POST', true);
    await savedState(reviewer, 'UNDER_REVIEW');
    await expect(reviewer.getByRole('button', { name: 'Return for Correction', exact: true })).toBeDisabled();
    await reviewer.locator('#correction-reason').fill('   ');
    await expect(reviewer.getByRole('button', { name: 'Return for Correction', exact: true })).toBeDisabled();
  });
  const correctionReason = 'Browser verification: correct the indication using the documented test data.';
  await scenario('Return for Correction persists reason once under repeated clicks', async () => {
    await reviewer.locator('#correction-reason').fill(correctionReason);
    const endpoint = `/test-cases/${caseId}/workflow/return`;
    const before = count('POST', `/api/v1${endpoint}`);
    await clickMutation(reviewer, 'Return for Correction', endpoint, 'POST', true);
    await savedState(reviewer, 'RETURNED_FOR_CORRECTION');
    expect(record().reviewNotes).toBe(correctionReason);
    expect(count('POST', `/api/v1${endpoint}`) - before).toBe(1);
    await screenshot(reviewer, 'returned-with-feedback');
  });
  await scenario('Owning technician sees feedback and must Resume Testing before correction', async () => {
    await openWorkspace(technician);
    await expect(technician.getByText(correctionReason, { exact: true }).first()).toBeVisible();
    await expect(technician.getByRole('button', { name: 'Record Observation', exact: true })).toHaveCount(0);
    await clickMutation(technician, 'Resume Testing', `/test-cases/${caseId}/status`, 'PUT', true);
    await savedState(technician, 'TESTING');
    await expect(technician.getByRole('button', { name: 'Edit observation 1', exact: true })).toBeVisible();
  });
  await scenario('Technician correction recalculates on backend and retains original audit snapshot', async () => {
    await technician.getByRole('button', { name: 'Edit observation 1', exact: true }).click();
    await fillObservation(technician, '5000', '2.5');
    await clickMutation(technician, 'Save Correction', `/observations/${observationId}`, 'PUT', true);
    await expect(technician.locator('tbody tr')).toContainText('Ec: 0 g');
    const updated = collection('audit').find(item => item.testCaseId === caseId && item.action === 'OBSERVATION_UPDATED');
    expect(updated.metadata.previous.evaluation.calculation.Ec.value).toBe('4.5');
    expect(updated.metadata.updated.evaluation.calculation.Ec.value).toBe('0');
    await screenshot(technician, 'corrected-evaluation-history');
  });
  await scenario('Supported observation deletion retains its saved evaluation in audit history', async () => {
    await fillObservation(technician);
    const added = await clickMutation(technician, 'Record Observation', '/observations');
    await clickMutation(technician, 'Delete observation 2', `/observations/${added.data.id}`, 'DELETE');
    expect(collection('observations').filter(item => item.testCaseId === caseId)).toHaveLength(1);
    expect(collection('audit').find(item => item.action === 'OBSERVATION_DELETED' && item.testCaseId === caseId).metadata.previous.evaluation.compliance.verdict).toBe('PASS');
  });
  await scenario('Resubmission returns corrected record to READY_FOR_REVIEW', async () => {
    await clickMutation(technician, 'Submit for Review', `/test-cases/${caseId}/workflow/submit`, 'POST', true);
    await savedState(technician, 'READY_FOR_REVIEW');
    expect(collection('audit').filter(item => item.testCaseId === caseId && item.action === 'SUBMIT_FOR_REVIEW')).toHaveLength(2);
  });
  await scenario('Stale reviewer tab gets clear 409 feedback across correction cycles', async () => {
    need(staleReview, 'A prior reviewer tab is required.');
    activePage = staleReview;
    const response = staleReview.waitForResponse(r => r.url().endsWith(`/test-cases/${caseId}/workflow/start-review`));
    await staleReview.getByRole('button', { name: 'Start Review', exact: true }).click();
    expect((await response).status()).toBe(409);
    await expect(staleReview.getByRole('alert').filter({ hasText: 'record has changed' })).toBeVisible();
    expect(record().status).toBe('READY_FOR_REVIEW');
    await screenshot(staleReview, 'stale-tab-feedback');
  });
  await scenario('Reviewer starts new review but incomplete programme cannot receive final approval', async () => {
    await openWorkspace(reviewer);
    await expect(reviewer.locator('tbody tr')).toContainText('Ec: 0 g');
    await clickMutation(reviewer, 'Start Review', `/test-cases/${caseId}/workflow/start-review`);
    const endpoint = `/test-cases/${caseId}/workflow/approve`;
    const before = count('POST', `/api/v1${endpoint}`);
    await expect(reviewer.getByRole('button', { name: 'Approve Record', exact: true })).toBeDisabled();
    await expect(reviewer.locator('#programme-status')).toContainText('INCOMPLETE');
    const rejected = await browserFetch(reviewer, endpoint, 'POST', { expectedRevision: record().revision });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error).toContain('programme is INCOMPLETE');
    await savedState(reviewer, 'UNDER_REVIEW');
    expect(count('POST', `/api/v1${endpoint}`) - before).toBe(1);
    expect(collection('audit').filter(item => item.testCaseId === caseId && item.action === 'APPROVE')).toHaveLength(0);
  });
  await scenario('Reload retains UNDER_REVIEW state, technician locks, feedback and full review history', async () => {
    await openWorkspace(technician);
    await savedState(technician, 'UNDER_REVIEW');
    for (const name of ['Record Observation', 'Save Conditions', 'Resume Testing', 'Edit observation 1']) await expect(technician.getByRole('button', { name, exact: true })).toHaveCount(0);
    const history = technician.locator('section').filter({ has: technician.getByRole('heading', { name: 'Review and audit history', exact: true }) });
    await expect(history).toContainText('RETURN FOR CORRECTION');
    await expect(history).toContainText('OBSERVATION UPDATED');
    expect(collection('audit').filter(item => item.testCaseId === caseId && item.action === 'APPROVE')).toHaveLength(0);
    expect((await browserFetch(technician, `/observations/${observationId}`, 'DELETE')).status).toBe(403);
    await screenshot(technician, 'approved-technician-history');
    await reviewer.reload();
    await screenshot(reviewer, 'approved-reviewer');
  });
  await scenario('Reviewer navigation restricts technician creation actions', async () => {
    activePage = reviewer;
    await reviewer.goto(`${frontend}/dashboard`);
    await expect(reviewer.locator('main h1')).toHaveText('Dashboard');
    await expect(reviewer.getByRole('link', { name: /New Instrument|Register Instrument/ })).toHaveCount(0);
  });
  await scenario('Reports navigation opens an available report screen', async () => {
    activePage = reviewer;
    await reviewer.getByRole('link', { name: 'Reports', exact: true }).click();
    await reviewer.waitForURL('**/reports');
    await reviewer.waitForLoadState('networkidle');
    expect(await reviewer.locator('body').innerText()).not.toContain('This page could not be found.');
    await screenshot(reviewer, 'report-navigation');
  });
  await scenario('Legacy APPROVED PDF remains downloadable but is correctly PROTOTYPE and INCOMPLETE', async () => {
    activePage = reviewer;
    await reviewer.goto(`${frontend}/reports`);
    const report = reviewer.getByRole('article', { name: `Report ${legacyCaseId}`, exact: true });
    await expect(report).toBeVisible();
    const download = reviewer.waitForEvent('download');
    await report.getByRole('button', { name: 'Download PDF', exact: true }).click();
    const file = await download;
    const pdfPath = path.join(output, 'approved-report.pdf');
    await file.saveAs(pdfPath);
    const pdf = fs.readFileSync(pdfPath).toString('latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);
    expect(collection('testCases').find(item => item.id === legacyCaseId).status).toBe('APPROVED');
    for (const text of [legacyCaseId, 'Status: PROTOTYPE', 'Overall: INCOMPLETE', 'Load: 5000 g', 'Indication: 5000 g', 'Add. Weights: 2.5 g', 'Ec: 0 g', 'MPE: 5 g', 'Verdict: PASS']) expect(pdf).toContain(text);
    expect(pdf).not.toContain('Status: FINAL');
    const viewer = await reviewer.context().newPage();
    activePage = viewer;
    await viewer.goto(pathToFileURL(pdfPath).href);
    await expect.poll(() => viewer.frames().some(frame => frame.url().startsWith('chrome-extension://'))).toBe(true);
    const pdfFrame = viewer.frames().find(frame => frame.url().startsWith('chrome-extension://'));
    await expect(pdfFrame.locator('pdf-viewer')).toBeAttached();
    await expect(pdfFrame.getByText('approved-report.pdf', { exact: true })).toBeVisible();
    await viewer.waitForTimeout(2000);
    await screenshot(viewer, 'approved-report-open-in-browser');
    return 'Real authenticated PDF download and Chromium viewer; synthetic legacy APPROVED fixture retains stored state and raw values without a false FINAL/PASS claim.';
  });
  await scenario('Second technician cannot access the first technician approved report', async () => {
    activePage = other;
    const auditBefore = collection('audit');
    const filesBefore = fs.readdirSync(dataDir).sort();
    const probes = [];
    for (const representation of ['data', 'html', 'pdf']) {
      const result = await browserFetch(other, `/reports/${caseId}/${representation}`);
      probes.push({ representation, status: result.status, error: result.body.error });
      expect(result.status, `${representation} report reads must enforce the same record ownership as workspace/observations/audit reads.`).toBe(403);
      expect(result.body).toEqual({ success: false, error: 'Forbidden: Cannot access this test case' });
    }
    fs.writeFileSync(path.join(output, 'cross-record-report-probe.json'), JSON.stringify({ requestedCaseId: caseId, probes }, null, 2));
    expect(collection('audit'), 'Denied report reads must not generate or audit a report.').toEqual(auditBefore);
    expect(fs.readdirSync(dataDir).sort(), 'Denied requests must not create report files.').toEqual(filesBefore);
  });
  await scenario('Offline request failure shows feedback and successful retry', async () => {
    activePage = technician;
    await technician.goto(`${frontend}/tests`);
    await expect(technician.getByRole('button', { name: 'Refresh queue' })).toBeVisible();
    await technician.context().setOffline(true);
    try {
      await technician.getByRole('button', { name: 'Refresh queue' }).click();
      await expect(technician.getByRole('alert').filter({ hasText: /fetch/i })).toBeVisible();
      await expect(technician.getByRole('button', { name: 'Retry loading queue' })).toBeVisible();
      await screenshot(technician, 'offline-request-feedback');
    } finally { await technician.context().setOffline(false); }
    await technician.getByRole('button', { name: 'Retry loading queue' }).click();
    await expect(technician.locator('tbody tr').filter({ hasText: caseId })).toBeVisible();
  });
  await scenario('Repeated instrument creation clicks do not create duplicate mutations', async () => {
    await fillInstrument(technician, 'DUPLICATE-PROBE');
    const before = count('POST', '/api/v1/instruments');
    const casesBefore = count('POST', '/api/v1/test-cases');
    await technician.getByRole('button', { name: 'SUBMIT & INITIATE TEST' }).evaluate(element => { element.click(); element.click(); });
    await technician.waitForURL('**/test-cases/*/workspace');
    await expect(technician.getByRole('heading', { name: 'Observation Workspace' })).toBeVisible();
    await technician.waitForTimeout(500);
    const requests = count('POST', '/api/v1/instruments') - before;
    const instruments = collection('instruments').filter(instrument => instrument.name === 'Browser Verification DUPLICATE-PROBE');
    const created = collection('testCases').filter(item => instruments.some(instrument => instrument.id === item.instrumentId));
    expect({ mutationRequests: requests, testCaseRequests: count('POST', '/api/v1/test-cases') - casesBefore, persistedInstruments: instruments.length, persistedCases: created.length })
      .toEqual({ mutationRequests: 1, testCaseRequests: 1, persistedInstruments: 1, persistedCases: 1 });
  });
  await scenario('Administrator can claim a review but cannot override incomplete-programme protection', async () => {
    const mainCaseId = caseId;
    try {
      await fillInstrument(technician, 'ADMIN-PROBE');
      await technician.getByRole('button', { name: 'SUBMIT & INITIATE TEST' }).click();
      await technician.waitForURL('**/test-cases/*/workspace');
      caseId = /\/test-cases\/([^/]+)\/workspace/.exec(technician.url())[1];
      await expect(technician.getByRole('button', { name: 'Start Testing', exact: true })).toBeVisible();
      await clickMutation(technician, 'Start Testing', `/test-cases/${caseId}/status`, 'PUT');
      await fillObservation(technician);
      await clickMutation(technician, 'Record Observation', '/observations');
      await clickMutation(technician, 'Submit for Review', `/test-cases/${caseId}/workflow/submit`);
      await login(admin, 'administrator');
      await openWorkspace(admin);
      await clickMutation(admin, 'Start Review', `/test-cases/${caseId}/workflow/start-review`);
      await expect(admin.getByRole('button', { name: 'Approve Record', exact: true })).toBeDisabled();
      expect((await browserFetch(admin, `/test-cases/${caseId}/workflow/approve`, 'POST', { expectedRevision: record().revision })).status).toBe(409);
      await savedState(admin, 'UNDER_REVIEW');
      await screenshot(admin, 'administrator-final-approval-blocked');
    } finally { caseId = mainCaseId; }
  });
  await scenario('Logout clears session and protected navigation returns to login', async () => {
    activePage = technician;
    await technician.getByRole('button', { name: /Sign out/i }).first().click();
    await technician.waitForURL('**/login');
    expect(await technician.evaluate(() => localStorage.getItem('nawi_token'))).toBeNull();
    await technician.goto(`${frontend}/tests`);
    await technician.waitForURL('**/login');
  });
  await scenario('Business registers, signs in, submits and reloads its owned application through the actual form', async () => {
    activePage = business;
    await business.goto(`${frontend}/register`);
    await business.getByLabel('Name', { exact: true }).fill('Full Runner Business');
    await business.getByLabel('Email address', { exact: true }).fill(businessEmail);
    await business.getByLabel('Password', { exact: true }).fill(businessPassword);
    await business.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(business.getByRole('status')).toContainText('Your account has been created');
    await business.goto(`${frontend}/business/login`);
    await business.getByLabel('Email address', { exact: true }).fill(businessEmail);
    await business.getByLabel('Password', { exact: true }).fill(businessPassword);
    await business.getByRole('button', { name: 'Sign In', exact: true }).click();
    await business.waitForURL('**/applications');
    await expect(business.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
    await fillBusinessApplication(business);
    const before = count('POST', '/api/v1/verification/applications');
    await business.getByRole('button', { name: 'Submit application', exact: true }).evaluate(button => { button.click(); button.click(); });
    await business.waitForURL('**/applications/*');
    await expect(business.getByRole('heading', { name: 'Full runner scale', exact: true })).toBeVisible();
    expect(count('POST', '/api/v1/verification/applications') - before).toBe(1);
    const applicationId = business.url().split('/').pop();
    const saved = collection('applications').find(item => item.id === applicationId);
    expect(saved).toMatchObject({ ownerId: expect.any(String), status: 'SUBMITTED', instrument: { serialNumber: 'FULL-APP-SERIAL-1' } });
    expect(saved.history).toHaveLength(1);
    await business.reload();
    await expect(business.getByText('30000 g', { exact: true })).toBeVisible();
    await screenshot(business, 'business-application-submitted');
    activePage = admin;
    await admin.goto(`${frontend}/applications`);
    await expect(admin.locator('main [role=alert]')).toContainText('Business applications require a Business account');
  });
  await scenario('Browser console contains no application runtime errors', async () => {
    expect(consoleEvents.filter(item => item.type === 'pageerror')).toEqual([]);
    return `${consoleEvents.length} warning/error entries retained in redacted console.json; HTTP errors from intentional negative probes are separately recorded.`;
  });
  await scenario('All browser application traffic stayed local and original project records were preserved', async () => {
    expect(blockedExternal).toEqual([]);
    const afterFiles = fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json'));
    const after = Object.fromEntries(afterFiles.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
    expect(after).toEqual(projectDataBefore);
    return `Original project data: ${originalFiles.length} JSON files unchanged. Isolated data: ${dataDir}`;
  });
  const summary = { browser: `Chromium ${browserVersion}`, playwright: require('@playwright/test/package.json').version, frontend, backend, caseId, output, dataDir, scenarios, blockedExternal };
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(output, 'network.json'), JSON.stringify(traffic, null, 2));
  fs.writeFileSync(path.join(output, 'console.json'), JSON.stringify(consoleEvents, null, 2));
  fs.writeFileSync(path.join(output, 'persisted-main-record.json'), JSON.stringify({ testCase: record(), observations: collection('observations').filter(item => item.testCaseId === caseId), history: collection('audit').filter(item => item.testCaseId === caseId), evidence: collection('evidence').filter(item => item.testCaseId === caseId) }, null, 2));
  console.log(`RESULTS ${output}`);
  console.log(`TOTAL ${JSON.stringify(scenarios.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {}))}`);
  await browser.close();
  process.exitCode = scenarios.some(item => item.status === 'FAIL') ? 1 : 0;
}

main().catch(async error => {
  console.error(scrub(error.stack || error.message));
  fs.writeFileSync(path.join(output, 'interrupted-results.json'), JSON.stringify({ scenarios, error: scrub(error.message), traffic, consoleEvents }, null, 2));
  if (browser) await browser.close();
  process.exitCode = 2;
});
