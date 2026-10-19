// Managed isolated real-backend verification. All metrology data below are
// explicitly SYNTHETIC historical fixtures, never actual laboratory measurements.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const frontend = process.env.W8LAB_BROWSER_FRONTEND, backend = process.env.W8LAB_BROWSER_BACKEND, root = process.env.W8LAB_BROWSER_RUN_DIR;
const credentials = { tech: [process.env.W8LAB_BROWSER_TECHNICIAN, process.env.W8LAB_BROWSER_PASSWORD], other: [process.env.W8LAB_BROWSER_OTHER_TECHNICIAN, process.env.W8LAB_BROWSER_OTHER_TECHNICIAN_PASSWORD], review: [process.env.W8LAB_BROWSER_REVIEWER, process.env.W8LAB_BROWSER_REVIEWER_PASSWORD] };
if (!frontend || !backend || !root || Object.values(credentials).flat().some(v => !v))
    throw Error('Use managed local runner');
for (const origin of [frontend, backend])
    if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
        throw Error('Local only');
const out = path.join(root, 'p4a');
fs.mkdirSync(out, { recursive: true });
const results = [], errors = [], assets = [], consoleErrors = [], pages = {};
const scrub = v => Object.values(credentials).flat().reduce((s, k) => s.split(k).join('[REDACTED]'), String(v)).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[REDACTED_TOKEN]');
let browser, id, instrument, declared, tareId, tareProgramme;
async function api(page, endpoint, method = 'GET', payload) { return page.evaluate(async ({ url, method, payload }) => { const r = await fetch(url, { method, headers: { Authorization: `Bearer ${localStorage.getItem('nawi_token')}`, 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) }); return { status: r.status, body: await r.json() }; }, { url: `${backend}/api/v1${endpoint}`, method, payload }); }
async function state(caseId = id) { const r = await api(pages.tech, `/native/${caseId}`); expect(r.status).toBe(200); return r.body.data; }
async function shot(name) { await pages.tech.screenshot({ path: path.join(out, `${name}.png`), fullPage: true, animations: 'disabled', mask: [pages.tech.locator('input[type=email],input[type=password]')] }); }
async function scenario(name, op) { try {
    await op();
    results.push({ name, status: 'PASS' });
    console.log(`PASS ${name}`);
}
catch (e) {
    results.push({ name, status: 'FAIL', error: scrub(e.message) });
    console.log(`FAIL ${name}: ${scrub(e.message).slice(0, 350)}`);
    await shot(`failure-${results.length}`).catch(() => { });
} }
async function createCase(inst = instrument) { const r = await api(pages.tech, '/test-cases', 'POST', { instrumentId: inst.id }); expect(r.status).toBe(201); const cid = r.body.data.id; expect((await api(pages.tech, `/test-cases/${cid}/status`, 'PUT', { expectedRevision: 0, status: 'TESTING' })).status).toBe(200); return cid; }
function observations(p, procedure, series) { const sample = p.decisions.find(d => d.id === procedure).samples.find(s => s.series === series); return sample.plan.map((r, j) => ({ sequence: j + 1, unit: 'g', load: r.loadG, indication: r.loadG, additionalWeights: '2.5', ...(r.phase ? { phase: r.phase } : {}), ...(r.position ? { position: r.position, zero: { load: '0', indication: '0', additionalWeights: '2.5' } } : {}), ...(r.tareG ? { tareLoad: r.tareG } : {}), ...(r.baseG ? { baseLoad: r.baseG } : {}) })); }
async function select(procedure, series) { await pages.tech.getByLabel(/^Native procedure \/ series/).selectOption(`${procedure}/${series}`); }
async function fill(rows) {
    const page = pages.tech;
    for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        for (const k of ['load', 'indication', 'additionalWeights', 'tareLoad', 'baseLoad', 'timestamp', 'temperatureC', 'initialIndication', 'decreasedIndication', 'restoredWeight', 'addedLoad', 'outputIndication'])
            if (row[k] !== undefined)
                await page.locator(`#performance-${j}-${k}`).fill(row[k]);
        const fieldset = page.locator('form[aria-busy] > fieldset > fieldset').nth(j);
        if (row.zero)
            for (const k of ['load', 'indication', 'additionalWeights'])
                await fieldset.getByLabel(`Primary zero ${k} (g)`, { exact: true }).fill(row.zero[k]);
        if (row.deviceIndications)
            for (let n = 0; n < row.deviceIndications.length; n++) {
                for (const k of ['indication', 'additionalWeights'])
                    await fieldset.getByLabel(`Device ${n + 1} ${k} (g)`, { exact: true }).fill(row.deviceIndications[n][k]);
                if (row.deviceIndications[n].zero)
                    for (const k of ['load', 'indication', 'additionalWeights'])
                        await fieldset.getByLabel(`Tare device zero ${k} (g)`, { exact: true }).fill(row.deviceIndications[n].zero[k]);
            }
        if (row.following) {
            const trace = fieldset.getByRole('group', { name: 'Actual following indications over 0–5 seconds', exact: true });
            for (let n = 0; n < row.following.length; n++) {
                await trace.getByLabel('Actual seconds after output', { exact: true }).nth(n).fill(row.following[n].seconds);
                await trace.getByLabel('Observed indication (g)', { exact: true }).nth(n).fill(row.following[n].indication);
            }
        }
        if (row.disturbed !== undefined)
            for (const name of ['Single disturbance and prompt operation performed', 'Operation inhibited during continuous disturbance', 'Operation inhibited before stable equilibrium'])
                await fieldset.getByLabel(name, { exact: true }).selectOption('YES');
    }
    for (const check of await page.locator('form[aria-busy] > fieldset > label input[type=checkbox]').all())
        await check.check();
    await page.getByLabel('Performance observation / calibrated equipment / sketch evidence', { exact: true }).fill('SYNTHETIC historical test fixture / isolated calibration and position sketch; NOT actual laboratory observations');
}
async function save(caseId = id, rapid = false) { const page = pages.tech; const response = page.waitForResponse(r => r.url().includes(`/native/${caseId}/tests/`) && r.request().method() === 'PUT'); const button = page.getByRole('button', { name: 'Save performance evidence', exact: true }); if (rapid)
    await button.evaluate(b => { b.click(); b.click(); b.form.requestSubmit(); });
else
    await button.click(); const r = await response; expect(r.status()).toBe(200); await expect(page.getByRole('status').filter({ hasText: 'Performance evidence saved' })).toBeVisible(); return (await r.json()).data; }
async function main() {
    browser = await chromium.launch({ headless: true, channel: 'chromium' });
    for (const [role, [email, password]] of Object.entries(credentials)) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = pages[role] = await context.newPage();
        page.setDefaultTimeout(12000);
        page.on('pageerror', e => errors.push(scrub(e.message)));
        page.on('console', m => { if (m.type() === 'error')
            consoleErrors.push({ text: scrub(m.text()), url: m.location().url }); });
        page.on('response', r => { if (r.url().includes('/_next/') && r.status() >= 400)
            assets.push({ url: r.url(), status: r.status() }); });
        await page.goto(`${frontend}/login`);
        await page.getByLabel(/^Email/).fill(email);
        await page.getByLabel(/^Password/).fill(password);
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard/);
    }
    const page = pages.tech;
    await scenario('Real authenticated manufacturer/instrument and owned case setup', async () => { const maker = await api(page, '/manufacturers', 'POST', { name: 'SYNTHETIC P4A manufacturer', identifier: `P4A-${Date.now()}`, address: 'Isolated verification lab' }); expect(maker.status).toBe(201); const r = await api(page, '/instruments', 'POST', { manufacturerId: maker.body.data.id, name: 'SYNTHETIC P4A scale', model: 'P4A', serialNumber: `P4A-${Date.now()}`, accuracyClass: 'III', maxCapacity: '15000', minCapacity: '100', e: '5', d: '5', weighingUnit: 'g', hasTare: false, isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true, hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false }); expect(r.status).toBe(201); instrument = r.body.data; id = await createCase(); });
    await scenario('Actual P4A declaration form defines a versioned programme and explicit characteristics', async () => {
        await page.goto(`${frontend}/test-cases/${id}/programme`);
        await page.getByLabel(/^Test purpose/).selectOption('TYPE_EVALUATION');
        await page.getByLabel(/^Indication type/).selectOption('DIGITAL');
        await page.getByLabel(/^Zero-device inventory/).selectOption('NONE');
        await page.getByLabel(/^Initial zero-setting device/).selectOption('NO');
        await page.getByLabel(/^Eccentric loading possible/).selectOption('YES');
        await page.getByLabel(/^Load receptor/).selectOption('PLATFORM');
        await page.getByLabel(/^Support points/).fill('4');
        await page.getByLabel('Instrument documentation / evidence reference', { exact: true }).fill('SYNTHETIC P4A manual');
        await page.getByLabel(/^Enable P4A/).check();
        await page.getByLabel('Self-indicating instrument', { exact: true }).selectOption('YES');
        await page.getByLabel(/^Vehicle-mounted/).selectOption('NO');
        await page.getByLabel(/^Indicating \/ printing devices/).selectOption('DISPLAY,PRINT');
        await page.getByLabel(/^Support points too close/).selectOption('NO');
        await page.getByLabel('Stability function inventory', { exact: true }).selectOption('KNOWN');
        await page.getByLabel('PRINT stability function', { exact: true }).check();
        await page.getByLabel(/^PRINT documented test load/).fill('7500');
        await page.getByLabel(/^Stability documentation:/).fill('Synthetic principle, criteria, all parameters and securing');
        await page.getByLabel('Worst-case adjustment and type variants', { exact: true }).fill('Synthetic worst case, all variants');
        await page.getByRole('button', { name: 'Define programme', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Applicability matrix & sampling overview', exact: true })).toBeVisible();
        declared = (await state()).programme;
        expect(declared.ruleset).toBe('W8LAB-R76-2006-P4A-1');
        expect((await state()).assessment.overallVerdict).toBe('INCOMPLETE');
        await shot('programme-desktop');
    });
    await scenario('Blank observations and required labels never invent measurements', async () => { await select('WEIGHING', 'SERIES'); await expect(page.locator('#performance-0-load')).toHaveValue(''); await page.getByRole('button', { name: 'Save performance evidence', exact: true }).click(); expect(await page.locator('#performance-0-load').evaluate(n => n.validity.valueMissing)).toBe(true); expect((await state()).tests).toHaveLength(0); });
    await scenario('Complete weighing form saves real calculated traces and prevents rapid duplicate requests', async () => { await fill(observations(declared, 'WEIGHING', 'SERIES')); let calls = 0; const listener = r => { if (r.url().endsWith(`/native/${id}/tests/WEIGHING/SERIES`) && r.method() === 'PUT')
        calls++; }; page.on('request', listener); const record = await save(id, true); page.off('request', listener); expect(calls).toBe(1); expect(record.result).toMatchObject({ status: 'PASS', complete: true, count: 21 }); expect(record.result.rows[3]).toMatchObject({ loadG: '2500', E0: '0', Ec: '0', limitG: '2.5' }); });
    await scenario('Eccentricity form renders position map, complete per-position zero and corrected errors', async () => { await select('ECCENTRICITY', 'POSITIONS'); await expect(page.getByText('Receptor position map — confirm actual sketch in evidence', { exact: true })).toBeVisible(); await fill(observations(declared, 'ECCENTRICITY', 'POSITIONS')); expect((await save()).result.status).toBe('PASS'); await shot('eccentricity-desktop'); });
    await scenario('Digital discrimination actual three-load form enforces prescribed response', async () => { await select('DISCRIMINATION', 'THREE_LOADS'); const rows = observations(declared, 'DISCRIMINATION', 'THREE_LOADS'); for (const r of rows) {
        r.initialIndication = r.load;
        r.decreasedIndication = String(Number(r.load) - 5);
        r.restoredWeight = '0.5';
        r.addedLoad = '7';
        r.indication = String(Number(r.load) + 5);
    } await fill(rows); expect((await save()).result.status).toBe('PASS'); });
    await scenario('Creep form uses explicit synthetic historical timestamps, never a simulated clock', async () => { await select('CREEP', 'TIMELINE'); const rows = observations(declared, 'CREEP', 'TIMELINE'); rows.forEach((r, j) => { r.timestamp = ['2026-01-01T00:00:00Z', '2026-01-01T00:15:00Z', '2026-01-01T00:30:00Z'][j]; r.temperatureC = '20'; }); await fill(rows); const r = await save(); expect(r.result.status).toBe('PASS'); expect(r.submission.readings[2].timestamp).toBe(rows[2].timestamp); });
    await scenario('Zero-return form records actual load chronology and 30-minute requirement', async () => { await select('ZERO_RETURN', 'TIMELINE'); const rows = observations(declared, 'ZERO_RETURN', 'TIMELINE'); rows.forEach((r, j) => { r.timestamp = ['2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z', '2026-01-01T00:31:00Z', '2026-01-01T00:31:05Z'][j]; r.temperatureC = '20'; }); await fill(rows); expect((await save()).result.status).toBe('PASS'); });
    await scenario('Equilibrium form captures five disturbances, inhibition and output follow-up traces', async () => { await select('EQUILIBRIUM', 'PRINT'); const rows = observations(declared, 'EQUILIBRIUM', 'PRINT'); for (const r of rows) {
        r.disturbed = true;
        r.outputIndication = '7500';
        r.following = [{ seconds: '0', indication: '7500' }, { seconds: '5', indication: '7505' }];
    } await fill(rows); expect((await save()).result.status).toBe('PASS'); });
    await scenario('Backend rejection preserves values and allows confirmed retry without duplicate records', async () => { await select('WEIGHING', 'SERIES'); const endpoint = `${backend}/api/v1/native/${id}/tests/WEIGHING/SERIES`; await page.route(endpoint, route => { const body = route.request().postDataJSON(); body.submission.readings[0].unit = 'lb'; return route.continue({ postData: JSON.stringify(body) }); }); const response = page.waitForResponse(r => r.url() === endpoint); await page.getByRole('button', { name: 'Save performance evidence', exact: true }).click(); expect((await response).status()).toBe(400); await expect(page.locator('form[aria-busy] [role=alert]').first()).toContainText('unit'); await expect(page.locator('#performance-1-load')).toHaveValue('100'); await page.unroute(endpoint); expect((await save()).result.status).toBe('PASS'); });
    await scenario('Cross-Technician reads/writes, Reviewer writes and unsupported approval stay blocked', async () => { const s = await state(); expect((await api(pages.other, `/native/${id}`)).status).toBe(403); expect((await api(pages.other, `/native/${id}/tests/WEIGHING/SERIES`, 'PUT', { expectedRevision: s.testCase.revision, submission: {} })).status).toBe(403); expect((await api(pages.review, `/native/${id}/tests/WEIGHING/SERIES`, 'PUT', { expectedRevision: s.testCase.revision, submission: {} })).status).toBe(403); const escalation = await api(page, `/native/${id}/tests/WEIGHING/SERIES`, 'PUT', { expectedRevision: s.testCase.revision, submission: { procedureId: 'WEIGHING', series: 'SERIES', verdict: 'PASS' } }); expect(escalation.status).toBe(400); expect((await api(page, `/reports/${id}/data`)).status).toBe(400); expect(s.assessment.complete).toBe(false); });
    await scenario('Separate subtractive tare, accuracy and tare-device form use real backend', async () => { const reg = { ...instrument, serialNumber: `TARE-${Date.now()}`, hasTare: true, weighingUnit: 'g', hasAuxiliaryIndication: false, isGrading: false, softwareControlled: false }; for (const k of ['id', 'revision', 'createdAt', 'updatedAt', 'createdBy', 'declaredSpecifications', 'n'])
        delete reg[k]; const created = await api(page, '/instruments', 'POST', reg); expect(created.status).toBe(201); tareId = await createCase(created.body.data); const r = await api(page, `/native/${tareId}/programme`, 'PUT', { expectedRevision: 1, profile: declared.profile, performance: { ...declared.performance, tareKind: 'SUBTRACTIVE', maximumTareG: '6000', tareWeighingDevice: true, combinedZeroTare: false } }); expect(r.status).toBe(200); tareProgramme = r.body.data; await page.goto(`${frontend}/test-cases/${tareId}/programme`); for (const procedure of ['TARE', 'TARE_ACCURACY', 'TARE_COMPARISON']) {
        await select(procedure, 'TARE_HALF');
        const rows = observations(tareProgramme, procedure, 'TARE_HALF');
        if (procedure === 'TARE_COMPARISON') {
            rows[0].zero = { load: '0', indication: '0', additionalWeights: '2.5' };
            rows[0].deviceIndications = [{ indication: '3000', additionalWeights: '2.5', zero: { load: '0', indication: '0', additionalWeights: '2.5' } }];
        }
        await fill(rows);
        expect((await save(tareId)).result.status).toBe('PASS');
    } });
    await scenario('Reload retains saved programme, raw observations and results', async () => { const before = JSON.stringify((await state(tareId)).tests); await page.reload(); await expect(page.getByRole('heading', { name: 'Performance correction and chronology traces', exact: true })).toBeVisible(); expect(JSON.stringify((await state(tareId)).tests)).toBe(before); });
    await scenario('Keyboard access, narrow light/dark layouts, focus and no page overflow', async () => { for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(`${frontend}/test-cases/${id}/programme`);
        await select('ECCENTRICITY', 'POSITIONS');
        const input = page.locator('#performance-0-load');
        await input.focus();
        await expect(input).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const region = page.getByRole('region', { name: 'ECCENTRICITY detailed traces', exact: true });
        await region.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
        await shot(`performance-mobile-${theme}`);
    } await page.setViewportSize({ width: 1440, height: 1000 }); });
    await scenario('No browser exceptions, broken assets or unexpected console errors', async () => { for (const url of await page.locator('script[src],link[rel=stylesheet]').evaluateAll(ns => ns.map(n => n.src || n.href)))
        expect((await page.request.get(url)).status()).toBe(200); expect(errors).toEqual([]); expect(assets).toEqual([]); expect(consoleErrors.filter(e => !e.url.startsWith(backend) || !/^Failed to load resource: the server responded with a status of (400|401|403|404|409|422)\b/.test(e.text))).toEqual([]); });
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ browser: browser.version(), results, errors, assets, consoleErrors }, null, 2));
    console.log(`P4A TOTAL ${JSON.stringify(results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}))}`);
    if (results.some(r => r.status === 'FAIL'))
        process.exitCode = 1;
}
main().catch(e => { console.error(scrub(e.stack)); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
