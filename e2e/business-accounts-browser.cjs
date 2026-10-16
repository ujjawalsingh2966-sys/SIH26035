// Real local Business account flows; failed delivery is injected explicitly below.
// Credentials are generated in memory, never logged or saved in browser artifacts.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { textContrast } = require('./contrast.cjs');
const root = path.resolve(__dirname, '..');
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3012';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4003';
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
if (!runRoot) throw new Error('Supply W8LAB_BROWSER_RUN_DIR and start its isolated backend first.');
for (const origin of [frontend, backend]) if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local origins only');
const dataDir = path.join(runRoot, 'data');
if (!fs.existsSync(dataDir)) throw new Error('Isolated DATA_DIR missing');
const output = path.join(runRoot, `accounts-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const password = crypto.randomBytes(24).toString('base64url');
const email = `business-${crypto.randomUUID()}@example.test`;
const otherEmail = `other-business-${crypto.randomUUID()}@example.test`;
const secrets = [password, email, otherEmail];
const scrub = value => secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const readAccounts = () => fs.existsSync(path.join(dataDir, 'accounts.json')) ? JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')) : [];
const projectHashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
const scenarios = [], network = [], consoleEvents = [], colors = [];
let browser, page, scenarioName;
async function scenario(name, operation) {
  scenarioName = name;
  try { await operation(); scenarios.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { scenarios.push({ name, status: 'FAIL', error: scrub(error.message) }); await screenshot(`failure-${scenarios.length}`).catch(() => {}); console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 300)}`); }
}
async function screenshot(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input'), ...secrets.map(secret => page.getByText(secret, { exact: true }))] });
}
async function fillRegistration(accountEmail = email) {
  await page.getByLabel('Name', { exact: true }).fill('Synthetic Business');
  await page.getByLabel('Email address', { exact: true }).fill(accountEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
}
async function signIn(accountEmail = email) {
  await page.goto(`${frontend}/business/login`);
  await page.getByLabel('Email address', { exact: true }).fill(accountEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/account');
  await expect(page.locator('main').getByRole('heading', { name: 'Business account', exact: true })).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: accountEmail })).toBeVisible();
}
async function api(endpoint, method = 'GET', payload) {
  return page.evaluate(async ({ url, method, payload }) => {
    const token = localStorage.getItem('nawi_token');
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  }, { url: `${backend}/api/v1${endpoint}`, method, payload });
}
async function main() {
  const hashes = projectHashes();
  const initial = readAccounts().length;
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const version = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === backend || response.status() >= 400) network.push({ scenario: scenarioName, method: response.request().method(), path: url.pathname, status: response.status() });
  });
  page.on('pageerror', error => consoleEvents.push({ type: 'pageerror', message: scrub(error.message) }));
  page.on('console', message => { if (message.type() === 'error') consoleEvents.push({ scenario: scenarioName, type: 'console-error', message: scrub(message.text()) }); });
  try {
    await scenario('Existing login links expose Business registration with persistent associated labels', async () => {
      await page.goto(`${frontend}/login`);
      await page.getByRole('link', { name: 'Create a Business account', exact: true }).click();
      await page.waitForURL('**/register');
      for (const label of ['Name', 'Email address', 'Password']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
      const heading = await textContrast(page.locator('h1'));
      colors.push({ page: 'Registration', theme: 'light', ...heading });
      expect(heading.contrast).toBeGreaterThanOrEqual(4.5);
      await screenshot('registration-light');
    });
    await scenario('Invalid registration returns real safe validation feedback and preserves entered values', async () => {
      await fillRegistration();
      await page.getByLabel('Name', { exact: true }).fill(' ');
      await page.locator('form').evaluate(form => { form.noValidate = true; });
      const response = page.waitForResponse(r => r.url() === `${backend}/api/v1/auth/register` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      const result = await response;
      expect(result.status()).toBe(400);
      expect(await result.text()).not.toContain(password);
      await expect(page.locator('form [role=alert]')).toContainText('Name must contain');
      await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email);
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue(password);
      expect(readAccounts().length).toBe(initial);
    });
    await scenario('Confirmed failed delivery restores retry and preserves registration values', async () => {
      await fillRegistration();
      await page.route(`${backend}/api/v1/auth/register`, route => route.abort('failed'), { times: 1 });
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await expect(page.locator('form [role=alert]')).toContainText('Unable to reach');
      await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Synthetic Business');
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue(password);
      expect(readAccounts().length).toBe(initial);
    });
    await scenario('Slow real registration plus rapid clicks and keyboard submission saves exactly one account', async () => {
      let requests = 0;
      const observer = request => { if (request.url() === `${backend}/api/v1/auth/register` && request.method() === 'POST') requests++; };
      page.on('request', observer);
      let release;
      const pendingCheck = new Promise(resolve => { release = resolve; });
      await page.route(`${backend}/api/v1/auth/register`, async route => { await pendingCheck; await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); }, { times: 1 });
      const response = page.waitForResponse(r => r.url() === `${backend}/api/v1/auth/register` && r.request().method() === 'POST');
      // Keep an early UI assertion failure from producing an unhandled waiter.
      // Awaiting the original promise below still reports response failures.
      void response.catch(() => {});
      await page.locator('form').evaluate(form => { const button = form.querySelector('button[type=submit]'); button.click(); form.requestSubmit(); button.click(); });
      try {
        await expect(page.locator('fieldset')).toHaveAttribute('disabled', '');
        await expect(page.getByLabel('Email address', { exact: true })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Creating account…', exact: true })).toBeDisabled();
      } finally { release(); }
      expect((await response).status()).toBe(201);
      await expect(page.getByRole('status')).toContainText('Your account has been created');
      page.off('request', observer);
      expect(requests).toBe(1);
      const saved = readAccounts();
      expect(saved.length).toBe(initial + 1);
      expect(saved.filter(account => account.email === email)).toHaveLength(1);
      expect(saved.find(account => account.email === email).passwordHash).not.toContain(password);
      await screenshot('registration-success');
    });
    await scenario('Business signs in with real backend and session survives reload', async () => {
      await signIn();
      const me = await api('/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.data.role).toBe('Business');
      expect(me.body.data).not.toHaveProperty('passwordHash');
      await page.reload();
      await expect(page.locator('dd').filter({ hasText: email })).toBeVisible();
      const heading = await textContrast(page.locator('main h1'));
      colors.push({ page: 'Account', theme: 'light', ...heading });
      expect(heading.contrast).toBeGreaterThanOrEqual(4.5);
      await screenshot('account-light');
    });
    await scenario('Business has no laboratory navigation and direct staff pages show access denied on desktop/mobile', async () => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const name of ['Instruments', 'Evaluation Queue', 'Reports']) await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
        for (const route of ['/dashboard', '/instruments/new', '/tests', '/reports']) {
          await page.goto(`${frontend}${route}`);
          await expect(page.locator('main [role=alert]')).toHaveText('Access denied. This page is for laboratory staff.');
          await expect(page.locator('main input')).toHaveCount(0);
        }
      }
      await screenshot('mobile-staff-denial');
      await page.goto(`${frontend}/account`);
    });
    await scenario('Business token cannot read or mutate staff APIs including all report representations', async () => {
      for (const [endpoint, method] of [['/manufacturers', 'GET'], ['/instruments', 'GET'], ['/instruments', 'POST'], ['/test-cases', 'GET'], ['/test-cases', 'POST'], ['/observations', 'POST'], ['/evidence', 'POST'], ['/repository/search', 'GET'], ['/reports/synthetic/data', 'GET'], ['/reports/synthetic/html', 'GET'], ['/reports/synthetic/pdf', 'GET'], ['/test-cases/synthetic/workflow/approve', 'POST']]) {
        expect((await api(endpoint, method, method === 'POST' ? {} : undefined)).status).toBe(403);
      }
    });
    await scenario('Registration rejects privileged roles and documented staff-email collisions without saving', async () => {
      for (const role of ['Technician', 'Reviewer', 'Administrator', 'LMO', 'GATC']) {
        expect((await api('/auth/register', 'POST', { name: 'Synthetic Business', email: otherEmail, password, role })).status).toBe(403);
      }
      const guide = fs.readFileSync(path.join(root, 'docs/LABORATORY_REVIEW_WORKFLOW.md'), 'utf8');
      for (const match of guide.matchAll(/\| (?:Technician|Reviewer|Administrator|Different technician) \| `([^`]+)`/g)) {
        expect((await api('/auth/register', 'POST', { name: 'Synthetic Business', email: match[1], password })).status).toBe(409);
      }
      expect(readAccounts().length).toBe(initial + 1);
    });
    await scenario('Account and registration remain usable in dark theme at a narrow viewport', async () => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await expect(page.locator('dd').filter({ hasText: email })).toBeVisible();
      const accountHeading = await textContrast(page.locator('main h1'));
      colors.push({ page: 'Account', theme: 'dark', ...accountHeading });
      expect(accountHeading.contrast).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await screenshot('account-dark-mobile');
      await page.goto(`${frontend}/register`);
      await fillRegistration(otherEmail);
      const heading = await textContrast(page.locator('h1'));
      colors.push({ page: 'Registration', theme: 'dark', ...heading });
      expect(heading.contrast).toBeGreaterThanOrEqual(4.5);
      await screenshot('registration-dark-mobile-populated');
    });
    await scenario('Duplicate registration has real 409 feedback and preserves values', async () => {
      await fillRegistration(email.toUpperCase());
      const response = page.waitForResponse(r => r.url() === `${backend}/api/v1/auth/register` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      expect((await response).status()).toBe(409);
      await expect(page.locator('form [role=alert]')).toContainText('An account with this email already exists');
      await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email.toUpperCase());
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue(password);
      expect(readAccounts().length).toBe(initial + 1);
      await screenshot('duplicate-feedback');
    });
    await scenario('Logout removes the current session and protected reload returns to login', async () => {
      await page.goto(`${frontend}/account`);
      await page.getByRole('button', { name: 'Sign Out', exact: true }).last().click();
      await page.waitForURL('**/login');
      expect(await page.evaluate(() => localStorage.getItem('nawi_token'))).toBeNull();
      await page.goto(`${frontend}/account`);
      await page.waitForURL('**/login');
    });
    await scenario('Wrong password shows real 401 and cannot create a session', async () => {
      await page.goto(`${frontend}/business/login`);
      await page.getByLabel('Email address', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill('wrong-synthetic-password');
      const response = page.waitForResponse(r => r.url() === `${backend}/api/v1/auth/login` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      expect((await response).status()).toBe(401);
      await expect(page.locator('form [role=alert]')).toContainText('Invalid email or password');
      expect(await page.evaluate(() => localStorage.getItem('nawi_token'))).toBeNull();
    });
    await scenario('A second Business account can register/login without displaying the first identity', async () => {
      await page.goto(`${frontend}/register`);
      await fillRegistration(otherEmail);
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Your account has been created');
      await signIn(otherEmail);
      await expect(page.getByText(email, { exact: true })).toHaveCount(0);
      expect(readAccounts().length).toBe(initial + 2);
      await screenshot('second-account-no-stale-identity');
    });
    await scenario('Excluded application routes remain unimplemented (HTTP 404)', async () => {
      expect((await page.goto(`${frontend}/applications`)).status()).toBe(404);
      expect((await api('/verification/applications')).status).toBe(404);
    });
    await scenario('No project records changed and browser has no JavaScript exceptions', async () => {
      expect(projectHashes()).toEqual(hashes);
      expect(consoleEvents.filter(event => event.type === 'pageerror')).toEqual([]);
    });
    scenarios.push({ name: 'Business application form workflow', status: 'BLOCKED', detail: 'Applications are intentionally outside this account-only implementation slice.' });
  } finally {
    await browser.close();
    const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(status => [status, scenarios.filter(row => row.status === status).length]));
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ browser: version, playwright: require('@playwright/test/package.json').version, frontend, backend, scenarios, counts, network, consoleEvents, colors, failureInjection: 'One registration request aborted before forwarding; one real registration request delayed 700ms. Successful responses always came from the real backend.' }, null, 2));
    console.log(JSON.stringify({ output: path.relative(root, output), counts }));
    if (counts.FAIL) process.exitCode = 1;
  }
}
main().catch(error => { console.error(scrub(error.message)); process.exitCode = 1; });
