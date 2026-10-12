import { access, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createAttemptStore } from './attempt-store.mjs';
import { PackageAllowanceError } from './package-allowance.mjs';
import { packageHash } from './package-dataset.mjs';
import { fingerprint } from './event-package.mjs';
import { LIVE_RATES } from './package-live-evaluation.mjs';

const cost = (input, output) => Math.ceil(input * LIVE_RATES.input_usd_per_million + output * LIVE_RATES.output_usd_per_million);
const exists = async path => { try { await access(path); return true; } catch(error) { if(error.code==='ENOENT')return false; throw error; } };
const envelope = request => { const clone=structuredClone(request); clone.input=[{role:'user',content:JSON.stringify({...JSON.parse(request.input[0].content),messages:[]})}]; return packageHash(clone); };

// Migration keeps previous reservations charged in full. It neither resets nor
// raises the original app allowance. Every new request is reserved before dispatch.
export async function createFlexiblePackageAllowance({ previous, directory, template, extraTemplates = [] }) {
  const lockPath=join(previous.directory,'app.running.lock');
  const planPath=join(previous.directory,'pasted-workspace.json');
  await mkdir(directory,{recursive:true});
  const attempts=join(directory,'attempts');await mkdir(attempts,{recursive:true});
  const ownStore=createAttemptStore(attempts);
  const extraPath=join(directory,'pasted-prompt-envelopes.json');
  const extraBytes=JSON.stringify({schema_version:'eventbrief.pasted-prompt-envelopes.v1',envelopes:extraTemplates.map(envelope).sort()})+'\n';
  let lock;
  try {lock=await open(lockPath,'wx',0o600);} catch {throw new PackageAllowanceError('Wait for the current preparation before opening the updated workspace.');}
  let plan;
  try {
    const state=await previous.status(undefined,true);
    if(state.paused||state.in_flight) throw new PackageAllowanceError('The earlier spending record needs checking.');
    const expected={schema_version:'eventbrief.pasted-allowance.v1',budget_cents:state.budget_cents,max_attempts:previous.maxAttempts,
      previous_used:state.used,previous_reserved_micro_usd:state.reserved_micro_usd,request_envelope:envelope(template),
      max_request_bytes:50000,max_output_tokens:7500,rates:LIVE_RATES};
    if(await exists(planPath)) {
      plan=JSON.parse(await readFile(planPath,'utf8'));
      if(JSON.stringify(plan)!==JSON.stringify(expected))throw new PackageAllowanceError('The saved spending plan has changed. AI stays off.');
    } else {
      const file=await open(planPath,'wx',0o600);
      try {await file.writeFile(JSON.stringify(expected)+'\n');await file.sync();} finally {await file.close();}
      plan=expected;
    }
    if(await exists(extraPath)) {
      if(await readFile(extraPath,'utf8')!==extraBytes)throw new PackageAllowanceError('The saved pasted-message settings changed. AI stays off.');
    } else {
      const file=await open(extraPath,'wx',0o600);
      try {await file.writeFile(extraBytes);await file.sync();} finally {await file.close();}
    }
  } finally {await lock.close();await unlink(lockPath);}
  const bytes=JSON.stringify(plan)+'\n';
  function reserve(request) {
    if(![plan.request_envelope,...extraTemplates.map(envelope)].includes(envelope(request)) || request.max_output_tokens!==plan.max_output_tokens || Buffer.byteLength(JSON.stringify(request))>plan.max_request_bytes) throw new PackageAllowanceError('These messages exceed the supported AI test size or settings.');
    const input=Buffer.byteLength(JSON.stringify(request))+2000;
    return {input,reserved:cost(input,request.max_output_tokens)};
  }
  async function history() {
    const results=await previous.history();
    for(const id of await readdir(attempts)) {
      const receipt=await ownStore.read(id);
      results.push({run_id:id,scenario_id:receipt.scenario_id,status:receipt.status,mode:receipt.mode,saved_at:receipt.finished_at??receipt.started_at});
    }
    return results.sort((a,b)=>b.saved_at.localeCompare(a.saved_at));
  }
  const store={begin:data=>ownStore.begin(data),finish:(id,data)=>ownStore.finish(id,data),async read(id){
    try {return await ownStore.read(id);} catch(error) {if(error.code!=='ENOENT')throw error;return previous.store.read(id);}
  }};
  async function status(_scenario, ignoreLock=false, request=template) {
    try {
      if(await readFile(planPath,'utf8')!==bytes)throw new Error('Changed plan');
      if(await readFile(extraPath,'utf8')!==extraBytes)throw new Error('Changed pasted-message settings');
      const old=await previous.status(undefined,true);
      if(old.paused||old.in_flight||old.used!==plan.previous_used||old.reserved_micro_usd!==plan.previous_reserved_micro_usd)throw new Error('Earlier spending changed');
      let reserved=old.reserved_micro_usd,used=old.used,paused=false;
      for(const id of await readdir(attempts)) {
        const receipt=await ownStore.read(id), allowance=reserve(receipt.request),usage=receipt.meta?.usage;
        if(receipt.run_id!==id||receipt.request_hash!==fingerprint(receipt.request))throw new Error('Changed attempt');
        reserved+=allowance.reserved;used++;
        if(!['succeeded','failed'].includes(receipt.status)||!Number.isSafeInteger(usage?.input_tokens)||usage.input_tokens<0||usage.input_tokens>allowance.input||!Number.isSafeInteger(usage?.output_tokens)||usage.output_tokens<0||usage.output_tokens>plan.max_output_tokens)paused=true;
      }
      const inFlight=!ignoreLock&&await exists(lockPath),entries=await history();
      return {used,reserved_micro_usd:reserved,budget_cents:plan.budget_cents,limit_kind:'persistent',paused,in_flight:inFlight,
        remaining:paused||inFlight?0:Math.max(0,Math.min(plan.max_attempts-used,Math.floor((plan.budget_cents*10000-reserved)/reserve(request).reserved))),
        last_successful:entries.find(entry=>entry.status==='succeeded')??null,last_attempt:entries[0]??null};
    } catch {return {remaining:0,paused:true,in_flight:false};}
  }
  async function run({request,execute}) {
    reserve(request);
    let file;try {file=await open(lockPath,'wx',0o600);} catch {throw new PackageAllowanceError('An AI preparation is already running.');}
    try {
      const state=await status(undefined,true,request);
      if(state.paused||state.remaining<1)throw new PackageAllowanceError(state.paused?'AI is paused while the last request is checked.':'These messages exceed the remaining AI test allowance. Saved drafts are still available.');
      return await execute();
    } finally {await file.close();await unlink(lockPath);}
  }
  return {store,status,run,history,activateUpdate:()=>previous.activateUpdate(),plan};
}
