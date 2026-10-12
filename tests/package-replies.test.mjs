import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createPackageWorkspace, replyInput } from '../lib/package-workspace.mjs';
import { demoInput, demoText, demoReply, demoRecord } from '../lib/package-demo.mjs';
import { createApp } from '../server.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { createAttemptStore } from '../lib/attempt-store.mjs';
import { sourceQuote, currentBody } from '../lib/reused-yannis/evidence.mjs';
import { appendSourceHistory } from '../lib/reused-yannis/source-history.mjs';
import { standaloneDocument } from '../public/package-render.mjs';

const profile = packageFixtures.get('patio-complete').profile;
const ready = data => data.documents.filter(doc => doc.state === 'ready_for_review').map(doc => doc.id);
const reviewsFor = data => Object.fromEntries(data.documents.filter(doc => doc.state === 'ready_for_review').map(doc => [doc.id, {decision:'reviewed', revision:doc.revision, reviewed_at:new Date().toISOString()}]));
const syntheticText = demoText.replaceAll('Alex Morgan', 'Taylor Brooks');
function syntheticOutput(input) {
  const output = demoRecord(demoInput);
  output.fields.host_name.value = 'Taylor Brooks';
  for (const detail of Object.values(output.fields)) for (const cite of detail.evidence) cite.quote = cite.quote.replaceAll('Alex Morgan','Taylor Brooks');
  if (input.messages.length > 1) {
    output.fields.dietary = {value:'No allergies or dietary restrictions',status:'stated',evidence:[{message_id:input.messages.at(-1).id,quote:'No allergies or dietary restrictions.'}]};
    output.open_questions = [];
  }
  return output;
}
async function setup() {
  const directory = await mkdtemp(join(tmpdir(),'eventbrief-replies-'));
  const workspace = await createPackageWorkspace(join(directory,'workspace'),profile);
  return {directory,workspace,store:createAttemptStore(join(directory,'receipts'))};
}
async function serve(t,s,options={}) {
  const app=createApp({packageWorkspace:s.workspace,packageStore:s.store,...options});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(()=>{app.closeAllConnections();app.close();});
  const url=`http://127.0.0.1:${app.address().port}`;
  const post=async(path,body)=>{
    const response=await fetch(url+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  const listing=async()=>await(await fetch(url+'/api/package/scenarios')).json();
  return {app,post,listing};
}

test('reused evidence routines preserve exact source spans and refuse quoted-only replies',()=>{
  assert.equal(sourceQuote('A “vegetarian” meal.','A "vegetarian" meal.'),'A “vegetarian” meal.');
  assert.equal(sourceQuote('No allergies.','Allergies.'),null);
  assert.equal(sourceQuote('**No allergies** confirmed.','No allergies confirmed.'),'**No allergies** confirmed.');
  assert.equal(currentBody('New answer.\nOn Tuesday wrote:\nOld question.'),'New answer.');
  assert.throws(()=>replyInput(demoInput,'> old content'),/new reply/);
  const base={event_id:'event',identity:'established',expected_revision:1,baseline:{},messages:[{id:'1',body:'Original'}]};
  const prior=appendSourceHistory(null,base);
  assert.throws(()=>appendSourceHistory(prior,{...base,expected_revision:2,messages:[{id:'1',body:'Changed'},{id:'2',body:'Reply'}]}),/Earlier source/);
  assert.throws(()=>appendSourceHistory(prior,{...base,expected_revision:3,messages:[...base.messages,{id:'2',body:'Reply'}]}),/another tab/);
});

test('same-event replies append immutable revisions, survive restart and reject stale concurrent changes',async()=>{
  const s=await setup(),root=await s.workspace.save(syntheticText);
  const updated=await s.workspace.appendReply(root.input.id,demoReply,'host');
  assert.deepEqual(updated.input.messages[0],root.input.messages[0]);
  assert.equal(updated.input.event_id,root.input.id);assert.equal(updated.input.source_revision_number,2);
  assert.deepEqual(await s.workspace.appendReply(root.input.id,demoReply,'host'),updated);
  await assert.rejects(s.workspace.appendReply(root.input.id,'Different reply.'),/another tab/);
  const restarted=await createPackageWorkspace(join(s.directory,'workspace'),profile);
  assert.deepEqual(await restarted.get(updated.input.id),updated);
  const contenders=await Promise.allSettled([restarted.appendReply(updated.input.id,'New message A.','host'),s.workspace.appendReply(updated.input.id,'New message B.','coordinator')]);
  assert.equal(contenders.filter(r=>r.status==='fulfilled').length,1);
  const state=await restarted.status();assert.equal(state.events[0].revision,3);assert.equal(state.source_versions[root.input.id].superseded,true);
  assert.equal((await restarted.list()).length,3);
  const filename=join(s.directory,'workspace','events',root.input.id,'00000002.json');
  const tampered=JSON.parse(await readFile(filename,'utf8'));tampered.input.messages[0].body+=' changed';
  await writeFile(filename,JSON.stringify(tampered));
  await assert.rejects(restarted.list(),/original copy/);
});

test('HTTP whole journey: missing details → reply → fresh five drafts → saved review → export, with no external provider',async t=>{
  const s=await setup();let calls=0;
  const transport=async({request})=>{
    calls++;
    const messages=JSON.parse(request.input[0].content).messages;
    return {ok:true,status:200,body:JSON.stringify({status:'completed',model:'fake-local',usage:{input_tokens:1,output_tokens:1},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(syntheticOutput({messages}))}]}]})};
  };
  const {post,listing}=await serve(t,s,{key:'fake',enabled:true,packageRunMode:'simulated',packageTransport:transport});
  const initial=await post('/api/package/messages',{text:syntheticText}),id=initial.data.input.id;
  assert.equal((await post('/api/package/prepare',{scenario_id:id,corrections:{}})).status,400);
  const first=await post('/api/package/analyze',{scenario_id:id});assert.equal(first.status,200);
  assert.deepEqual(ready(first.data),['calendar','quote']);assert.equal(calls,1);
  const identity={scenario_id:id,run_id:first.data.extraction.run_id};
  assert.equal((await post('/api/package/review',{...identity,corrections:{},reviews:reviewsFor(first.data),sequence:0})).status,200);
  const update=await post('/api/package/reply',{scenario_id:id,text:demoReply,role:'host'}),nextId=update.data.input.id;
  assert.equal(update.status,200);assert.equal(update.data.version.pending_update,true);assert.equal(calls,1);
  let list=await listing();assert.equal(list.events[0].current_scenario_id,nextId);assert.equal(list.events[0].pending_update,true);
  assert.equal(list.source_versions[id].superseded,true);assert.equal(list.history[0].superseded,true);
  assert.equal((await post('/api/package/analyze',{scenario_id:id})).status,409);
  assert.equal((await post('/api/package/review',{...identity,corrections:{},reviews:{},sequence:1})).status,409);
  assert.equal((await post('/api/package/prepare',{...identity,corrections:{host_name:{value:'Wrong',status:'stated',reason:'Wrong version'}}})).status,409);
  const earlier=await post('/api/package/prepare',{...identity,corrections:{}});assert.equal(earlier.status,200);assert.equal(earlier.data.version.superseded,true);
  const second=await post('/api/package/analyze',{scenario_id:nextId});assert.equal(second.status,200);
  assert.equal(calls,2);assert.equal(ready(second.data).length,5);assert.equal(second.data.record.fields.dietary.value,'No allergies or dietary restrictions');
  const updatedIdentity={scenario_id:nextId,run_id:second.data.extraction.run_id};
  assert.equal((await post('/api/package/review/load',updatedIdentity)).data.saved,null);
  assert.ok(second.data.documents.every(doc=>doc.revision!==first.data.documents.find(old=>old.id===doc.id).revision));
  const decisions=reviewsFor(second.data);
  assert.equal((await post('/api/package/review',{...updatedIdentity,corrections:{},reviews:decisions,sequence:0})).status,200);
  const restarted=await serve(t,s),reopened=await restarted.post('/api/package/review/load',updatedIdentity);
  assert.deepEqual(reopened.data.saved.reviews,decisions);assert.equal(calls,2);
  list=await restarted.listing();assert.equal(list.events[0].pending_update,false);assert.equal(list.history.length,2);
  for(const document of reopened.data.data.documents){
    const html=standaloneDocument(document,reopened.data.data,true);
    assert.match(html,/Reviewed draft/);
    if(['guest','quote'].includes(document.id))assert.doesNotMatch(html,/Riley will lead/);
  }
});

test('clean checkout guided example runs the entire reply/review journey with AI disabled',async t=>{
  const s=await setup(),{post,listing}=await serve(t,s);
  const example=await post('/api/package/demo',{});assert.equal(example.status,200);assert.equal(example.data.reference_available,true);
  const first=await post('/api/package/prepare',{scenario_id:example.data.input.id,corrections:{}});
  assert.equal(first.data.mode,'authored_reference');assert.deepEqual(ready(first.data),['calendar','quote']);
  const reply=await post('/api/package/reply',{scenario_id:example.data.input.id,text:example.data.example_reply,role:'host'});
  assert.equal(reply.data.reference_available,true);
  const second=await post('/api/package/prepare',{scenario_id:reply.data.input.id,corrections:{}});
  assert.equal(ready(second.data).length,5);assert.equal(second.data.mode,'authored_reference');
  assert.equal((await post('/api/package/review',{scenario_id:reply.data.input.id,run_id:null,corrections:{},reviews:reviewsFor(second.data),sequence:0})).status,200);
  assert.equal((await listing()).history.length,0);
  const notScripted=await post('/api/package/reply',{scenario_id:reply.data.input.id,text:'We now need a vegan dinner.',role:'host'});
  assert.equal(notScripted.data.reference_available,false);
  assert.equal((await post('/api/package/prepare',{scenario_id:notScripted.data.input.id,corrections:{}})).status,400);
});

test('failed reply analysis keeps new messages pending, never reopens earlier drafts as current',async t=>{
  const s=await setup(),{post,listing}=await serve(t,s,{key:'fake',enabled:true,packageRunMode:'simulated',packageTransport:async()=>({status:500,ok:false,body:'{}'})});
  const source=await post('/api/package/messages',{text:syntheticText});
  const reply=await post('/api/package/reply',{scenario_id:source.data.input.id,text:demoReply});
  assert.equal((await post('/api/package/analyze',{scenario_id:reply.data.input.id})).status,502);
  const state=await listing();assert.equal(state.events[0].pending_update,true);assert.equal(state.source_versions[source.data.input.id].superseded,true);
  assert.equal((await post('/api/package/review/load',{scenario_id:reply.data.input.id,run_id:null})).data.saved,null);
  assert.equal((await post('/api/package/reply',{scenario_id:source.data.input.id,text:'A different stale reply'})).status,409);
});
