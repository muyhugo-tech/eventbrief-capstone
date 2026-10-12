import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createAttemptStore } from '../lib/attempt-store.mjs';
import { buildPackageRequest, capturePackageAttempt, responsesTransport } from '../lib/package-provider.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { PACKAGE_MODEL_VERSION, packageOutputSchema, validatePackageRecord } from '../lib/package-contract.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { standaloneDocument } from '../public/package-render.mjs';
import { createApp } from '../server.mjs';

const bundle = packageFixtures.get('patio-complete');
const modelOutput = () => ({ ...structuredClone(bundle.original), schema_version: PACKAGE_MODEL_VERSION, pending_changes: [], open_questions: [] });
const envelope = output => ({ id: 'resp_fake', model: 'fake-model', status: 'completed', usage: { input_tokens: 123, output_tokens: 456 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
const reply = (body = envelope(modelOutput()), status = 200) => ({ ok: status >= 200 && status < 300, status, body: typeof body === 'string' ? body : JSON.stringify(body), request_id: 'req_fake' });
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'eventbrief-attempt-test-'));
  return { directory, store: createAttemptStore(directory) };
}
const attempt = (store, overrides = {}) => capturePackageAttempt({ input: bundle.input, profile: bundle.profile, prompt: 'Extract the supplied event.', model: 'fake-model', key: 'fake-credential-not-for-network', store, transport: async () => reply(), mode: 'simulated', ...overrides });

test('expanded request sends messages, vocabulary and strict schema, never expected answers or prices', () => {
  const request = buildPackageRequest({ ...bundle.input, expected: 'FORBIDDEN_REFERENCE' }, bundle.profile, 'Extract.', 'chosen-model');
  const content = JSON.parse(request.input[0].content);
  assert.deepEqual(content.messages, bundle.input.messages);
  assert.deepEqual(Object.keys(content).sort(), ['messages', 'vocabulary']);
  assert.ok(!JSON.stringify(request).includes('FORBIDDEN_REFERENCE'));
  assert.ok(!JSON.stringify(content).includes('prices_cents'));
  assert.equal(request.model, 'chosen-model');
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema, packageOutputSchema);
  assert.equal(request.max_output_tokens, 10000);
});

test('v3 preserves an agreed date with a distinct pending request and blocks only dependent drafts', () => {
  const input = structuredClone(bundle.input);
  input.messages.push({ id: 'm5', body: 'Could we move to November 21, 2027 instead? Is that date available?' });
  const output = modelOutput();
  output.pending_changes.push({ field: 'event_date', value: '2027-11-21', status: 'requested', evidence: [{ message_id: 'm5', quote: 'Could we move to November 21, 2027 instead?' }] });
  output.open_questions.push({ field: 'event_date', question: 'Is the requested new date available?', evidence: [{ message_id: 'm5', quote: 'Is that date available?' }] });
  validatePackageRecord(output, input);
  const prepared = prepareEventPackage({ input, profile: bundle.profile, original: output });
  assert.equal(prepared.record.fields.event_date.value, '2027-11-14');
  assert.equal(prepared.unresolved.length, 2);
  assert.deepEqual(prepared.documents.filter(doc => doc.state === 'blocked').map(doc => doc.id), ['calendar', 'kitchen', 'staff', 'guest']);
  assert.equal(prepared.documents.find(doc => doc.id === 'quote').quote.total_cents, 228000);
  const changed = structuredClone(output);
  changed.pending_changes[0].evidence[0].quote = 'invented quote';
  assert.throws(() => validatePackageRecord(changed, input), /quotation/);
  const corrected = prepareEventPackage({ input, profile: bundle.profile, original: output, corrections: { event_date: { value: '2027-11-21', status: 'agreed', reason: 'Test correction' } } });
  assert.equal(corrected.documents[0].state, 'blocked', 'A field correction cannot silently dismiss an outstanding source issue');
});

test('expanded schema rejects unknown fields, wrong pending types, fabricated questions, and extras', () => {
  for (const mutation of [
    output => { output.pending_changes = [{ field: 'absent', value: 'x', status: 'requested', evidence: [] }]; },
    output => { output.open_questions = [{ field: 'dietary', question: 'Needs?', evidence: [{ message_id: 'm4', quote: 'invented' }] }]; },
    output => { output.pending_changes = [{ field: 'guest_count', value: '30', status: 'requested', evidence: bundle.original.fields.guest_count.evidence }]; },
    output => { output.extra = true; },
    output => { delete output.open_questions; }
  ]) { const output = modelOutput(); mutation(output); assert.throws(() => validatePackageRecord(output, bundle.input)); }
});

test('completed attempt is saved before dispatch and retains actual output, usage, configuration and code hashes', async () => {
  const { directory, store } = await setup();
  const output = modelOutput();
  output.fields.host_name.value = 'Alex';
  let calls = 0;
  const result = await attempt(store, { transport: async () => {
    calls++;
    const ids = await readdir(directory);
    const started = await store.read(ids[0]);
    assert.equal(started.status, 'started');
    assert.equal(started.request.model, 'fake-model');
    return reply(envelope(output));
  } });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.output.fields.host_name.value, 'Alex');
  const receipt = await store.read(result.run_id);
  assert.equal(receipt.status, 'succeeded');
  assert.equal(receipt.purpose, 'fake_provider_test');
  assert.deepEqual(receipt.parsed_output, output);
  assert.equal(receipt.meta.usage.input_tokens, 123);
  assert.equal(receipt.meta.model, 'fake-model');
  assert.equal(receipt.meta.requested_model, 'fake-model');
  assert.ok(receipt.meta.latency_ms >= 0);
  assert.equal(receipt.automatic_retries, 0);
  assert.ok(receipt.implementation['package-provider.mjs']);
  assert.equal(receipt.request_hash.length, 64);
  assert.equal(receipt.raw_response, JSON.stringify(envelope(output)));
  assert.ok(!JSON.stringify(receipt).includes('fake-credential-not-for-network'));
  await assert.rejects(store.finish(result.run_id, {}), /EEXIST/);
  assert.deepEqual(await createAttemptStore(directory).read(result.run_id), receipt, 'Receipt survives store restart');
  await assert.rejects(store.read('../../.env.local'), /Invalid attempt/);
});

test('incomplete, refused, malformed, invalid and HTTP-error responses are retained without retries or authored fallbacks', async t => {
  const invalid = modelOutput(); invalid.fields.venue.evidence[0].quote = 'Fabricated source';
  for (const [name, response, code] of [
    ['incomplete', reply({ ...envelope(modelOutput()), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), 'incomplete'],
    ['refusal', reply({ ...envelope(modelOutput()), output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Synthetic refusal' }] }] }), 'refusal'],
    ['response JSON', reply('not JSON'), 'response_json'],
    ['output JSON', reply({ ...envelope(modelOutput()), output: [{ type: 'message', content: [{ type: 'output_text', text: '{broken' }] }] }), 'output_json'],
    ['source mismatch', reply(envelope(invalid)), 'invalid_output'],
    ['old contract', reply(envelope({ ...modelOutput(), schema_version: 'eventbrief.package-record.v2' })), 'invalid_output'],
    ['HTTP error', reply('upstream failure', 429), 'http_error']
  ]) await t.test(name, async () => {
    const { store } = await setup(); let calls = 0;
    const result = await attempt(store, { transport: async () => { calls++; return response; } });
    assert.equal(result.ok, false); assert.equal(calls, 1); assert.equal(result.status, code);
    assert.equal(result.receipt_saved, true); assert.ok(!Object.hasOwn(result, 'output'));
    const receipt = await store.read(result.run_id);
    assert.equal(receipt.status, 'failed'); assert.equal(receipt.raw_response, response.body); assert.equal(receipt.error.code, code);
    if (code === 'invalid_output') assert.ok(receipt.parsed_output, 'Rejected output remains available to a future scorer');
  });
});

test('transport failure preserves an unknown-outcome receipt without persisting exception credentials', async () => {
  const { store } = await setup(); let calls = 0;
  const result = await attempt(store, { transport: async () => { calls++; throw new Error('fake-credential-not-for-network'); } });
  const receipt = await store.read(result.run_id);
  assert.equal(calls, 1); assert.equal(receipt.status, 'failed'); assert.equal(receipt.raw_response, null);
  assert.equal(receipt.meta.usage, null); assert.equal(receipt.error.code, 'transport_error');
  assert.match(result.error, /billing outcome may be unknown/);
  assert.ok(!JSON.stringify(receipt).includes('fake-credential-not-for-network'));
});

test('credential echoed by an HTTP error is redacted explicitly in the retained body', async () => {
  const { store } = await setup();
  const result = await attempt(store, { transport: async () => reply({ error: 'Invalid key fake-credential-not-for-network' }, 401) });
  const receipt = await store.read(result.run_id);
  assert.equal(receipt.credential_redacted, true);
  assert.match(receipt.raw_response, /REDACTED_CREDENTIAL/);
  assert.ok(!JSON.stringify(receipt).includes('fake-credential-not-for-network'));
});

test('storage failures stop dispatch or withhold success while preserving the started attempt', async () => {
  let calls = 0;
  const before = await attempt({ begin: async () => { throw new Error('disk'); } }, { transport: async () => { calls++; return reply(); } });
  assert.equal(calls, 0); assert.equal(before.dispatched, false);
  const { store } = await setup();
  const after = await attempt({ ...store, finish: async () => { throw new Error('disk'); } });
  assert.equal(after.ok, false); assert.equal(after.dispatched, true); assert.equal(after.receipt_saved, false);
  assert.equal((await store.read(after.run_id)).status, 'started');
});

test('transport uses only Responses endpoint, server-side authorization, and a bounded request', async () => {
  let captured;
  const request = buildPackageRequest(bundle.input, bundle.profile, 'Extract', 'fake-model');
  const response = await responsesTransport({ request, key: 'fake-key', fetcher: async (url, options) => {
    captured = { url, ...options };
    return new Response(JSON.stringify(envelope(modelOutput())), { status: 200, headers: { 'x-request-id': 'req_fixture' } });
  } });
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.headers.Authorization, 'Bearer fake-key');
  assert.equal(captured.signal.aborted, false);
  assert.deepEqual(JSON.parse(captured.body), request); assert.equal(response.request_id, 'req_fixture');
});

async function serve(t, options = {}) {
  const { store, directory } = await setup();
  const app = createApp({ enabled: true, key: 'fake-credential-not-for-network', model: 'fake-model', packageTransport: async () => reply(), packageStore: store, packageRunMode: 'simulated', ...options });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const url = `http://127.0.0.1:${app.address().port}`;
  return { url, store, directory, post: (path, body, origin = url) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) }) };
}

test('package HTTP uses captured model output; corrections reuse its receipt without another provider call', async t => {
  let calls = 0;
  const output = modelOutput(); output.fields.host_name.value = 'Alex';
  const { url, post } = await serve(t, { packageTransport: async () => { calls++; return reply(envelope(output)); } });
  const response = await post('/api/package/analyze', { scenario_id: bundle.input.id });
  assert.equal(response.status, 200);
  const prepared = await response.json();
  assert.equal(prepared.mode, 'simulated'); assert.equal(prepared.original_record.fields.host_name.value, 'Alex');
  assert.equal(prepared.extraction.meta.provider, 'Fake provider');
  const receipt = await (await fetch(`${url}/api/package/attempts/${prepared.extraction.run_id}`)).json();
  assert.deepEqual(receipt.parsed_output, prepared.original_record);
  const changed = await (await post('/api/package/prepare', { scenario_id: bundle.input.id, run_id: receipt.run_id, corrections: { guest_count: { value: 31, status: 'agreed', reason: 'Synthetic review correction' } } })).json();
  assert.equal(changed.original_record.fields.guest_count.value, 30); assert.equal(changed.record.fields.guest_count.value, 31);
  assert.equal(changed.mode, 'simulated'); assert.equal(calls, 1);
  assert.notEqual(changed.documents.find(doc => doc.id === 'quote').revision, prepared.documents.find(doc => doc.id === 'quote').revision);
  assert.equal((await post('/api/package/prepare', { scenario_id: 'patio-awaiting-dietary', run_id: receipt.run_id, corrections: {} })).status, 409);
  const exported = standaloneDocument(prepared.documents[0], prepared, false);
  assert.match(exported, /Simulated provider/); assert.ok(!exported.includes('Authored example'));
});

test('failed package attempts count against the shared cap, are downloadable, and cannot be rebuilt as success', async t => {
  const { post, url } = await serve(t, { maxCalls: 1, packageTransport: async () => reply('unreadable') });
  const response = await post('/api/package/analyze', { scenario_id: bundle.input.id });
  assert.equal(response.status, 502);
  const error = await response.json(); assert.equal(error.remaining, 0); assert.equal(error.receipt_saved, true);
  assert.equal((await (await fetch(`${url}/api/package/attempts/${error.run_id}`)).json()).status, 'failed');
  assert.equal((await post('/api/package/prepare', { scenario_id: bundle.input.id, run_id: error.run_id, corrections: {} })).status, 409);
  assert.equal((await post('/api/package/analyze', { scenario_id: bundle.input.id })).status, 429);
  assert.equal((await post('/api/analyze', { scenario_id: '01-new-inquiry' })).status, 429);
});

test('disabled, arbitrary-input and cross-origin requests make no package model call', async t => {
  let calls = 0;
  const { post, url } = await serve(t, { enabled: false, packageTransport: async () => { calls++; return reply(); } });
  assert.equal((await post('/api/package/analyze', { scenario_id: bundle.input.id })).status, 503);
  assert.equal((await post('/api/package/analyze', { scenario_id: bundle.input.id }, 'https://example.com')).status, 403);
  assert.equal((await post('/api/package/analyze', { scenario_id: bundle.input.id, messages: [] })).status, 400);
  assert.equal((await fetch(`${url}/api/package/attempts/../../.env.local`)).status, 404);
  assert.equal(calls, 0);
});

test('package and legacy requests share the concurrent-call guard', async t => {
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const signal = new Promise(resolve => { started = resolve; });
  const { post } = await serve(t, { packageTransport: async () => { started(); await gate; return reply(); } });
  const first = post('/api/package/analyze', { scenario_id: bundle.input.id });
  await signal;
  assert.equal((await post('/api/package/analyze', { scenario_id: bundle.input.id })).status, 429);
  assert.equal((await post('/api/analyze', { scenario_id: '01-new-inquiry' })).status, 429);
  release(); assert.equal((await first).status, 200);
});
