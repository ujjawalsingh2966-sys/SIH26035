// Real local Business account flows; failed delivery is injected explicitly below.
// Credentials are generated in memory, never logged or saved in browser artifacts.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { textContrast } = require('./contrast.cjs');
const root = path.resolve(__dirname, '..');
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3012';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4003';
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
if (!runRoot) throw new Error('Supply W8LAB_BROWSER_RUN_DIR and start its isolated backend first.');
for (const origin of [frontend, backend]) if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local origins only');
const dataDir = path.join(runRoot, 'data');
const manageBackend = process.env.W8LAB_BROWSER_MANAGE_BACKEND === '1';
if (!fs.existsSync(dataDir)) throw new Error('Isolated DATA_DIR missing');
const output = path.join(runRoot, `accounts-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const password = crypto.randomBytes(24).toString('base64url');
const email = `business-${crypto.randomUUID()}@example.test`;
const otherEmail = `other-business-${crypto.randomUUID()}@example.test`;
const secrets = [password, email, otherEmail];
const scrub = value => secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const readAccounts = () => fs.existsSync(path.join(dataDir, 'accounts.json')) ? JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')) : [];
const readApplications = () => fs.existsSync(path.join(dataDir, 'applications.json')) ? JSON.parse(fs.readFileSync(path.join(dataDir, 'applications.json'), 'utf8')) : [];
const projectHashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
const scenarios = [], network = [], consoleEvents = [], colors = [];
let browser, page, scenarioName, backendProcess;
const backendLogs = [];
async function startBackend() {
  // Manage only a child created by this runner; never stop an unrelated listener.
  let occupied = false;
  try { await fetch(`${backend}/api/v1/health`); occupied = true; } catch {}
  if (occupied) throw new Error('Managed backend port is occupied; stop its known owner before running.');
  backendProcess = spawn(process.execPath, ['dist/index.js'], {
    cwd: path.join(root, 'backend'), windowsHide: true,
    env: { ...process.env, PORT: new URL(backend).port, DATA_DIR: dataDir, CLIENT_URL: frontend },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [backendProcess.stdout, backendProcess.stderr]) stream.on('data', value => backendLogs.push(scrub(value.toString())));
  await expect.poll(async () => {
    try { return (await fetch(`${backend}/api/v1/health`)).status; } catch { return 0; }
  }, { timeout: 15000 }).toBe(200);
}
async function stopBackend() {
  if (!backendProcess || backendProcess.exitCode !== null) return;
  const child = backendProcess;
  await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
  backendProcess = undefined;
}
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
  await page.waitForURL('**/applications');
  await expect(page.locator('main').getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await page.goto(`${frontend}/account`);
  await expect(page.locator('main').getByRole('heading', { name: 'Business account', exact: true })).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: accountEmail })).toBeVisible();
}
async function fillApplication(serial = 'BUSINESS-E2E-001') {
  await page.getByLabel('Business name').fill('Synthetic Verification Business');
  await page.getByLabel('Installation address').fill('17 Isolated Test Avenue\nVerification District');
  await page.getByLabel('Instrument name').fill('Retail counter scale');
  await page.getByLabel('Model').fill('W8-B200');
  await page.getByLabel('Serial number').fill(serial);
  await page.getByLabel('Accuracy class').selectOption('III');
  await page.getByLabel('Maximum capacity, Max (g)').fill('15000');
  await page.getByLabel('Minimum capacity, Min (g)').fill('100');
  await page.getByLabel('Verification interval, e (g)').fill('5');
  await page.getByLabel('Scale interval, d (g)').fill('5');
  await page.getByLabel('Instrument has a tare device').check();
  await page.getByLabel('I confirm this instrument matches the supported profile.').check();
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
  if (manageBackend) await startBackend();
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
      const openNavigation = page.getByRole('button', { name: 'Open navigation', exact: true });
      if (await openNavigation.isVisible()) await openNavigation.click();
      await page.getByRole('button', { name: /Sign out/i }).last().click();
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
    let secondApplicationId;
    await scenario('Business application form validates locally, retains values and safely retries a failed delivery', async () => {
      await page.goto(`${frontend}/applications`);
      await expect(page.getByText('No applications yet', { exact: true })).toBeVisible();
      await fillApplication();
      await page.getByLabel('Maximum capacity, Max (g)').fill('50');
      await page.locator('#new-application').evaluate(form => { form.noValidate = true; });
      await page.getByRole('button', { name: 'Submit application', exact: true }).click();
      await expect(page.locator('#new-application [role=alert]')).toContainText('Min < Max');
      expect(readApplications()).toHaveLength(0);
      await page.getByLabel('Maximum capacity, Max (g)').fill('15000');
      await page.route(`${backend}/api/v1/verification/applications`, route => route.abort('failed'), { times: 1 });
      await page.getByRole('button', { name: 'Submit application', exact: true }).click();
      await expect(page.locator('#new-application [role=alert]')).toContainText('could not reach the service');
      await expect(page.getByLabel('Serial number')).toHaveValue('BUSINESS-E2E-001');
      await expect(page.getByRole('button', { name: 'Submit application', exact: true })).toBeEnabled();
      expect(readApplications()).toHaveLength(0);
    });
    await scenario('Rapid retry creates one submitted owner record and opens its real detail view', async () => {
      let successfulRequests = 0;
      const observer = request => { if (request.url() === `${backend}/api/v1/verification/applications` && request.method() === 'POST') successfulRequests++; };
      page.on('request', observer);
      await page.getByRole('button', { name: 'Submit application', exact: true }).evaluate(button => { button.click(); button.click(); });
      await page.waitForURL('**/applications/*');
      page.off('request', observer);
      secondApplicationId = page.url().split('/').pop();
      expect(successfulRequests).toBe(1);
      const saved = readApplications();
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ id: secondApplicationId, status: 'SUBMITTED', businessName: 'Synthetic Verification Business', instrument: { serialNumber: 'BUSINESS-E2E-001' } });
      expect(saved[0].history).toHaveLength(1);
      await expect(page.getByRole('heading', { name: 'Retail counter scale', exact: true })).toBeVisible();
      await expect(page.getByText('Submitted fields are read-only.', { exact: false })).toBeVisible();
      await page.reload();
      await expect(page.getByText('15000 g', { exact: true })).toBeVisible();
      await screenshot('submitted-application-detail');
    });
    await scenario('Privileged fields, forged ownership and post-submission changes are rejected', async () => {
      const saved = readApplications()[0];
      const payload = {
        submissionKey: crypto.randomUUID(), businessName: 'Forged Business', address: 'Forged Address', ownerId: 'forged-owner',
        instrument: { name: 'Forged scale', model: 'FORGED', serialNumber: 'FORGED', accuracyClass: 'III', maxCapacity: '1000', minCapacity: '10', e: '1', d: '1', hasTare: false, isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true },
      };
      expect((await api('/verification/applications', 'POST', payload)).status).toBe(400);
      expect((await api(`/verification/applications/${secondApplicationId}`, 'PUT', { businessName: 'Changed after submit' })).status).toBe(409);
      expect((await api(`/verification/applications/${secondApplicationId}/submit`, 'POST', {})).status).toBe(409);
      expect(readApplications()).toEqual([saved]);
    });
    await scenario('Application navigation and details remain readable in dark mobile layout', async () => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Retail counter scale', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const heading = await textContrast(page.locator('main h1'));
      colors.push({ page: 'Application detail', theme: 'dark', ...heading });
      expect(heading.contrast).toBeGreaterThanOrEqual(4.5);
      await screenshot('application-detail-dark-mobile');
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Applications', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close navigation', exact: true }).last().click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ colorScheme: 'light' });
    });
    await scenario('Cross-Business detail access is hidden while the owner list persists', async () => {
      await signIn(email);
      const probe = await api(`/verification/applications/${secondApplicationId}`);
      expect(probe.status).toBe(404);
      await page.goto(`${frontend}/applications/${secondApplicationId}`);
      await expect(page.locator('main [role=alert]')).toContainText('Application not found');
      const firstList = await api('/verification/applications');
      expect(firstList.status).toBe(200);
      expect(firstList.body.data.applications).toHaveLength(0);
      await signIn(otherEmail);
      await page.getByRole('link', { name: 'Applications', exact: true }).click();
      await expect(page.getByText('BUSINESS-E2E-001', { exact: false })).toBeVisible();
      expect((await api(`/verification/applications/${secondApplicationId}`)).status).toBe(200);
    });
    await scenario('Application labels, required fields and keyboard focus work without a mutation', async () => {
      await page.goto(`${frontend}/applications`);
      await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
      for (const control of await page.locator('#new-application input, #new-application textarea, #new-application select').all()) {
        expect(await control.evaluate(element => element.labels?.length)).toBe(1);
        await expect(control).toHaveAccessibleName(/\S/);
      }
      const before = readApplications();
      const name = page.getByLabel('Business name');
      await name.focus();
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Installation address')).toBeFocused();
      await page.getByRole('button', { name: 'Submit application', exact: true }).press('Enter');
      await expect(name).toBeFocused();
      expect(await name.evaluate(element => element.validity.valueMissing)).toBe(true);
      expect(readApplications()).toEqual(before);
    });
    await scenario('Real backend application validation preserves the entered form and permits retry', async () => {
      await fillApplication('BUSINESS-LOST-RESPONSE-002');
      const before = readApplications();
      await page.route(`${backend}/api/v1/verification/applications`, async route => {
        const payload = route.request().postDataJSON();
        payload.instrument.accuracyClass = 'I';
        await route.continue({ postData: JSON.stringify(payload) });
      }, { times: 1 });
      const response = page.waitForResponse(r => r.url() === `${backend}/api/v1/verification/applications` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Submit application', exact: true }).press('Enter');
      expect((await response).status()).toBe(400);
      await expect(page.locator('#new-application [role=alert]')).toContainText('instrument.accuracyClass');
      await expect(page.getByLabel('Serial number')).toHaveValue('BUSINESS-LOST-RESPONSE-002');
      await expect(page.getByRole('button', { name: 'Submit application', exact: true })).toBeEnabled();
      expect(readApplications()).toEqual(before);
    });
    let lostApplicationId;
    await scenario('Lost real save response is safely retried by keyboard without a duplicate or extra history', async () => {
      const before = readApplications().length;
      let savedStatus;
      await page.route(`${backend}/api/v1/verification/applications`, async route => {
        const realResponse = await route.fetch();
        savedStatus = realResponse.status();
        await route.abort('failed');
      }, { times: 1 });
      await page.getByRole('button', { name: 'Submit application', exact: true }).press('Enter');
      await expect(page.locator('#new-application [role=alert]')).toContainText('could not reach the service');
      expect(savedStatus).toBe(201);
      expect(readApplications()).toHaveLength(before + 1);
      await expect(page.getByLabel('Serial number')).toHaveValue('BUSINESS-LOST-RESPONSE-002');
      const retry = page.waitForResponse(r => r.url() === `${backend}/api/v1/verification/applications` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Submit application', exact: true }).press('Enter');
      expect((await retry).status()).toBe(200);
      await page.waitForURL('**/applications/*');
      lostApplicationId = page.url().split('/').pop();
      expect(readApplications()).toHaveLength(before + 1);
      expect(readApplications().find(item => item.id === lostApplicationId).history).toHaveLength(1);
    });
    await scenario('Application list loading, connection-error retry, search and narrow themes work', async () => {
      const failRead = async route => {
        await new Promise(resolve => setTimeout(resolve, 700));
        await route.abort('failed');
      };
      // React development mode can cancel and repeat a mount fetch; fail the
      // active load as well as its cancelled predecessor, then restore the API.
      await page.route(`${backend}/api/v1/verification/applications`, failRead);
      await page.goto(`${frontend}/applications`);
      await expect(page.getByRole('status').filter({ hasText: 'Loading applications' })).toBeVisible();
      await expect(page.locator('main [role=alert]')).toContainText('could not reach the service');
      await page.unroute(`${backend}/api/v1/verification/applications`, failRead);
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(page.getByText('BUSINESS-LOST-RESPONSE-002', { exact: false })).toBeVisible();
      const search = page.getByRole('searchbox', { name: 'Search your applications' });
      await search.fill('no matching serial');
      await expect(page.getByText('No applications match', { exact: false })).toBeVisible();
      await search.fill('BUSINESS-LOST-RESPONSE-002');
      await expect(page.getByRole('link', { name: /View details/ })).toHaveCount(1);
      await search.fill('');
      for (const theme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 390, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await screenshot(`application-form-${theme}-mobile`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
    });
    if (manageBackend) await scenario('Actual backend outage gives a connection error; restart preserves accounts, applications and retry', async () => {
      const savedApplications = readApplications();
      const savedAccounts = readAccounts();
      await stopBackend();
      await page.goto(`${frontend}/login`);
      await page.getByLabel('Email Address', { exact: true }).fill(otherEmail);
      await page.getByLabel('Password', { exact: true }).fill(password);
      let requests = 0;
      const observer = request => { if (request.url() === `${backend}/api/v1/auth/login` && request.method() === 'POST') requests++; };
      page.on('request', observer);
      await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await expect(page.locator('form [role=alert]')).toContainText('Unable to reach the W8LAB server');
      expect(requests).toBe(1);
      page.off('request', observer);
      await expect(page.getByLabel('Email Address', { exact: true })).toHaveValue(otherEmail);
      await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
      await startBackend();
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await page.waitForURL('**/applications');
      await expect(page.getByText('BUSINESS-LOST-RESPONSE-002', { exact: false })).toBeVisible();
      expect(readApplications()).toEqual(savedApplications);
      expect(readAccounts()).toEqual(savedAccounts);
      const details = await api(`/verification/applications/${lostApplicationId}`);
      expect(details.status).toBe(200);
      expect(details.body.data).toEqual(savedApplications.find(item => item.id === lostApplicationId));
    });
    await scenario('No project records changed and browser has no JavaScript exceptions', async () => {
      expect(projectHashes()).toEqual(hashes);
      expect(consoleEvents.filter(event => event.type === 'pageerror')).toEqual([]);
    });
  } finally {
    await browser.close();
    if (manageBackend) await stopBackend();
    const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(status => [status, scenarios.filter(row => row.status === status).length]));
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ browser: version, playwright: require('@playwright/test/package.json').version, frontend, backend, scenarios, counts, network, consoleEvents, colors, failureInjection: 'Registration/application delivery aborted before forwarding; delayed real requests; one unsupported class sent to the real backend; one real committed 201 response dropped; real managed-backend outage/restart when enabled. Successful responses always came from the real backend.' }, null, 2));
    if (manageBackend) fs.writeFileSync(path.join(output, 'backend.log'), backendLogs.join(''));
    console.log(JSON.stringify({ output: path.relative(root, output), counts }));
    if (counts.FAIL) process.exitCode = 1;
  }
}
main().catch(async error => { if (manageBackend) await stopBackend(); console.error(scrub(error.message)); process.exitCode = 1; });
