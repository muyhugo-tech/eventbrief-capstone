// Offline replay: no provider import, API key, network call or manual correction.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { AS_EXTRACTED } from '../lib/package-normalization.mjs';
import { pastedInput } from '../lib/package-workspace.mjs';
const root = new URL('../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const protocolBytes = await readFile(new URL('evaluation/lesson-comparison-v1/protocol.json',root));
const originalBytes = await readFile(new URL('evaluation/lesson-comparison-v1/results/2026-10-12.json',root));
const protocol = JSON.parse(protocolBytes), original = JSON.parse(originalBytes);
const profileBytes = await readFile(new URL('fixtures/package/restaurant-v2.json',root));
const profile = JSON.parse(profileBytes);
assert.equal(hash(protocolBytes), original.protocol_sha256);
const sources = {};
for (const file of ['lib/event-package.mjs','lib/package-normalization.mjs','lib/package-contract.mjs','scripts/replay-beverage-pair.mjs']) {
  sources[file] = hash((await readFile(new URL(file,root),'utf8')).replaceAll('\r\n','\n'));
}
const report = {
  id: 'beverage-saved-response-replay-v1', type:'post-fix app replay, not a new AI evaluation',
  original_results_sha256:hash(originalBytes), protocol_sha256:hash(protocolBytes), profile_sha256:hash(profileBytes),
  implementation_sha256:sources, new_ai_calls:0, additional_ai_cost_usd:0, manual_corrections:0,
  conditions:original.attempts.map(attempt => {
    const bundle = {input:pastedInput(protocol.conversation),original:attempt.original_output,profile};
    const before = prepareEventPackage({...bundle,normalizationPolicy:AS_EXTRACTED});
    const after = prepareEventPackage(bundle), quote = after.documents.find(doc=>doc.id==='quote');
    assert.deepEqual(after.original_record,attempt.original_output);
    const checks = {
      five_ready:after.documents.every(doc=>doc.state==='ready_for_review'),
      expected_quote:quote.quote?.total_cents===protocol.expected.quote_total_cents,
      expected_attendance:after.record.fields.guest_count.value===19,
      supported_drink_option:after.record.fields.beverage.value===protocol.expected.beverage_value,
      notes_preserved:after.record.fields.beverage.notes?.includes('juice and soda') && after.record.fields.beverage.notes?.includes('21 or older'),
      original_unchanged:JSON.stringify(after.original_record)===JSON.stringify(attempt.original_output)
    };
    assert.ok(Object.values(checks).every(Boolean));
    return {condition:attempt.condition, original_primary_pass:attempt.primary_pass, original_output_sha256:hash(JSON.stringify(attempt.original_output)),
      before_ready:before.documents.filter(doc=>doc.state==='ready_for_review').length,
      after_ready:after.documents.filter(doc=>doc.state==='ready_for_review').length,
      quote_total_cents:quote.quote.total_cents, beverage:after.record.fields.beverage,
      attendance:after.record.fields.guest_count, setup:after.record.fields.setup, checks};
  }),
  interpretation:'Both saved answers now work after deterministic app fixes. Original AI failures remain failures. This does not establish a lesson benefit, unseen-event accuracy, or an independent holdout result.'
};
const bytes = JSON.stringify(report,null,2)+'\n';
if (process.argv.includes('--write')) {
  const target = new URL('evaluation/lesson-comparison-v1/results/2026-10-12-app-replay.json',root);
  try {await writeFile(target,bytes,{flag:'wx'});} catch(error) {if(error.code!=='EEXIST')throw error;assert.equal(await readFile(target,'utf8'),bytes,'Saved replay differs; keep earlier evidence and version the new report.');}
}
console.log(JSON.stringify({new_ai_calls:0,conditions:report.conditions.map(({condition,before_ready,after_ready,quote_total_cents,checks})=>({condition,before_ready,after_ready,quote_total_cents,checks}))},null,2));
