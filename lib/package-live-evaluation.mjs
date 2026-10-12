import { mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createAttemptStore } from './attempt-store.mjs';
import { buildPackageRequest, capturePackageAttempt } from './package-provider.mjs';
import { packageRunFromAttempts } from './package-evaluation-report.mjs';
import { packageHash } from './package-dataset.mjs';
import { projectRoot, sha256 } from './dataset.mjs';

// Verified October 11, 2026: https://developers.openai.com/api/docs/models/gpt-6.1-sol
// Use the higher cache-write input rate for a conservative estimate. Prices and
// byte-based input allowances are estimates, not an account-wide billing cap.
export const LIVE_MODEL = 'gpt-6.1-sol';
export const LIVE_RATES = { input_usd_per_million: 2.5, output_usd_per_million: 10, checked_on: '2026-10-11' };
const estimateMicroUsd = (input, output) => Math.ceil(input * LIVE_RATES.input_usd_per_million + output * LIVE_RATES.output_usd_per_million);
const bytes = value => JSON.stringify(value, null, 2) + '\n';

export async function createLivePlan({ dataset, prompt, budgetCents = 200, mode = 'live', caseIds = dataset.cases.map(item => item.id), maxOutputTokens = 10000 }) {
  if (!Number.isSafeInteger(budgetCents) || budgetCents <= 0 || budgetCents > 200) throw new Error('This test permits a budget of at most $2.');
  if (!['live', 'simulated'].includes(mode)) throw new Error('Invalid test mode.');
  if (!Array.isArray(caseIds) || !caseIds.length || new Set(caseIds).size !== caseIds.length || caseIds.some(id => !dataset.cases.some(item => item.id === id))) throw new Error('Choose unique cases from the frozen dataset.');
  const sources = {};
  for (const path of ['lib/package-provider.mjs', 'lib/package-contract.mjs', 'lib/event-package.mjs', 'lib/attempt-store.mjs', 'lib/package-live-evaluation.mjs', 'scripts/run-package-model.mjs']) {
    sources[path] = sha256(await readFile(join(projectRoot, path), 'utf8'));
  }
  const cases = dataset.cases.filter(entry => caseIds.includes(entry.id)).map(entry => {
    const request = buildPackageRequest(entry.input, dataset.profile, prompt, LIVE_MODEL, { maxOutputTokens });
    const inputAllowance = Buffer.byteLength(JSON.stringify(request)) + 2000;
    return { id: entry.id, request_sha256: packageHash(request), input_token_allowance: inputAllowance,
      max_output_tokens: request.max_output_tokens, reserved_micro_usd: estimateMicroUsd(inputAllowance, request.max_output_tokens) };
  });
  const reserved = cases.reduce((sum, entry) => sum + entry.reserved_micro_usd, 0);
  if (reserved > budgetCents * 10000) throw new Error('The conservative request allowances exceed the test budget. No call is permitted.');
  return { schema_version: 'eventbrief.live-test-plan.v1', mode, model: LIVE_MODEL, budget_cents: budgetCents,
    rates: LIVE_RATES, dataset: { version: dataset.version, sha256: dataset.sha256 }, profile_sha256: packageHash(dataset.profile),
    prompt_sha256: sha256(prompt), sources_sha256: sources, reserved_micro_usd: reserved, cases,
    limitations: ['One token per serialized request byte plus 2,000 overhead tokens is a conservative allowance, not an exact tokenizer.',
      'Token cost estimates do not replace the provider bill or project hard limit.', 'Budget applies to this batch only; failed or uncertain requests are never retried.'] };
}

function usageEstimate(receipt, entry) {
  const usage = receipt.meta?.usage;
  if (!Number.isSafeInteger(usage?.input_tokens) || usage.input_tokens < 0 || !Number.isSafeInteger(usage?.output_tokens) || usage.output_tokens < 0) return null;
  const cost = estimateMicroUsd(usage.input_tokens, usage.output_tokens);
  if (usage.input_tokens > entry.input_token_allowance || usage.output_tokens > entry.max_output_tokens || cost > entry.reserved_micro_usd) return null;
  return cost;
}

export async function runLiveBatch({ dataset, prompt, key, root, limit = 1, budgetCents = 200, transport, mode = 'live', caseIds, maxOutputTokens = 10000, onAttempt = () => {} }) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > dataset.cases.length) throw new Error('Invalid attempt limit.');
  if (!key?.trim()) throw new Error('Save a capstone API key in .env.local first.');
  const plan = await createLivePlan({ dataset, prompt, budgetCents, mode, caseIds, maxOutputTokens });
  await mkdir(root, { recursive: true });
  const lockPath = join(root, 'running.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { throw new Error('This batch is running or has a stale lock. Inspect its receipts before continuing.'); }
  try {
    const planPath = join(root, 'plan.json');
    try {
      const file = await open(planPath, 'wx', 0o600);
      try { await file.writeFile(bytes(plan)); await file.sync(); } finally { await file.close(); }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (await readFile(planPath, 'utf8') !== bytes(plan)) throw new Error('Batch configuration changed. No new call was made.');
    }
    const attemptsDir = join(root, 'attempts');
    await mkdir(attemptsDir, { recursive: true });
    const store = createAttemptStore(attemptsDir);
    const folders = await readdir(attemptsDir);
    if (folders.length) await packageRunFromAttempts(attemptsDir, dataset, 'preflight');
    const completed = new Set(); const estimates = []; const attempted = [];
    for (const id of folders) {
      const receipt = await store.read(id);
      const entry = plan.cases.find(item => item.id === receipt.scenario_id);
      if (!entry) throw new Error('An existing attempt is outside the declared selection.');
      if (receipt.status !== 'succeeded') throw new Error('This batch contains a failed or unfinished attempt. No automatic retry or further call was made.');
      const estimate = usageEstimate(receipt, entry);
      if (estimate === null) throw new Error('An earlier request has unknown or excessive usage. No further call was made.');
      completed.add(entry.id); estimates.push(estimate);
    }
    let stopped = null;
    for (const entry of dataset.cases.filter(item => plan.cases.some(selected => selected.id === item.id) && !completed.has(item.id)).slice(0, limit)) {
      const result = await capturePackageAttempt({ input: entry.input, profile: dataset.profile, prompt, model: LIVE_MODEL, key, store, transport, mode, maxOutputTokens });
      const receipt = result.run_id && result.receipt_saved ? await store.read(result.run_id) : null;
      const allowance = plan.cases.find(item => item.id === entry.id);
      const estimate = receipt ? usageEstimate(receipt, allowance) : null;
      if (estimate !== null) estimates.push(estimate);
      const summary = { case_id: entry.id, attempt_id: result.run_id, ok: result.ok, status: result.status ?? 'succeeded',
        dispatched: result.dispatched, receipt_saved: result.receipt_saved, estimated_micro_usd: estimate,
        model: receipt?.meta?.model ?? null, usage: receipt?.meta?.usage ?? null, latency_ms: receipt?.meta?.latency_ms ?? null };
      attempted.push(summary); await onAttempt(summary);
      if (!result.ok || estimate === null) { stopped = result.ok ? 'unknown_or_excessive_usage' : result.status; break; }
      completed.add(entry.id);
    }
    return { plan, attemptsDir, attempted, completed: completed.size, stopped, usage_estimate_micro_usd: estimates.reduce((sum, value) => sum + value, 0) };
  } finally { await lock.close(); await unlink(lockPath); }
}
