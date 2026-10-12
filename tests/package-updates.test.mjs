import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { updatedBundle, createPackageUpdateStore } from '../lib/package-updates.mjs';
import { combinePackageAllowances } from '../lib/package-app-allowances.mjs';
import { createPackageAllowance } from '../lib/package-allowance.mjs';
import { buildPackageRequest, capturePackageAttempt } from '../lib/package-provider.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { LIVE_MODEL } from '../lib/package-live-evaluation.mjs';
import { createApp } from '../server.mjs';

const base=packageFixtures.get('patio-complete');
const prompt=await readFile(new URL('../prompts/extract-package-v3.txt',import.meta.url),'utf8');
const request=bundle=>buildPackageRequest(bundle.input,bundle.profile,prompt,LIVE_MODEL,{maxOutputTokens:7500});
const reply=bundle=>({ok:true,status:200,body:JSON.stringify({status:'completed',model:LIVE_MODEL,usage:{input_tokens:1000,output_tokens:1000},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(bundle.original)}]}]})});
async function setup() {
  const directory=await mkdtemp(join(tmpdir(),'eventbrief-updates-'));
  const updates=await createPackageUpdateStore({directory:join(directory,'head')});
  const primary=await createPackageAllowance({directory:join(directory,'base'),requests:[request(base)],budgetCents:100,maxAttempts:8});
  const options={primary,updateStore:updates,updateRequest:request(updatedBundle),updateDirectory:join(directory,'update'),updateScenarioId:updatedBundle.input.id};
  return {directory,updates,primary,options,allowance:combinePackageAllowances(options)};
}
const capture=(allowance,bundle,transport=async()=>reply(bundle))=>allowance.run({request:request(bundle),execute:()=>capturePackageAttempt({input:bundle.input,profile:bundle.profile,prompt,model:LIVE_MODEL,key:'fake-not-for-network',mode:'simulated',store:allowance.store,transport,maxOutputTokens:7500})});

test('the append-only update preserves the original thread and changes all five draft revisions',()=>{
  assert.deepEqual(updatedBundle.input.messages.slice(0,4),base.input.messages);
  assert.equal(updatedBundle.input.messages.length,6);
  const before=prepareEventPackage(base),after=prepareEventPackage(updatedBundle);
  assert.equal(after.record.fields.event_date.value,'2027-11-15');assert.equal(after.record.fields.guest_count.value,36);
  assert.equal(after.documents.find(d=>d.id==='quote').quote.total_cents,273600);
  for(let i=0;i<5;i++){assert.equal(after.documents[i].state,'ready_for_review');assert.notEqual(after.documents[i].revision,before.documents[i].revision);}
  assert.equal(after.record.fields.dietary.evidence[0].message_id,'m5');
  assert.equal(after.unresolved.length,0);
});

test('new messages and their identity survive restart and cannot be silently replaced',async()=>{
  const {directory,updates}=await setup();assert.equal((await updates.status()).active_scenario_id,null);
  const first=await updates.activate();assert.equal(first.active_scenario_id,'patio-updated');
  const restarted=await createPackageUpdateStore({directory:join(directory,'head')});assert.deepEqual(await restarted.activate(),first);
  const saved=JSON.parse(await readFile(join(directory,'head','activated.json'),'utf8'));saved.input_hash='changed';
  await writeFile(join(directory,'head','activated.json'),JSON.stringify(saved));await assert.rejects(restarted.status(),/does not match/);
});

test('the new version transfers only unused funds, retires original requests and never refills total attempts',async()=>{
  const {directory,options,allowance,primary}=await setup();let calls=0;
  const transport=bundle=>async()=>{calls++;return reply(bundle);};
  await assert.rejects(capture(allowance,updatedBundle,transport(updatedBundle)),/Add the demo update/);assert.equal(calls,0);
  const original=await capture(allowance,base,transport(base));assert.equal(original.ok,true);
  const originalState=await primary.status();await allowance.activateUpdate();
  const plan=JSON.parse(await readFile(join(directory,'update','plan.json'),'utf8'));
  assert.equal(plan.max_attempts,7);assert.ok(plan.budget_cents*10000+originalState.reserved_micro_usd<=1000000);
  await assert.rejects(capture(allowance,base,transport(base)),/Earlier requests are retired/);assert.equal(calls,1);
  const updated=await capture(allowance,updatedBundle,transport(updatedBundle));assert.equal(updated.ok,true);
  const state=await allowance.status('patio-updated');assert.equal(state.used,2);assert.ok(state.remaining<=6);
  const restarted=combinePackageAllowances(options);assert.deepEqual(await restarted.status('patio-updated'),state);
  assert.equal((await restarted.status('patio-complete')).remaining,0);
  assert.equal((await restarted.store.read(original.run_id)).input.messages.length,4);
  assert.equal((await restarted.store.read(updated.run_id)).input.messages.length,6);
  assert.equal((await restarted.history()).length,2);assert.equal(calls,2);
});

test('unknown update outcomes pause the shared budget while earlier saved results remain readable',async()=>{
  const {options,allowance}=await setup();const original=await capture(allowance,base);
  await allowance.activateUpdate();let calls=0;
  await capture(allowance,updatedBundle,async()=>{calls++;throw new Error('Unknown transport');});
  const restarted=combinePackageAllowances(options);assert.equal((await restarted.status('patio-updated')).paused,true);
  await assert.rejects(capture(restarted,updatedBundle),/paused/);assert.equal(calls,1);
  assert.equal((await restarted.store.read(original.run_id)).status,'succeeded');
});

test('activation cannot race an in-flight model call across app processes',async()=>{
  const {options,allowance,updates}=await setup();let signal,release;
  const entered=new Promise(resolve=>{signal=resolve;}),pending=new Promise(resolve=>{release=resolve;});
  const first=capture(allowance,base,async()=>{signal();await pending;return reply(base);});
  await entered;const other=combinePackageAllowances(options);
  await assert.rejects(other.activateUpdate(),/already running/);assert.equal((await updates.status()).active_scenario_id,null);
  release();await first;await other.activateUpdate();assert.equal((await updates.status()).active_scenario_id,'patio-updated');
});

test('HTTP updates are source-controlled, supersede old results and reopen freely after restart',async t=>{
  const {options,allowance,updates}=await setup();let calls=0;
  async function serve(guard) {
    const app=createApp({key:'fake-not-for-network',enabled:true,model:LIVE_MODEL,maxCalls:8,packageRunMode:'simulated',packageMaxOutputTokens:7500,
      packageAllowance:guard,packageStore:guard.store,packageUpdates:updates,packageTransport:async({request:r})=>{calls++;return reply(JSON.parse(r.input[0].content).messages.length===6?updatedBundle:base);}});
    app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});
    const url='http://127.0.0.1:'+app.address().port;
    const post=(path,body,origin=url)=>fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {url,post};
  }
  const {url,post}=await serve(allowance);
  assert.equal((await post('/api/package/update',{scenario_id:'patio-complete'},'https://example.com')).status,403);
  assert.equal((await post('/api/package/update',{scenario_id:'patio-complete',messages:[]})).status,400);
  assert.equal((await post('/api/package/analyze',{scenario_id:'patio-updated'})).status,409);
  const before=await (await post('/api/package/analyze',{scenario_id:'patio-complete'})).json();assert.equal(calls,1);
  const listing=await (await post('/api/package/update',{scenario_id:'patio-complete'})).json();assert.equal(listing.scenarios.length,3);assert.equal(listing.updates.active_scenario_id,'patio-updated');assert.equal(calls,1);
  assert.ok(!JSON.stringify(listing).includes('original_record'));
  assert.equal((await post('/api/package/analyze',{scenario_id:'patio-complete'})).status,409);
  assert.equal((await post('/api/package/prepare',{scenario_id:'patio-updated',run_id:before.extraction.run_id,corrections:{}})).status,409);
  const earlier=await (await post('/api/package/prepare',{scenario_id:'patio-complete',run_id:before.extraction.run_id,corrections:{}})).json();assert.equal(earlier.version.superseded,true);
  assert.equal((await post('/api/package/prepare',{scenario_id:'patio-complete',run_id:before.extraction.run_id,corrections:{host_name:{value:'Alex',status:'stated',reason:'Old edit'}}})).status,409);
  const after=await (await post('/api/package/analyze',{scenario_id:'patio-updated'})).json();assert.equal(calls,2);assert.equal(after.version.superseded,false);assert.equal(after.documents[1].quote.total_cents,273600);
  for(let i=0;i<5;i++)assert.notEqual(after.documents[i].revision,before.documents[i].revision);
  const restarted=await serve(combinePackageAllowances(options));
  const head=await(await fetch(restarted.url+'/api/package/scenarios')).json();assert.equal(head.updates.active_scenario_id,'patio-updated');assert.equal(head.live.last_successful.run_id,after.extraction.run_id);
  const reopened=await(await restarted.post('/api/package/prepare',{scenario_id:'patio-updated',run_id:after.extraction.run_id,corrections:{}})).json();assert.equal(reopened.record.fields.guest_count.value,36);assert.equal(calls,2);
});

test('a correction cannot return as current if the messages change while its receipt is being read',async t=>{
  const {allowance,updates}=await setup();const original=await capture(allowance,base);
  let entered,release;const started=new Promise(resolve=>{entered=resolve;}),pending=new Promise(resolve=>{release=resolve;});
  const normalRead=allowance.store.read;
  allowance.store.read=async id=>{entered();await pending;return normalRead(id);};
  const app=createApp({packageUpdates:updates,packageAllowance:allowance,packageStore:allowance.store});
  app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});
  const url='http://127.0.0.1:'+app.address().port;
  const request=fetch(url+'/api/package/prepare',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({scenario_id:'patio-complete',run_id:original.run_id,corrections:{host_name:{value:'Alex',status:'stated',reason:'Old source correction'}}})});
  await started;await allowance.activateUpdate();release();
  const result=await request;assert.equal(result.status,409);assert.match((await result.json()).error,/New messages arrived/);
});
