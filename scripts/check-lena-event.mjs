// Saved-result evaluation only. No credentials, provider or network calls.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {calendarFile} from '../public/workspace-calendar.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const protocol=await json('evaluation/new-event-v2/protocol.json');
const expected=protocol.expected;
export function checkLena(data) {
  const fields=data.record.fields;
  const docs=Object.fromEntries(data.documents.map(doc=>[doc.id,doc]));
  const ready=id=>docs[id].state==='ready_for_review';
  const rows=id=>Object.fromEntries(docs[id].rows.map(row=>[row.field,row.value]));
  const matches=(id,names)=>names.every(name=>rows(id)[name]===expected[name]);
  const html=id=>ready(id)?standaloneDocument(docs[id],data):'';
  const schedule=['host_name','event_date','start_time','end_time','timezone','venue'];
  const attendance=['guest_13_plus_count','child_count','guest_count'];
  // Semantic requirements fixed before the call: do not require one exact phrasing.
  const drinkNotes=text=>/\bsoda\b/i.test(text)&&/\bjuice\b/i.test(text)&&/\b(everybody|everyone|all guests|all attendees|whole group)\b/i.test(text)&&/\b(no alcohol|non-?alcoholic)\b/i.test(text);
  const beverage_details=Object.fromEntries(['quote','staff','guest'].map(id=>[id,ready(id)&&drinkNotes(html(id))]));
  const ics=ready('calendar')?calendarFile(docs.calendar,data,{now:new Date('2026-10-13T00:00:00Z')}):'';
  const quantities=docs.kitchen.kitchen_plan?.sections.flatMap(section=>section.lines).map(line=>line.quantity);
  const checks={
    final_counts:attendance.every(name=>fields[name].value===expected[name]),
    final_time:['start_time','end_time'].every(name=>fields[name].value===expected[name]),
    no_open_items:data.unresolved.length===0,
    supported_beverage:fields.beverage.value===expected.beverage,
    no_corrections:Object.keys(data.corrections).length===0,
    calendar:ready('calendar')&&matches('calendar',schedule)&&ics.includes(`DTSTART:${expected.calendar_start_utc}`)&&ics.includes(`DTEND:${expected.calendar_end_utc}`)&&ics.includes('STATUS:TENTATIVE'),
    quote:ready('quote')&&matches('quote',[...attendance,'menu','beverage'])&&docs.quote.quote?.total_cents===expected.quote_total_cents&&beverage_details.quote&&!html('quote').includes(expected.staff_notes),
    kitchen:ready('kitchen')&&matches('kitchen',[...attendance,'event_date','start_time','menu','dietary'])&&JSON.stringify(quantities)===JSON.stringify(expected.kitchen_quantities),
    staff:ready('staff')&&matches('staff',[...schedule,...attendance,'menu','beverage','dietary','setup','av','special','staff_notes'])&&beverage_details.staff,
    guest:ready('guest')&&matches('guest',[...schedule,...attendance,'menu','beverage','guest_notes'])&&beverage_details.guest&&!html('guest').includes(expected.staff_notes)&&html('guest').includes('Thank you for choosing')
  };
  return {checks,beverage_details,field_matches:Object.fromEntries(Object.entries(fields).map(([name,detail])=>[name,detail.value===expected[name]])),
    ready_documents:data.documents.filter(doc=>doc.state==='ready_for_review').length,
    all_five_pass:['calendar','quote','kitchen','staff','guest'].every(id=>checks[id]),
    quote_total_cents:docs.quote.quote?.total_cents??null,
    beverage_value:fields.beverage.value,beverage_notes:fields.beverage.notes??null,
    documents:data.documents.map(({id,state,blockers})=>({id,state,blockers}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const saved=await json('evaluation/new-event-v2/results/2026-10-12.json');
  const profile=await json('fixtures/package/restaurant-v2.json');
  assert.equal(createHash('sha256').update(await readFile(new URL('evaluation/new-event-v2/protocol.json',root))).digest('hex'),saved.protocol_sha256);
  assert.equal(saved.ai_calls,1);assert.equal(saved.manual_corrections,0);
  const prepared=prepareEventPackage({workflowPolicy: 'strict-drafts-v1',input:pastedInput(protocol.conversation),profile,original:saved.original_output,normalizationPolicy:saved.normalization_policy});
  const result=checkLena(prepared);
  assert.deepEqual(result,saved.automated_checks,'Reproduced outcome differs from the saved first attempt. Preserve the original result and record app replays separately.');
  console.log(JSON.stringify({reproduced:true,...result,new_ai_calls:0},null,2));
}
