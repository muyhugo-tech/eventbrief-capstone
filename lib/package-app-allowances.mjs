import { access, open, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { packageHash } from './package-dataset.mjs';
import { createPackageAllowance, PackageAllowanceError } from './package-allowance.mjs';
import { createAttemptStore } from './attempt-store.mjs';

// The immutable new head retires the original requests. Only the unused part of
// the SAME app allowance is eligible for the update; total attempts never refill.
export function combinePackageAllowances({ primary, updateRequest, updateDirectory, updateScenarioId, updateStore }) {
  let update = null;
  const runRoutes = new Map();
  const lockPath = join(primary.directory, 'app.running.lock');
  const savedStores = [primary.store, createAttemptStore(join(updateDirectory,'attempts'))];
  async function getUpdate() {
    if (!(await updateStore.status()).active_scenario_id) return null;
    if (update) return update;
    const state = await primary.status();
    if (state.paused || state.in_flight) throw new PackageAllowanceError('The original spending record needs checking. AI stays paused.');
    const cents = Math.floor((primary.plan.budget_cents * 10000 - state.reserved_micro_usd) / 10000);
    const attempts = primary.plan.max_attempts - state.used;
    if (cents < 1 || attempts < 1) return null;
    update = await createPackageAllowance({directory:updateDirectory,requests:[updateRequest],budgetCents:cents,maxAttempts:attempts});
    return update;
  }
  async function routeFor(request) {
    const head = await updateStore.status();
    const hash = packageHash(request);
    if (head.active_scenario_id) {
      const next = await getUpdate();
      if (next && Object.hasOwn(next.plan.requests,hash)) return next;
      throw new PackageAllowanceError('Choose the latest messages. Earlier requests are retired.');
    }
    if (Object.hasOwn(primary.plan.requests,hash)) return primary;
    throw new PackageAllowanceError('Add the demo update before preparing its messages.');
  }
  async function allAllowances() { const next=await getUpdate();return next ? [primary,next] : [primary]; }
  const store = {
    async begin(data) {
      const route = await routeFor(data.request);
      const id = await route.store.begin(data);runRoutes.set(id,route);return id;
    },
    async finish(id,data) {
      const route=runRoutes.get(id);if(!route) throw new Error('Unknown active capture.');
      return route.store.finish(id,data);
    },
    async read(id) {
      for (const saved of savedStores) {
        try {return await saved.read(id);}
        catch(error) {if(error.code!=='ENOENT') throw error;}
      }
      throw new Error('Saved attempt not found.');
    }
  };
  const latest=(states,key)=>states.map(state=>state[key]).filter(Boolean).sort((a,b)=>b.saved_at.localeCompare(a.saved_at))[0]??null;
  async function status(scenarioId, ignoreGlobalLock = false) {
    try {
      const head=await updateStore.status();
      const allowances=await allAllowances();
      const states=await Promise.all(allowances.map(item=>item.status()));
      const selected=head.active_scenario_id ? (scenarioId===updateScenarioId || !scenarioId ? states[1] : null) : states[0];
      let locked=false;try {await access(lockPath);locked=true;} catch(error) {if(error.code!=='ENOENT') locked=true;}
      const paused=states.some(state=>state.paused), inFlight=(!ignoreGlobalLock && locked)||states.some(state=>state.in_flight);
      const used=states.reduce((sum,state)=>sum+(state.used??0),0);
      return {...selected,used,paused,in_flight:inFlight,reserved_micro_usd:states.reduce((sum,state)=>sum+(state.reserved_micro_usd??0),0),budget_cents:primary.plan.budget_cents,limit_kind:'persistent',
        remaining:paused||inFlight?0:Math.max(0,Math.min(selected?.remaining??0,primary.plan.max_attempts-used)),
        last_successful:latest(states,'last_successful'),last_attempt:latest(states,'last_attempt')};
    } catch {return {remaining:0,paused:true,in_flight:false,limit_kind:'persistent',budget_cents:primary.plan.budget_cents};}
  }
  async function withLock(execute) {
    let lock;try {lock=await open(lockPath,'wx',0o600);} catch {throw new PackageAllowanceError('An AI request is already running or needs checking. No new request was sent.');}
    try {
      const states=await Promise.all((await allAllowances()).map(item=>item.status()));
      if(states.some(state=>state.paused||state.in_flight)) throw new PackageAllowanceError('AI is paused while the last request is checked.');
      return await execute();
    } finally {await lock.close();await unlink(lockPath);}
  }
  async function run({request,execute}) {
    return withLock(async()=>{
      try { await access(join(primary.directory,'pasted-workspace.json')); throw new PackageAllowanceError('Use the updated event workspace for new AI requests.'); }
      catch(error) { if(error.code!=='ENOENT') throw error; }
      const route=await routeFor(request);
      const states=await Promise.all((await allAllowances()).map(item=>item.status()));
      if(states.reduce((sum,state)=>sum+state.used,0)>=primary.plan.max_attempts) throw new PackageAllowanceError('The AI test limit has been reached.');
      return route.run({request,execute});
    });
  }
  async function activateUpdate() {return withLock(async()=>{await updateStore.activate();await getUpdate();});}
  async function history() {
    const entries=[];
    const directories=[primary.directory,updateDirectory];
    for(let index=0;index<directories.length;index++) {
      let folders;try {folders=await readdir(join(directories[index],'attempts'),{withFileTypes:true});} catch(error) {if(error.code==='ENOENT')continue;throw error;}
      for(const folder of folders) {
        if(!folder.isDirectory()) throw new Error('Unreadable attempt history.');
        const receipt=await savedStores[index].read(folder.name);
        entries.push({run_id:receipt.run_id,scenario_id:receipt.scenario_id,status:receipt.status,mode:receipt.mode,saved_at:receipt.finished_at??receipt.started_at});
      }
    }
    return entries.sort((a,b)=>b.saved_at.localeCompare(a.saved_at));
  }
  return {store,status,run,history,activateUpdate,directory:primary.directory,maxAttempts:primary.plan.max_attempts};
}
