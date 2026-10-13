import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { FIELD_DEFINITIONS, validatePackageRecord } from '../lib/package-contract.mjs';
import { prepareEventPackage, validateRestaurant } from '../lib/event-package.mjs';
import { renderDocument, standaloneDocument } from '../public/package-render.mjs';
import { createApp } from '../server.mjs';

const complete = packageFixtures.get('patio-complete');
const awaiting = packageFixtures.get('patio-awaiting-dietary');
const prepare = corrections => prepareEventPackage({ ...complete, corrections });
const correction = (value, status = 'stated') => ({ value, status, reason: 'Authored QA correction; not user feedback.' });
const doc = (prepared, id) => prepared.documents.find(item => item.id === id);

test('two fictional thread snapshots have a separate authored 18-field record with exact evidence', () => {
  assert.equal(Object.keys(FIELD_DEFINITIONS).length, 18);
  assert.equal(packageFixtures.size, 2);
  for (const bundle of packageFixtures.values()) {
    validatePackageRecord(bundle.original, bundle.input);
    assert.equal(bundle.input.synthetic, true);
    assert.ok(!Object.hasOwn(bundle.input, 'fields'));
    assert.ok(!Object.hasOwn(bundle.input, 'expected'));
    assert.ok(bundle.input.messages.every(message => message.sender && message.recipient && message.subject));
  }
});

test('complete authored snapshot produces five ready drafts and a hand-calculated $2,280 quote', () => {
  const prepared = prepare();
  assert.equal(prepared.mode, 'authored_reference');
  assert.deepEqual(prepared.documents.map(item => item.state), Array(5).fill('ready_for_review'));
  const quote = doc(prepared, 'quote').quote;
  assert.deepEqual(quote.lines.map(line => [line.quantity, line.unit_cents, line.amount_cents]), [[30, 5800, 174000], [30, 1800, 54000]]);
  assert.equal(quote.total_cents, 228000);
  assert.ok(quote.lines.every(line => line.source_fields.length === 2 && line.rule && line.calculation));
  assert.deepEqual(doc(prepared, 'kitchen').menu_courses, complete.profile.menus['Menu 2'].courses);
});

test('the host’s missing dietary reply blocks kitchen, staff and guest drafts without inventing no restrictions', () => {
  const prepared = prepareEventPackage(awaiting);
  assert.equal(prepared.record.fields.dietary.value, null);
  assert.deepEqual(prepared.documents.filter(item => item.state === 'blocked').map(item => item.id), ['kitchen', 'staff', 'guest']);
  for (const id of ['kitchen', 'staff', 'guest']) {
    const item = doc(prepared, id);
    assert.deepEqual(item.rows, []);
    assert.deepEqual(item.menu_courses, []);
    assert.equal(item.quote, null);
    assert.match(item.blockers[0].reason, /Dietary requirements: not supplied/);
    const html = renderDocument(item, prepared);
    assert.match(html, /This draft is blocked/);
    assert.ok(!html.includes('No allergies or dietary restrictions'));
  }
});

test('Guests and Children (0–12) keep mixed-party pricing and exports consistent', () => {
  const prepared = prepare({ guest_13_plus_count: correction(22), child_count: correction(8) });
  const quote = doc(prepared, 'quote');
  assert.equal(quote.state, 'ready_for_review');
  assert.deepEqual(quote.quote.lines.map(line => [line.quantity, line.unit_cents, line.amount_cents]), [
    [22, 5800, 127600], [8, 2200, 17600], [22, 1800, 39600], [8, 600, 4800]
  ]);
  assert.equal(quote.quote.total_cents, 189600);
  const html = standaloneDocument(quote, prepared, false);
  assert.match(html, />Guests</);
  assert.doesNotMatch(html, /\(13\+\)/);
  assert.match(html, /Children \(0–12\)/);
  assert.match(html, /\$1,896\.00/);
  assert.doesNotMatch(html, /Adults \(21\+\)|Young guests/);
  for (const id of ['quote', 'staff', 'guest']) {
    assert.match(standaloneDocument(doc(prepared, id), prepared, false), /only for guests confirmed to be 21 or older/);
  }
  assert.equal(complete.original.fields.guest_13_plus_count.value, 30);
  assert.equal(complete.original.fields.child_count.value, 0);
});

test('quote requires explicit pricing categories, never infers age-group counts from total attendance', () => {
  const prepared = prepare({ guest_13_plus_count: correction(null, 'unknown') });
  assert.equal(doc(prepared, 'quote').state, 'blocked');
  assert.equal(doc(prepared, 'quote').quote, null);
  assert.equal(doc(prepared, 'calendar').state, 'ready_for_review');
  assert.equal(doc(prepared, 'kitchen').state, 'ready_for_review');
  assert.ok(!renderDocument(doc(prepared, 'quote'), prepared).includes('$2,280'));
});

test('a draft quote can precede a confirmed booking and agreements are checked per output', () => {
  const prepared = prepare({ booking_status: correction('Inquiry only'), menu: correction('Menu 2', 'requested') });
  assert.equal(doc(prepared, 'quote').state, 'ready_for_review');
  assert.equal(doc(prepared, 'quote').quote.total_cents, 228000);
  assert.equal(doc(prepared, 'kitchen').state, 'blocked');
  assert.equal(doc(prepared, 'staff').state, 'blocked');
  assert.equal(doc(prepared, 'guest').state, 'blocked');
});

test('counts must reconcile and capacity violations block affected documents', () => {
  const inconsistent = prepare({ guest_count: correction(31, 'agreed') });
  assert.match(doc(inconsistent, 'quote').blockers.map(item => item.reason).join(' '), /categories total 30, but attendance is 31/);
  assert.equal(doc(inconsistent, 'calendar').state, 'ready_for_review');
  const overCapacity = prepare({ guest_count: correction(41, 'agreed'), guest_13_plus_count: correction(41) });
  assert.equal(doc(overCapacity, 'calendar').state, 'blocked');
  assert.equal(doc(overCapacity, 'staff').state, 'blocked');
  assert.match(doc(overCapacity, 'quote').blockers[0].reason, /capacity of 40/);
});

test('policy exceptions, unrecognized choices, conflicting values, and unsupported times block affected drafts', () => {
  for (const corrections of [
    { dietary: correction('Severe nut allergy') },
    { av: correction('Outdoor amplified concert') },
    { setup: correction('Unknown setup', 'agreed') },
    { special: correction('Unspecified special equipment') },
    { timezone: correction('Europe/Paris', 'agreed') },
    { end_time: correction('17:30', 'agreed') },
    { start_time: correction('16:00', 'agreed') },
    { venue: correction('constructor', 'agreed') },
    { menu: correction('Unknown menu', 'agreed') },
    { beverage: correction('Unknown bar', 'agreed') },
    { venue: correction(null, 'conflicting') }
  ]) assert.equal(doc(prepare(corrections), 'staff').state, 'blocked');
});

test('corrections keep original evidence immutable and only dependent document revisions change', () => {
  const originalBytes = JSON.stringify(complete.original);
  const before = prepare();
  const after = prepare({ av: correction('Sound system requested') });
  assert.equal(JSON.stringify(complete.original), originalBytes);
  assert.deepEqual(after.original_record, complete.original);
  assert.deepEqual(after.record.fields.av.evidence, []);
  assert.equal(after.record.fields.av.provenance, 'coordinator_correction');
  assert.notEqual(doc(before, 'staff').revision, doc(after, 'staff').revision);
  assert.equal(doc(before, 'quote').revision, doc(after, 'quote').revision);
  assert.notEqual(before.record_revision, after.record_revision);
  assert.deepEqual(prepare(), before, 'Same inputs produce the same package bytes');
});

test('source and policy changes invalidate document revisions even when displayed values remain the same', () => {
  const before = prepare();
  const sourceChanged = structuredClone(complete);
  sourceChanged.input.messages[0].body += ' Extra fictional source context.';
  const sourceAfter = prepareEventPackage(sourceChanged);
  assert.notEqual(doc(before, 'quote').revision, doc(sourceAfter, 'quote').revision);
  const policyChanged = structuredClone(complete);
  policyChanged.profile.version = 'fictional-v4';
  policyChanged.profile.menus['Menu 2'].prices_cents.guest_13_plus_count = 5900;
  const policyAfter = prepareEventPackage(policyChanged);
  assert.notEqual(doc(before, 'quote').revision, doc(policyAfter, 'quote').revision);
  assert.equal(doc(policyAfter, 'quote').quote.total_cents, 231000);
});

test('audience-specific HTML exports preserve draft labels and exclude internal staff notes and full messages', () => {
  const prepared = prepare();
  const guest = standaloneDocument(doc(prepared, 'guest'), prepared, false);
  assert.match(guest, /Draft · not reviewed/);
  assert.match(guest, /Authored example · no AI call/);
  assert.ok(!guest.includes('Riley will lead the event handover'));
  assert.ok(!guest.includes('riley@linden-fig.example'));
  assert.match(guest, /Arrive at the garden entrance/);
  assert.ok(!guest.includes('<script'));
  const staff = standaloneDocument(doc(prepared, 'staff'), prepared, true);
  assert.match(staff, /Riley will lead the event handover/);
  assert.match(staff, /Reviewed draft/);
  assert.match(staff, /Internal staff copy/);
});

test('untrusted text is escaped in rendered and downloaded drafts', () => {
  const prepared = prepare({ host_name: correction('<img src=x onerror=alert(1)>') });
  const html = standaloneDocument(doc(prepared, 'guest'), prepared, false);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.ok(!html.includes('<img'));
});

test('invalid correction values, fabricated evidence, and malformed fictional prices are rejected', () => {
  for (const corrections of [
    { guest_count: correction(0) },
    { guest_13_plus_count: correction('30') },
    { guest_count: correction(2.5) },
    { event_date: correction('2027-02-30') },
    { start_time: correction('25:00') },
    { menu: { value: 'Menu 2', status: 'agreed', reason: '' } },
    { fake_field: correction('bad') },
    { menu: { ...correction('Menu 2'), evidence: [] } },
    { menu: correction('Menu 2', 'unknown') }
  ]) assert.throws(() => prepare(corrections));
  const bad = structuredClone(complete);
  bad.original.fields.host_name.evidence[0].quote = 'Fabricated source.';
  assert.throws(() => prepareEventPackage(bad), /quotation does not match/);
  const profile = structuredClone(complete.profile);
  profile.menus['Menu 2'].prices_cents.guest_13_plus_count = 58.5;
  assert.throws(() => validateRestaurant(profile), /integer cents/);
});

test('package HTTP flow serves all five authored drafts, accepts corrections, and never invokes the model', async t => {
  let calls = 0;
  const app = createApp({ enabled: true, key: 'fake', provider: async () => { calls++; throw new Error('Must not run'); } });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const url = `http://127.0.0.1:${app.address().port}`;
  const post = (body, origin = url) => fetch(`${url}/api/package/prepare`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const html = await fetch(`${url}/package`);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Prepare five drafts/);
  for (const path of ['/package.js', '/package.css', '/package-render.mjs', '/package-contract.mjs']) assert.equal((await fetch(url + path)).status, 200);
  const scenarios = await (await fetch(`${url}/api/package/scenarios`)).json();
  assert.equal(scenarios.scenarios.length, 2);
  assert.ok(!JSON.stringify(scenarios).includes('original_record'));
  const response = await post({ scenario_id: 'patio-complete', corrections: {} });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).documents.length, 5);
  const changed = await post({ scenario_id: 'patio-complete', corrections: { dietary: correction(null, 'unknown') } });
  assert.deepEqual((await changed.json()).documents.filter(item => item.state === 'blocked').map(item => item.id), ['kitchen', 'staff', 'guest']);
  assert.equal((await post({ scenario_id: 'patio-complete', corrections: {} }, 'https://example.com')).status, 403);
  assert.equal((await post({ scenario_id: 'absent', corrections: {} })).status, 400);
  assert.equal((await post({ scenario_id: 'patio-complete', corrections: {}, messages: [] })).status, 400);
  assert.equal((await post({ scenario_id: 'patio-complete', corrections: { guest_count: correction(0) } })).status, 400);
  assert.equal((await fetch(`${url}/fixtures/package/restaurant-v2.json`)).status, 404);
  assert.equal(calls, 0);
});
