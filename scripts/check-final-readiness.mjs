// Frozen before the three requests. Runs offline on saved first-attempt outputs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
import {calendarFile} from '../public/workspace-calendar.mjs';
const root = new URL('../', import.meta.url);
export const finalProtocol = JSON.parse(await readFile(new URL('evaluation/final-readiness-v1/protocol.json',root),'utf8'));
export function checkFinalReadiness(data, testCase) {
  const e=testCase.expected,f=data.record.fields,raw=data.original_record.fields;
  const docs=Object.fromEntries(data.documents.map(d=>[d.id,d]));
  const ready=id=>docs[id]?.state==='ready_for_review';
  const html=id=>ready(id)?standaloneDocument(docs[id],data,false):'';
  const matches=(id,keys)=>keys.every(k=>docs[id].rows.some(r=>r.field===k&&r.value===e[k]));
  const drinks=id=>e.drink_terms.every(term=>html(id).toLowerCase().includes(term));
  const counts=['guest_count','guest_13_plus_count','child_count'];
  const schedule=['event_date','start_time','end_time','timezone','venue'];
  let ics='';try{ics=calendarFile(docs.calendar,data).replace(/\r\n /g,'');}catch{}
  const checks={
    latest_counts:counts.every(k=>f[k].value===e[k]),
    source_counts:counts.every(k=>raw[k].value===e[k]),
    known_details:['host_name',...schedule,'menu','beverage'].every(k=>f[k].value===e[k]),
    agreed_arrangements:['event_date','start_time',...counts,'venue','menu','beverage'].every(k=>f[k].status==='agreed'),
    evidence_quotes_present:Object.values(raw).every(detail=>detail.evidence.every(item=>testCase.conversation.includes(item.quote))),
    restaurant_timezone:raw.timezone.value===null&&raw.timezone.status==='unknown'&&f.timezone.preparation?.kind==='restaurant_default',
    end_rule:e.default_end
      ?raw.end_time.value===null&&raw.end_time.status==='unknown'&&f.end_time.preparation?.kind==='default_duration'&&f.end_time.preparation.hours===4&&data.documents.every(d=>(d.notices??[]).some(n=>n.includes('4 hours after')))
      :raw.end_time.value===e.end_time&&raw.end_time.status==='agreed'&&f.end_time.preparation?.kind!=='default_duration',
    dietary:e.dietary_silent?raw.dietary.value===null&&raw.dietary.status==='unknown':e.dietary_pending
      ?!/(?:no|none|without)\s+(?:allerg|dietary)/i.test(String(raw.dietary.value))&&['kitchen','staff','guest'].every(id=>!ready(id)&&docs[id].blockers.some(b=>b.field==='dietary'))
      :/(?:no|none|without)/i.test(String(raw.dietary.value))&&['stated','agreed'].includes(raw.dietary.status),
    no_unrelated_open_items:[...data.record.pending_changes,...data.record.open_questions].every(item=>e.dietary_pending&&item.field==='dietary'),
    no_corrections:Object.keys(data.corrections).length===0,
    document_states:data.documents.every(d=>ready(d.id)===e.ready_documents.includes(d.id)),
    no_obsolete_count:data.documents.every(d=>!new RegExp('\\b'+e.old_guest_count+'\\s+(?:guests|people)\\b','i').test(html(d.id)))
  };
  const quantities=docs.kitchen.kitchen_plan?.sections.flatMap(s=>s.lines).map(l=>l.quantity);
  const expectedBlock=id=>!ready(id)&&docs[id].blockers.length>0&&docs[id].blockers.every(b=>b.field==='dietary');
  const draftChecks={
    calendar:ready('calendar')&&matches('calendar',schedule)&&ics.includes('DTSTART:'+e.calendar_start_utc)&&ics.includes('DTEND:'+e.calendar_end_utc)&&ics.includes('STATUS:TENTATIVE')&&(!e.default_end||ics.includes('4 hours after')),
    quote:ready('quote')&&matches('quote',counts)&&docs.quote.quote?.total_cents===e.quote_total_cents&&drinks('quote'),
    kitchen:e.dietary_pending?expectedBlock('kitchen'):ready('kitchen')&&matches('kitchen',counts)&&docs.kitchen.kitchen_plan?.calculated===true&&JSON.stringify(quantities)===JSON.stringify(e.kitchen_quantities),
    staff:e.dietary_pending?expectedBlock('staff'):ready('staff')&&matches('staff',[...schedule,...counts])&&drinks('staff'),
    guest:e.dietary_pending?expectedBlock('guest'):ready('guest')&&matches('guest',[...schedule,...counts])&&drinks('guest')&&/Thank you for choosing/.test(html('guest'))
  };
  return {checks,draft_checks:draftChecks,all_pass:Object.values(checks).every(Boolean)&&Object.values(draftChecks).every(Boolean),ready_documents:data.documents.filter(d=>ready(d.id)).length,quote_total_cents:docs.quote.quote?.total_cents??null,documents:data.documents.map(({id,state,blockers})=>({id,state,blockers}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const saved=JSON.parse(await readFile(new URL('evaluation/final-readiness-v1/results/2026-10-13.json',root),'utf8'));
  const hash=createHash('sha256').update(await readFile(new URL('evaluation/final-readiness-v1/protocol.json',root))).digest('hex');
  assert.equal(hash,saved.protocol_sha256);
  const results=[];
  for(const testCase of finalProtocol.cases){
    const item=saved.cases.find(c=>c.id===testCase.id);
    assert.ok(Date.parse(saved.predeclared_at)<Date.parse(item.tested_at));
    const data=prepareEventPackage({input:pastedInput(testCase.conversation),original:item.original_output,profile:saved.profile,workflowPolicy:item.workflow_policy,normalizationPolicy:item.normalization_policy});
    const result=checkFinalReadiness(data,testCase);assert.deepEqual(result,item.automated_checks);
    results.push({id:item.id,...result});
  }
  console.log(JSON.stringify({reproduced:true,new_ai_calls:0,results},null,2));
}
