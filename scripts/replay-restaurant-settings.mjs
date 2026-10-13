// Replays saved evidence only. No provider, credentials or network access.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {prepareEventPackage, fingerprint} from '../lib/event-package.mjs';
import {settingsFromProfile, applyRestaurantSettings} from '../lib/restaurant-settings.mjs';
import {rehearsalExample} from '../public/restaurant-example.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
export function checkConfiguredAlex(data, original, unknownFields) {
  const checks={
    original_preserved:fingerprint(data.original_record)===fingerprint(original),
    no_event_corrections:Object.keys(data.corrections).length===0,
    latest_total:data.record.fields.guest_count.value===46&&data.record.fields.guest_count.status==='agreed',
    menu_supported:data.record.fields.menu.value==='Menu 3'&&Object.hasOwn(data.profile.menus,'Menu 3'),
    capacity_supported:data.profile.venues['Garden Patio'].capacity===60&&!data.issues.some(issue=>issue.rule.includes('capacity')),
    configured_drinks:data.record.fields.beverage.value==='À la carte + cash bar',
    exact_terms_kept:data.record.fields.beverage.notes===original.fields.beverage.value,
    missing_fields_not_invented:unknownFields.every(field=>fingerprint(data.record.fields[field])===fingerprint(original.fields[field])),
    unsupported_arrangement_issues_removed:data.issues.length===0,
    guest_dietary_silence_not_blocked:!data.documents.find(doc=>doc.id==='guest').blockers.some(blocker=>blocker.field==='dietary'),
    all_five_still_require_details:data.documents.length===5&&data.documents.every(doc=>doc.state==='blocked'&&doc.rows.length===0&&doc.blockers.length>0),
    no_price_or_kitchen_quantities_invented:data.documents.find(doc=>doc.id==='quote').quote===null&&data.documents.find(doc=>doc.id==='kitchen').kitchen_plan===null
  };
  assert.ok(Object.values(checks).every(Boolean),JSON.stringify(checks));
  return {checks,ready_documents:0,documents:data.documents.map(({id,state,blockers})=>({id,state,blockers})),
    boundary:'A settings replay of one known answer, not a new AI trial or five completed documents.'};
}
export async function replayRestaurantSettings() {
  const originalResult=await read('evaluation/new-event-v3/results/2026-10-12.json'), protocol=await read('evaluation/new-event-v3/protocol.json');
  const baseline=await read('fixtures/package/restaurant-v2.json'), settings=rehearsalExample(settingsFromProfile(baseline));
  const data=prepareEventPackage({workflowPolicy: 'strict-drafts-v1',input:pastedInput(protocol.conversation),original:originalResult.original_output,
    profile:applyRestaurantSettings(baseline,settings),baselineProfile:baseline});
  return {schema_version:'eventbrief.settings-replay.v1',case:'Alex rehearsal dinner',kind:'saved-answer replay with explicit fictional restaurant settings',
    new_ai_calls:0,added_ai_cost_usd:0,source_result:'evaluation/new-event-v3/results/2026-10-12.json',
    original_output_sha256:fingerprint(originalResult.original_output),settings,...checkConfiguredAlex(data,originalResult.original_output,protocol.expected.unknown_fields)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await replayRestaurantSettings(), destination=new URL('evaluation/restaurant-settings-v1/results/2026-10-12.json',root);
  if(process.argv.includes('--record')) {await mkdir(new URL('.',destination),{recursive:true});await writeFile(destination,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
  else assert.deepEqual(result,JSON.parse(await readFile(destination,'utf8')));
  console.log(JSON.stringify({reproduced:true,checks:result.checks,ready_documents:result.ready_documents,new_ai_calls:0},null,2));
}
