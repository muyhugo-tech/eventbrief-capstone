import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { referenceOutput, validateOutput } from '../lib/contract.mjs';
import { analyze, buildRequest } from '../lib/provider.mjs';

const input = JSON.parse(await readFile(new URL('../fixtures/inputs/03-pending-date.json', import.meta.url), 'utf8'));
const expected = JSON.parse(await readFile(new URL('../fixtures/expected/03-pending-date.json', import.meta.url), 'utf8'));
const output = referenceOutput(expected);
async function server(t, options) {
  const app = createApp(options);
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const url = `http://127.0.0.1:${app.address().port}`;
  return { url, post: (body = { scenario_id: input.id }, origin = url) => fetch(`${url}/api/analyze`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}
test('reference contract preserves an agreed date and distinct pending request', () => {
  validateOutput(output, input);
  assert.equal(output.fields.event_date.value, '2027-06-12');
  assert.equal(output.pending_changes[0].value, '2027-06-19');
  assert.deepEqual(output.open_questions.map(q => q.topic), ['date_change_availability']);
});
test('fabricated quotes, non-existent messages, unexpected fields, and invalid calendar dates are rejected', () => {
  for (const mutate of [
    x => { x.fields.venue.evidence[0].quote = 'This was never written.'; },
    x => { x.fields.venue.evidence[0].message_id = 'absent'; },
    x => { x.booking_status = 'confirmed'; },
    x => { x.fields.event_date.value = '2027-02-30'; },
    x => { x.fields.guest_count.value = 3.5; }
  ]) { const changed = structuredClone(output); mutate(changed); assert.throws(() => validateOutput(changed, input)); }
});
test('request includes messages and schema but no reference answers or rationale', () => {
  const request = buildRequest(input, 'Extract the brief.', 'test-model');
  assert.deepEqual(JSON.parse(request.input[0].content), { messages: input.messages });
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.ok(!JSON.stringify(request).includes(expected.rationale));
});
test('provider parses completed output and retains usage without exposing key', async () => {
  let captured;
  const result = await analyze({ input, prompt: 'Extract.', model: 'test', key: 'test-secret', fetcher: async (_url, options) => {
    captured = options;
    return { ok: true, json: async () => ({ id: 'fake-response', model: 'test', status: 'completed', usage: { input_tokens: 100, output_tokens: 50 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }) };
  } });
  assert.equal(captured.headers.Authorization, 'Bearer test-secret');
  assert.deepEqual(result.output, output);
  assert.equal(result.meta.usage.input_tokens, 100);
  assert.ok(!JSON.stringify(result).includes('test-secret'));
});
test('incomplete output is rejected and no retry is made', async () => {
  let calls = 0;
  await assert.rejects(analyze({ input, prompt: '', model: 'test', key: 'test', fetcher: async () => { calls++; return { ok: true, json: async () => ({ status: 'incomplete' }) }; } }), /incomplete/);
  assert.equal(calls, 1);
});
test('reference app serves examples and blocks filesystem paths and unconfigured live calls', async t => {
  const { url, post } = await server(t);
  const html = await fetch(url);
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const scenarios = await (await fetch(`${url}/api/scenarios`)).json();
  assert.equal(scenarios.scenarios.length, 3);
  assert.equal(scenarios.live.ready, false);
  const reference = await (await fetch(`${url}/api/reference/${input.id}`)).json();
  assert.equal(reference.mode, 'reference');
  assert.deepEqual(reference.output, output);
  for (const path of ['/.env.local', '/server.mjs', '/fixtures/expected/03-pending-date.json', '/..%2F.env']) assert.equal((await fetch(`${url}${path}`)).status, 404);
  assert.equal((await post()).status, 503);
});
test('cross-origin and arbitrary-text requests cannot invoke a configured provider', async t => {
  let calls = 0;
  const { post } = await server(t, { enabled: true, key: 'test', provider: async () => { calls++; return { output, meta: {} }; } });
  assert.equal((await post(undefined, 'https://example.com')).status, 403);
  assert.equal((await post({ scenario_id: input.id, body: 'private text' })).status, 400);
  assert.equal(calls, 0);
});
test('session cap counts failures and never automatically retries', async t => {
  let calls = 0;
  const { post } = await server(t, { enabled: true, key: 'test', maxCalls: 1, provider: async () => { calls++; throw new Error('Simulated uncertain failure.'); } });
  assert.equal((await post()).status, 502);
  assert.equal((await post()).status, 429);
  assert.equal(calls, 1);
});
test('concurrent requests share one in-flight guard', async t => {
  let release;
  let started;
  const start = new Promise(r => { started = r; });
  const wait = new Promise(r => { release = r; });
  const { post } = await server(t, { enabled: true, key: 'test', maxCalls: 3, provider: async () => { started(); await wait; return { output, meta: { model: 'fake' } }; } });
  const first = post();
  await start;
  const second = await post();
  assert.equal(second.status, 429);
  release();
  const response = await first;
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, 'live');
  assert.equal(body.remaining, 2);
});
