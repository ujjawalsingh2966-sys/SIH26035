// Real login and asset checks, including concurrent dev/prod cache isolation.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('artifacts/browser-review/p0-20261018-runtime');
const email = process.env.W8LAB_BROWSER_TECHNICIAN;
const password = process.env.W8LAB_BROWSER_PASSWORD;
if (!email || !password) throw new Error('Supply configured staff credentials.');
const results = [], errors = [], assetErrors = [];
let browser;
async function check(name, operation) {
  try { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error.message).split(email).join('[REDACTED]').split(password).join('[REDACTED]') }); console.log(`FAIL ${name}`); }
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/_next/') && response.status() >= 400) assetErrors.push({ url: response.url(), status: response.status() });
  });
  const prod = 'http://127.0.0.1:3014';
  await check('Production login renders and every referenced JS/CSS asset returns 200', async () => {
    await page.goto(`${prod}/login`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /W8LAB/ })).toBeVisible();
    const assets = await page.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => node.src || node.href));
    expect(assets.length).toBeGreaterThan(3);
    for (const asset of assets) expect((await page.request.get(asset)).status()).toBe(200);
    await page.screenshot({ path: path.join(out, 'production-login.png'), fullPage: true });
  });
  await check('Production supports real configured staff login and route navigation', async () => {
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/dashboard');
    for (const route of ['/tests', '/instruments', '/reports', '/dashboard']) {
      await page.goto(prod + route, { waitUntil: 'networkidle' });
      await expect(page.getByRole('link', { name: 'W8LAB home' })).toBeVisible();
      expect(page.url()).toBe(prod + route);
    }
    await page.screenshot({ path: path.join(out, 'production-dashboard.png'), fullPage: true,
      mask: [page.getByText(email, { exact: true })] });
  });
  await check('Compiling development routes cannot overwrite production JS/CSS', async () => {
    const dev = await browser.newPage();
    dev.on('pageerror', error => errors.push(error.message));
    for (const route of ['/login', '/prototypes/navigation']) {
      const response = await dev.goto('http://127.0.0.1:3000' + route, { waitUntil: 'networkidle', timeout: 90000 });
      expect(response.status()).toBe(200);
    }
    for (const route of ['/login', '/tests', '/dashboard']) {
      const response = await page.goto(prod + route, { waitUntil: 'networkidle' });
      expect(response.status()).toBe(200);
      const assets = await page.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => node.src || node.href));
      for (const asset of assets) expect((await page.request.get(asset)).status()).toBe(200);
    }
    await dev.close();
  });
  await check('No missing production assets or uncaught browser runtime exceptions', async () => {
    expect(assetErrors).toEqual([]); expect(errors).toEqual([]);
  });
  await browser.close();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, assetErrors, errors }, null, 2));
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
}
main().catch(async error => { console.error(String(error.message).split(email).join('[REDACTED]').split(password).join('[REDACTED]')); await browser?.close(); process.exitCode = 1; });
