// Replay Sofia's original answer after the matching fix, without a provider.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {prepareEventPackage, fingerprint} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {checkSofiaEvent} from './check-sofia-event.mjs';
const root = new URL('../', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const saved = await read('evaluation/new-event-v4/results/2026-10-13.json');
const protocol = await read('evaluation/new-event-v4/protocol.json');
const data = prepareEventPackage({input:pastedInput(protocol.conversation), original:saved.original_output, profile:saved.profile});
assert.deepEqual(data.original_record, saved.original_output);
assert.deepEqual(data.corrections, {});
const checks = checkSofiaEvent(data);
assert.equal(checks.all_pass, true);
const result = {
  original_output_sha256:fingerprint(saved.original_output), normalization_policy:data.normalization_policy,
  workflow_policy:data.workflow_policy, original_preserved:true, manual_corrections:0, new_ai_calls:0, added_ai_cost_usd:0,
  original_ready_documents:saved.automated_checks.ready_documents, automated_checks:checks,
  beverage_option:data.record.fields.beverage.value, beverage_notes:data.record.fields.beverage.notes,
  limitation:'Saved-answer replay used to develop the fix, not another unseen test. The original first-attempt failure is retained.'
};
const destination = new URL('evaluation/new-event-v4/results/replay-2026-10-13.json', root);
if (process.argv.includes('--record')) await writeFile(destination, JSON.stringify(result, null, 2) + '\n', {flag:'wx'});
else assert.deepEqual(result, JSON.parse(await readFile(destination, 'utf8')));
console.log(JSON.stringify(result, null, 2));
