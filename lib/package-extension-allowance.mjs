import { access, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createAttemptStore } from './attempt-store.mjs';
import { PackageAllowanceError } from './package-allowance.mjs';
import { fingerprint } from './event-package.mjs';
import { LIVE_MODEL, LIVE_RATES } from './package-live-evaluation.mjs';

const exists = async path => { try { await access(path); return true; } catch(error) { if(error.code === 'ENOENT') return false; throw error; } };
const envelope = request => {
  const copy = structuredClone(request);
  copy.input = [{ role: 'user', content: JSON.stringify({ ...JSON.parse(request.input[0].content), messages: [] }) }];
  return fingerprint(copy);
};
const cost = (input, output) => Math.ceil(input * LIVE_RATES.input_usd_per_million + output * LIVE_RATES.output_usd_per_million);

// Explicitly configured additional allowance. Its immutable plan and receipts
// never reset the original budget; prior attempts remain readable and charged.
export async function createExtensionPackageAllowance({ previous, directory, lockDirectory, templates, budgetCents = 500, maxAttempts = 30 }) {
  if (!Number.isSafeInteger(budgetCents) || budgetCents < 1 || budgetCents > 500 || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 30) throw new PackageAllowanceError('Additional testing is limited to $5 and 30 calls.');
  if (!templates?.length || templates.some(item => item.model !== LIVE_MODEL || item.max_output_tokens !== 7500)) throw new PackageAllowanceError('Unsupported additional test settings.');
  await mkdir(directory, { recursive: true });
  const attempts = join(directory, 'attempts');
  await mkdir(attempts, { recursive: true });
  const ownStore = createAttemptStore(attempts);
  const lockPath = join(lockDirectory, 'app.running.lock');
  const planPath = join(directory, 'plan.json');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); } catch { throw new PackageAllowanceError('An AI preparation is running or needs checking.'); }
  let plan;
  try {
    const old = await previous.status(undefined, true);
    if (old.paused || old.in_flight) throw new PackageAllowanceError('The earlier spending record needs checking.');
    plan = { schema_version: 'eventbrief.additional-allowance.v1', budget_cents: budgetCents, max_attempts: maxAttempts,
      previous_used: old.used, previous_reserved_micro_usd: old.reserved_micro_usd,
      request_envelopes: templates.map(envelope).sort(), max_request_bytes: 50000, max_output_tokens: 7500, rates: LIVE_RATES };
    const bytes = JSON.stringify(plan) + '\n';
    if (await exists(planPath)) {
      if (await readFile(planPath, 'utf8') !== bytes) throw new PackageAllowanceError('The additional spending plan changed. AI stays off.');
    } else {
      // A removed plan must never make existing receipts eligible for a refill.
      if ((await readdir(attempts)).length) throw new PackageAllowanceError('The additional spending plan is missing. AI stays off.');
      const file = await open(planPath, 'wx', 0o600);
      try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    }
  } finally { await lock.close(); await unlink(lockPath); }
  const planBytes = JSON.stringify(plan) + '\n';
  let activeRequest = null;
  function reserve(request) {
    if (!plan.request_envelopes.includes(envelope(request)) || Buffer.byteLength(JSON.stringify(request)) > plan.max_request_bytes) throw new PackageAllowanceError('These messages exceed the supported AI test size or settings.');
    const input = Buffer.byteLength(JSON.stringify(request)) + 2000;
    return { input, reserved: cost(input, plan.max_output_tokens) };
  }
  async function history() {
    const entries = await previous.history();
    for (const id of await readdir(attempts)) {
      const receipt = await ownStore.read(id);
      entries.push({run_id: id, scenario_id: receipt.scenario_id, status: receipt.status, mode: receipt.mode, saved_at: receipt.finished_at ?? receipt.started_at});
    }
    return entries.sort((a,b) => b.saved_at.localeCompare(a.saved_at));
  }
  const store = {
    async begin(data) {
      if (!activeRequest || fingerprint(data.request) !== activeRequest) throw new PackageAllowanceError('No request has reserved an allowance.');
      return ownStore.begin(data);
    },
    finish: (id,data) => ownStore.finish(id,data),
    async read(id) { try { return await ownStore.read(id); } catch(error) { if(error.code !== 'ENOENT') throw error; return previous.store.read(id); } }
  };
  async function status(_scenario, ignoreLock = false, request = templates[0]) {
    try {
      if (await readFile(planPath, 'utf8') !== planBytes) throw new Error('Changed plan');
      const old = await previous.status(undefined, true);
      if (old.paused || old.in_flight || old.used !== plan.previous_used || old.reserved_micro_usd !== plan.previous_reserved_micro_usd) throw new Error('Previous spending changed');
      let reserved = 0, used = 0, estimated = 0, paused = false;
      for (const id of await readdir(attempts)) {
        const receipt = await ownStore.read(id), allowance = reserve(receipt.request), usage = receipt.meta?.usage;
        if (receipt.run_id !== id || receipt.request_hash !== fingerprint(receipt.request)) throw new Error('Changed attempt');
        reserved += allowance.reserved; used++;
        const valid = ['succeeded','failed'].includes(receipt.status) && Number.isSafeInteger(usage?.input_tokens) && usage.input_tokens >= 0 && usage.input_tokens <= allowance.input && Number.isSafeInteger(usage?.output_tokens) && usage.output_tokens >= 0 && usage.output_tokens <= plan.max_output_tokens;
        if (!valid) paused = true;
        else estimated += cost(usage.input_tokens, usage.output_tokens);
      }
      const inFlight = !ignoreLock && await exists(lockPath), entries = await history();
      return { used: old.used + used, additional_used: used, budget_cents: old.budget_cents + budgetCents, additional_budget_cents: budgetCents,
        reserved_micro_usd: old.reserved_micro_usd + reserved, additional_reserved_micro_usd: reserved, additional_estimated_micro_usd: estimated,
        limit_kind: 'persistent', paused, in_flight: inFlight,
        remaining: paused || inFlight ? 0 : Math.max(0, Math.min(maxAttempts - used, Math.floor((budgetCents * 10000 - reserved) / reserve(request).reserved))),
        last_successful: entries.find(item => item.status === 'succeeded') ?? null, last_attempt: entries[0] ?? null };
    } catch { return { remaining: 0, paused: true, in_flight: false }; }
  }
  async function run({request,execute}) {
    reserve(request);
    let file;
    try { file = await open(lockPath, 'wx', 0o600); } catch { throw new PackageAllowanceError('An AI preparation is already running.'); }
    try {
      const state = await status(undefined, true, request);
      if (state.paused || state.remaining < 1) throw new PackageAllowanceError(state.paused ? 'AI is paused while the last request is checked.' : 'The additional AI test allowance is used up. Saved drafts remain available.');
      activeRequest = fingerprint(request);
      return await execute();
    } finally { activeRequest = null; await file.close(); await unlink(lockPath); }
  }
  return { store, status, run, history, plan, activateUpdate: () => previous.activateUpdate() };
}
