// Run through the managed P1 runner with W8LAB_BROWSER_P2=1. All successful
// requests reach the real isolated backend. No credentials or bearer tokens are saved.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const frontend = process.env.W8LAB_BROWSER_FRONTEND, backend = process.env.W8LAB_BROWSER_BACKEND;
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const roles = {
  tech: [process.env.W8LAB_BROWSER_TECHNICIAN, process.env.W8LAB_BROWSER_PASSWORD],
  other: [process.env.W8LAB_BROWSER_OTHER_TECHNICIAN, process.env.W8LAB_BROWSER_OTHER_TECHNICIAN_PASSWORD],
  reviewer: [process.env.W8LAB_BROWSER_REVIEWER, process.env.W8LAB_BROWSER_REVIEWER_PASSWORD],
  admin: [process.env.W8LAB_BROWSER_ADMINISTRATOR, process.env.W8LAB_BROWSER_ADMINISTRATOR_PASSWORD],
};
if (!frontend || !backend || !runRoot || Object.values(roles).some(pair => pair.some(value => !value))) throw new Error('Use the managed local browser runner.');
for (const origin of [frontend, backend]) if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local verification only.');
const output = path.join(runRoot, 'p2'); fs.mkdirSync(output, { recursive: true });
const read = name => JSON.parse(fs.readFileSync(path.join(runRoot, 'data', `${name}.json`), 'utf8'));
const scrub = value => Object.values(roles).flat().reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const projectHashes = () => Object.fromEntries(fs.readdirSync(path.join(__dirname, '../data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../data', name))).digest('hex')]));
const results = [], errors = [], assetErrors = [], pages = {};
let browser, maker, instrument, caseId, registerOnly;
const suffix = Date.now();
const values = { name: `Synthetic P2 balance ${suffix}`, model: 'SYNTHETIC-P2', serialNumber: `SYNTHETIC-P2-${suffix}`,
  accuracyClass: 'III', maxCapacity: '3', minCapacity: '0.02', e: '0.001', d: '0.001', weighingUnit: 'kg',
  isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, hasTare: false, hasAuxiliaryIndication: false,
  isGrading: false, softwareControlled: true, softwareIdentification: 'SYNTHETIC-SW-1', typeApprovalMark: 'SYNTHETIC-UNVERIFIED', technicalNotes: 'Isolated verification only; not a real instrument.' };
async function api(page, endpoint, method = 'GET', payload) {
  return page.evaluate(async ({ url, method, payload }) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}`, 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  }, { url: `${backend}/api/v1${endpoint}`, method, payload });
}
async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input[type=password],input[type=email]'), ...Object.values(roles).map(([email]) => page.getByText(email, { exact: true }))] });
}
async function scenario(name, operation) {
  try { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: scrub(error.message) }); console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 450)}`); await screenshot(pages.tech, `failure-${results.length}`).catch(() => {}); }
}
async function manufacturerForm(page, name, identifier) {
  await page.goto(`${frontend}/manufacturers/new`);
  await page.getByLabel('Manufacturer name', { exact: true }).fill(name);
  await page.getByLabel('Manufacturer identifier', { exact: true }).fill(identifier);
  await page.getByLabel('Manufacturer address', { exact: true }).fill('Synthetic laboratory road, local-only verification');
}
async function registrationForm(page, data = values) {
  await page.goto(`${frontend}/instruments/new`);
  await page.getByRole('button', { name: 'CONTINUE TO METADATA', exact: true }).click();
  await page.getByLabel('Manufacturer', { exact: true }).selectOption(maker.id);
  for (const [label, key] of [['Name', 'name'], ['Model', 'model'], ['Serial Number', 'serialNumber'], ['Max Capacity', 'maxCapacity'], ['Min Capacity', 'minCapacity'], ['Verification Scale Interval (e)', 'e'], ['Actual Scale Interval (d)', 'd']]) await page.getByLabel(label, { exact: true }).fill(data[key]);
  await page.getByLabel('Accuracy Class', { exact: true }).selectOption(data.accuracyClass);
  await page.getByLabel('Weighing unit for Max, Min, e and d', { exact: true }).selectOption(data.weighingUnit);
  await page.getByLabel('Software-controlled instrument', { exact: true }).setChecked(data.softwareControlled);
  if (data.softwareControlled) await page.getByLabel('Software identification', { exact: true }).fill(data.softwareIdentification);
  await page.getByLabel('Type approval mark (if applicable; not independently verified)', { exact: true }).fill(data.typeApprovalMark);
  await page.getByLabel('Technical characteristics / additional markings (if applicable)', { exact: true }).fill(data.technicalNotes);
}
const submitRegistration = page => page.locator('form[aria-busy] button[type=submit]');
async function main() {
  const original = projectHashes();
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  for (const [role, [email, password]] of Object.entries(roles)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin) ? route.abort() : route.continue();
    });
    const page = pages[role] = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(scrub(error.message)));
    page.on('response', response => { if (response.url().includes('/_next/') && response.status() >= 400) assetErrors.push({ status: response.status(), url: response.url() }); });
    await page.goto(`${frontend}/login`); await page.getByLabel('Email Address', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await page.waitForURL('**/dashboard');
  }
  const page = pages.tech;
  await scenario('Manufacturer form creates exactly one persistent record under rapid submissions', async () => {
    const identifier = `SYNTHETIC-P2-M-${suffix}`;
    await manufacturerForm(page, 'Synthetic P2 manufacturer', identifier);
    await page.getByRole('button', { name: 'Save manufacturer', exact: true }).evaluate(button => { button.click(); button.click(); button.form.requestSubmit(); });
    await page.waitForURL(/\/manufacturers\/mfr_[^/]+$/);
    maker = read('manufacturers').find(row => row.identifier === identifier);
    expect(read('manufacturers').filter(row => row.identifier === identifier)).toHaveLength(1);
    await expect(page.getByRole('heading', { name: 'Synthetic P2 manufacturer', exact: true })).toBeVisible();
    await screenshot(page, 'manufacturer-details-desktop');
  });
  await scenario('Manufacturer search and keyboard labels locate the saved identity', async () => {
    await page.goto(`${frontend}/manufacturers`);
    await page.getByLabel('Search name, identifier or address', { exact: true }).fill(maker.identifier);
    await page.getByRole('button', { name: 'Search manufacturers', exact: true }).click();
    await expect(page.getByRole('link', { name: maker.name, exact: true })).toBeVisible();
    await screenshot(page, 'manufacturer-directory-desktop');
  });
  await scenario('Duplicate and invalid manufacturer responses preserve entries and allow a valid retry', async () => {
    await manufacturerForm(page, maker.name, maker.identifier);
    await page.getByRole('button', { name: 'Save manufacturer', exact: true }).click();
    await expect(page.locator('main [role=alert]')).toContainText('already exists');
    await expect(page.getByLabel('Manufacturer identifier', { exact: true })).toHaveValue(maker.identifier);
    expect((await api(page, '/manufacturers', 'POST', { name: ' ', address: ' ', identifier: ' ' })).status).toBe(400);
    await page.getByLabel('Manufacturer identifier', { exact: true }).fill(`${maker.identifier}-ARCHIVE`);
    await page.getByLabel('Manufacturer name', { exact: true }).fill('Synthetic unused manufacturer');
    await page.getByRole('button', { name: 'Save manufacturer', exact: true }).click(); await page.waitForURL(/\/manufacturers\/mfr_[^/]+$/);
  });
  await scenario('Unused manufacturer is archived without deletion and excluded from active selection', async () => {
    const id = new URL(page.url()).pathname.split('/').pop();
    await page.getByRole('button', { name: 'Archive manufacturer', exact: true }).click();
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();
    expect((await api(page, '/manufacturers')).body.data.some(row => row.id === id)).toBe(false);
    expect(read('manufacturers').find(row => row.id === id).active).toBe(false);
  });
  await scenario('Malformed registration is rejected in the actual form without losing input', async () => {
    await registrationForm(page);
    await page.getByLabel('Verification Scale Interval (e)', { exact: true }).fill('0');
    await submitRegistration(page).click();
    await expect(page.locator('main [role=alert]')).toContainText('greater than zero');
    await expect(page.getByLabel('Serial Number', { exact: true })).toHaveValue(values.serialNumber);
    expect(read('instruments').some(row => row.serialNumber === values.serialNumber)).toBe(false);
  });
  await scenario('Kilogram registration derives n, persists canonical grams and creates one snapshot-backed case', async () => {
    await page.getByLabel('Verification Scale Interval (e)', { exact: true }).fill(values.e);
    await expect(page.getByLabel('Number of verification scale intervals', { exact: true })).toHaveText('3000');
    await screenshot(page, 'instrument-registration-desktop');
    await submitRegistration(page).evaluate(button => { button.click(); button.click(); button.form.requestSubmit(); });
    await page.waitForURL('**/test-cases/*/workspace');
    instrument = read('instruments').find(row => row.serialNumber === values.serialNumber);
    const cases = read('testCases').filter(row => row.instrumentId === instrument.id); expect(cases).toHaveLength(1); caseId = cases[0].id;
    expect(instrument).toMatchObject({ maxCapacity: '3000', minCapacity: '20', e: '1', d: '1', n: '3000', weighingUnit: 'g', softwareIdentification: values.softwareIdentification });
    expect(cases[0].masterDataSnapshot.instrument.e).toBe('1');
    await expect(page.locator('main')).toContainText(maker.identifier);
    await expect(page.locator('main')).toContainText('SNAPSHOT');
    await screenshot(page, 'workspace-frozen-metadata');
  });
  await scenario('Backend rejects duplicate identity, forged ownership, invalid units, and missing manufacturer', async () => {
    const payload = { ...values, manufacturerId: maker.id };
    expect((await api(page, '/instruments', 'POST', payload)).status).toBe(409);
    for (const patch of [{ createdBy: 'forged-owner' }, { weighingUnit: 'lb' }, { manufacturerId: 'mfr_placeholder' }, { n: '123' }, { e: '0x01' }]) expect((await api(page, '/instruments', 'POST', { ...payload, serialNumber: `${suffix}-invalid`, ...patch })).status).toBe(400);
    expect(read('instruments').filter(row => row.serialNumber === values.serialNumber)).toHaveLength(1);
  });
  await scenario('Instrument detail and own testing history survive browser reload', async () => {
    await page.goto(`${frontend}/instruments/${instrument.id}`); await expect(page.getByRole('heading', { name: values.name, exact: true })).toBeVisible();
    await expect(page.getByText('Specifications are locked', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit registration', exact: true })).toHaveCount(0);
    await screenshot(page, 'instrument-details-desktop');
    await page.getByRole('link', { name: 'Testing history', exact: true }).click(); await page.reload();
    await expect(page.getByText(caseId, { exact: true })).toBeVisible();
    await screenshot(page, 'instrument-history-desktop');
  });
  await scenario('Other Technicians and unassigned Reviewers cannot see restricted testing history or workspace', async () => {
    for (const user of [pages.other, pages.reviewer]) {
      expect((await api(user, `/instruments/${instrument.id}/history`)).body.data).toEqual([]);
      expect((await api(user, `/repository/records/${caseId}`)).status).toBe(403);
      expect((await api(user, `/reports/${caseId}/data`)).status).toBe(403);
      await user.goto(`${frontend}/instruments/${instrument.id}/history`); await expect(user.getByText('No accessible test cases.', { exact: true })).toBeVisible();
    }
  });
  await scenario('Backend edit guards protect linked specifications, creator identity and Reviewer permissions', async () => {
    expect((await api(page, `/instruments/${instrument.id}`, 'PUT', { ...values, manufacturerId: maker.id, expectedRevision: 0 })).status).toBe(409);
    expect((await api(pages.admin, `/instruments/${instrument.id}`, 'PUT', { ...values, manufacturerId: maker.id, expectedRevision: 0 })).status).toBe(409);
    expect((await api(pages.other, `/manufacturers/${maker.id}`, 'PUT', { name: maker.name, identifier: maker.identifier, address: 'forged edit', expectedRevision: 0 })).status).toBe(403);
    expect((await api(pages.reviewer, '/manufacturers', 'POST', { name: 'no', identifier: 'no', address: 'no' })).status).toBe(403);
    expect((await api(pages.admin, '/instruments', 'POST', { ...values, manufacturerId: maker.id })).status).toBe(403);
  });
  await scenario('Manufacturer edit updates current directory but cannot change frozen workspace/report metadata', async () => {
    await page.goto(`${frontend}/manufacturers/${maker.id}/edit`);
    await page.getByLabel('Manufacturer address', { exact: true }).fill('Synthetic revised address; not historical metadata');
    await page.getByRole('button', { name: 'Save manufacturer', exact: true }).click(); await page.waitForURL(`${frontend}/manufacturers/${maker.id}`);
    const detail = (await api(page, `/repository/records/${caseId}`)).body.data;
    expect(detail.manufacturer.address).toBe(maker.address); expect(detail.metadataSource).toBe('SNAPSHOT');
    await page.goto(`${frontend}/test-cases/${caseId}/workspace`); await expect(page.locator('main')).toContainText(maker.address);
    await expect(page.locator('main')).not.toContainText('Synthetic revised address');
  });
  await scenario('Class I registration explicitly stops before unsupported evaluation and permits unlinked edits', async () => {
    const data = { ...values, name: 'Synthetic unsupported Class I profile', serialNumber: `P2-I-${suffix}`, accuracyClass: 'I', maxCapacity: '50', minCapacity: '0.1' };
    await registrationForm(page, data); await submitRegistration(page).click(); await page.waitForURL(/\/instruments\/inst_[^/]+$/);
    registerOnly = read('instruments').find(row => row.serialNumber === data.serialNumber);
    await expect(page.getByRole('region', { name: 'Unsupported evaluation profile' })).toContainText('Class I');
    expect(read('testCases').some(row => row.instrumentId === registerOnly.id)).toBe(false);
    expect((await api(page, '/test-cases', 'POST', { instrumentId: registerOnly.id })).status).toBe(409);
    await screenshot(page, 'unsupported-profile-details');
    await page.getByRole('link', { name: 'Edit registration', exact: true }).click();
    await page.getByLabel('Software-controlled instrument', { exact: true }).uncheck();
    await expect(page.getByLabel('Software identification', { exact: true })).toHaveCount(0);
    await page.getByLabel('Model', { exact: true }).fill('SYNTHETIC-EDITED'); await submitRegistration(page).click(); await page.waitForURL(`${frontend}/instruments/${registerOnly.id}`);
    await expect(page.locator('main')).toContainText('SYNTHETIC-EDITED');
    expect(read('instruments').find(row => row.id === registerOnly.id).softwareIdentification).toBeUndefined();
  });
  await scenario('Automatic/multi-range profiles are rejected explicitly without creating records', async () => {
    for (const patch of [{ isManual: false }, { isSingleRange: false }]) expect((await api(page, '/instruments', 'POST', { ...values, manufacturerId: maker.id, serialNumber: `P2-unsupported-${suffix}`, ...patch })).status).toBe(422);
    expect(read('instruments').some(row => row.serialNumber === `P2-unsupported-${suffix}`)).toBe(false);
  });
  await scenario('Confirmed manufacturer validation failures remain retryable; lost real responses never auto-resend', async () => {
    const id = `P2-LOST-${suffix}`; await manufacturerForm(page, 'Synthetic response-loss manufacturer', id);
    let requests = 0;
    const handler = async route => { requests++; await route.fetch(); await route.abort('connectionreset'); };
    await page.route(`${backend}/api/v1/manufacturers`, handler, { times: 1 });
    await page.getByRole('button', { name: 'Save manufacturer', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Save outcome is unknown' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save manufacturer', exact: true })).toBeDisabled();
    expect(requests).toBe(1); expect(read('manufacturers').filter(row => row.identifier === id)).toHaveLength(1);
    await page.unroute(`${backend}/api/v1/manufacturers`, handler);
  });
  await scenario('Directories, registration, details and history work in narrow light/dark reduced-motion layouts', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const route of ['/manufacturers', '/manufacturers/new', '/instruments', `/instruments/${instrument.id}`, `/instruments/${instrument.id}/history`]) {
        await page.goto(`${frontend}${route}`); await expect(page.locator('main h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await registrationForm(page); await page.getByLabel('Name', { exact: true }).focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('Model', { exact: true })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screenshot(page, `instrument-registration-mobile-${theme}`);
      await page.goto(`${frontend}/manufacturers/new`); await page.getByLabel('Manufacturer name', { exact: true }).focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('Manufacturer identifier', { exact: true })).toBeFocused();
      await screenshot(page, `manufacturer-form-mobile-${theme}`);
    }
  });
  await scenario('All production assets load without runtime exceptions and original project data is unchanged', async () => {
    expect(errors).toEqual([]); expect(assetErrors).toEqual([]); expect(projectHashes()).toEqual(original);
    for (const url of await page.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => node.src || node.href))) expect((await page.request.get(url)).status()).toBe(200);
  });
  const counts = results.reduce((sum, item) => ({ ...sum, [item.status]: (sum[item.status] || 0) + 1 }), {});
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ frontend, backend, browser: browser.version(), results, errors, assetErrors, originalDataPreserved: true }, null, 2));
  console.log(`P2 TOTAL ${JSON.stringify(counts)}`);
  if (results.some(item => item.status === 'FAIL')) process.exitCode = 1;
}
main().catch(error => { console.error(scrub(error.stack)); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
