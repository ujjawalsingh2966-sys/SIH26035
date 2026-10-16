// Actual local Chromium/account checks. --inspect captures the pre-fix defect.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3011';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4002';
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const accounts = { Technician: process.env.W8LAB_BROWSER_TECHNICIAN, Reviewer: process.env.W8LAB_BROWSER_REVIEWER, Administrator: process.env.W8LAB_BROWSER_ADMINISTRATOR };
const password = process.env.W8LAB_BROWSER_PASSWORD;
const inspectOnly = process.argv.includes('--inspect');
if (!runRoot || !password || Object.values(accounts).some(value => !value)) throw new Error('Supply the isolated run directory and documented accounts through W8LAB_BROWSER_* environment variables.');
for (const origin of [frontend, backend]) if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local origins only.');
const dataDir = path.resolve(process.env.W8LAB_BROWSER_DATA_DIR || path.join(runRoot, 'data'));
if (!fs.existsSync(dataDir)) throw new Error('Start the isolated backend first.');
const output = path.resolve(runRoot, `${inspectOnly ? 'before' : 'navigation'}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const scrub = value => [password, ...Object.values(accounts)].reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const read = name => fs.existsSync(path.join(dataDir, `${name}.json`)) ? JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8')) : [];
const hashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
const payload = { manufacturerId: 'mfr_placeholder', name: `Navigation ${Date.now()}`, model: 'NAVIGATION-PROBE', serialNumber: 'ISOLATED-NAVIGATION', isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: false };
const scenarios = [], network = [], snapshots = [], errors = [], contexts = [];
let browser, page;
const creationLinks = () => page.locator('a[href="/instruments/new"]').or(page.getByRole('link', { name: /New Instrument|Register Instrument|Start New Test/ }));
async function screenshot(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input[type=email],input[type=password]'), ...Object.values(accounts).map(email => page.getByText(email, { exact: true }))] });
}
async function openPage(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1100 : 844 } });
  contexts.push(context);
  await context.addInitScript(() => {
    window.__creationExposures = [];
    const inspect = () => {
      try {
        const token = localStorage.getItem('nawi_token');
        const role = token ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role : null;
        if (!['Reviewer', 'Administrator'].includes(role)) return;
        const actions = [...document.querySelectorAll('a')].filter(element => element.getAttribute('href') === '/instruments/new' || /^(New Instrument|Register Instrument|\+ Start New Test)$/.test(element.textContent.trim()));
        const forms = document.querySelectorAll('form[aria-busy]').length;
        if (actions.length || forms) window.__creationExposures.push({ role, path: location.pathname, actions: actions.length, forms });
      } catch {}
    };
    new MutationObserver(inspect).observe(document, { childList: true, subtree: true });
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  const next = await context.newPage();
  next.setDefaultTimeout(15000);
  next.setDefaultNavigationTimeout(90000);
  next.on('pageerror', error => errors.push(scrub(error.message)));
  next.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === backend) network.push({ type: 'request', path: url.pathname, method: request.method() });
  });
  next.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === backend) network.push({ type: 'response', path: url.pathname, method: response.request().method(), status: response.status() });
  });
  return next;
}
async function login(role) {
  await page.goto(`${frontend}/login`);
  await page.locator('input[type=email]').fill(accounts[role]);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.locator('main h1')).toHaveText('Dashboard');
}
async function api(endpoint, method = 'GET', body) {
  return page.evaluate(async ({ url, method, body }) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nawi_token')}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, result: await response.json() };
  }, { url: `${backend}/api/v1${endpoint}`, method, body });
}
async function observe(label) {
  snapshots.push({ label, url: new URL(page.url()).pathname,
    actions: await creationLinks().evaluateAll(elements => elements.map(element => ({ text: element.textContent.trim(), href: element.getAttribute('href') }))),
    creationForms: await page.locator('form[aria-busy]').count() });
}
async function noCreation() {
  await expect(creationLinks()).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);
  await expect(page.locator('form[aria-busy]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__creationExposures || []), 'No temporary creation action/form during authentication or rendering').toEqual([]);
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
async function main() {
  const original = hashes();
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  page = await openPage();
  await login('Reviewer');
  expect((await api('/instruments')).result.data.map(row => row.id).sort()).toEqual(read('instruments').map(row => row.id).sort());
  const beforeIds = read('instruments').map(row => row.id);
  if (inspectOnly) {
    for (const width of [1440, 390]) await scenario(`${width}px reviewer dashboard, registry and direct creation route`, async () => {
      await page.setViewportSize({ width, height: width === 1440 ? 1100 : 844 });
      for (const route of ['/dashboard', '/instruments', '/instruments/new']) {
        await page.goto(`${frontend}${route}`);
        await expect(page.locator('main h1')).toBeVisible();
        await observe(`${width} ${route}`);
        await screenshot(`reviewer-${width}-${route.split('/').filter(Boolean).join('-')}`);
      }
    });
    await scenario('Real reviewer creation request is rejected without persisting an instrument', async () => {
      const result = await api('/instruments', 'POST', payload);
      expect(result.status).toBe(403);
      expect(read('instruments').map(row => row.id)).toEqual(beforeIds);
      snapshots.push({ label: 'reviewer API denial', status: result.status, body: result.result });
    });
  } else {
    for (const width of [1440, 390]) await scenario(`${width}px reviewer creation entry points absent; registry/queue still accessible`, async () => {
      await page.setViewportSize({ width, height: width === 1440 ? 1100 : 844 });
      for (const [route, title] of [['/dashboard', 'Dashboard'], ['/instruments', 'Instrument Registry'], ['/tests', 'Evaluation Queue']]) {
        await page.goto(`${frontend}${route}`);
        await expect(page.locator('main h1')).toHaveText(title);
        await noCreation();
        await observe(`${width} reviewer ${route}`);
        await screenshot(`reviewer-${width}-${route.slice(1)}`);
      }
      await page.goto(`${frontend}/instruments/new`);
      await expect(page.getByRole('heading', { name: 'Instrument creation unavailable' })).toBeVisible();
      await noCreation();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Instrument creation unavailable' })).toBeVisible();
      await noCreation();
      await screenshot(`reviewer-${width}-direct-denied`);
    });
    await scenario('Reviewer and Administrator creation API calls return real 403 with no persisted write', async () => {
      for (const role of ['Reviewer', 'Administrator']) {
        if (role !== 'Reviewer') await login(role);
        const denied = await api('/instruments', 'POST', payload);
        expect(denied.status).toBe(403);
        expect(read('instruments').map(row => row.id)).toEqual(beforeIds);
        snapshots.push({ label: `${role} API denial`, status: denied.status });
        await page.goto(`${frontend}/instruments/new`);
        await expect(page.getByRole('heading', { name: 'Instrument creation unavailable' })).toBeVisible();
        await noCreation();
      }
    });
    await scenario('Authentication startup contains no creation form, including delayed hydration', async () => {
      const restricted = page;
      page = await openPage();
      await login('Reviewer');
      const html = await page.request.get(`${frontend}/instruments/new`);
      expect(await html.text()).not.toContain('<form');
      // Inspect before hydration: hold real JS requests, do not replace app responses.
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/_next/static/**/*.js', async route => { await gate; await route.continue(); });
      try {
        await page.goto(`${frontend}/instruments/new`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('status').filter({ hasText: 'Loading session' })).toBeVisible();
        await noCreation();
        await screenshot('reviewer-before-hydration');
      } finally { release(); }
      await expect(page.getByRole('heading', { name: 'Instrument creation unavailable' })).toBeVisible();
      await page.unroute('**/_next/static/**/*.js');
      page = restricted;
    });
    await scenario('Technician creates one instrument and case; same-tab logout/login removes stale actions', async () => {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await login('Technician');
      await page.getByRole('link', { name: 'New Instrument', exact: true }).click();
      await page.getByRole('button', { name: 'CONTINUE TO METADATA' }).click();
      for (const [label, value] of Object.entries({ Name: payload.name, Model: payload.model, 'Serial Number': payload.serialNumber, 'Max Capacity': '15000', 'Min Capacity': '100', 'Verification Scale Interval (e)': '5', 'Actual Scale Interval (d)': '5' })) await page.getByLabel(label, { exact: true }).fill(value);
      await page.getByRole('button', { name: 'SUBMIT & INITIATE TEST' }).evaluate(button => { button.click(); button.click(); button.form.requestSubmit(); });
      await page.waitForURL('**/test-cases/*/workspace');
      const instruments = read('instruments').filter(row => row.name === payload.name);
      expect(instruments).toHaveLength(1);
      expect(read('testCases').filter(row => row.instrumentId === instruments[0].id)).toHaveLength(1);
      await page.goto(`${frontend}/dashboard`);
      await expect(page.getByRole('link', { name: 'New Instrument', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Sign Out', exact: true }).first().click();
      await page.waitForURL('**/login');
      await login('Reviewer');
      await noCreation();
      await page.reload();
      await expect(page.locator('main h1')).toHaveText('Dashboard');
      await noCreation();
      await screenshot('reviewer-after-technician-logout');
      await page.goto(`${frontend}/instruments`);
      await expect(page.getByText(payload.name, { exact: true })).toBeVisible();
      await noCreation();
      const rows = (await api('/instruments')).result.data;
      expect(rows.find(row => row.id === instruments[0].id).model).toBe(payload.model);
    });
    await scenario('Cross-tab account changes close an existing technician form and hide creation actions', async () => {
      await login('Technician');
      await page.goto(`${frontend}/instruments/new`);
      await expect(page.locator('form[aria-busy]')).toBeVisible();
      const technicianTab = page;
      page = await technicianTab.context().newPage();
      await login('Reviewer'); // Same localStorage origin; real login updates the other tab.
      page = technicianTab;
      await expect(page.getByRole('heading', { name: 'Instrument creation unavailable' })).toBeVisible();
      await noCreation();
      await screenshot('cross-tab-session-change-denied');
      await page.goto(`${frontend}/dashboard`);
      await expect(page.locator('main h1')).toHaveText('Dashboard');
      await noCreation();
    });
  }
  expect(hashes()).toEqual(original);
  expect(errors).toEqual([]);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ browser: browser.version(), frontend, backend, dataDir, inspectOnly, scenarios, snapshots, errors, originalDataPreserved: true }, null, 2));
  fs.writeFileSync(path.join(output, 'network.json'), JSON.stringify(network, null, 2));
  console.log(`RESULTS ${output}`);
  console.log(`TOTAL ${JSON.stringify(scenarios.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {}))}`);
  await browser.close();
  process.exitCode = scenarios.some(item => item.status === 'FAIL') ? 1 : 0;
}
main().catch(async error => {
  console.error(scrub(error.stack || error.message));
  fs.writeFileSync(path.join(output, 'interrupted.json'), JSON.stringify({ error: scrub(error.message), scenarios }, null, 2));
  if (browser) await browser.close();
  process.exitCode = 2;
});
