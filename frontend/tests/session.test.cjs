const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function harness(response) {
  const calls = [], events = [];
  const storage = new Map([['nawi_token', 'synthetic-session-token']]);
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../lib/session.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, process: { env: {} }, Event,
    localStorage: { getItem: key => storage.get(key), removeItem: key => storage.delete(key) },
    window: { dispatchEvent: event => events.push(event.type) },
    fetch: async (url, options) => { calls.push({ url, options }); if (response instanceof Error) throw response; return response; } });
  return { api: module.exports, storage, calls, events };
}
test('session verification resolves the authoritative server identity without caching', async () => {
  const user = { id: 'staff-1', email: 'operator@example.test', role: 'Reviewer' };
  const h = harness({ ok: true, status: 200, json: async () => ({ success: true, data: user }) });
  assert.equal(await h.api.verifySession(), user);
  assert.equal(h.calls[0].options.cache, 'no-store');
  assert.equal(h.calls[0].options.headers.Authorization, 'Bearer synthetic-session-token');
});
test('revoked verification removes the UI session and signals the layout', async () => {
  const h = harness({ status: 401 });
  await assert.rejects(h.api.verifySession(), /session has ended/);
  assert.equal(h.storage.size, 0); assert.deepEqual(h.events, ['w8lab-session-invalid']);
});
test('temporary server verification failure preserves credentials for retry', async () => {
  const h = harness({ ok: false, status: 503 });
  await assert.rejects(h.api.verifySession(), /retry/); assert.equal(h.storage.size, 1);
});
test('logout calls the server before removing the token', async () => {
  const h = harness({ ok: true, status: 200 }); await h.api.logout();
  assert.match(h.calls[0].url, /auth\/logout$/); assert.equal(h.calls[0].options.method, 'POST');
  assert.equal(h.storage.size, 0);
});
test('failed logout remains retryable and never falsely reports a completed logout', async () => {
  const h = harness({ ok: false, status: 503 });
  await assert.rejects(h.api.logout(), /retry/); assert.equal(h.storage.size, 1); assert.equal(h.events.length, 0);
});
test('offline logout retains the token for a confirmed server retry', async () => {
  const h = harness(new Error('offline')); await assert.rejects(h.api.logout(), /offline/); assert.equal(h.storage.size, 1);
});
test('already-invalid logout clears the unusable browser credential', async () => {
  const h = harness({ ok: false, status: 401 }); await h.api.logout(); assert.equal(h.storage.size, 0);
});
test('missing session does not send an authenticated request', async () => {
  const h = harness({}); h.storage.clear(); await assert.rejects(h.api.verifySession(), /sign in/); assert.equal(h.calls.length, 0);
});
