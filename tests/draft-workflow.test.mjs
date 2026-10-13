import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {applyDraftWorkflow} from '../lib/draft-workflow.mjs';
import {packageFixtures} from '../lib/package-fixtures.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {applyRestaurantSettings,settingsFromProfile} from '../lib/restaurant-settings.mjs';
import {rehearsalExample} from '../public/restaurant-example.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
import {calendarFile} from '../public/workspace-calendar.mjs';

const read = async name => JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const protocol=await read('../evaluation/new-event-v3/protocol.json');
const original=(await read('../evaluation/new-event-v3/results/2026-10-12.json')).original_output;
const baseline=packageFixtures.get('patio-complete').profile;
const profile=applyRestaurantSettings(baseline,rehearsalExample(settingsFromProfile(baseline)));
const bundle={input:pastedInput(protocol.conversation),original,profile,baselineProfile:baseline};
const doc=(data,id)=>data.documents.find(d=>d.id===id);

test('saved Alex populates 46 guests and four useful drafts without fabricating children or an end time',()=>{
  const before=JSON.stringify(original),data=prepareEventPackage(bundle);
  assert.equal(JSON.stringify(original),before);assert.deepEqual(data.original_record,original);assert.deepEqual(data.corrections,{});
  assert.equal(data.record.fields.guest_13_plus_count.value,46);
  assert.equal(data.record.fields.guest_13_plus_count.preparation.kind,'guest_total_basis');
  assert.equal(data.record.fields.child_count.value,null);
  assert.equal(data.record.fields.timezone.value,'America/Los_Angeles');
  assert.equal(data.record.fields.timezone.preparation.kind,'restaurant_default');
  assert.equal(data.record.fields.end_time.value,null);
  assert.deepEqual(data.documents.filter(d=>d.state==='ready_for_review').map(d=>d.id),['quote','kitchen','staff','guest']);
  assert.deepEqual(doc(data,'calendar').blockers.map(b=>b.field),['end_time']);
  assert.throws(()=>calendarFile(doc(data,'calendar'),data));
  assert.equal(doc(data,'quote').quote.total_cents,294400);
  assert.equal(doc(data,'quote').quote.provisional,true);
  assert.equal(doc(data,'quote').quote.beverages_excluded,true);
  assert.equal(doc(data,'quote').quote.lines.length,1);
  for(const id of ['quote','kitchen','staff','guest']){
    const html=standaloneDocument(doc(data,id),data,false);
    assert.match(html,/46/);assert.match(html,/Menu 3/);assert.doesNotMatch(html,/undefined|NaN|0 children|No allergies or dietary restrictions/);
    assert.match(html,/Children were not specified/);
    if(id!=='kitchen')assert.match(html,/pay for their own alcoholic drinks/);
  }
  assert.match(standaloneDocument(doc(data,'guest'),data),/End time to confirm/);
  assert.match(standaloneDocument(doc(data,'kitchen'),data),/Confirm/);
});

test('one actual end-time confirmation opens all five, preserves raw extraction and keeps optional notes blank',()=>{
  const corrections={end_time:{value:'20:30',status:'agreed',reason:'Authored test: host confirmed end time.'}};
  const data=prepareEventPackage({...bundle,corrections});
  assert.ok(data.documents.every(d=>d.state==='ready_for_review'));
  assert.match(calendarFile(doc(data,'calendar'),data),/DTEND:20261017T033000Z/);
  for(const field of ['setup','av','special','staff_notes','guest_notes','dietary'])assert.equal(data.record.fields[field].value,null);
  assert.deepEqual(data.original_record,original);
  const before=prepareEventPackage(bundle);
  for(const id of ['calendar','quote','kitchen','staff','guest'])assert.notEqual(doc(before,id).revision,doc(data,id).revision);
});

test('explicit counts, corrections, conflicts and pending count changes are never replaced by a default',()=>{
  const mutations=[
    r=>{r.fields.guest_count.status='requested';},
    r=>{r.fields.child_count={value:null,status:'conflicting',evidence:[]};},
    r=>{r.pending_changes.push({field:'guest_count',value:50});},
    r=>{r.open_questions.push({field:'child_count',question:'How many children?'});}
  ];
  for(const mutate of mutations){const r=structuredClone(original);mutate(r);assert.equal(applyDraftWorkflow(r,profile,{}).fields.guest_13_plus_count.value,null);}
  assert.equal(applyDraftWorkflow(original,profile,{guest_13_plus_count:{}}).fields.guest_13_plus_count.value,null);
  assert.equal(applyDraftWorkflow(original,profile,{timezone:{}}).fields.timezone.value,null);
  const known=structuredClone(original);known.fields.child_count={value:2,status:'agreed',evidence:[]};
  assert.equal(applyDraftWorkflow(known,profile,{}).fields.guest_13_plus_count.value,44);
  known.fields.guest_13_plus_count={value:40,status:'agreed',evidence:[]};
  assert.equal(applyDraftWorkflow(known,profile,{}).fields.guest_13_plus_count.value,40);
  const explicit=structuredClone(original);
  explicit.fields.guest_13_plus_count={...explicit.fields.guest_count};
  const prepared=prepareEventPackage({...bundle,original:explicit});
  assert.equal(doc(prepared,'quote').quote.provisional,true);
  assert.equal(prepared.record.fields.child_count.value,null);
});

test('optional absence is allowed but explicit operational requests, conflicts and allergy questions remain blocked',()=>{
  for(const field of ['setup','av','special','staff_notes','guest_notes','dietary']){
    const r=structuredClone(original);
    r.open_questions.push({field,question:'Please confirm this detail.',evidence:r.fields.host_name.evidence});
    const data=prepareEventPackage({...bundle,original:r});
    const id=field==='guest_notes'?'guest':field==='dietary'?'kitchen':'staff';
    assert.ok(doc(data,id).blockers.some(b=>b.field===field),field);
  }
  const input=structuredClone(bundle.input);input.messages[0].body+='\nAlex: One guest has a food allergy. I will send details later.';
  const data=prepareEventPackage({...bundle,input});
  for(const id of ['kitchen','staff','guest'])assert.ok(doc(data,id).blockers.some(b=>b.field==='dietary'));
});

test('complete events retain their reviews; newly supplied optional details invalidate affected sheets',()=>{
  const fixture=packageFixtures.get('patio-complete');
  const old=prepareEventPackage({...fixture,workflowPolicy:'strict-drafts-v1'}),current=prepareEventPackage(fixture);
  assert.deepEqual(current.documents.map(d=>d.revision),old.documents.map(d=>d.revision));
  const before=prepareEventPackage(bundle),after=prepareEventPackage({...bundle,corrections:{guest_notes:{value:'Meet at the patio entrance.',status:'agreed',reason:'Arrival confirmed.'}}});
  assert.notEqual(doc(before,'guest').revision,doc(after,'guest').revision);
  for(const id of ['calendar','quote','kitchen','staff'])assert.equal(doc(before,id).revision,doc(after,id).revision);
});
