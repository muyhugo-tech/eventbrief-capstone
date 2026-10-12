import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createPackageWorkspace, pastedInput, pastedPrompt } from '../lib/package-workspace.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { createApp } from '../server.mjs';
import { createPackageAllowance } from '../lib/package-allowance.mjs';
import { combinePackageAllowances } from '../lib/package-app-allowances.mjs';
import { createFlexiblePackageAllowance } from '../lib/package-flexible-allowance.mjs';
import { createPackageUpdateStore, updatedBundle } from '../lib/package-updates.mjs';
import { buildPackageRequest, capturePackageAttempt } from '../lib/package-provider.mjs';
import { LIVE_MODEL } from '../lib/package-live-evaluation.mjs';

const base=packageFixtures.get('patio-complete');
const prompt=await readFile(new URL('../prompts/extract-package-v3.txt',import.meta.url),'utf8');
const request=b=>buildPackageRequest(b.input,b.profile,prompt,LIVE_MODEL,{maxOutputTokens:7500});
const text=base.input.messages.map(m=>`${m.role}: ${m.body}`).join('\n\n');
const original=structuredClone(base.original);
for(const detail of Object.values(original.fields)) for(const cite of detail.evidence) cite.message_id='pasted';
const bundle={input:pastedInput(text),profile:base.profile,original};
const response=output=>({ok:true,status:200,body:JSON.stringify({status:'completed',model:LIVE_MODEL,usage:{input_tokens:1000,output_tokens:1000},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]})});
const capture=(allowance,b=base,transport=async()=>response(b.original))=>allowance.run({request:request(b),execute:()=>capturePackageAttempt({input:b.input,profile:b.profile,prompt,model:LIVE_MODEL,key:'fake',mode:'simulated',store:allowance.store,transport,maxOutputTokens:7500})});
async function setup() {
  const directory=await mkdtemp(join(tmpdir(),'eventbrief-workspace-'));
  const workspace=await createPackageWorkspace(join(directory,'workspace'),base.profile);
  const updates=await createPackageUpdateStore({directory:join(directory,'head')});
  const primary=await createPackageAllowance({directory:join(directory,'old'),requests:[request(base)],budgetCents:100,maxAttempts:8});
  const previous=combinePackageAllowances({primary,updateRequest:request(updatedBundle),updateDirectory:join(directory,'updated'),updateScenarioId:updatedBundle.input.id,updateStore:updates});
  return {directory,workspace,previous,updates};
}
async function flexible(s) {return createFlexiblePackageAllowance({previous:s.previous,directory:join(s.directory,'pasted'),template:request(updatedBundle),extraTemplates:[buildPackageRequest(bundle.input,bundle.profile,pastedPrompt(prompt),LIVE_MODEL,{maxOutputTokens:7500})]});}
const decision=doc=>({decision:'reviewed',revision:doc.revision,reviewed_at:new Date().toISOString()});

test('pasted sources are bounded, immutable, idempotent, and survive restart',async()=>{
  const s=await setup();assert.throws(()=>pastedInput('  '),/Paste/);assert.throws(()=>pastedInput('x'.repeat(8001)),/too long/);
  const saved=await s.workspace.save(text);assert.equal(saved.original,undefined);assert.deepEqual(saved.input,bundle.input);
  await s.workspace.save(text);assert.equal((await s.workspace.list()).length,1);
  const restarted=await createPackageWorkspace(join(s.directory,'workspace'),base.profile);assert.deepEqual(await restarted.get(saved.input.id),saved);
  assert.equal(await restarted.get('../../server.mjs'),null);
  await writeFile(join(s.directory,'workspace','sources',`${saved.input.id}.json`),JSON.stringify({...saved.input,title:'tampered'}));
  await assert.rejects(restarted.get(saved.input.id),/original copy/);
});

test('saved corrections and exact review revisions survive restart and reject stale or blocked marks',async()=>{
  const s=await setup();await s.workspace.save(text);
  const data=prepareEventPackage(bundle),reviews=Object.fromEntries(data.documents.map(doc=>[doc.id,decision(doc)]));
  const saved=await s.workspace.saveReview(data,reviews,0);assert.equal(saved.sequence,1);
  const restarted=await createPackageWorkspace(join(s.directory,'workspace'),base.profile);assert.deepEqual(await restarted.loadReview(data.scenario_id,null),saved);
  const changed=prepareEventPackage({...bundle,corrections:{host_name:{value:'Casey',status:'stated',reason:'Corrected fictional host'}}});
  await assert.rejects(restarted.saveReview(changed,reviews,1),/fresh review/);
  await restarted.saveReview(changed,{},1);assert.equal((await restarted.loadReview(data.scenario_id,null)).corrections.host_name.value,'Casey');
  await assert.rejects(s.workspace.saveReview(data,{},1),/another tab/);
  const changedSource=prepareEventPackage({...bundle,input:pastedInput(text+'\nNew message.')});
  await assert.rejects(s.workspace.saveReview(changedSource,reviews,0),/fresh review/);
  const blocked=prepareEventPackage({...bundle,corrections:{event_date:{value:null,status:'unknown',reason:'Date not yet known'}}});
  await assert.rejects(s.workspace.saveReview(blocked,{calendar:decision(blocked.documents[0])},2),/fresh review/);
});

test('simultaneous review saves cannot silently overwrite each other',async()=>{
  const s=await setup(),data=prepareEventPackage(bundle);
  const result=await Promise.allSettled([s.workspace.saveReview(data,{},0),s.workspace.saveReview(data,{calendar:decision(data.documents[0])},0)]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await s.workspace.loadReview(data.scenario_id,null)).sequence,1);
});

test('flexible input reuses the original allowance, locks across processes and never refills',async()=>{
  const s=await setup();const old=await capture(s.previous);await s.previous.activateUpdate();await capture(s.previous,updatedBundle);
  const before=await s.previous.status();const allowance=await flexible(s);assert.equal(allowance.plan.previous_reserved_micro_usd,before.reserved_micro_usd);
  const result=await capture(allowance,bundle);assert.equal(result.ok,true);const state=await allowance.status();assert.equal(state.used,3);assert.equal(state.paused,false);
  assert.ok(state.reserved_micro_usd>before.reserved_micro_usd);assert.deepEqual(await (await flexible(s)).status(),state);
  assert.equal((await allowance.store.read(old.run_id)).status,'succeeded');await assert.rejects(capture(s.previous,updatedBundle),/updated event workspace/);
  await assert.rejects(allowance.run({request:{...request(bundle),max_output_tokens:10000},execute:()=>assert.fail('dispatch')}),/settings/);
  let entered,release;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
  const active=capture(allowance,bundle,async()=>{entered();await hold;return response(original);});await started;
  await assert.rejects(capture(allowance,bundle),/already running/);release();await active;
  let count=0;while((await allowance.status()).remaining>0 && count++<8)await capture(allowance,bundle);
  assert.ok((await allowance.status()).used<=8);assert.ok((await allowance.status()).reserved_micro_usd<=1000000);
  await assert.rejects(capture(await flexible(s),bundle),/remaining AI test allowance/);
});

test('unknown pasted-call outcome pauses spending while previous drafts remain readable',async()=>{
  const s=await setup(),allowance=await flexible(s),before=await capture(allowance,bundle);
  await capture(allowance,bundle,async()=>{throw new Error('transport down');});
  assert.equal((await allowance.status()).paused,true);await assert.rejects(capture(await flexible(s),bundle),/paused/);
  assert.equal((await allowance.store.read(before.run_id)).status,'succeeded');
});

test('HTTP pasted messages reach five drafts, saved corrections and marks reopen free across restart',async t=>{
  const s=await setup(),allowance=await flexible(s);let calls=0;
  async function serve() {
    const app=createApp({key:'fake',enabled:true,model:LIVE_MODEL,maxCalls:8,packageRunMode:'simulated',packageMaxOutputTokens:7500,packageWorkspace:s.workspace,
      packageAllowance:allowance,packageStore:allowance.store,packageUpdates:s.updates,packageTransport:async()=>{calls++;return response(original);}});
    app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});
    const url=`http://127.0.0.1:${app.address().port}`;
    return {url,post:(path,body,origin=url)=>fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)})};
  }
  const {post}=await serve();assert.equal((await post('/api/package/messages',{text},'https://example.com')).status,403);
  assert.equal((await post('/api/package/messages',{text,model:'other'})).status,400);
  assert.equal((await post('/api/package/messages',{text:'x'.repeat(8001)})).status,400);
  const source=await(await post('/api/package/messages',{text})).json(),id=source.input.id;
  assert.equal(calls,0);assert.equal((await post('/api/package/prepare',{scenario_id:id,corrections:{}})).status,400);
  const prepared=await(await post('/api/package/analyze',{scenario_id:id})).json();assert.equal(calls,1);assert.equal(prepared.documents.length,5);
  assert.ok(prepared.documents.every(doc=>doc.state==='ready_for_review'));
  const identity={scenario_id:id,run_id:prepared.extraction.run_id};
  const corrections={guest_notes:{value:'Please enter through the garden gate.',status:'stated',reason:'Fictional host instruction corrected'}};
  const changed=await(await post('/api/package/prepare',{...identity,corrections})).json();
  const reviews={quote:decision(changed.documents.find(d=>d.id==='quote'))};
  const saved=await(await post('/api/package/review',{...identity,corrections,reviews,sequence:0})).json();assert.equal(saved.saved.sequence,1);
  const restarted=await serve();const reopened=await(await restarted.post('/api/package/review/load',identity)).json();
  assert.deepEqual(reopened.saved.reviews,reviews);assert.deepEqual(reopened.data.corrections,corrections);assert.equal(calls,1);
  assert.equal((await post('/api/package/review',{...identity,corrections,reviews,sequence:0})).status,400);
  assert.equal((await post('/api/package/review/load',{...identity,scenario_id:'patio-complete'})).status,200); // no saved review for that identity
  assert.equal((await post('/api/package/prepare',{...identity,scenario_id:'patio-complete',corrections:{}})).status,409);
  const newSource=await(await post('/api/package/messages',{text:text+'\nHost: Can we change the date?'})).json();
  assert.notEqual(newSource.input.id,id);assert.equal((await(await post('/api/package/review/load',{scenario_id:newSource.input.id,run_id:null})).json()).saved,null);
});
