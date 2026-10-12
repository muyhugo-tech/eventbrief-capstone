import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { buildPackageRequest, capturePackageAttempt } from '../lib/package-provider.mjs';
import { createPackageAllowance } from '../lib/package-allowance.mjs';
import { LIVE_MODEL } from '../lib/package-live-evaluation.mjs';

const bundle = packageFixtures.get('patio-complete');
const prompt = await readFile(new URL('../prompts/extract-package-v3.txt', import.meta.url), 'utf8');
const request = buildPackageRequest(bundle.input, bundle.profile, prompt, LIVE_MODEL, {maxOutputTokens:7500});
const reply = () => ({ status: 200, ok: true, body: JSON.stringify({ status:'completed', model:LIVE_MODEL,
  usage:{input_tokens:1000,output_tokens:1000}, output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(bundle.original)}]}] }) });
async function setup(maxAttempts = 2) {
  const directory = await mkdtemp(join(tmpdir(), 'eventbrief-app-budget-'));
  const options = {directory, requests:[request], maxAttempts, budgetCents:100};
  return {options, allowance:await createPackageAllowance(options)};
}
const capture = (allowance, transport) => allowance.run({ request, execute:() => capturePackageAttempt({input:bundle.input,profile:bundle.profile,prompt,
  model:LIVE_MODEL,key:'fake-not-for-network',mode:'simulated',store:allowance.store,transport,maxOutputTokens:7500}) });

test('successful attempts reserve the full allowance across restarts and cannot exceed the cap', async () => {
  const {options,allowance} = await setup(); let calls = 0;
  const transport = async () => {calls++;return reply();};
  assert.equal((await allowance.status()).remaining,2);
  const first = await capture(allowance,transport); assert.equal(first.ok,true);
  const restarted = await createPackageAllowance(options);
  const state = await restarted.status(); assert.equal(state.remaining,1);assert.ok(state.reserved_micro_usd>12500);
  assert.equal(state.last_successful.run_id,first.run_id);assert.equal(state.last_attempt.status,'succeeded');
  assert.equal((await capture(restarted,transport)).ok,true);
  await assert.rejects(capture(restarted,transport), /test limit/); assert.equal(calls,2);
  assert.equal((await (await createPackageAllowance(options)).status()).remaining,0);
});

test('an unknown billing outcome pauses future preparations even after restart', async () => {
  const {options,allowance} = await setup(); let calls=0;
  const transport = async () => {calls++;throw new Error('Secret-bearing exception not persisted');};
  const result = await capture(allowance,transport);assert.equal(result.status,'transport_error');
  const restarted=await createPackageAllowance(options);assert.equal((await restarted.status()).paused,true);
  await assert.rejects(capture(restarted,transport), /paused/);assert.equal(calls,1);
});

test('known validation failures consume an attempt without silently retrying or refilling', async () => {
  const {allowance}=await setup();let calls=0;
  const transport=async()=>{calls++;const r=reply();const body=JSON.parse(r.body);body.status='incomplete';return {...r,body:JSON.stringify(body)};};
  assert.equal((await capture(allowance,transport)).ok,false);
  const state=await allowance.status();assert.equal(state.remaining,1);assert.equal(state.paused,false);assert.equal(calls,1);
});

test('changed funding plans and unapproved requests cannot dispatch a model call', async () => {
  const {options,allowance}=await setup();let calls=0;
  await assert.rejects(createPackageAllowance({...options,budgetCents:99}), /plan has changed/);
  await assert.rejects(createPackageAllowance({...options,budgetCents:101}), /limited to/);
  await assert.rejects(allowance.run({request:{...request,model:'different-model'},execute:async()=>{calls++;}}), /do not match/);
  assert.equal(calls,0);assert.equal((await allowance.status()).remaining,2);
});

test('a misconfigured app cannot bypass the allowance by writing receipts elsewhere', async () => {
  const {allowance}=await setup();
  assert.throws(()=>createApp({packageAllowance:allowance}), /own attempt store/);
  assert.equal((await allowance.status()).remaining,2);
});

test('the filesystem lock prevents two app processes from spending concurrently', async () => {
  const {options,allowance}=await setup();let release,signal,calls=0;
  const entered=new Promise(resolve=>{signal=resolve;});const blocked=new Promise(resolve=>{release=resolve;});
  const first=capture(allowance,async()=>{calls++;signal();await blocked;return reply();});
  await entered;const second=await createPackageAllowance(options);
  assert.equal((await second.status()).in_flight,true);
  await assert.rejects(capture(second,async()=>{calls++;return reply();}),/already running/);
  release();await first;assert.equal(calls,1);
});

test('the app exposes the durable count, keeps the legacy paid endpoint disabled and reuses receipts for corrections', async t => {
  const {options,allowance}=await setup();let calls=0;
  async function serve(guard) {
    const app=createApp({enabled:true,key:'fake-not-for-network',model:LIVE_MODEL,maxCalls:8,packageRunMode:'simulated',
      packageAllowance:guard,packageStore:guard.store,packageMaxOutputTokens:7500,packageTransport:async()=>{calls++;return reply();},
      provider:async()=>{throw new Error('Legacy paid endpoint must stay disabled');}});
    app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});
    const url=`http://127.0.0.1:${app.address().port}`;
    return {url,post:(path,body)=>fetch(url+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(body)})};
  }
  const first=await serve(allowance);
  const prepared=await (await first.post('/api/package/analyze',{scenario_id:bundle.input.id})).json();
  assert.equal(prepared.documents.length,5);assert.equal(prepared.remaining,1);
  assert.equal((await first.post('/api/analyze',{scenario_id:'01-new-inquiry'})).status,503);
  assert.equal((await (await fetch(first.url+'/api/scenarios')).json()).live.ready,false);
  const restarted=await serve(await createPackageAllowance(options));
  const live=(await (await fetch(restarted.url+'/api/package/scenarios')).json()).live;
  assert.equal(live.remaining,1);assert.equal(live.limit_kind,'persistent');
  assert.equal(live.last_successful.run_id,prepared.extraction.run_id);
  const changed=await (await restarted.post('/api/package/prepare',{scenario_id:bundle.input.id,run_id:prepared.extraction.run_id,
    corrections:{host_name:{value:'Alex',status:'stated',reason:'Synthetic review correction'}}})).json();
  assert.equal(changed.record.fields.host_name.value,'Alex');assert.equal(calls,1);
  const receipt=await allowance.store.read(prepared.extraction.run_id);assert.equal(receipt.request.max_output_tokens,7500);
});
