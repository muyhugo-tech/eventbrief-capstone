import test from 'node:test';
import assert from 'node:assert/strict';
import { eventEditCorrections } from '../lib/package-edits.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';

const bundle = packageFixtures.get('patio-complete');
test('coordinator attendance edits update totals and prices together without changing sources', () => {
  const original = structuredClone(bundle.original);
  const corrections = eventEditCorrections(original, {}, {guest_13_plus_count:18,child_count:2});
  const data = prepareEventPackage({...bundle,corrections});
  assert.equal(data.record.fields.guest_count.value,20);
  assert.equal(data.documents.find(doc => doc.id === 'quote').quote.total_cents,142400);
  for (const id of ['kitchen','staff','guest']) {
    const doc = data.documents.find(doc => doc.id === id);
    assert.equal(doc.rows.find(row => row.field === 'guest_13_plus_count').value,18);
    assert.equal(doc.rows.find(row => row.field === 'child_count').value,2);
  }
  assert.deepEqual(original,bundle.original);
  assert.deepEqual(data.input,bundle.input);
  assert.equal(data.record.fields.guest_count.provenance,'coordinator_correction');
});
test('invalid counts and dates cannot be saved as event edits', () => {
  for (const changes of [{guest_count:20},{guest_13_plus_count:18},{guest_13_plus_count:18,child_count:null},
    {guest_13_plus_count:18.5,child_count:2},{guest_13_plus_count:-1,child_count:2},
    {guest_13_plus_count:0,child_count:0},{guest_13_plus_count:9999,child_count:2},
    {event_date:'2027-02-30'},{start_time:'26:00'},{unknown_field:'test'},{}]) {
    assert.throws(() => eventEditCorrections(bundle.original,{},changes));
  }
});
test('edits retain other corrections and unchanged field evidence', () => {
  const previous = {staff_notes:{value:'Use the side entrance.',status:'agreed',reason:'Coordinator confirmed.'}};
  const corrections = eventEditCorrections(bundle.original,previous,{event_date:'2027-12-03'},'Host confirmed new date.');
  assert.deepEqual(corrections.staff_notes,previous.staff_notes);
  assert.equal(corrections.event_date.reason,'Host confirmed new date.');
  const same = eventEditCorrections(bundle.original,corrections,{event_date:'2027-12-03'},'A second note');
  assert.deepEqual(same,corrections);
});
test('unsupported requests and unanswered source questions keep their readiness gates', () => {
  const corrections = eventEditCorrections(bundle.original,{}, {dietary:'Severe peanut allergy'});
  const data = prepareEventPackage({...bundle,corrections});
  for (const id of ['kitchen','staff','guest']) assert.equal(data.documents.find(doc => doc.id === id).state,'blocked');
  const awaiting = structuredClone(packageFixtures.get('patio-awaiting-dietary'));
  awaiting.original.open_questions.push({field:'dietary',question:'Has everyone answered?',evidence:[{message_id:'m2',quote:'I will check dietary requirements and send those separately.'}]});
  const supplied = eventEditCorrections(awaiting.original,{}, {dietary:'No allergies or dietary restrictions'});
  const pending = prepareEventPackage({...awaiting,corrections:supplied});
  assert.deepEqual(pending.record.open_questions,awaiting.original.open_questions);
  assert.equal(pending.documents.find(doc => doc.id === 'guest').state,'blocked');
});

test('confirmed correction resolves source questions without rewriting the original', () => {
  const awaiting=structuredClone(packageFixtures.get('patio-awaiting-dietary'));
  const original=structuredClone(awaiting.original);
  const corrections=eventEditCorrections(original,{}, {dietary:'No allergies or dietary restrictions'},'Called the host and confirmed.',{resolve:true});
  const prepared=prepareEventPackage({...awaiting,corrections});
  assert.equal(prepared.documents.every(doc=>doc.state==='ready_for_review'),true);
  assert.equal(prepared.unresolved.some(item=>item.field==='dietary'),false);
  assert.deepEqual(prepared.original_record,original);
  assert.equal(prepared.record.fields.dietary.resolved,true);
  assert.deepEqual(prepared.record.fields.dietary.evidence,[]);
});

test('coordinator can confirm the same requested value and keep the pending source request intact', () => {
  const original=structuredClone(bundle.original);
  original.fields.event_date.status='requested';
  original.pending_changes.push({field:'event_date',value:original.fields.event_date.value,status:'requested',evidence:original.fields.event_date.evidence});
  const corrections=eventEditCorrections(original,{}, {event_date:original.fields.event_date.value},'Host confirmed this date by phone.',{resolve:true});
  const prepared=prepareEventPackage({...bundle,original,corrections});
  assert.equal(prepared.record.fields.event_date.status,'agreed');
  assert.equal(prepared.unresolved.length,0);
  assert.equal(prepared.original_record.pending_changes.length,1);
});

test('custom arrangements require an explicit confirmation and cannot override prices or capacity', () => {
  const value='Nut allergy: kitchen lead confirmed a separate meal and preparation instructions.';
  const confirmed=eventEditCorrections(bundle.original,{}, {dietary:value},'Checked with the host and kitchen lead.',{resolve:true,acceptCustom:true});
  assert.equal(prepareEventPackage({...bundle,corrections:confirmed}).documents.every(doc=>doc.state==='ready_for_review'),true);
  const unconfirmed=eventEditCorrections(bundle.original,{}, {dietary:value},'Request received.',{resolve:true});
  assert.equal(prepareEventPackage({...bundle,corrections:unconfirmed}).documents.find(doc=>doc.id==='kitchen').state,'blocked');
  assert.throws(()=>eventEditCorrections(bundle.original,{}, {menu:'Unpriced menu'},'Approved',{resolve:true,acceptCustom:true}));
  assert.throws(()=>eventEditCorrections(bundle.original,{}, {dietary:value},'',{resolve:true,acceptCustom:true}));
  const tooMany=eventEditCorrections(bundle.original,{}, {guest_13_plus_count:50,child_count:2},'Confirmed count.',{resolve:true});
  assert.equal(prepareEventPackage({...bundle,corrections:tooMany}).documents.find(doc=>doc.id==='staff').state,'blocked');
});
