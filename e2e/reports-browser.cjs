// Real local browser report workflow. --inspect captures the original 404 only.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3011';
const backend = process.env.W8LAB_BROWSER_BACKEND || 'http://127.0.0.1:4002';
const runRoot = process.env.W8LAB_BROWSER_RUN_DIR;
const accounts = { Technician: process.env.W8LAB_BROWSER_TECHNICIAN, Reviewer: process.env.W8LAB_BROWSER_REVIEWER, Administrator: process.env.W8LAB_BROWSER_ADMINISTRATOR, Other: process.env.W8LAB_BROWSER_OTHER_TECHNICIAN };
const password = process.env.W8LAB_BROWSER_PASSWORD;
const inspectOnly = process.argv.includes('--inspect');
if (!runRoot || !password || Object.values(accounts).some(value => !value)) throw new Error('Supply isolated storage and documented accounts using W8LAB_BROWSER_* environment variables.');
for (const origin of [frontend, backend]) if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local origins only.');
const dataDir = path.resolve(process.env.W8LAB_BROWSER_DATA_DIR || path.join(runRoot, 'data'));
if (!fs.existsSync(dataDir)) throw new Error('Start the isolated backend first.');
const output = path.resolve(runRoot, `${inspectOnly ? 'before' : 'reports'}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const scrub = value => [password, ...Object.values(accounts)].reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const read = name => fs.existsSync(path.join(dataDir, `${name}.json`)) ? JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8')) : [];
const originalHashes = () => Object.fromEntries(fs.readdirSync(path.join(root, 'data')).filter(name => name.endsWith('.json')).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data', name))).digest('hex')]));
const scenarios = [], network = [], consoleEvents = [], evidence = [];
let browser, page;
async function screenshot(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input[type=email],input[type=password]'), ...Object.values(accounts).map(email => page.getByText(email, { exact: true }))] });
}
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light', acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![frontend, backend].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  const next = await context.newPage();
  next.setDefaultTimeout(15000);
  next.setDefaultNavigationTimeout(90000);
  next.on('pageerror', error => consoleEvents.push({ type: 'pageerror', text: scrub(error.message) }));
  next.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleEvents.push({ type: message.type(), text: scrub(message.text()) }); });
  next.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === backend) network.push({ type: 'request', method: request.method(), path: url.pathname, query: url.search });
  });
  next.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === backend || response.status() >= 400) network.push({ type: 'response', method: response.request().method(), path: url.pathname, query: url.search, status: response.status() });
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
async function scenario(name, operation) {
  try { await operation(); scenarios.push({ name, status: inspectOnly ? 'INSPECTED' : 'PASS' }); console.log(`${inspectOnly ? 'INSPECTED' : 'PASS'} ${name}`); }
  catch (error) { scenarios.push({ name, status: 'FAIL', error: scrub(error.message) }); await screenshot(`failure-${scenarios.length}`).catch(() => {}); console.log(`FAIL ${name}: ${scrub(error.message).slice(0, 350)}`); }
}
async function main() {
  const original = originalHashes();
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  page = await newPage();
  await login('Reviewer');
  const served = await api('/repository/search?status=APPROVED&limit=100&page=1');
  expect(served.status).toBe(200);
  expect(served.result.data.map(row => row.testCase.id).sort()).toEqual(read('testCases').filter(row => row.status === 'APPROVED').map(row => row.id).sort());
  if (inspectOnly) {
    const audit = read('audit'), records = read('testCases');
    await scenario('Sidebar Reports link and direct refresh reproduce HTTP 404', async () => {
      const response = page.waitForResponse(response => new URL(response.url()).pathname === '/reports');
      await page.getByRole('link', { name: 'Reports', exact: true }).click();
      const status = (await response).status();
      await page.waitForURL('**/reports');
      await expect(page.getByText('This page could not be found.', { exact: true })).toBeVisible();
      await screenshot('reports-404-sidebar');
      const reload = await page.reload();
      expect(reload.status()).toBe(404);
      expect(status).toBe(404);
      evidence.push({ status, reloadStatus: reload.status(), availableApprovedRecords: served.result.total, auditUnchanged: JSON.stringify(audit) === JSON.stringify(read('audit')) });
      expect(read('audit')).toEqual(audit);
      expect(read('testCases')).toEqual(records);
    });
  } else {
    await runChecks();
  }
  expect(originalHashes()).toEqual(original);
  expect(consoleEvents.filter(event => event.type === 'pageerror')).toEqual([]);
  for (const [name, value] of Object.entries({ results: { browser: browser.version(), frontend, backend, dataDir, inspectOnly, scenarios, evidence, originalDataPreserved: true }, network, console: consoleEvents })) fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(value, null, 2));
  console.log(`RESULTS ${output}`);
  console.log(`TOTAL ${JSON.stringify(scenarios.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {}))}`);
  await browser.close();
  process.exitCode = scenarios.some(item => item.status === 'FAIL') ? 1 : 0;
}
async function runChecks() {
  let mainId, otherId, draftId, mainInstrument;
  const row = id => page.getByRole('article', { name: `Report ${id}`, exact: true });
  const listingRequests = () => network.filter(event => event.type === 'request' && event.path === '/api/v1/repository/search').length;
  const reportRequests = () => network.filter(event => event.type === 'request' && /^\/api\/v1\/reports\//.test(event.path)).length;
  const mutation = async (endpoint, method, body) => {
    const result = await api(endpoint, method, body);
    expect(result.status, `${method} ${endpoint}`).toBeLessThan(300);
    return result.result.data;
  };
  const revision = id => read('testCases').find(record => record.id === id).revision;
  const transition = (id, action) => mutation(`/test-cases/${id}/workflow/${action}`, 'POST', { expectedRevision: revision(id) });
  const setupCase = async instrumentId => {
    const record = await mutation('/test-cases', 'POST', { instrumentId });
    await mutation(`/test-cases/${record.id}/status`, 'PUT', { status: 'TESTING', expectedRevision: revision(record.id) });
    await mutation('/observations', 'POST', { testCaseId: record.id, testType: 'WEIGHING', sequence: 1, load: '5000', indication: '5000', additionalWeights: '2.5', zeroError: '0', unit: 'g' });
    await transition(record.id, 'submit');
    return record.id;
  };
  const openReports = async () => {
    await page.goto(`${frontend}/reports`);
    await expect(page.locator('main h1')).toHaveText('Reports');
    await expect(page.getByRole('status').filter({ hasText: 'Loading reports' })).toHaveCount(0);
  };
  const search = async query => {
    await page.getByLabel('Search by test ID, model or manufacturer').fill(query);
    const before = listingRequests();
    await page.getByRole('button', { name: 'Search reports', exact: true }).click();
    await expect.poll(listingRequests).toBeGreaterThan(before);
    await expect(page.getByRole('status').filter({ hasText: 'Loading reports' })).toHaveCount(0);
  };
  const downloadPdf = async (id, fileName) => {
    const download = page.waitForEvent('download');
    await row(id).getByRole('button', { name: 'Download PDF', exact: true }).click();
    const file = await download;
    const filePath = path.join(output, fileName);
    await file.saveAs(filePath);
    const text = fs.readFileSync(filePath).toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text).toContain(`Test Case ID: ${id}`);
    expect(text).toContain('Status: FINAL');
    return { filePath, text };
  };

  await scenario('Real delayed list shows loading then an empty state without generating reports', async () => {
    expect(read('testCases')).toHaveLength(0);
    const audits = read('audit');
    const before = reportRequests();
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const delayList = async route => { await held; await route.continue(); };
    await page.route(`${backend}/api/v1/repository/search?**`, delayList);
    try {
      await page.getByRole('link', { name: 'Reports', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Loading reports' })).toBeVisible();
      await screenshot('reports-loading');
    } finally { release(); }
    await expect(page.getByText('No approved reports found.', { exact: true })).toBeVisible();
    await page.unroute(`${backend}/api/v1/repository/search?**`, delayList);
    await screenshot('reports-empty');
    expect(reportRequests()).toBe(before);
    expect(read('audit')).toEqual(audits);
  });
  await scenario('Supported API setup creates approved records for two technicians and an ineligible draft', async () => {
    for (const [role, suffix] of [['Technician', 'MAIN'], ['Other', 'OTHER']]) {
      await login(role);
      const instrument = await mutation('/instruments', 'POST', { manufacturerId: 'mfr_placeholder', name: `Reports ${suffix}`, model: `REPORT-${suffix}`, serialNumber: `ISOLATED-REPORT-${suffix}`, isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', hasTare: false });
      const id = await setupCase(instrument.id);
      if (role === 'Technician') {
        mainId = id; mainInstrument = instrument.id;
        draftId = (await mutation('/test-cases', 'POST', { instrumentId: instrument.id })).id;
      } else otherId = id;
      await login(role === 'Technician' ? 'Reviewer' : 'Administrator');
      await transition(id, 'start-review');
      await transition(id, 'approve');
    }
    evidence.push({ fixtures: { mainId, otherId, draftId }, setup: 'Real authenticated browser API calls, documented Class III observations; no direct file edits or mocked successes.' });
  });
  await scenario('Owner list, direct URL, refresh and search use authorized backend rows without generation', async () => {
    await login('Technician');
    const records = read('testCases'), audits = read('audit'), before = reportRequests();
    await openReports();
    await expect(row(mainId)).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(row(otherId)).toHaveCount(0);
    await expect(row(draftId)).toHaveCount(0);
    expect((await page.reload()).status()).toBe(200);
    await expect(row(mainId)).toBeVisible();
    await search('REPORT-OTHER');
    await expect(page.getByText('No approved reports found.', { exact: true })).toBeVisible();
    const targeted = await api('/repository/search?status=APPROVED&q=REPORT-OTHER');
    expect(targeted.result.data).toEqual([]);
    expect(targeted.result.total).toBe(0);
    await search(mainId);
    await expect(row(mainId)).toBeVisible();
    expect(reportRequests()).toBe(before);
    expect(read('audit')).toEqual(audits);
    expect(read('testCases')).toEqual(records);
    await screenshot('owner-authorized-report-list');
  });
  await scenario('Owner previews HTML and downloads one real PDF under rapid clicks; content matches saved evaluation', async () => {
    await row(mainId).getByRole('button', { name: 'Preview report' }).click();
    const frame = page.frameLocator(`iframe[title="Report preview ${mainId}"]`);
    await expect(frame.locator('body')).toContainText(mainId);
    await expect(frame.locator('body')).toContainText('FINAL');
    await screenshot('owner-html-preview');
    await page.getByRole('button', { name: 'Close preview' }).click();
    const pdfRequests = () => network.filter(event => event.type === 'request' && event.path === `/api/v1/reports/${mainId}/pdf`).length;
    const before = pdfRequests();
    const download = page.waitForEvent('download');
    await row(mainId).getByRole('button', { name: 'Download PDF' }).evaluate(button => { button.click(); button.click(); });
    const filePath = path.join(output, 'owner-report.pdf');
    await (await download).saveAs(filePath);
    expect(pdfRequests() - before).toBe(1);
    const text = fs.readFileSync(filePath).toString('latin1');
    const saved = read('observations').find(record => record.testCaseId === mainId);
    for (const value of [mainId, `Load: ${saved.load} g`, `Indication: ${saved.indication} g`, `Add. Weights: ${saved.additionalWeights} g`, `Ec: ${saved.evaluation.calculation.Ec.value} g`, `MPE: ${saved.evaluation.rulePackage.mpeLimit.value} g`, `Verdict: ${saved.evaluation.compliance.verdict}`]) expect(text).toContain(value);
    const ownerPage = page;
    const viewer = await page.context().newPage();
    await viewer.goto(pathToFileURL(filePath).href);
    await expect.poll(() => viewer.frames().some(frame => frame.url().startsWith('chrome-extension://'))).toBe(true);
    const pdfFrame = viewer.frames().find(frame => frame.url().startsWith('chrome-extension://'));
    await expect(pdfFrame.locator('pdf-viewer')).toBeAttached();
    page = viewer; await screenshot('owner-pdf-open-in-chromium'); page = ownerPage;
    evidence.push({ downloadedCase: mainId, savedEc: saved.evaluation.calculation.Ec, savedMpe: saved.evaluation.rulePackage.mpeLimit, rapidPdfRequests: pdfRequests() - before });
  });
  await scenario('Unrelated technician sees only their own approved report; data/HTML/PDF remain forbidden for the other record', async () => {
    await login('Other');
    await openReports();
    await expect(row(otherId)).toBeVisible();
    await expect(row(mainId)).toHaveCount(0);
    const result = await api(`/repository/search?status=APPROVED&testId=${mainId}`);
    expect(result.result.data).toEqual([]);
    expect(result.result.total).toBe(0);
    const audits = read('audit');
    for (const format of ['data', 'html', 'pdf']) {
      const denied = await api(`/reports/${mainId}/${format}`);
      expect(denied.status).toBe(403);
      expect(denied.result).toEqual({ success: false, error: 'Forbidden: Cannot access this test case' });
    }
    expect(read('audit')).toEqual(audits);
    await screenshot('unrelated-technician-only-own-list');
  });
  await scenario('Reviewer and Administrator list approved reports and use authorized HTML/PDF actions', async () => {
    for (const role of ['Reviewer', 'Administrator']) {
      await login(role);
      await openReports();
      await expect(row(mainId)).toBeVisible();
      await expect(row(otherId)).toBeVisible();
      await expect(row(draftId)).toHaveCount(0);
      await row(mainId).getByRole('button', { name: 'Preview report' }).click();
      await expect(page.frameLocator(`iframe[title="Report preview ${mainId}"]`).locator('body')).toContainText(mainId);
      await page.getByRole('button', { name: 'Close preview' }).click();
      const pdf = await downloadPdf(mainId, `${role.toLowerCase()}-report.pdf`);
      expect(pdf.text).toContain(`Generated By: ${role}`);
    }
  });
  await scenario('Mobile Reports entry, both themes and narrow page controls work without horizontal clipping', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${frontend}/dashboard`);
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(row(mainId)).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      await page.waitForTimeout(250);
      expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await screenshot(`reports-mobile-${theme}`);
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 1440, height: 1100 });
  });
  await scenario('Offline list failure has retry feedback, clears rows and recovers with real backend data', async () => {
    await page.context().setOffline(true);
    try {
      await page.getByRole('button', { name: 'Refresh reports' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Reports could not be loaded' })).toBeVisible();
      await expect(page.getByRole('article')).toHaveCount(0);
      await expect(page.getByText('No approved reports found.', { exact: true })).toHaveCount(0);
      await screenshot('reports-request-error');
    } finally { await page.context().setOffline(false); }
    await page.getByRole('button', { name: 'Retry loading reports' }).click();
    await expect(row(mainId)).toBeVisible();
  });
  await scenario('Real 401 listing response produces distinct access denied state and recovers', async () => {
    // Explicit negative injection: invalid outgoing token, real backend 401.
    await page.route(`${backend}/api/v1/repository/search?**`, route => route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer invalid-local-test-token' } }), { times: 1 });
    await page.getByRole('button', { name: 'Refresh reports' }).click();
    await expect(page.getByRole('heading', { name: 'Access denied', exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
    await screenshot('reports-access-denied');
    await page.getByRole('button', { name: 'Refresh reports' }).click();
    await expect(row(mainId)).toBeVisible();
  });
  await scenario('Real denied PDF request shows error without download/audit; allowed retry succeeds', async () => {
    await login('Other');
    await openReports();
    await expect(row(otherId)).toBeVisible();
    const audits = read('audit');
    let downloads = 0;
    const onDownload = () => { downloads += 1; };
    page.on('download', onDownload);
    // Explicit negative injection: keep the real token but request the other protected record.
    await page.route(`${backend}/api/v1/reports/${otherId}/pdf`, route => route.continue({ url: `${backend}/api/v1/reports/${mainId}/pdf` }), { times: 1 });
    await row(otherId).getByRole('button', { name: 'Download PDF' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Access denied' })).toBeVisible();
    expect(downloads).toBe(0);
    expect(read('audit')).toEqual(audits);
    await screenshot('pdf-access-denied-feedback');
    await downloadPdf(otherId, 'other-technician-own-report.pdf');
    expect(downloads).toBe(1);
    page.off('download', onDownload);
  });
  await scenario('Cross-tab account changes clear old rows/preview and discard a delayed previous-account response', async () => {
    await login('Reviewer'); await openReports(); await expect(row(mainId)).toBeVisible();
    await row(mainId).getByRole('button', { name: 'Preview report' }).click();
    await expect(page.locator('iframe')).toBeVisible();
    const first = page;
    const second = await page.context().newPage();
    page = second; await login('Other'); page = first;
    await expect(row(otherId)).toBeVisible();
    await expect(row(mainId)).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await login('Reviewer'); await openReports(); await expect(row(mainId)).toBeVisible();
    let release, arrived, finish;
    const gate = new Promise(resolve => { release = resolve; });
    const seen = new Promise(resolve => { arrived = resolve; });
    const done = new Promise(resolve => { finish = resolve; });
    await page.route(`${backend}/api/v1/repository/search?**`, async route => {
      try { const response = await route.fetch(); arrived(response.status()); await gate; await route.fulfill({ response }); }
      catch { /* The old account's request may be aborted by the session change. */ }
      finally { finish(); }
    }, { times: 1 });
    let timeout;
    try {
      await page.getByRole('button', { name: 'Refresh reports' }).click();
      expect(await Promise.race([seen, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Held listing did not arrive')), 15000); })])).toBe(200);
      page = second; await login('Other'); page = first;
      await expect(row(otherId)).toBeVisible(); await expect(row(mainId)).toHaveCount(0);
    } finally { clearTimeout(timeout); release(); await done; }
    await page.waitForTimeout(250);
    await expect(row(mainId)).toHaveCount(0); await expect(page.getByRole('article')).toHaveCount(1);
    await screenshot('reports-account-change-no-stale-rows');
  });
  await scenario('Pagination uses real authorized records and excludes the other technician from totals', async () => {
    await login('Technician');
    const ids = [];
    for (let index = 0; index < 20; index += 1) ids.push(await setupCase(mainInstrument));
    await login('Reviewer');
    for (const id of ids) { await transition(id, 'start-review'); await transition(id, 'approve'); }
    await login('Technician'); await openReports();
    await expect(page.getByRole('article')).toHaveCount(20);
    await expect(page.getByText('Page 1 of 2 (21 reports)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next reports' }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByText('Page 2 of 2 (21 reports)', { exact: true })).toBeVisible();
    await expect(row(otherId)).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous reports' }).click();
    await expect(page.getByRole('article')).toHaveCount(20);
    await search(mainId); await expect(row(mainId)).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(1);
  });
  await scenario('Anonymous listing and protected report requests remain unauthorized', async () => {
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(`${backend}/api/v1/repository/search?status=APPROVED`)).status()).toBe(401);
    expect((await anonymous.request.get(`${backend}/api/v1/reports/${mainId}/pdf`)).status()).toBe(401);
    await anonymous.close();
  });
}
main().catch(async error => {
  console.error(scrub(error.stack || error.message));
  fs.writeFileSync(path.join(output, 'interrupted.json'), JSON.stringify({ error: scrub(error.message), scenarios }, null, 2));
  if (browser) await browser.close();
  process.exitCode = 2;
});
