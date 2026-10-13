// Reproduce Alex's saved extraction. Never imports a provider or reads a key.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {prepareEventPackage,fingerprint} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {applyRestaurantSettings,settingsFromProfile} from '../lib/restaurant-settings.mjs';
import {rehearsalExample} from '../public/restaurant-example.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
import {calendarFile} from '../public/workspace-calendar.mjs';
const root=new URL('../',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const saved=await read('evaluation/new-event-v3/results/2026-10-12.json');
const protocol=await read('evaluation/new-event-v3/protocol.json');
const baseline=await read('fixtures/package/restaurant-v2.json');
const profile=applyRestaurantSettings(baseline,rehearsalExample(settingsFromProfile(baseline)));
const data=prepareEventPackage({input:pastedInput(protocol.conversation),original:saved.original_output,profile,baselineProfile:baseline});
assert.deepEqual(data.original_record,saved.original_output);
assert.deepEqual(data.corrections,{});
assert.equal(data.record.fields.guest_13_plus_count.value,46);
assert.equal(data.record.fields.child_count.value,null);
assert.equal(data.record.fields.timezone.value,'America/Los_Angeles');
assert.equal(data.record.fields.end_time.value,null);
const results=data.documents.map(d=>{
  const html=standaloneDocument(d,data,false);
  if(d.id==='calendar') {assert.deepEqual(d.blockers.map(b=>b.field),['end_time']);assert.throws(()=>calendarFile(d,data));}
  else {assert.equal(d.state,'ready_for_review');assert.match(html,/46/);assert.doesNotMatch(html,/undefined|NaN|0 children/);}
  return {id:d.id,state:d.state,blockers:d.blockers,notices:d.notices??[],...(d.quote?{total_cents:d.quote.total_cents,provisional:d.quote.provisional,drinks_excluded:d.quote.beverages_excluded}:{}),...(d.kitchen_plan?{kitchen_quantities_calculated:d.kitchen_plan.calculated}: {})};
});
assert.equal(results.find(r=>r.id==='quote').total_cents,294400);
const result={schema_version:'eventbrief.workflow-replay.v1',source:'evaluation/new-event-v3/results/2026-10-12.json',original_output_sha256:fingerprint(saved.original_output),
  workflow_policy:data.workflow_policy,new_ai_calls:0,added_ai_cost_usd:0,manual_corrections:0,original_receipt_preserved:true,guests:46,children:null,
  timezone_from_restaurant:true,ready_documents:4,documents:results,
  limitation:'Saved-answer replay with configured fictional restaurant settings. The original conversation has no end time; calendar export remains blocked. Child count and Menu 3 prep quantities need confirmation. This is not an unseen AI test.'};
const destination=new URL('evaluation/draft-workflow-v1/results/2026-10-12.json',root);
if(process.argv.includes('--record')){await mkdir(new URL('.',destination),{recursive:true});await writeFile(destination,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
else assert.deepEqual(result,JSON.parse(await readFile(destination,'utf8')));
console.log(JSON.stringify(result,null,2));
