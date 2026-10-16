// Local real-browser color verification. --inspect captures pre-fix evidence only.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { textContrast } = require('./contrast.cjs');
const root = path.resolve(__dirname, '..');
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3010';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4001';
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const email = process.env.W8LAB_BROWSER_TECHNICIAN;
const password = process.env.W8LAB_BROWSER_PASSWORD;
const inspectOnly = process.argv.includes('--inspect');
if (!runRoot || !email || !password) throw new Error('Supply the isolated run directory and account through W8LAB_BROWSER_* environment variables.');
for (const origin of [frontend, backend]) if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local origins only.');
const dataDir = path.resolve(process.env.W8LAB_BROWSER_DATA_DIR || path.join(runRoot, 'data'));
if (!fs.existsSync(dataDir)) throw new Error('Start the isolated backend first.');
const output = path.resolve(runRoot, `${inspectOnly ? 'before' : 'contrast'}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const scrub = value => String(value).split(email).join('[REDACTED]').split(password).join('[REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const read = name => fs.existsSync(path.join(dataDir, `${name}.json`)) ? JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8')) : [];
const hashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
const measurements = [], network = [], consoleEvents = [], scenarios = [];
let browser, page;
const form = () => page.locator('form[aria-busy]');
const field = name => page.getByPlaceholder(name, { exact: true });
async function screenshot(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.getByText(email, { exact: true }), page.locator('input[type=email],input[type=password]')] });
}
async function measure(label, locator, minimum = 4.5, placeholder = false) {
  const detail = await textContrast(locator, placeholder);
  measurements.push({ label, minimum, ...detail });
  if (!inspectOnly) {
    expect(detail.approximate, `${label}: text should have a known solid surface`).toBe(false);
    expect(detail.opacity, `${label}: ancestor opacity`).toBe(1);
    expect(detail.contrast, `${label}: ${detail.foreground} on ${detail.background}`).toBeGreaterThanOrEqual(minimum);
  }
}
async function checkText(prefix) {
  for (const selector of ['h1', 'h2', 'label span', '[role=alert]', '[role=status]', 'button', 'a']) {
    for (const item of await form().locator(selector).all()) if (await item.isVisible()) await measure(`${prefix} ${selector} ${(await item.textContent()).trim().slice(0, 50)}`, item, selector === 'h1' || selector === 'h2' ? 3 : 4.5);
  }
  for (const item of await form().locator('input:not([type=checkbox]),select').all()) {
    await measure(`${prefix} field`, item);
    if (await item.getAttribute('placeholder')) await measure(`${prefix} placeholder`, item, 4.5, true);
  }
  for (const item of await form().locator('option').all()) await measure(`${prefix} option`, item);
}
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
async function theme(colorScheme) {
  await page.emulateMedia({ colorScheme });
  await page.waitForTimeout(300); // Existing control color transitions must settle.
}
async function populate(name) {
  for (const [placeholder, value] of Object.entries({
    'Name (e.g. Sartorius 200)': name, Model: 'CONTRAST-PROBE', 'Serial Number': 'ISOLATED-CONTRAST',
    'Max Capacity (String strictly)': '15000', 'Min Capacity': '100', 'Verification Scale Interval (e)': '5', 'Actual Scale Interval (d)': '5',
  })) await field(placeholder).fill(value);
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
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === backend) network.push({ type: 'request', method: request.method(), path: url.pathname });
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === backend) network.push({ type: 'response', method: response.request().method(), path: url.pathname, status: response.status() });
  });
  page.on('pageerror', error => consoleEvents.push({ type: 'pageerror', text: scrub(error.message) }));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleEvents.push({ type: message.type(), text: scrub(message.text()) }); });
  await page.goto(`${frontend}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const servedIds = await page.evaluate(async backend => {
    const response = await fetch(`${backend}/api/v1/instruments`, { headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}` } });
    if (!response.ok) throw new Error('Cannot verify isolated data.');
    return (await response.json()).data.map(row => row.id).sort();
  }, backend);
  expect(servedIds).toEqual(read('instruments').map(row => row.id).sort());
  const instrumentName = `Contrast ${Date.now()}`;
  for (const scheme of ['light', 'dark']) {
    await scenario(`${scheme}: both steps, empty/populated fields, checkbox and focus states`, async () => {
      await page.goto(`${frontend}/instruments/new`);
      await theme(scheme);
      await checkText(`${scheme} step1 checked`);
      const checkbox = form().getByRole('checkbox').first();
      await checkbox.uncheck();
      await checkbox.press('Tab');
      await page.keyboard.press('Shift+Tab'); // Exercise the real :focus-visible keyboard state.
      await checkText(`${scheme} step1 unchecked focused`);
      if (!inspectOnly) {
        await expect(checkbox).not.toBeChecked();
        expect(await checkbox.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none');
      }
      await screenshot(`${scheme}-step1-unchecked-focus`);
      await checkbox.check();
      await page.getByRole('button', { name: 'CONTINUE TO METADATA' }).click();
      await checkText(`${scheme} step2 empty`);
      await screenshot(`${scheme}-step2-empty`);
      await populate(instrumentName);
      await form().getByRole('checkbox').check();
      await checkText(`${scheme} step2 populated checked`);
      await screenshot(`${scheme}-step2-populated`);
      await field('Name (e.g. Sartorius 200)').focus();
      if (!inspectOnly) expect(await field('Name (e.g. Sartorius 200)').evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none');
      await checkText(`${scheme} field focused`);
      await screenshot(`${scheme}-step2-input-focus`);
    });
  }
  const themeMechanism = await page.evaluate(() => ({
    darkMedia: matchMedia('(prefers-color-scheme: dark)').matches,
    rootTheme: document.documentElement.getAttribute('data-theme'), rootClasses: document.documentElement.className,
    tokens: Object.fromEntries(['--color-text','--color-bg','--color-surface'].map(name => [name, getComputedStyle(document.documentElement).getPropertyValue(name)])),
    mesh: { background: getComputedStyle(document.querySelector('.mesh-background')).backgroundColor, image: getComputedStyle(document.querySelector('.mesh-background')).backgroundImage },
  }));
  if (!inspectOnly) {
    await scenario('Live OS theme changes update both surface and text without clearing values', async () => {
      for (const scheme of ['light', 'dark', 'light']) {
        await theme(scheme);
        await expect(field('Name (e.g. Sartorius 200)')).toHaveValue(instrumentName);
        await checkText(`${scheme} live theme change`);
      }
    });
    await scenario('Real validation error, loading/disabled states and rapid retry remain readable in both themes', async () => {
      // Explicit negative injection: backend returns its real 400, no fabricated response.
      await page.route(`${backend}/api/v1/instruments`, route => route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), name: '' }) }), { times: 1 });
      const rejected = page.waitForResponse(response => response.url() === `${backend}/api/v1/instruments` && response.request().method() === 'POST');
      rejected.catch(() => {}); // Keep a failed UI action from leaving an unobserved waiter.
      await form().locator('button[type=submit]').click();
      expect((await rejected).status()).toBe(400);
      await expect(form().getByRole('alert')).toBeVisible();
      for (const scheme of ['light', 'dark']) {
        await theme(scheme);
        await checkText(`${scheme} real validation error`);
        await screenshot(`${scheme}-validation-error`);
      }
      let release, arrived, finished;
      const gate = new Promise(resolve => { release = resolve; });
      const seen = new Promise(resolve => { arrived = resolve; });
      const done = new Promise(resolve => { finished = resolve; });
      let routeError;
      const handler = async route => {
        try {
          const response = await route.fetch(); // Real backend commits before delivery is delayed.
          arrived(response.status());
          await gate;
          await route.fulfill({ response });
        } catch (error) { routeError = error; }
        finally { finished(); }
      };
      await page.route(`${backend}/api/v1/instruments`, handler, { times: 1 });
      try {
        await form().locator('button[type=submit]').evaluate(button => { button.click(); button.click(); button.form.requestSubmit(); });
        expect(await Promise.race([seen, new Promise((_, reject) => setTimeout(() => reject(new Error('Real backend response timed out')), 15000))])).toBe(201);
        for (const scheme of ['light', 'dark']) {
          await theme(scheme);
          await expect(form()).toHaveAttribute('aria-busy', 'true');
          await expect(field('Name (e.g. Sartorius 200)')).toBeDisabled();
          await checkText(`${scheme} pending disabled`);
          await screenshot(`${scheme}-pending-disabled`);
        }
      } finally {
        release();
        await done; // Do not remove a route while it still owns the held response.
        await page.unroute(`${backend}/api/v1/instruments`, handler);
      }
      if (routeError) throw routeError;
      await page.waitForURL('**/test-cases/*/workspace');
      const instrumentIds = read('instruments').filter(row => row.name === instrumentName).map(row => row.id);
      const testCaseIds = read('testCases').filter(row => instrumentIds.includes(row.instrumentId)).map(row => row.id);
      const actual = {
        instrumentRequests: network.filter(row => row.type === 'request' && row.method === 'POST' && row.path === '/api/v1/instruments').length,
        testCaseRequests: network.filter(row => row.type === 'request' && row.method === 'POST' && row.path === '/api/v1/test-cases').length,
        instrumentIds, testCaseIds,
      };
      expect(actual.instrumentRequests).toBe(2); // One real rejection, one successful retry.
      expect(actual.testCaseRequests).toBe(1);
      expect(instrumentIds).toHaveLength(1);
      expect(testCaseIds).toHaveLength(1);
      fs.writeFileSync(path.join(output, 'persisted-counts.json'), JSON.stringify(actual, null, 2));
    });
  }
  expect(hashes()).toEqual(original);
  expect(consoleEvents.filter(event => event.type === 'pageerror')).toEqual([]);
  const result = { browser: browser.version(), frontend, backend, dataDir, inspectOnly, themeMechanism, scenarios, measurements, originalDataPreserved: true };
  for (const [name, value] of Object.entries({ results: result, network, console: consoleEvents })) fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(value, null, 2));
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
