// Real local Chromium checks; --inspect records the original label defect only.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { textContrast } = require('./contrast.cjs');
const root = path.resolve(__dirname, '..');
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3011';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4002';
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const email = process.env.W8LAB_BROWSER_TECHNICIAN;
const password = process.env.W8LAB_BROWSER_PASSWORD;
const inspectOnly = process.argv.includes('--inspect');
if (!runRoot || !email || !password) throw new Error('Supply W8LAB_BROWSER_RUN_DIR and the documented account through environment variables.');
for (const origin of [frontend, backend]) if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local origins only.');
const dataDir = path.resolve(process.env.W8LAB_BROWSER_DATA_DIR || path.join(runRoot, 'data'));
if (!fs.existsSync(dataDir)) throw new Error('Start the isolated backend first.');
const output = path.resolve(runRoot, `${inspectOnly ? 'before' : 'labels'}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const fields = [
  ['Name', 'Name (e.g. Sartorius 200)', 'instrument-name'],
  ['Model', 'Model', 'instrument-model'],
  ['Serial Number', 'Serial Number', 'instrument-serial-number'],
  ['Accuracy Class', null, 'instrument-accuracy-class'],
  ['Max Capacity', 'Max Capacity (String strictly)', 'instrument-max-capacity'],
  ['Min Capacity', 'Min Capacity', 'instrument-min-capacity'],
  ['Verification Scale Interval (e)', 'Verification Scale Interval (e)', 'instrument-e'],
  ['Actual Scale Interval (d)', 'Actual Scale Interval (d)', 'instrument-d'],
];
const read = name => fs.existsSync(path.join(dataDir, `${name}.json`)) ? JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8')) : [];
const hashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
const scrub = value => String(value).split(email).join('[REDACTED]').split(password).join('[REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const scenarios = [], snapshots = [], network = [], errors = [];
let browser, page;
const form = () => page.locator('form[aria-busy]');
const control = label => form().getByLabel(label, { exact: true });
async function screenshot(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.getByText(email, { exact: true }), page.locator('input[type=email],input[type=password]')] });
}
async function snapshot(state) {
  const controls = await form().locator('input,select').evaluateAll(elements => elements.map(element => ({
    id: element.id, type: element.type, placeholder: element.getAttribute('placeholder'), value: element.value,
    labels: [...(element.labels || [])].map(label => ({ text: label.textContent.trim(), htmlFor: label.htmlFor })),
    disabled: element.matches(':disabled'),
  })));
  snapshots.push({ state, controls });
}
async function labels(state, disabled = false) {
  await snapshot(state);
  for (const [name, , id] of fields) {
    const input = control(name);
    const label = form().locator(`label[for="${id}"]`);
    await expect(input).toHaveAttribute('id', id);
    await expect(input).toHaveAccessibleName(name);
    await expect(label).toBeVisible();
    await expect(label).toHaveText(name);
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    if (disabled) await expect(input).toBeDisabled();
    else await expect(input).toBeEnabled();
    const geometry = await label.evaluate(element => {
      const label = element.getBoundingClientRect(), input = element.control.getBoundingClientRect();
      return { labelBottom: label.bottom, controlTop: input.top, labelHeight: label.height, labelWidth: label.width, available: element.parentElement.clientWidth };
    });
    expect(geometry.labelHeight).toBeGreaterThan(0);
    expect(geometry.labelBottom).toBeLessThanOrEqual(geometry.controlTop + 1);
    expect(geometry.labelWidth).toBeLessThanOrEqual(geometry.available + 1);
    const colors = await textContrast(label);
    expect(colors.approximate).toBe(false);
    expect(colors.contrast).toBeGreaterThanOrEqual(4.5);
  }
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
}
async function populate(name) {
  for (const [placeholder, value] of Object.entries({
    'Name (e.g. Sartorius 200)': name, Model: 'LABEL-PROBE', 'Serial Number': 'ISOLATED-LABELS',
    'Max Capacity (String strictly)': '15000', 'Min Capacity': '100', 'Verification Scale Interval (e)': '5', 'Actual Scale Interval (d)': '5',
  })) await form().getByPlaceholder(placeholder, { exact: true }).fill(value);
}
async function scheme(theme) { await page.emulateMedia({ colorScheme: theme }); await page.waitForTimeout(250); }
async function scenario(name, operation) {
  try {
    await operation();
    scenarios.push({ name, status: inspectOnly ? 'INSPECTED' : 'PASS' });
    console.log(`${inspectOnly ? 'INSPECTED' : 'PASS'} ${name}`);
  } catch (error) {
    scenarios.push({ name, status: 'FAIL', error: scrub(error.message) });
    await screenshot(`failure-${scenarios.length}`).catch(() => {});
    console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 300)}`);
  }
}
async function main() {
  const original = hashes();
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(scrub(error.message)));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === backend) network.push({ type: 'request', path: url.pathname, method: request.method() });
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === backend) network.push({ type: 'response', path: url.pathname, method: response.request().method(), status: response.status() });
  });
  await page.goto(`${frontend}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const servedIds = await page.evaluate(async backend => {
    const response = await fetch(`${backend}/api/v1/instruments`, { headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}` } });
    if (!response.ok) throw new Error('Cannot verify isolated storage.');
    return (await response.json()).data.map(row => row.id).sort();
  }, backend);
  expect(servedIds).toEqual(read('instruments').map(row => row.id).sort());
  const instrumentName = `Label verification ${Date.now()}`;
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) await scenario(`${viewport.width}px ${theme}: both steps, visible associated labels, empty and populated`, async () => {
      await scheme(theme);
      await page.goto(`${frontend}/instruments/new`);
      await snapshot(`${viewport.width} ${theme} step1`);
      for (const checkbox of await form().getByRole('checkbox').all()) {
        if (!inspectOnly) {
          const label = checkbox.locator('..');
          await expect(label).toBeVisible();
          await expect(checkbox).toHaveAccessibleName((await label.textContent()).trim());
          await label.click();
          await expect(checkbox).not.toBeChecked();
          await label.click();
          await expect(checkbox).toBeChecked();
        }
      }
      await screenshot(`${viewport.width}-${theme}-step1`);
      await page.getByRole('button', { name: 'CONTINUE TO METADATA' }).click();
      if (inspectOnly) await snapshot(`${viewport.width} ${theme} empty`);
      else await labels(`${viewport.width} ${theme} empty`);
      await populate(instrumentName);
      if (inspectOnly) await snapshot(`${viewport.width} ${theme} populated`);
      else {
        for (const [name, , id] of fields) {
          await form().locator(`label[for="${id}"]`).click();
          await expect(control(name)).toBeFocused();
        }
        const tare = control('Equipped with Tare device?');
        await tare.locator('..').click();
        await expect(tare).toBeChecked();
        await tare.locator('..').click();
        await expect(tare).not.toBeChecked();
        await labels(`${viewport.width} ${theme} populated after focus`);
      }
      await page.locator('main').evaluate(element => { element.scrollTop = 0; });
      await screenshot(`${viewport.width}-${theme}-populated-top`);
      await page.locator('main').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await screenshot(`${viewport.width}-${theme}-populated-bottom`);
    });
  }
  if (!inspectOnly) {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await scenario('Keyboard order and native checkbox/select activation preserve field values and labels', async () => {
      await control('Name').focus();
      for (const [name] of fields) {
        await expect(control(name)).toBeFocused();
        if (name === 'Accuracy Class') {
          await page.keyboard.press('ArrowUp');
          await expect(control(name)).toHaveValue('II');
          await page.keyboard.press('ArrowDown');
          await expect(control(name)).toHaveValue('III');
        }
        await page.keyboard.press('Tab');
      }
      await expect(control('Equipped with Tare device?')).toBeFocused();
      await page.keyboard.press('Space');
      await expect(control('Equipped with Tare device?')).toBeChecked();
      await page.keyboard.press('Space');
      await labels('keyboard traversal');
    });
    await scenario('Labels persist through real 400 rejection, saved-instrument 404, disabled loading and successful retry', async () => {
      // Explicit failure injections modify requests; all responses come from the real backend.
      await page.route(`${backend}/api/v1/instruments`, route => route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), name: '' }) }), { times: 1 });
      await page.route(`${backend}/api/v1/test-cases`, route => route.continue({ postData: JSON.stringify({ instrumentId: 'missing-isolated-label-instrument' }) }), { times: 1 });
      await form().locator('button[type=submit]').click();
      await expect(form().getByRole('alert')).toContainText('name:');
      for (const theme of ['light', 'dark']) {
        await scheme(theme);
        await labels(`${theme} backend400 values preserved`);
        await expect(control('Name')).toHaveValue(instrumentName);
        await screenshot(`${theme}-validation-labels`);
      }
      await form().locator('button[type=submit]').click();
      await expect(form().getByRole('alert')).toContainText('Instrument not found');
      await expect(form().getByRole('button', { name: 'RETRY TEST CASE' })).toBeEnabled();
      await labels('saved instrument checkpoint', true);
      await screenshot('saved-instrument-disabled-labels');
      let release, arrived, finish;
      const gate = new Promise(resolve => { release = resolve; });
      const seen = new Promise(resolve => { arrived = resolve; });
      const done = new Promise(resolve => { finish = resolve; });
      let routeError;
      const handler = async route => {
        try {
          const response = await route.fetch();
          arrived(response.status());
          await gate;
          await route.fulfill({ response });
        } catch (error) { routeError = error; }
        finally { finish(); }
      };
      await page.route(`${backend}/api/v1/test-cases`, handler, { times: 1 });
      let timeout;
      try {
        await form().locator('button[type=submit]').evaluate(button => { button.click(); button.click(); button.form.requestSubmit(); });
        expect(await Promise.race([seen, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Backend did not respond')), 15000); })])).toBe(201);
        for (const theme of ['light', 'dark']) {
          await scheme(theme);
          await expect(form()).toHaveAttribute('aria-busy', 'true');
          await labels(`${theme} pending disabled`, true);
          await screenshot(`${theme}-pending-disabled-labels`);
        }
      } finally {
        clearTimeout(timeout);
        release();
        await done;
        await page.unroute(`${backend}/api/v1/test-cases`, handler);
      }
      if (routeError) throw routeError;
      await page.waitForURL('**/test-cases/*/workspace');
      const instrumentIds = read('instruments').filter(row => row.name === instrumentName).map(row => row.id);
      const testCaseIds = read('testCases').filter(row => instrumentIds.includes(row.instrumentId)).map(row => row.id);
      expect(instrumentIds).toHaveLength(1);
      expect(testCaseIds).toHaveLength(1);
      expect(network.filter(row => row.type === 'request' && row.path === '/api/v1/instruments' && row.method === 'POST')).toHaveLength(2);
      expect(network.filter(row => row.type === 'request' && row.path === '/api/v1/test-cases' && row.method === 'POST')).toHaveLength(2);
      fs.writeFileSync(path.join(output, 'persisted-counts.json'), JSON.stringify({ instrumentIds, testCaseIds, instrumentRequests: 2, testCaseRequests: 2, rejectedRequests: ['instruments:400', 'test-cases:404'] }, null, 2));
    });
  }
  expect(hashes()).toEqual(original);
  expect(errors).toEqual([]);
  const result = { browser: browser.version(), frontend, backend, dataDir, inspectOnly, scenarios, snapshots, errors, originalDataPreserved: true,
    autofill: 'Not verified: installed Chromium CDP supports address/card autofill, not these instrument metadata fields; no saved instrument profile. Typed values are not claimed as autofill.' };
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(output, 'network.json'), JSON.stringify(network, null, 2));
  console.log(`RESULTS ${output}`);
  console.log(`TOTAL ${JSON.stringify(scenarios.reduce((counts, scenario) => ({ ...counts, [scenario.status]: (counts[scenario.status] || 0) + 1 }), {}))}`);
  await browser.close();
  process.exitCode = scenarios.some(scenario => scenario.status === 'FAIL') ? 1 : 0;
}
main().catch(async error => {
  console.error(scrub(error.stack || error.message));
  fs.writeFileSync(path.join(output, 'interrupted.json'), JSON.stringify({ error: scrub(error.message), scenarios }, null, 2));
  if (browser) await browser.close();
  process.exitCode = 2;
});
