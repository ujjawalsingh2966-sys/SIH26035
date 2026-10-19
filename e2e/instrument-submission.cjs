// Actual Chromium + local backend regression checks. Successful responses are real.
// Negative probes change outgoing requests or drop a response after a real commit.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3010';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4001';
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const email = process.env.W8LAB_BROWSER_TECHNICIAN;
const password = process.env.W8LAB_BROWSER_PASSWORD;
if (!runRoot || !email || !password) throw new Error('Set W8LAB_BROWSER_RUN_DIR, W8LAB_BROWSER_TECHNICIAN and W8LAB_BROWSER_PASSWORD.');
for (const origin of [frontend, backend]) if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local origins only.');
const dataDir = path.resolve(runRoot, 'data');
if (!fs.existsSync(dataDir)) throw new Error('The isolated backend data directory must already exist.');
const output = path.resolve(runRoot, `submission-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const read = name => {
  const file = path.join(dataDir, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
};
const scrub = value => String(value).split(email).join('[REDACTED]').split(password).join('[REDACTED]')
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const originalDataHashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json'))
  .map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
const scenarios = [], network = [], browserErrors = [], injections = [];
let browser, context, page, currentScenario, activeName;
const epoch = Date.now();
const field = name => page.getByPlaceholder(name, { exact: true });
const submit = () => page.locator('form[aria-busy] button[type=submit]');
const form = () => page.locator('form[aria-busy]');
const count = endpoint => network.filter(item => item.type === 'request' && item.path === `/api/v1/${endpoint}`).length;
const baseline = () => ({ instruments: count('instruments'), cases: count('test-cases') });

async function screenshot(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, mask: [page.getByText(email, { exact: true }), page.locator('input[type=email],input[type=password]')], animations: 'disabled' });
}
async function scenario(name, operation) {
  currentScenario = name;
  try {
    const detail = await operation();
    scenarios.push({ name, status: 'PASS', detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    await screenshot(`failure-${scenarios.length + 1}`).catch(() => {});
    scenarios.push({ name, status: 'FAIL', error: scrub(error.message) });
    console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 400)}`);
  }
}
async function fill(suffix) {
  activeName = `Submission ${epoch} ${suffix}`;
  await page.goto(`${frontend}/instruments/new`);
  await page.getByRole('button', { name: 'CONTINUE TO METADATA', exact: true }).click();
  for (const [placeholder, value] of Object.entries({
    'Name (e.g. Sartorius 200)': activeName, Model: 'BROWSER-SUBMISSION', 'Serial Number': `SYNTHETIC-${epoch}-${suffix}`,
    'Max Capacity (String strictly)': '15000', 'Min Capacity': '100', 'Verification Scale Interval (e)': '5', 'Actual Scale Interval (d)': '5',
  })) await field(placeholder).fill(value);
  const makers = await page.evaluate(async url => (await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}` } })).json(), `${backend}/api/v1/manufacturers`);
  await page.getByLabel('Manufacturer', { exact: true }).selectOption(makers.data[0].id);
  return activeName;
}
function persisted(name = activeName) {
  const instruments = read('instruments').filter(item => item.name === name);
  const cases = read('testCases').filter(item => instruments.some(instrument => instrument.id === item.instrumentId));
  return { instrumentIds: instruments.map(item => item.id), testCaseIds: cases.map(item => item.id) };
}
function assertCounts(before, expected, name = activeName) {
  const saved = persisted(name);
  const actual = {
    instrumentRequests: count('instruments') - before.instruments, testCaseRequests: count('test-cases') - before.cases,
    instruments: saved.instrumentIds.length, testCases: saved.testCaseIds.length,
  };
  expect(actual).toEqual(expected);
  return { ...actual, ...saved };
}
async function workspace() {
  await page.waitForURL('**/test-cases/*/workspace');
  await expect(page.getByRole('heading', { name: 'Observation Workspace', exact: true })).toBeVisible();
}
async function repeatedSubmissions() {
  await submit().evaluate(button => { button.click(); button.click(); button.form.requestSubmit(); });
}
// Hold a real backend response unchanged after it has committed to isolated storage.
async function holdResponse(endpoint) {
  let release, arrived;
  const gate = new Promise(resolve => { release = resolve; });
  const seen = new Promise(resolve => { arrived = resolve; });
  const url = `${backend}/api/v1/${endpoint}`;
  const handler = async route => {
    const response = await route.fetch();
    arrived(response.status());
    await gate;
    await route.fulfill({ response });
  };
  await page.route(url, handler, { times: 1 });
  injections.push({ scenario: currentScenario, kind: 'delayed real response', endpoint });
  return { seen, release, cleanup: async () => { release(); await page.unroute(url, handler); } };
}

async function main() {
  const original = originalDataHashes();
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.origin === backend && ['/api/v1/instruments', '/api/v1/test-cases'].includes(url.pathname)) {
      network.push({ type: 'request', scenario: currentScenario, path: url.pathname, milliseconds: Date.now() - epoch, instrumentId: request.postDataJSON()?.instrumentId });
    }
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (response.request().method() === 'POST' && url.origin === backend && ['/api/v1/instruments', '/api/v1/test-cases'].includes(url.pathname)) network.push({ type: 'response', scenario: currentScenario, path: url.pathname, status: response.status(), milliseconds: Date.now() - epoch });
  });
  page.on('pageerror', error => browserErrors.push(scrub(error.message)));
  await page.goto(`${frontend}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const serverIds = await page.evaluate(async backend => {
    const response = await fetch(`${backend}/api/v1/instruments`, { headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}` } });
    if (!response.ok) throw new Error('Cannot verify isolated dataset.');
    return (await response.json()).data.map(item => item.id).sort();
  }, backend);
  expect(serverIds).toEqual(read('instruments').map(item => item.id).sort());

  await scenario('Immediate rapid clicks and direct form submissions create one instrument and case', async () => {
    await fill('rapid');
    const before = baseline();
    await repeatedSubmissions();
    await workspace();
    return assertCounts(before, { instrumentRequests: 1, testCaseRequests: 1, instruments: 1, testCases: 1 });
  });
  await scenario('Enter key combined with clicking cannot overlap while test case response is slow', async () => {
    await fill('keyboard');
    const before = baseline();
    const delay = await holdResponse('test-cases');
    try {
      await field('Actual Scale Interval (d)').press('Enter');
      expect(await delay.seen).toBe(201);
      await expect(form()).toHaveAttribute('aria-busy', 'true');
      await expect(submit()).toBeDisabled();
      await expect(field('Name (e.g. Sartorius 200)')).toBeDisabled();
      await repeatedSubmissions();
      const waiting = assertCounts(before, { instrumentRequests: 1, testCaseRequests: 1, instruments: 1, testCases: 1 });
      delay.release();
      await workspace();
      return { ...waiting, final: assertCounts(before, { instrumentRequests: 1, testCaseRequests: 1, instruments: 1, testCases: 1 }) };
    } finally { await delay.cleanup(); }
  });
  await scenario('Slow real instrument response keeps controls pending and creates no duplicates', async () => {
    await fill('slow-instrument');
    const before = baseline();
    const delay = await holdResponse('instruments');
    try {
      await submit().click();
      expect(await delay.seen).toBe(201);
      await expect(page.getByRole('status').filter({ hasText: 'Saving instrument' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'BACK', exact: true })).toBeDisabled();
      await repeatedSubmissions();
      assertCounts(before, { instrumentRequests: 1, testCaseRequests: 0, instruments: 1, testCases: 0 });
      await screenshot('slow-response-pending');
      delay.release();
      await workspace();
      return assertCounts(before, { instrumentRequests: 1, testCaseRequests: 1, instruments: 1, testCases: 1 });
    } finally { await delay.cleanup(); }
  });
  await scenario('Confirmed backend rejection preserves values and allows a successful retry', async () => {
    const name = await fill('rejected-instrument');
    const before = baseline();
    injections.push({ scenario: currentScenario, kind: 'outgoing name replaced with empty string; real backend validation returns 400' });
    await page.route(`${backend}/api/v1/instruments`, route => route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), name: '' }) }), { times: 1 });
    const response = page.waitForResponse(reply => reply.url() === `${backend}/api/v1/instruments`);
    await submit().click();
    expect((await response).status()).toBe(400);
    await expect(page.getByRole('alert').filter({ hasText: 'Instrument name is required' })).toBeVisible();
    await expect(field('Name (e.g. Sartorius 200)')).toHaveValue(name);
    await expect(field('Name (e.g. Sartorius 200)')).toBeEnabled();
    await expect(submit()).toBeEnabled();
    assertCounts(before, { instrumentRequests: 1, testCaseRequests: 0, instruments: 0, testCases: 0 });
    await screenshot('confirmed-rejection-values-preserved');
    await submit().click();
    await workspace();
    return assertCounts(before, { instrumentRequests: 2, testCaseRequests: 1, instruments: 1, testCases: 1 });
  });
  await scenario('Saved instrument is reused when confirmed downstream failure is retried', async () => {
    const name = await fill('rejected-test-case');
    const before = baseline();
    injections.push({ scenario: currentScenario, kind: 'outgoing test-case instrumentId replaced with missing synthetic ID; real backend returns 404' });
    await page.route(`${backend}/api/v1/test-cases`, route => route.continue({ postData: JSON.stringify({ instrumentId: 'missing-isolated-browser-instrument' }) }), { times: 1 });
    const response = page.waitForResponse(reply => reply.url() === `${backend}/api/v1/test-cases`);
    await submit().click();
    expect((await response).status()).toBe(404);
    await expect(page.getByRole('alert').filter({ hasText: 'Instrument not found' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'RETRY TEST CASE', exact: true })).toBeEnabled();
    await expect(field('Name (e.g. Sartorius 200)')).toHaveValue(name);
    await expect(field('Name (e.g. Sartorius 200)')).toBeDisabled();
    const partial = assertCounts(before, { instrumentRequests: 1, testCaseRequests: 1, instruments: 1, testCases: 0 });
    await screenshot('partial-save-retry-test-case');
    await page.getByRole('button', { name: 'RETRY TEST CASE', exact: true }).click();
    await workspace();
    const final = assertCounts(before, { instrumentRequests: 1, testCaseRequests: 2, instruments: 1, testCases: 1 });
    expect(final.instrumentIds).toEqual(partial.instrumentIds);
    expect(network.filter(item => item.type === 'request' && item.path === '/api/v1/test-cases' && item.scenario === currentScenario).map(item => item.instrumentId)).toEqual([partial.instrumentIds[0], partial.instrumentIds[0]]);
    return final;
  });
  await scenario('Another legitimate instrument can be created after completing the previous form', async () => {
    const outcomes = [];
    for (const suffix of ['legitimate-first', 'legitimate-second']) {
      await fill(suffix); // Shared serial intentionally tests that no uniqueness rule was added.
      const before = baseline();
      await submit().click();
      await workspace();
      outcomes.push(assertCounts(before, { instrumentRequests: 1, testCaseRequests: 1, instruments: 1, testCases: 1 }));
    }
    expect(outcomes[0].instrumentIds[0]).not.toBe(outcomes[1].instrumentIds[0]);
    return outcomes;
  });
  for (const endpoint of ['instruments', 'test-cases']) {
    await scenario(`Ambiguous ${endpoint} response after real save does not trigger an unsafe retry`, async () => {
      await fill(`lost-${endpoint}`);
      const before = baseline();
      injections.push({ scenario: currentScenario, kind: 'real backend 201 response dropped after commit', endpoint });
      await page.route(`${backend}/api/v1/${endpoint}`, async route => {
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        await route.abort('failed');
      }, { times: 1 });
      await submit().click();
      await expect(page.getByRole('alert').filter({ hasText: 'could not be confirmed' })).toBeVisible();
      await expect(form()).toHaveAttribute('aria-busy', 'false');
      await expect(submit()).toBeDisabled();
      await repeatedSubmissions();
      await expect(page.getByRole('link', { name: 'Check Instruments', exact: true })).toBeVisible();
      await screenshot(`unknown-${endpoint}-no-resend`);
      return assertCounts(before, { instrumentRequests: 1, testCaseRequests: endpoint === 'instruments' ? 0 : 1, instruments: 1, testCases: endpoint === 'instruments' ? 0 : 1 });
    });
  }
  await scenario('Existing classification validation remains intact and does not lock the form', async () => {
    await fill('scope-validation');
    await page.getByRole('button', { name: 'BACK', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Is it a Weighing Instrument?', exact: true }).uncheck();
    await page.getByRole('button', { name: 'CONTINUE TO METADATA', exact: true }).click();
    const before = baseline();
    await submit().click();
    await expect(page.getByRole('alert').filter({ hasText: 'OUT_OF_SCOPE' })).toBeVisible();
    await expect(submit()).toBeEnabled();
    await expect(field('Name (e.g. Sartorius 200)')).toBeEnabled();
    return assertCounts(before, { instrumentRequests: 0, testCaseRequests: 0, instruments: 0, testCases: 0 });
  });
  expect(browserErrors).toEqual([]);
  expect(originalDataHashes()).toEqual(original);
  const result = { browser: await browser.version(), frontend, backend, dataDir, scenarios, injections, browserErrors, originalDataPreserved: true };
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(output, 'network.json'), JSON.stringify(network, null, 2));
  console.log(`RESULTS ${output}`);
  console.log(`TOTAL ${JSON.stringify(scenarios.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {}))}`);
  await browser.close();
  process.exitCode = scenarios.some(item => item.status === 'FAIL') ? 1 : 0;
}
main().catch(async error => {
  console.error(scrub(error.stack || error.message));
  fs.writeFileSync(path.join(output, 'interrupted.json'), JSON.stringify({ error: scrub(error.message), scenarios, network }, null, 2));
  if (browser) await browser.close();
  process.exitCode = 2;
});
