import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxThreads,renderInboxThreads,renderInboxDetail} from '../public/workspace-inbox.mjs';
import {packageFixtures} from '../lib/package-fixtures.mjs';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {packageSummary} from '../lib/package-summary.mjs';
import {FIELD_DEFINITIONS} from '../lib/package-contract.mjs';
const bundle=packageFixtures.get('patio-complete');
const prepared=prepareEventPackage(bundle);
const event={event_id:bundle.input.id,current_scenario_id:bundle.input.id,scenario_ids:[bundle.input.id],revision:1,summary:packageSummary(prepared),pending_update:false};
const thread=inboxThreads([event],[bundle.input])[0];
const render=(data=prepared,options={})=>renderInboxDetail(thread,{data,definitions:FIELD_DEFINITIONS,...options});

test('inbox groups one current conversation per event and searches its full source',()=>{
  const input={id:'new-source',title:'A new enquiry',messages:[{id:'pasted',role:'conversation',body:'Host: The new date is undecided. Please call Rowan.'}]};
  const rows=inboxThreads([event,{event_id:'new',current_scenario_id:input.id,pending_update:true}],[bundle.input,input]);
  assert.equal(rows.length,2);assert.equal(rows[0].state,'pending');
  const search=renderInboxThreads(rows,{search:'Rowan'});
  assert.match(search,/1 of 2 conversations/);assert.match(search,/Needs preparation/);assert.doesNotMatch(search,/Alex Morgan/);
  assert.match(renderInboxThreads(rows,{filter:'prepared'}),/1 of 2 conversations/);
});
test('source, event details and all five asset links stay connected without claiming an AI run',()=>{
  const page=render();
  assert.match(page,/From source to drafts/);assert.match(page,/5 ready · 0 need details/);
  assert.match(page,/These sample details were written in advance/);
  for(const id of ['calendar','quote','kitchen','staff','guest'])assert.ok(page.includes(`data-open-document="${id}"`));
  assert.ok(page.includes('data-inbox-source="event_date"'));
  assert.ok(page.indexOf('Assets from this conversation')<page.indexOf('id="inbox-source-heading"'));
});
test('coordinator changes retain the original quote and have distinct provenance',()=>{
  const data=prepareEventPackage({...bundle,corrections:{event_date:{value:'2027-12-03',status:'agreed',reason:'The host called to confirm.'}}});
  const page=render(data,{highlight:data.original_record.fields.event_date.evidence[0]});
  assert.match(page,/Coordinator change/);assert.match(page,/The host called to confirm/);assert.match(page,/2027-12-03/);
  assert.ok(page.includes(`Original value: ${bundle.original.fields.event_date.value}`));
  assert.match(page,/See original source/);assert.match(page,/<mark>/);
});
test('a pending or superseded source never displays old details or old ready assets',()=>{
  for(const changed of [{...thread,pending_update:true},{...thread,id:'new-source'}]){
    const page=renderInboxDetail(changed,{data:prepared,definitions:FIELD_DEFINITIONS,canPrepare:true});
    assert.match(page,/No current drafts yet/);assert.doesNotMatch(page,/data-open-document=/);assert.match(page,/Uses one AI preparation/);
  }
  assert.doesNotMatch(render({...prepared,version:{superseded:true}}),/data-open-document=/);
  assert.match(renderInboxDetail({...thread,pending_update:true},{canPrepare:false}),/data-inbox-prepare="[^"]+" disabled/);
});
test('missing details, blocked outputs and actual review marks remain visible',()=>{
  const awaiting=packageFixtures.get('patio-awaiting-dietary');
  const data=prepareEventPackage(awaiting);
  const source=inboxThreads([{...event,current_scenario_id:awaiting.input.id,summary:packageSummary(data)}],[awaiting.input])[0];
  const page=renderInboxDetail(source,{data,definitions:FIELD_DEFINITIONS,reviews:{calendar:{revision:data.documents[0].revision}}});
  assert.match(page,/2 ready · 3 need details/);assert.match(page,/>Reviewed</);assert.match(page,/>Needs details</);assert.match(page,/>Missing</);
});
test('messages, quotation highlights, edits and thread names are escaped',()=>{
  const hostile='<img src=x onerror="steal()"> & <script>bad()</script> $&';
  const input={...bundle.input,messages:[{id:'"><script>x</script>',role:'conversation',body:hostile}]};
  const page=renderInboxDetail({...thread,input,title:hostile},{highlight:{message_id:input.messages[0].id,quote:hostile},error:hostile});
  assert.doesNotMatch(page,/<script>|<img/);assert.match(page,/&lt;img/);assert.match(page,/<mark>&lt;img/);
  assert.match(page,/\$&amp;<\/mark>/);
  assert.match(renderInboxThreads([{...thread,input,title:hostile}]),/&lt;img/);
});
