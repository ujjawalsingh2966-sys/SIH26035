// Managed, local-only P1 verification. Credentials/key exist in memory only.
// Bootstrap uses the supported offline CLI; all subsequent provisioning uses
// the actual Administrator UI/API. No forged successful sessions or responses.
const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const root = path.resolve(__dirname, '..');
const runRoot = path.resolve(process.env.W8LAB_BROWSER_RUN_DIR || path.join(root, 'artifacts/browser-review', `p1-${Date.now()}`));
if (!runRoot.startsWith(path.join(root, 'artifacts/browser-review') + path.sep) || fs.existsSync(runRoot)) throw new Error('Choose a new browser-review artifact directory.');
fs.mkdirSync(runRoot, { recursive: true });
const frontend = 'http://127.0.0.1:3016', backend = 'http://127.0.0.1:4006';
const key = crypto.randomBytes(48).toString('hex');
const credentials = {
  administrator: { name: 'P1 operator', email: 'operator@example.test', password: crypto.randomBytes(24).toString('base64url'), role: 'Administrator' },
  technician: { name: 'P1 technician', email: 'technician@example.com', password: crypto.randomBytes(24).toString('base64url'), role: 'Technician' },
  reviewer: { name: 'P1 reviewer', email: 'reviewer@example.com', password: crypto.randomBytes(24).toString('base64url'), role: 'Reviewer' },
  otherTechnician: { name: 'P1 second technician', email: 'technician2@example.com', password: crypto.randomBytes(24).toString('base64url'), role: 'Technician' },
  misleading: { name: 'P1 ordinary staff', email: 'misleading-admin@example.test', password: crypto.randomBytes(24).toString('base64url'), role: 'Technician' },
};
const privateValues = [key, ...Object.values(credentials).flatMap(item => [item.email, item.password])];
const scrub = value => privateValues.reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value))
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const env = { ...process.env, JWT_SECRET: key, NODE_ENV: 'development', PORT: '4006', CLIENT_URL: frontend,
  DATA_DIR: path.join(runRoot, 'data'), W8LAB_BROWSER_RUN_DIR: runRoot,
  W8LAB_BROWSER_FRONTEND: frontend, W8LAB_BROWSER_BACKEND: backend, W8LAB_BROWSER_BUILD_DIR: process.env.W8LAB_BROWSER_BUILD_DIR || '.next-p1-review',
  W8LAB_BROWSER_TECHNICIAN: credentials.technician.email, W8LAB_BROWSER_PASSWORD: credentials.technician.password,
  W8LAB_BROWSER_REVIEWER: credentials.reviewer.email, W8LAB_BROWSER_REVIEWER_PASSWORD: credentials.reviewer.password,
  W8LAB_BROWSER_ADMINISTRATOR: credentials.administrator.email, W8LAB_BROWSER_ADMINISTRATOR_PASSWORD: credentials.administrator.password,
  W8LAB_BROWSER_OTHER_TECHNICIAN: credentials.otherTechnician.email, W8LAB_BROWSER_OTHER_TECHNICIAN_PASSWORD: credentials.otherTechnician.password,
};
const logs = [], results = [], errors = [], assetErrors = [];
let browser, server, front, adminPage, techPage, reviewerPage, otherPage, caseId, revokedToken;
const read = name => { const file = path.join(runRoot, 'data', `${name}.json`); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []; };
const projectHashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
function child(args, cwd = root, extra = {}) {
  const process = spawn(global.process.execPath, args, { cwd, windowsHide: true, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [process.stdout, process.stderr]) stream.on('data', data => {
    const redacted = scrub(data.toString()); logs.push(redacted);
    fs.appendFileSync(path.join(runRoot, 'live-redacted.log'), redacted);
  });
  return process;
}
const finish = process => new Promise((resolve, reject) => { process.once('error', reject); process.once('exit', code => resolve(code)); });
async function stop(process) { if (process && process.exitCode === null) { const done = finish(process); process.kill(); await done; } }
async function ready(url) { await expect.poll(async () => { try { return (await fetch(url)).status; } catch { return 0; } }, { timeout: 20000 }).toBe(200); }
async function startBackend() { server = child(['dist/index.js'], path.join(root, 'backend')); await ready(`${backend}/api/v1/health`); }
async function scenario(name, operation) {
  try { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: scrub(error.message) }); console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 400)}`); }
}
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend, 'http://127.0.0.1:3000'].includes(url.origin) ? route.abort() : route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(scrub(error.message)));
  page.on('response', response => { if (response.url().includes('/_next/') && response.status() >= 400) assetErrors.push({ status: response.status(), url: response.url() }); });
  return page;
}
async function login(page, role) {
  const account = credentials[role]; await page.goto(`${frontend}/login`);
  await page.getByLabel('Email Address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await page.waitForURL('**/dashboard');
  await expect(page.locator('aside')).toContainText(account.role);
}
async function api(page, endpoint, method = 'GET', payload, token) {
  return page.evaluate(async ({ url, method, payload, token }) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token || localStorage.getItem('nawi_token')}`, 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  }, { url: `${backend}/api/v1${endpoint}`, method, payload, token });
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(runRoot, `${name}.png`), fullPage: true, animations: 'disabled',
    mask: [page.locator('input[type=password],input[type=email]'), ...Object.values(credentials).map(item => page.getByText(item.email, { exact: true }))] });
}
async function main() {
  const before = projectHashes();
  for (const url of [frontend, backend]) { let occupied = false; try { await fetch(url); occupied = true; } catch {} if (occupied) throw new Error('Isolated P1 port occupied; refusing to stop its owner.'); }
  expect(await finish(child(['e2e/p0-isolated-data.cjs']))).toBe(0);
  const bootstrapEnv = { W8LAB_BOOTSTRAP_NAME: credentials.administrator.name, W8LAB_BOOTSTRAP_EMAIL: credentials.administrator.email, W8LAB_BOOTSTRAP_PASSWORD: credentials.administrator.password };
  await scenario('Supported offline bootstrap creates only the first persistent Administrator', async () => {
    expect(await finish(child(['dist/cli/staffBootstrap.js'], path.join(root, 'backend'), bootstrapEnv))).toBe(0);
    const accounts = JSON.stringify(read('staffAccounts'));
    expect(await finish(child(['dist/cli/staffBootstrap.js'], path.join(root, 'backend'), bootstrapEnv))).toBe(1);
    expect(JSON.stringify(read('staffAccounts'))).toBe(accounts);
  });
  await startBackend();
  front = child([path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3016'], path.join(root, 'frontend'));
  await ready(`${frontend}/login`);
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  adminPage = await newPage(); techPage = await newPage(); reviewerPage = await newPage(); otherPage = await newPage();
  await scenario('Login has empty credentials and no interactive email-to-role selector', async () => {
    await adminPage.goto(`${frontend}/login`); await expect(adminPage.getByLabel('Password', { exact: true })).toHaveValue('');
    await expect(adminPage.getByLabel('Email Address', { exact: true })).toHaveValue(''); await expect(adminPage.getByText('Select Your Role', { exact: true })).toHaveCount(0);
  });
  await scenario('Wrong password shows accurate error, preserves email and permits successful retry', async () => {
    await adminPage.getByLabel('Email Address', { exact: true }).fill(credentials.administrator.email);
    await adminPage.getByLabel('Password', { exact: true }).fill('not-the-configured-password');
    await adminPage.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(adminPage.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();
    await expect(adminPage.getByLabel('Email Address', { exact: true })).toHaveValue(credentials.administrator.email);
    await login(adminPage, 'administrator');
  });
  await scenario('Administrator role comes from persisted account despite non-admin email', async () => {
    expect((await api(adminPage, '/auth/me')).body.data.role).toBe('Administrator');
    await adminPage.getByRole('link', { name: 'Staff accounts', exact: true }).click(); await adminPage.waitForURL('**/staff');
  });
  await scenario('Actual staff form provisions explicit roles with unique passwords and rapid-submit protection', async () => {
    for (const role of ['technician', 'reviewer', 'otherTechnician', 'misleading']) {
      const account = credentials[role];
      await adminPage.getByLabel('Full name', { exact: true }).fill(account.name);
      await adminPage.getByLabel('Email address', { exact: true }).fill(account.email);
      await adminPage.getByLabel(/^Staff role/).selectOption(account.role);
      await adminPage.getByLabel(/^Initial password/).fill(account.password);
      if (role !== 'misleading') await adminPage.getByLabel(/^Adopt this verified/).check();
      const response = adminPage.waitForResponse(res => res.url() === `${backend}/api/v1/staff` && res.request().method() === 'POST');
      await adminPage.getByRole('button', { name: 'Create staff account', exact: true }).evaluate(button => { button.click(); button.click(); });
      expect((await response).status()).toBe(201);
      await expect(adminPage.getByLabel('Full name', { exact: true })).toHaveValue('');
      expect(read('staffAccounts').filter(item => item.email === account.email)).toHaveLength(1);
    }
    expect(read('staffAccounts').find(item => item.email === credentials.technician.email).id).toBe('dev-user-01');
    await screenshot(adminPage, 'staff-provisioning-desktop');
  });
  await scenario('Existing full laboratory browser runner remains green with real persisted accounts', async () => {
    expect(await finish(child(['e2e/laboratory-browser.cjs']))).toBe(0);
  });
  await scenario('Existing unit/completeness/report browser runner remains green without bypassing P0', async () => {
    expect(await finish(child(['e2e/p0-integrity-browser.cjs']))).toBe(0);
  });
  await scenario('Existing instrument overlap and lost-response retry browser runner remains green', async () => {
    expect(await finish(child(['e2e/instrument-submission.cjs']))).toBe(0);
  });
  if (process.env.W8LAB_BROWSER_P2 === '1') await scenario('P2 manufacturer and instrument browser/API verification remains green', async () => {
    expect(await finish(child(['e2e/p2-browser.cjs']))).toBe(0);
  });
  if (process.env.W8LAB_BROWSER_P3 === '1') await scenario('P3 applicability and native procedure browser/API verification remains green', async () => {
    expect(await finish(child(['e2e/p3-browser.cjs']))).toBe(0);
  });
  if (process.env.W8LAB_BROWSER_P3_1 === '1') await scenario('P3.1 strict enums, dispatch and preserved invalid history pass browser/API checks', async () => {
    // Historical corruption fixtures are installed only while this isolated
    // backend is stopped; original records and running-store memory are untouched.
    await stop(server);
    expect(await finish(child(['e2e/p3-1-isolated-history.cjs']))).toBe(0);
    await startBackend();
    expect(await finish(child(['e2e/p3-1-browser.cjs']))).toBe(0);
  });
  if (process.env.W8LAB_BROWSER_P4A === '1') await scenario('P4A performance forms, authorization and integrity pass real browser/API checks', async () => {
    expect(await finish(child(['e2e/p4a-browser.cjs']))).toBe(0);
  });
  await scenario('Valid Technician login restricts staff management in navigation, UI and API', async () => {
    await login(techPage, 'technician'); await expect(techPage.getByRole('link', { name: 'Staff accounts', exact: true })).toHaveCount(0);
    expect((await api(techPage, '/staff')).status).toBe(403);
    await techPage.goto(`${frontend}/staff`); await expect(techPage.locator('main [role=alert]')).toContainText('requires an Administrator');
    expect((await api(techPage, '/staff', 'POST', { ...credentials.misleading })).status).toBe(403);
  });
  await scenario('Valid Reviewer login cannot create instruments or provision staff', async () => {
    await login(reviewerPage, 'reviewer'); expect((await api(reviewerPage, '/instruments', 'POST', {})).status).toBe(403);
    expect((await api(reviewerPage, '/staff')).status).toBe(403);
  });
  await scenario('An admin-looking email remains Technician with no role inference', async () => {
    await login(otherPage, 'misleading'); expect((await api(otherPage, '/auth/me')).body.data.role).toBe('Technician');
    expect((await api(otherPage, '/staff')).status).toBe(403);
  });
  await scenario('Login/provisioning payloads cannot escalate privileges or overwrite identities', async () => {
    expect((await api(techPage, '/auth/login', 'POST', { email: credentials.technician.email, password: credentials.technician.password, role: 'Administrator' })).status).toBe(400);
    const id = read('staffAccounts').find(item => item.email === credentials.technician.email).id;
    expect((await api(techPage, `/staff/${id}`, 'PATCH', { role: 'Administrator' })).status).toBe(403);
    expect((await api(adminPage, `/staff/${id}`, 'PATCH', { role: 'Administrator' })).status).toBe(400);
  });
  await scenario('Inactive account loses live API/UI access; reactivation never revives old sessions', async () => {
    const row = adminPage.getByRole('article', { name: `Staff ${credentials.misleading.email}`, exact: true });
    const token = await otherPage.evaluate(() => localStorage.getItem('nawi_token'));
    await row.getByRole('button', { name: 'Deactivate', exact: true }).click(); await expect(row).toContainText('Inactive');
    expect((await api(otherPage, '/auth/me', 'GET', undefined, token)).status).toBe(401);
    expect((await api(otherPage, '/auth/login', 'POST', { email: credentials.misleading.email, password: credentials.misleading.password })).status).toBe(401);
    await otherPage.reload(); await otherPage.waitForURL('**/login');
    await row.getByRole('button', { name: 'Activate', exact: true }).click(); await expect(row).toContainText('Active');
    expect((await api(otherPage, '/auth/me', 'GET', undefined, token)).status).toBe(401);
    await login(otherPage, 'misleading');
  });
  await scenario('Administrator password reset revokes old sessions and accepts only the new password', async () => {
    const account = credentials.misleading; const old = account.password;
    const token = await otherPage.evaluate(() => localStorage.getItem('nawi_token'));
    const changed = crypto.randomBytes(24).toString('base64url'); privateValues.push(changed);
    const row = adminPage.getByRole('article', { name: `Staff ${account.email}`, exact: true });
    await row.getByLabel(`New password for ${account.name}`, { exact: true }).fill(changed);
    await row.getByRole('button', { name: 'Reset password', exact: true }).click();
    await expect(row.getByLabel(`New password for ${account.name}`, { exact: true })).toHaveValue('');
    expect((await api(otherPage, '/auth/me', 'GET', undefined, token)).status).toBe(401);
    expect((await api(otherPage, '/auth/login', 'POST', { email: account.email, password: old })).status).toBe(401);
    account.password = changed; await login(otherPage, 'misleading');
  });
  await scenario('Administrator revoke-sessions invalidates a Reviewer immediately', async () => {
    const token = await reviewerPage.evaluate(() => localStorage.getItem('nawi_token'));
    const row = adminPage.getByRole('article', { name: `Staff ${credentials.reviewer.email}`, exact: true });
    const response = adminPage.waitForResponse(res => res.url().endsWith('/revoke-sessions'));
    await row.getByRole('button', { name: 'Revoke sessions', exact: true }).click(); expect((await response).status()).toBe(200);
    expect((await api(reviewerPage, '/auth/me', 'GET', undefined, token)).status).toBe(401); await login(reviewerPage, 'reviewer');
  });
  await scenario('Cross-technician records, reports and review endpoints remain protected', async () => {
    await login(otherPage, 'otherTechnician');
    const own = read('testCases').find(item => item.technicianId === 'dev-user-01'); caseId = own.id;
    for (const endpoint of [`/repository/records/${caseId}`, `/reports/${caseId}/data`, `/reports/${caseId}/html`, `/reports/${caseId}/pdf`]) expect((await api(otherPage, endpoint)).status).toBe(403);
    expect((await api(techPage, `/test-cases/${caseId}/workflow/approve`, 'POST', { expectedRevision: own.revision })).status).toBe(403);
    expect((await api(reviewerPage, `/test-cases/${caseId}/workflow/approve`, 'POST', { expectedRevision: own.revision })).status).toBe(409);
    await reviewerPage.goto(`${frontend}/test-cases/${caseId}/workspace`);
    await expect(reviewerPage.getByRole('button', { name: 'Approve Record', exact: true })).toBeDisabled();
    await expect(reviewerPage.locator('#programme-status')).toContainText('INCOMPLETE');
  });
  await scenario('Invalid, expired, modified-role and legacy tokens are rejected through real browser requests', async () => {
    const token = await techPage.evaluate(() => localStorage.getItem('nawi_token'));
    const claims = jwt.decode(token); const expired = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 1 }, key);
    const forged = jwt.sign({ ...claims, role: 'Administrator' }, key);
    const legacy = jwt.sign({ id: claims.id, email: claims.email, role: claims.role }, key);
    for (const probe of ['not-a-token', expired, forged, legacy]) expect((await api(techPage, '/auth/me', 'GET', undefined, probe)).status).toBe(401);
  });
  await scenario('Offline logout retains a retryable credential, then confirms revocation on the server', async () => {
    revokedToken = await otherPage.evaluate(() => localStorage.getItem('nawi_token'));
    await otherPage.context().setOffline(true);
    try { await otherPage.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(otherPage.getByRole('alert').filter({ hasText: 'Sign out could not be confirmed' })).toBeVisible(); expect(await otherPage.evaluate(() => localStorage.getItem('nawi_token'))).toBe(revokedToken); }
    finally { await otherPage.context().setOffline(false); }
    await otherPage.getByRole('button', { name: 'Sign out', exact: true }).click(); await otherPage.waitForURL('**/login');
    expect(await otherPage.evaluate(() => localStorage.getItem('nawi_token'))).toBeNull();
    expect((await api(otherPage, '/auth/me', 'GET', undefined, revokedToken)).status).toBe(401);
  });
  await scenario('Server restart preserves active accounts/sessions and durable logout revocation', async () => {
    const token = await adminPage.evaluate(() => localStorage.getItem('nawi_token'));
    const before = read('instruments').map(item => item.id).sort();
    const nativeBefore = read('nativeTests');
    await stop(server); await startBackend();
    expect((await api(adminPage, '/auth/me', 'GET', undefined, token)).status).toBe(200);
    expect((await api(adminPage, '/auth/me', 'GET', undefined, revokedToken)).status).toBe(401);
    expect((await api(adminPage, '/instruments')).body.data.map(item => item.id).sort()).toEqual(before);
    expect(read('nativeTests')).toEqual(nativeBefore);
    for (const id of [...new Set(nativeBefore.map(item => item.testCaseId))]) {
      const persisted = await api(techPage, `/native/${id}`);
      expect(persisted.status).toBe(200);
      expect(persisted.body.data.tests).toEqual(nativeBefore.filter(item => item.testCaseId === id));
    }
    await adminPage.reload(); await expect(adminPage.getByRole('heading', { name: 'Staff accounts', exact: true })).toBeVisible();
  });
  await scenario('Staff management remains usable on narrow light/dark keyboard layouts', async () => {
    await adminPage.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['light', 'dark']) {
      await adminPage.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await adminPage.getByLabel('Full name', { exact: true }).focus(); await adminPage.keyboard.press('Tab');
      await expect(adminPage.getByLabel('Email address', { exact: true })).toBeFocused();
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const create = await adminPage.getByRole('button', { name: 'Create staff account', exact: true }).boundingBox();
      expect(create.height).toBeGreaterThanOrEqual(44);
      await screenshot(adminPage, `staff-mobile-${theme}`);
    }
    await adminPage.setViewportSize({ width: 1440, height: 1000 });
  });
  await scenario('P1 production assets and console remain healthy', async () => {
    const assets = await adminPage.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => node.src || node.href));
    for (const url of assets) expect((await adminPage.request.get(url)).status()).toBe(200);
    expect(assetErrors).toEqual([]); expect(errors).toEqual([]);
  });
  await scenario('Original project records and existing uncommitted data remain unchanged', async () => { expect(projectHashes()).toEqual(before); });
  fs.writeFileSync(path.join(runRoot, 'results.json'), JSON.stringify({ browser: browser.version(), frontend, backend, results, errors, assetErrors, originalDataPreserved: true }, null, 2));
  fs.writeFileSync(path.join(runRoot, 'redacted-services.log'), logs.join(''));
  console.log(`RESULTS ${runRoot}`); console.log(`TOTAL ${JSON.stringify(results.reduce((sum, item) => ({ ...sum, [item.status]: (sum[item.status] || 0) + 1 }), {}))}`);
  if (results.some(item => item.status === 'FAIL')) process.exitCode = 1;
}
main().catch(error => { console.error(scrub(error.stack)); process.exitCode = 1; }).finally(async () => { await browser?.close(); await stop(front); await stop(server); });
