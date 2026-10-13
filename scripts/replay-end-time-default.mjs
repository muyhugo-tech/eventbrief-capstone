// Replay the saved Alex answer. No provider, API key or paid request.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {prepareEventPackage, fingerprint} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {applyRestaurantSettings, settingsFromProfile} from '../lib/restaurant-settings.mjs';
import {rehearsalExample} from '../public/restaurant-example.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
import {calendarFile} from '../public/workspace-calendar.mjs';

const root = new URL('../', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const saved = await read('evaluation/new-event-v3/results/2026-10-12.json');
const protocol = await read('evaluation/new-event-v3/protocol.json');
const baseline = await read('fixtures/package/restaurant-v2.json');
const profile = applyRestaurantSettings(baseline, rehearsalExample(settingsFromProfile(baseline)));
const data = prepareEventPackage({input:pastedInput(protocol.conversation), original:saved.original_output, profile, baselineProfile:baseline});
assert.deepEqual(data.original_record, saved.original_output);
assert.deepEqual(data.corrections, {});
assert.equal(data.original_record.fields.end_time.value, null);
assert.equal(data.record.fields.end_time.value, '21:30');
assert.equal(data.record.fields.end_time.preparation.kind, 'default_duration');
assert.equal(data.record.fields.guest_13_plus_count.value, 46);
assert.equal(data.record.fields.child_count.value, null);
const documents = data.documents.map(document => {
  assert.equal(document.state, 'ready_for_review');
  const html = standaloneDocument(document, data, false);
  assert.match(html, /4 hours after/);
  assert.doesNotMatch(html, /undefined|NaN|0 children/);
  return {id:document.id, state:document.state, notices:document.notices};
});
const ics = calendarFile(data.documents.find(d => d.id === 'calendar'), data).replace(/\r\n /g, '');
assert.match(ics, /DTSTART:20261017T003000Z/);
assert.match(ics, /DTEND:20261017T043000Z/);
assert.match(ics, /4 hours after/);
assert.equal(data.documents.find(d => d.id === 'quote').quote.total_cents, 294400);
const result = {
  schema_version:'eventbrief.end-time-replay.v1', source:'evaluation/new-event-v3/results/2026-10-12.json',
  original_output_sha256:fingerprint(saved.original_output), workflow_policy:data.workflow_policy,
  new_ai_calls:0, added_ai_cost_usd:0, manual_corrections:0, original_receipt_preserved:true,
  guests:46, children:null, timezone:data.record.fields.timezone.value,
  start_time:'17:30', end_time:'21:30', default_duration_hours:4, ready_documents:5, documents,
  limitation:'Saved-answer regression with configured fictional restaurant settings and the user-authorized four-hour default; not an unseen AI test. Child count and Menu 3 prep quantities still need confirmation.'
};
const destination = new URL('evaluation/end-time-default-v1/results/2026-10-13.json', root);
if (process.argv.includes('--record')) {
  await mkdir(new URL('.', destination), {recursive:true});
  await writeFile(destination, JSON.stringify(result, null, 2) + '\n', {flag:'wx'});
} else assert.deepEqual(result, JSON.parse(await readFile(destination, 'utf8')));
console.log(JSON.stringify(result, null, 2));
