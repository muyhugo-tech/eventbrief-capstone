import { access, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createAttemptStore } from './attempt-store.mjs';
import { packageHash } from './package-dataset.mjs';
import { LIVE_MODEL, LIVE_RATES } from './package-live-evaluation.mjs';

const cost = (input, output) => Math.ceil(input * LIVE_RATES.input_usd_per_million + output * LIVE_RATES.output_usd_per_million);
const exists = async path => { try { await access(path); return true; } catch { return false; } };
async function writeOnce(path, bytes) {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
}

export class PackageAllowanceError extends Error {
  constructor(message) { super(message); this.name = 'PackageAllowanceError'; }
}

// Each saved attempt is its own pre-dispatch spending reservation. Reserve its
// full conservative allowance even after success/failure; never refill on restart.
export async function createPackageAllowance({ directory, requests, budgetCents = 100, maxAttempts = 8 }) {
  if (!Number.isSafeInteger(budgetCents) || budgetCents < 1 || budgetCents > 100 || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 8) {
    throw new PackageAllowanceError('The app test allowance is limited to $1 and eight preparations.');
  }
  if (!Array.isArray(requests) || !requests.length) throw new PackageAllowanceError('No eligible fictional messages were configured.');
  const allowances = new Map(requests.map(request => {
    if (request.model !== LIVE_MODEL || request.max_output_tokens !== 7500) throw new PackageAllowanceError('The app requires the tested model and output allowance.');
    const inputTokens = Buffer.byteLength(JSON.stringify(request)) + 2000;
    return [packageHash(request), { input_token_allowance: inputTokens, reserved_micro_usd: cost(inputTokens, request.max_output_tokens) }];
  }));
  const maxReserve = Math.max(...[...allowances.values()].map(item => item.reserved_micro_usd));
  const plan = { schema_version: 'eventbrief.package-app-allowance.v1', model: LIVE_MODEL, budget_cents: budgetCents,
    max_attempts: maxAttempts, max_output_tokens: 7500, rates: LIVE_RATES, requests: Object.fromEntries([...allowances].sort()),
    policy: 'Full request allowance reserved by saved attempt; no automatic retries or restart refill. Token estimates do not replace provider billing.' };
  const bytes = JSON.stringify(plan, null, 2) + '\n';
  const planPath = join(directory, 'plan.json');
  await mkdir(directory, { recursive: true });
  try { await writeOnce(planPath, bytes); }
  catch (error) {
    if (error.code !== 'EEXIST') throw new PackageAllowanceError('The spending limit could not be saved. AI stays off.');
    if (await readFile(planPath, 'utf8') !== bytes) throw new PackageAllowanceError('The saved spending plan has changed. AI stays off until it is checked.');
  }
  const attemptsDir = join(directory, 'attempts');
  await mkdir(attemptsDir, { recursive: true });
  const store = createAttemptStore(attemptsDir);
  const lockPath = join(directory, 'running.lock');

  async function status(includeLock = true) {
    try {
      if (await readFile(planPath, 'utf8') !== bytes) throw new Error('Changed plan');
      const folders = await readdir(attemptsDir, { withFileTypes: true });
      let reserved = 0, paused = false, lastSuccessful = null, lastAttempt = null;
      for (const folder of folders) {
        if (!folder.isDirectory()) throw new Error('Unexpected artifact');
        const receipt = await store.read(folder.name);
        const allowance = allowances.get(packageHash(receipt.request));
        if (!allowance || receipt.run_id !== folder.name || receipt.schema_version !== 'eventbrief.model-attempt.v1') throw new Error('Changed request');
        reserved += allowance.reserved_micro_usd;
        const saved = { run_id: receipt.run_id, scenario_id: receipt.scenario_id, status: receipt.status,
          saved_at: receipt.finished_at ?? receipt.started_at };
        if (!lastAttempt || saved.saved_at > lastAttempt.saved_at) lastAttempt = saved;
        if (receipt.status === 'succeeded' && (!lastSuccessful || saved.saved_at > lastSuccessful.saved_at)) lastSuccessful = saved;
        const usage = receipt.meta?.usage;
        if (!['succeeded', 'failed'].includes(receipt.status) || !Number.isSafeInteger(usage?.input_tokens) || usage.input_tokens < 0 ||
          !Number.isSafeInteger(usage?.output_tokens) || usage.output_tokens < 0 || usage.input_tokens > allowance.input_token_allowance ||
          usage.output_tokens > plan.max_output_tokens || cost(usage.input_tokens, usage.output_tokens) > allowance.reserved_micro_usd) paused = true;
      }
      const locked = includeLock && await exists(lockPath);
      const slots = Math.max(0, Math.min(maxAttempts - folders.length, Math.floor((budgetCents * 10000 - reserved) / maxReserve)));
      return { remaining: paused || locked ? 0 : slots, paused, in_flight: locked, used: folders.length, reserved_micro_usd: reserved,
        budget_cents: budgetCents, limit_kind: 'persistent', last_successful: lastSuccessful, last_attempt: lastAttempt };
    } catch {
      return { remaining: 0, paused: true, in_flight: false, limit_kind: 'persistent', budget_cents: budgetCents };
    }
  }

  async function run({ request, execute }) {
    if (!allowances.has(packageHash(request))) throw new PackageAllowanceError('These messages do not match the saved AI test plan.');
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch { throw new PackageAllowanceError('An AI request is already running or needs checking. No new request was sent.'); }
    try {
      const state = await status(false);
      if (state.paused) throw new PackageAllowanceError('AI is paused while the last request is checked. Saved drafts are still available.');
      if (state.remaining < 1) throw new PackageAllowanceError('The AI test limit has been reached. You can still review or download your drafts.');
      // capturePackageAttempt syncs its attempt before the transport sends anything.
      return await execute();
    } finally { await lock.close(); await unlink(lockPath); }
  }
  return { plan, store, directory, status, run };
}
