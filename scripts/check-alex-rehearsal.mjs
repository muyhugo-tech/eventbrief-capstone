// Saved-result scorer: no network or provider. Expectations precede the call.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const protocol=await json('evaluation/new-event-v3/protocol.json');
export function checkAlexRehearsal(data){
  const f=data.record.fields,expected=protocol.expected;
  const docs=Object.fromEntries(data.documents.map(d=>[d.id,d]));
  const beverage=[f.beverage.value,f.beverage.notes].filter(Boolean).join(' ').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const fixed=['host_name','event_date','start_time','guest_count','venue','menu'];
  const checks={
    latest_accepted_total:f.guest_count.value===46&&f.guest_count.status==='agreed',
    known_values:fixed.every(k=>f[k].value===expected[k]),
    accepted_arrangements:expected.agreed_fields.every(k=>f[k].status==='agreed'),
    missing_fields_unknown:expected.unknown_fields.every(k=>f[k].value===null&&f[k].status==='unknown'&&f[k].evidence.length===0),
    a_la_carte_retained:/\ba la carte\b/.test(beverage),
    cash_bar_retained:/\bcash bar\b/.test(beverage)||/\bpay for their own alcoholic drinks\b/.test(beverage),
    no_fixed_package_substitution:!Object.hasOwn(data.profile.beverages,f.beverage.value),
    no_invented_questions_or_pending_changes:data.original_record.open_questions.length===0&&data.original_record.pending_changes.length===0,
    expected_policy_flags:expected.required_policy_rules.every(rule=>data.issues.some(issue=>issue.rule===rule)),
    no_guest_dietary_block:!docs.guest.blockers.some(b=>b.field==='dietary'),
    no_corrections:Object.keys(data.corrections).length===0,
    no_quote_total:docs.quote.quote===null,
    no_kitchen_quantities:docs.kitchen.kitchen_plan===null
  };
  const draftChecks=Object.fromEntries(Object.entries(docs).map(([id,doc])=>[id,doc.state==='blocked'&&doc.rows.length===0&&doc.blockers.some(b=>b.rule==='venues.Garden Patio.capacity')]));
  const unknowns=Object.fromEntries(expected.unknown_fields.map(k=>[k,{value:f[k].value,status:f[k].status,passed:f[k].value===null&&f[k].status==='unknown'&&f[k].evidence.length===0}]));
  return {checks,draft_checks:draftChecks,unknown_fields:unknowns,all_automated_checks_pass:Object.values(checks).every(Boolean)&&Object.values(draftChecks).every(Boolean),
    ready_documents:data.documents.filter(d=>d.state==='ready_for_review').length,expected_ready_documents:0,
    beverage_value:f.beverage.value,booking_status:f.booking_status,
    documents:data.documents.map(({id,state,blockers})=>({id,state,blockers})),
    boundary:'Passing these checks means faithful extraction and appropriate blocking, not five completed documents.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const saved=await json('evaluation/new-event-v3/results/2026-10-12.json');
  assert.equal(createHash('sha256').update(await readFile(new URL('evaluation/new-event-v3/protocol.json',root))).digest('hex'),saved.protocol_sha256);
  const profile=await json('fixtures/package/restaurant-v2.json');
  const data=prepareEventPackage({input:pastedInput(protocol.conversation),profile,original:saved.original_output,normalizationPolicy:saved.normalization_policy});
  const result=checkAlexRehearsal(data);assert.deepEqual(result,saved.automated_checks);
  console.log(JSON.stringify({reproduced:true,...result,new_ai_calls:0},null,2));
}
