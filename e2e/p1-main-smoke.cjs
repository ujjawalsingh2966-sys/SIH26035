// Non-mutating main-app smoke: no provisioned account is invented for the user.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(process.env.W8LAB_MAIN_SMOKE_DIR || 'artifacts/browser-review/p1-20261018-main');
const results = [], errors = [];
let browser;
async function check(name, operation) {
  try { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.log(`FAIL ${name}`); }
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
  await check('Main P1 login is blank and production assets load', async () => {
    await page.goto('http://127.0.0.1:3014/login', { waitUntil: 'networkidle' });
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Email Address', { exact: true })).toHaveValue('');
    const assets = await page.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => node.src || node.href));
    for (const url of assets) expect((await page.request.get(url)).status()).toBe(200);
    await page.screenshot({ path: path.join(out, 'login.png'), fullPage: true });
  });
  await check('Main backend rejects anonymous staff access and unprovisioned login', async () => {
    expect((await page.request.get('http://127.0.0.1:4000/api/v1/staff')).status()).toBe(401);
    expect((await page.request.post('http://127.0.0.1:4000/api/v1/auth/login', { data: { email: 'unprovisioned-admin@example.test', password: 'not-an-account-password' } })).status()).toBe(401);
  });
  await check('Development compilation does not corrupt production assets', async () => {
    const dev = await browser.newPage();
    expect((await dev.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 90000 })).status()).toBe(200);
    await page.reload({ waitUntil: 'networkidle' });
    const assets = await page.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => node.src || node.href));
    for (const url of assets) expect((await page.request.get(url)).status()).toBe(200);
    await dev.close();
  });
  await check('Main protected staff screen redirects to login without uncaught exceptions', async () => {
    await page.goto('http://127.0.0.1:3014/staff'); await page.waitForURL('**/login'); expect(errors).toEqual([]);
  });
  if (process.env.W8LAB_MAIN_SMOKE_P2 === '1') await check('Main P2 manufacturer and instrument routes require a real staff session', async () => {
    for (const route of ['/manufacturers', '/manufacturers/new', '/instruments/new', '/instruments/unprovisioned/history']) {
      await page.goto(`http://127.0.0.1:3014${route}`); await page.waitForURL('**/login');
    }
    for (const endpoint of ['/manufacturers', '/instruments', '/instruments/unprovisioned/history']) expect((await page.request.get(`http://127.0.0.1:4000/api/v1${endpoint}`)).status()).toBe(401);
    expect(errors).toEqual([]);
  });
  if (process.env.W8LAB_MAIN_SMOKE_P3 === '1') await check('Main P3 programme route and native API require a real staff session', async () => {
    await page.goto('http://127.0.0.1:3014/test-cases/unprovisioned/programme'); await page.waitForURL('**/login');
    expect((await page.request.get('http://127.0.0.1:4000/api/v1/native/unprovisioned')).status()).toBe(401);
    expect(errors).toEqual([]);
  });
  await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
}
main().catch(async error => { console.error(error.message); await browser?.close(); process.exitCode = 1; });
