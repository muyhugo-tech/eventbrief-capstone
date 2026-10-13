// Reproduce the saved new-event check offline; no provider or credentials.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {calendarFile} from '../public/workspace-calendar.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const protocol=await json('evaluation/new-event-v1/protocol.json');
const saved=await json('evaluation/new-event-v1/results/2026-10-12.json');
const profile=await json('fixtures/package/restaurant-v2.json');
const input=pastedInput(protocol.conversation), expected=protocol.expected;
export function checksFor(data) {
  const fields=data.record.fields;
  const byId=Object.fromEntries(data.documents.map(doc=>[doc.id,doc]));
  const rows=id=>Object.fromEntries(byId[id].rows.map(row=>[row.field,row.value]));
  const matches=(id,names)=>names.every(name=>rows(id)[name]===expected[name]);
  const ready=id=>byId[id].state==='ready_for_review';
  const schedule=['host_name','event_date','start_time','end_time','timezone','venue'];
  const attendance=['guest_13_plus_count','child_count','guest_count'];
  const html=id=>ready(id)?standaloneDocument(byId[id],data):'';
  const ics=ready('calendar')?calendarFile(byId.calendar,data,{now:new Date('2026-10-13T00:00:00Z')}):'';
  const quantities=byId.kitchen.kitchen_plan?.sections.flatMap(section=>section.lines).map(line=>line.quantity);
  const checks={
    final_counts:attendance.every(f=>fields[f].value===expected[f]),
    final_time:['start_time','end_time'].every(f=>fields[f].value===expected[f]),
    no_open_items:data.unresolved.length===0,
    supported_beverage:fields.beverage.value===expected.beverage,
    calendar:ready('calendar')&&matches('calendar',schedule)&&ics.includes('DTSTART:20271205T020000Z')&&ics.includes('DTEND:20271205T050000Z')&&ics.includes('STATUS:TENTATIVE'),
    quote:ready('quote')&&matches('quote',[...attendance,'menu','beverage'])&&byId.quote.quote?.total_cents===expected.quote_total_cents&&!html('quote').includes(expected.staff_notes),
    kitchen:ready('kitchen')&&matches('kitchen',[...attendance,'event_date','start_time','menu','dietary'])&&JSON.stringify(quantities)===JSON.stringify([3,3,3,30]),
    staff:ready('staff')&&matches('staff',[...schedule,...attendance,'menu','beverage','dietary','setup','av','special','staff_notes']),
    guest:ready('guest')&&matches('guest',[...schedule,...attendance,'menu','beverage','guest_notes'])&&!html('guest').includes(expected.staff_notes)&&html('guest').includes('Thank you for choosing'),
    original_retained:JSON.stringify(data.original_record)===JSON.stringify(saved.original_output)
  };
  return {checks,ready_documents:data.documents.filter(d=>d.state==='ready_for_review').length,quote_total_cents:byId.quote.quote?.total_cents??null,documents:data.documents.map(({id,state,blockers})=>({id,state,blockers}))};
}
// Historical runs use their recorded preparation policy, even after app fixes.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const initial=prepareEventPackage({input,profile,original:saved.original_output,normalizationPolicy:saved.normalization_policy});
const recovered=prepareEventPackage({input,profile,original:saved.original_output,corrections:saved.recovery.corrections,normalizationPolicy:saved.normalization_policy});
const initialResult=checksFor(initial), recoveredResult=checksFor(recovered);
// Verify the frozen expectations and reproduce the recorded failure honestly.
// A later application fix should get a separate replay report, not rewrite this result.
assert.equal(createHash('sha256').update(await readFile(new URL('evaluation/new-event-v1/protocol.json',root))).digest('hex'),saved.protocol_sha256);
assert.ok(Date.parse(saved.predeclared_at)<Date.parse(saved.tested_at));
assert.equal(saved.ai_calls,1);
assert.equal(saved.recovery.additional_ai_calls,0);
assert.equal(initialResult.ready_documents,saved.initial.ready_documents);
assert.equal(initialResult.quote_total_cents,saved.initial.quote_total_cents);
assert.deepEqual(initialResult.documents,saved.initial.documents);
assert.deepEqual(initialResult.checks,{
  final_counts:true,final_time:true,no_open_items:true,supported_beverage:false,
  calendar:true,quote:false,kitchen:false,staff:false,guest:false,original_retained:true
});
assert.equal(recoveredResult.ready_documents,expected.ready_documents.length);
assert.equal(recoveredResult.quote_total_cents,expected.quote_total_cents);
assert.ok(Object.values(recoveredResult.checks).every(Boolean));
console.log(JSON.stringify({initial:initialResult,after_coordinator_correction:recoveredResult,new_ai_calls:0},null,2));
}
