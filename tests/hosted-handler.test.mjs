import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedFetch } from '../lib/hosted/handler.mjs';
import { demoInput, demoText, demoReply, demoRecord } from '../lib/package-demo.mjs';
import { replyInput } from '../lib/package-workspace.mjs';

const origin = 'https://eventbrief-test.example';
const env = {
  EVENTBRIEF_PUBLIC_ORIGIN: origin,
  EVENTBRIEF_ACCESS_CODE: 'fictional-access-code-for-local-tests',
  EVENTBRIEF_SESSION_SECRET: 'fictional-session-secret-for-local-tests-only',
  EVENTBRIEF_LIVE_ENABLED: 'true',
  EVENTBRIEF_OPENAI_API_KEY: 'fake-local-provider-key'
};

function memoryBlob() {
  const files = new Map();
  class BlobError extends Error {}
  return {
    files, BlobError,
    async put(path, body, options) {
      assert.equal(options.access, 'private');
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.addRandomSuffix, false);
      if (files.has(path)) throw new BlobError('Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.');
      files.set(path, Buffer.from(body));
      return { pathname: path };
    },
    async get(path, options) {
      assert.equal(options.access, 'private'); assert.equal(options.useCache, false);
      const value = files.get(path);
      return value === undefined ? null : { statusCode: 200, blob: { pathname: path, size: value.length }, stream: new Blob([value]).stream() };
    },
    async list({ prefix, cursor }) {
      const names = [...files.keys()].filter(name => name.startsWith(prefix)).sort();
      const offset = Number(cursor ?? 0), next = offset + 3;
      return { blobs: names.slice(offset, next).map(pathname => ({ pathname })), hasMore: next < names.length, cursor: String(next) };
    }
  };
}

function setup({ duringTransport } = {}) {
  const sdk = memoryBlob(); let calls = 0;
  const packageTransport = async ({ request, key }) => {
    calls++;
    if (duringTransport) await duringTransport();
    assert.equal(key, env.EVENTBRIEF_OPENAI_API_KEY);
    const { messages } = JSON.parse(request.input[0].content);
    const input = messages.length === 1 ? demoInput : replyInput(demoInput, demoReply);
    assert.deepEqual(messages, input.messages);
    return { ok: true, status: 200, body: JSON.stringify({ status: 'completed', model: request.model,
      usage: { input_tokens: 100, output_tokens: 100 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(demoRecord(input)) }] }] }) };
  };
  function visitor() {
    const jar = new Map();
    return {
      async request(path, body, options = {}) {
        const method = options.method ?? (body === undefined ? 'GET' : 'POST');
        const headers = new Headers({ ...(method === 'POST' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...options.headers });
        headers.set('Cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
        // A fresh handler on every request exercises cold-start persistence.
        const response = await createHostedFetch({ env, sdk, packageTransport })(new Request(origin + path, {
          method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
        }));
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(';')[0], index = pair.indexOf('=');
          const name = pair.slice(0, index), value = pair.slice(index + 1);
          if (cookie.includes('Max-Age=0')) jar.delete(name); else jar.set(name, value);
        }
        return { status: response.status, data: await response.json(), headers: response.headers };
      }
    };
  }
  return { sdk, visitor, calls: () => calls };
}

const readyIds = data => data.documents.filter(doc => doc.state === 'ready_for_review').map(doc => doc.id);
const marksFor = data => Object.fromEntries(data.documents.filter(doc => doc.state === 'ready_for_review').map(doc => [doc.id, {
  decision: 'reviewed', revision: doc.revision, reviewed_at: new Date().toISOString()
}]));

test('hosted public sample saves review progress across cold starts and reaches five drafts after the host reply', async () => {
  const system = setup(), client = system.visitor();
  const started = await client.request('/api/package/demo', {});
  assert.equal(started.status, 200); assert.equal(started.data.input.id, demoInput.id);
  assert.equal(started.data.input.messages[0].body, demoText);
  const first = await client.request('/api/package/prepare', { scenario_id: started.data.input.id, corrections: {} });
  assert.equal(first.status, 200); assert.deepEqual(readyIds(first.data), ['calendar', 'quote']);
  const identity = { scenario_id: started.data.input.id, run_id: null };
  const reviews = marksFor(first.data);
  const saved = await client.request('/api/package/review', { ...identity, corrections: {}, reviews, sequence: 0 });
  assert.equal(saved.status, 200); assert.equal(saved.data.saved.sequence, 1);
  const reopened = await client.request('/api/package/review/load', identity);
  assert.equal(reopened.status, 200); assert.deepEqual(reopened.data.saved.reviews, reviews);
  const listing = await client.request('/api/package/scenarios');
  assert.equal(listing.status, 200); assert.equal(listing.data.events.length, 1);
  assert.equal(listing.data.events[0].summary.reviewed_count, 2);
  assert.equal(listing.data.hosted.unlocked, false);
  assert.match(listing.data.demo.label, /authored results/);
  const reply = await client.request('/api/package/reply', { scenario_id: identity.scenario_id, text: demoReply, role: 'host' });
  assert.equal(reply.status, 200); assert.equal(reply.data.reference_available, true);
  assert.equal(reply.data.input.messages.length, 2);
  assert.deepEqual(reply.data.input.messages[0], started.data.input.messages[0]);
  const updatedIdentity = { scenario_id: reply.data.input.id, run_id: null };
  const updated = await client.request('/api/package/prepare', { scenario_id: updatedIdentity.scenario_id, corrections: {} });
  assert.equal(updated.status, 200); assert.equal(readyIds(updated.data).length, 5);
  assert.ok(updated.data.documents.every(doc => doc.revision !== first.data.documents.find(previous => previous.id === doc.id).revision));
  const freshReview = await client.request('/api/package/review/load', updatedIdentity);
  assert.equal(freshReview.status, 200); assert.equal(freshReview.data.saved, null);
  assert.equal(system.calls(), 0);
});

test('hosted access code gates the provider, visitor cookies isolate sources and receipts, and locking preserves saved work', async () => {
  const system = setup(), owner = system.visitor(), stranger = system.visitor();
  const sample = await owner.request('/api/package/demo', {}), scenarioId = sample.data.input.id;
  const locked = await owner.request('/api/package/analyze', { scenario_id: scenarioId });
  assert.equal(locked.status, 401); assert.equal(system.calls(), 0);
  const wrong = await owner.request('/api/hosted/unlock', { code: 'wrong-code' });
  assert.equal(wrong.status, 401); assert.equal(system.calls(), 0);
  const unlocked = await owner.request('/api/hosted/unlock', { code: env.EVENTBRIEF_ACCESS_CODE });
  assert.equal(unlocked.status, 200); assert.equal(unlocked.data.unlocked, true);
  const analyzed = await owner.request('/api/package/analyze', { scenario_id: scenarioId });
  assert.equal(analyzed.status, 200, JSON.stringify(analyzed.data)); assert.equal(system.calls(), 1);
  assert.equal(analyzed.data.extraction.mode, 'live');
  assert.deepEqual(readyIds(analyzed.data), ['calendar', 'quote']);
  const runId = analyzed.data.extraction.run_id;
  const receipt = await owner.request(`/api/package/attempts/${runId}`);
  assert.equal(receipt.status, 200); assert.equal(receipt.data.status, 'succeeded');
  const identity = { scenario_id: scenarioId, run_id: runId };
  const reviews = marksFor(analyzed.data);
  assert.equal((await owner.request('/api/package/review', { ...identity, corrections: {}, reviews, sequence: 0 })).status, 200);
  const strangersListing = await stranger.request('/api/package/scenarios');
  assert.equal(strangersListing.status, 200); assert.deepEqual(strangersListing.data.events, []);
  assert.deepEqual(strangersListing.data.history, []);
  assert.ok(!strangersListing.data.scenarios.some(source => source.id === scenarioId));
  assert.equal((await stranger.request(`/api/package/attempts/${runId}`)).status, 404);
  assert.equal((await stranger.request('/api/package/prepare', { scenario_id: scenarioId, run_id: runId, corrections: {} })).status, 400);
  assert.equal((await stranger.request('/api/package/review/load', identity)).status, 400);
  assert.equal((await stranger.request('/api/package/analyze', { scenario_id: scenarioId })).status, 401);
  assert.equal((await owner.request('/api/hosted/lock', {})).data.unlocked, false);
  const session = await owner.request('/api/hosted/session'); assert.equal(session.data.unlocked, false);
  const preserved = await owner.request('/api/package/scenarios');
  assert.equal(preserved.status, 200); assert.equal(preserved.data.events.length, 1);
  assert.equal(preserved.data.history[0].run_id, runId); assert.equal(preserved.data.events[0].summary.reviewed_count, 2);
  assert.equal((await owner.request(`/api/package/attempts/${runId}`)).status, 200);
  const reopened = await owner.request('/api/package/review/load', identity);
  assert.equal(reopened.status, 200); assert.deepEqual(reopened.data.saved.reviews, reviews);
  assert.equal((await owner.request('/api/package/analyze', { scenario_id: scenarioId })).status, 401);
  assert.equal(system.calls(), 1);
});

test('hosted handler rejects cross-site changes and non-allowlisted routes before touching saved data or the provider', async () => {
  const system = setup(), client = system.visitor();
  for (const headers of [{ Origin: 'https://unrelated.example' }, { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const result = await client.request('/api/package/demo', {}, { headers });
    assert.equal(result.status, 403);
  }
  for (const path of ['/api/analyze', '/api/package/update', '/api/package/attempts/../../secret', '/api?route=../secret']) {
    const result = await client.request(path, {});
    assert.equal(result.status, 404);
  }
  assert.equal(system.sdk.files.size, 0); assert.equal(system.calls(), 0);
  const routed = await client.request('/api/handler?route=package/demo', {});
  assert.equal(routed.status, 200); assert.equal(routed.data.input.id, demoInput.id);
  assert.equal(routed.headers.get('cache-control'), 'private, no-store');
  assert.equal(system.calls(), 0);
});

test('a reply from another request during AI preparation makes the completed original result superseded', async () => {
  let owner, appended;
  const system = setup({ duringTransport: async () => {
    appended = await owner.request('/api/package/reply', { scenario_id: demoInput.id, text: demoReply, role: 'host' });
    assert.equal(appended.status, 200);
  } });
  owner = system.visitor();
  assert.equal((await owner.request('/api/package/demo', {})).status, 200);
  assert.equal((await owner.request('/api/hosted/unlock', { code: env.EVENTBRIEF_ACCESS_CODE })).status, 200);
  const original = await owner.request('/api/package/analyze', { scenario_id: demoInput.id });
  assert.equal(original.status, 200, JSON.stringify(original.data));
  assert.equal(system.calls(), 1);
  assert.equal(original.data.version.superseded, true);
  assert.equal(original.data.version.current_scenario_id, appended.data.input.id);
  const listing = await owner.request('/api/package/scenarios');
  assert.equal(listing.data.events[0].current_scenario_id, appended.data.input.id);
  assert.equal(listing.data.history[0].superseded, true);
  const staleReview = await owner.request('/api/package/review', {
    scenario_id: demoInput.id, run_id: original.data.extraction.run_id,
    corrections: {}, reviews: marksFor(original.data), sequence: 0
  });
  assert.equal(staleReview.status, 409);
  const current = await owner.request('/api/package/prepare', { scenario_id: appended.data.input.id, corrections: {} });
  assert.equal(current.status, 200); assert.equal(readyIds(current.data).length, 5);
  assert.equal(current.data.version.superseded, false);
});
