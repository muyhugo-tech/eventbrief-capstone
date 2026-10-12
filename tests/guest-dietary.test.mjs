import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { PROFILE_READINESS_POLICY } from '../lib/guest-dietary-policy.mjs';
import { pastedInput, createPackageWorkspace } from '../lib/package-workspace.mjs';
import { createApp } from '../server.mjs';

const awaiting = packageFixtures.get('patio-awaiting-dietary');
const complete = packageFixtures.get('patio-complete');
const guest = data => data.documents.find(d => d.id === 'guest');
function withoutHostMention() {
  const bundle = structuredClone(awaiting);
  bundle.input.messages[1].body = bundle.input.messages[1].body.replace('I will check dietary requirements and send those separately.', '').trim();
  return bundle;
}
function pasted(bundle, hostLabel = 'HOST') {
  const input = pastedInput(bundle.input.messages.map(m => `${m.role === 'customer' ? hostLabel : 'RESTAURANT'}:\n${m.body}`).join('\n\n'));
  const original = structuredClone(bundle.original);
  for (const detail of [...Object.values(original.fields), ...original.open_questions, ...original.pending_changes]) {
    for (const cite of detail.evidence) cite.message_id = 'pasted';
  }
  return { input, original, profile: bundle.profile };
}

test('silence and restaurant-only dietary questions do not block the guest plan', () => {
  const bundle = withoutHostMention();
  const restaurant = bundle.input.messages[2];
  bundle.original.open_questions.push({ field: 'dietary', question: 'Are there dietary needs?', evidence: [{ message_id: restaurant.id, quote: 'We still need your dietary reply before preparing the kitchen sheet and staff plan.' }] });
  for (const source of [bundle, pasted(bundle)]) {
    const data = prepareEventPackage(source);
    assert.equal(guest(data).state, 'ready_for_review');
    assert.equal(data.record.fields.dietary.value, null);
    assert.ok(!guest(data).dependencies.includes('dietary'));
    assert.deepEqual(data.documents.filter(d => d.state === 'blocked').map(d => d.id), ['kitchen', 'staff']);
  }
  const silent = withoutHostMention();
  silent.input.messages[2].body = silent.input.messages[2].body.replace('We still need your dietary reply before preparing the kitchen sheet and staff plan.', '').trim();
  assert.equal(guest(prepareEventPackage(silent)).state, 'ready_for_review');
});

test('host-raised missing details block for structured, pasted and named host messages', () => {
  for (const bundle of [awaiting, pasted(awaiting), pasted(awaiting, 'Customer'), pasted(awaiting, 'Alex Morgan'), pasted(awaiting, 'Host — Alex Morgan, October 20, 2027')]) {
    const data = prepareEventPackage(bundle);
    assert.equal(guest(data).state, 'blocked');
    assert.ok(guest(data).blockers.some(b => b.field === 'dietary'));
    assert.equal(data.documents.find(d => d.id === 'quote').quote.total_cents, 228000);
  }
});

test('internal notes do not trigger host dietary requirements, including inline speaker labels', () => {
  const bundle = pasted(withoutHostMention());
  bundle.input = pastedInput(bundle.input.messages[0].body + '\n\nHOST: Everything else stays as agreed.\n\nINTERNAL STAFF NOTE: Ask about allergies.');
  assert.equal(guest(prepareEventPackage(bundle)).state, 'ready_for_review');
});

test('resolved dietary details allow progress; outstanding questions and requests still block', () => {
  assert.equal(guest(prepareEventPackage(complete)).state, 'ready_for_review');
  const question = structuredClone(complete);
  question.original.open_questions.push({ field: 'dietary', question: 'Has everyone answered?', evidence: [{ message_id: 'm2', quote: 'I will check dietary requirements and send those separately.' }] });
  assert.equal(guest(prepareEventPackage(question)).state, 'blocked');
  const request = structuredClone(complete);
  request.original.fields.dietary.status = 'requested';
  assert.equal(guest(prepareEventPackage(request)).state, 'blocked');
  const correction = { dietary: { value: null, status: 'unknown', reason: 'The reply was not complete.' } };
  assert.equal(guest(prepareEventPackage({ ...complete, corrections: correction })).state, 'blocked');
  assert.deepEqual(guest(prepareEventPackage(complete)).rows.map(r => r.field), [...complete.profile.readiness.guest.required, 'guest_13_plus_count', 'child_count'], 'Guest handout adds the guest breakdown without exposing individual dietary details');
});

test('new guest readiness invalidates only the affected review; frozen scoring rules remain reproducible', () => {
  const before = prepareEventPackage({ ...awaiting, readinessPolicy: PROFILE_READINESS_POLICY });
  const after = prepareEventPackage(awaiting);
  assert.equal(guest(before).state, 'ready_for_review');
  assert.notEqual(guest(before).revision, guest(after).revision);
  for (const id of ['calendar', 'quote', 'kitchen', 'staff']) assert.equal(before.documents.find(d => d.id === id).revision, after.documents.find(d => d.id === id).revision);
  assert.deepEqual(after.original_record, awaiting.original);
  assert.deepEqual(after.profile, awaiting.profile);
});

test('saved review reload removes a formerly ready guest approval without an AI call', async t => {
  const workspace = await createPackageWorkspace(await mkdtemp(join(tmpdir(), 'eventbrief-guest-gate-')), awaiting.profile);
  const old = prepareEventPackage({ ...awaiting, readinessPolicy: PROFILE_READINESS_POLICY });
  const reviews = Object.fromEntries(old.documents.filter(d => d.state === 'ready_for_review').map(d => [d.id, { decision: 'reviewed', revision: d.revision, reviewed_at: new Date().toISOString() }]));
  await workspace.saveReview(old, reviews, 0);
  let calls = 0;
  const app = createApp({ packageWorkspace: workspace, packageTransport: async () => { calls++; throw new Error('No AI call allowed'); } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const url = `http://127.0.0.1:${app.address().port}`;
  const post = (path, body) => fetch(url + path, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const identity = { scenario_id: awaiting.input.id, run_id: null };
  const loaded = await post('/api/package/review/load', identity);
  assert.equal(loaded.status, 200);
  const result = await loaded.json();
  assert.deepEqual(Object.keys(result.saved.reviews).sort(), ['calendar', 'quote']);
  assert.equal(guest(result.data).state, 'blocked');
  const rejected = await post('/api/package/review', { ...identity, corrections: {}, reviews, sequence: 1 });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /fresh review/);
  assert.equal(calls, 0);
});
