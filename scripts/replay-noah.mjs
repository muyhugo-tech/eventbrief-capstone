// Offline replay only: no environment loading, credentials or model transport.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { pastedInput } from '../lib/package-workspace.mjs';
import { renderDocument, standaloneDocument } from '../public/package-render.mjs';
import { checksFor } from './check-new-event.mjs';

const root = new URL('../',import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path,root),'utf8'));
const protocol = await json('evaluation/new-event-v1/protocol.json');
const saved = await json('evaluation/new-event-v1/results/2026-10-12.json');
const profile = await json('fixtures/package/restaurant-v2.json');
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha(await readFile(new URL('evaluation/new-event-v1/protocol.json',root))),saved.protocol_sha256);
const prepared = prepareEventPackage({input:pastedInput(protocol.conversation),profile,original:saved.original_output});
const result = checksFor(prepared);
assert.ok(Object.values(result.checks).every(Boolean));
assert.deepEqual(prepared.corrections,{});
const notes = 'juice and soda for everyone, with no alcohol';
assert.equal(prepared.record.fields.beverage.value,'Nonalcoholic service');
assert.equal(prepared.record.fields.beverage.notes,notes);
const noteChecks = {};
for (const id of ['quote','staff','guest']) {
  const doc = prepared.documents.find(doc=>doc.id===id);
  noteChecks[id] = doc.beverage_notes===notes && renderDocument(doc,prepared).includes(notes) && standaloneDocument(doc,prepared).includes(notes);
  assert.ok(noteChecks[id]);
}
console.log(JSON.stringify({
  case_id:saved.id,
  replayed_at:new Date().toISOString(),
  original_app_commit:saved.app_commit,
  original_result_sha256:sha(await readFile(new URL('evaluation/new-event-v1/results/2026-10-12.json',root))),
  protocol_sha256:saved.protocol_sha256,
  normalization_policy:prepared.normalization_policy,
  original_ready_documents:saved.initial.ready_documents,
  ...result,
  beverage_option:prepared.record.fields.beverage.value,
  beverage_notes:prepared.record.fields.beverage.notes,
  exact_notes_in_preview_and_download:noteChecks,
  manual_corrections:0,
  new_ai_calls:0,
  added_ai_cost_usd:0,
  limitation:'Saved-answer regression replay used to develop the fix, not a new AI trial. Historical failure and coordinator recovery remain in the original result.'
},null,2));
