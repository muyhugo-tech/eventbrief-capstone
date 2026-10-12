import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExtensionPackageAllowance } from '../lib/package-extension-allowance.mjs';
import { fingerprint } from '../lib/event-package.mjs';

const request = { model:'gpt-6.1-sol', max_output_tokens:7500, input:[{role:'user',content:JSON.stringify({messages:[{body:'Fictional event'}],vocabulary:{}})}] };
async function setup(t, maxAttempts=2) {
  const root=await mkdtemp(join(tmpdir(),'eventbrief-extension-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const prior={used:8,reserved_micro_usd:850000,budget_cents:100,paused:false,in_flight:false};
  const previous={status:async()=>prior,history:async()=>[],store:{read:async()=>({legacy:true})}};
  const options={previous,directory:join(root,'additional'),lockDirectory:root,templates:[request],maxAttempts};
  const allowance=await createExtensionPackageAllowance(options);
  return {root,prior,options,allowance};
}
async function attempt(allowance, usage={input_tokens:100,output_tokens:100}) {
  return allowance.run({request,execute:async()=>{
    const id=await allowance.store.begin({request,request_hash:fingerprint(request),scenario_id:'synthetic',mode:'simulated',started_at:new Date().toISOString()});
    await allowance.store.finish(id,{status:'succeeded',meta:{usage}});return id;
  }});
}
test('additional allowance persists across restart, preserves history, and enforces its own cap',async t=>{
  const {allowance,options}=await setup(t);
  assert.equal((await allowance.status()).remaining,2);
  const id=await attempt(allowance);
  const restarted=await createExtensionPackageAllowance(options);
  const state=await restarted.status();
  assert.equal(state.used,9);assert.equal(state.additional_used,1);assert.equal(state.remaining,1);
  assert.equal(state.additional_budget_cents,500);assert.equal(state.additional_estimated_micro_usd,1250);
  assert.equal((await restarted.store.read(id)).status,'succeeded');assert.deepEqual(await restarted.store.read('00000000-0000-4000-8000-000000000000'),{legacy:true});
  await attempt(restarted);await assert.rejects(attempt(restarted),/used up/);
});
test('unknown usage, earlier ledger changes, changed settings, and concurrent dispatch fail closed',async t=>{
  const {allowance,options,prior,root}=await setup(t);
  await assert.rejects(allowance.run({request:{...request,model:'other'},execute:async()=>{throw Error('should not dispatch');}}),/settings/);
  await writeFile(join(root,'app.running.lock'),'');
  await assert.rejects(attempt(allowance),/running/);await rm(join(root,'app.running.lock'));
  await attempt(allowance,null);assert.equal((await allowance.status()).paused,true);
  await assert.rejects(attempt(allowance),/paused/);
  prior.used++;assert.equal((await allowance.status()).paused,true);
  await assert.rejects(createExtensionPackageAllowance({...options,budgetCents:501}),/limited/);
});
test('a changed or removed plan cannot refill a used allowance',async t=>{
  const {allowance,options}=await setup(t);
  await attempt(allowance);
  await assert.rejects(createExtensionPackageAllowance({...options,maxAttempts:3}),/changed/);
  await rm(join(options.directory,'plan.json'));
  await assert.rejects(createExtensionPackageAllowance(options),/missing/);
  assert.equal((await allowance.status()).remaining,0);
});
