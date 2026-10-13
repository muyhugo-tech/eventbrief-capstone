import { AsyncLocalStorage } from 'node:async_hooks';
import { join } from 'node:path';
import { PackageAllowanceError } from '../package-allowance.mjs';
import { packageHash } from '../package-dataset.mjs';
import { packageOutputSchema } from '../package-contract.mjs';
import { LIVE_MODEL, LIVE_RATES } from '../package-live-evaluation.mjs';
import { withoutLessons } from '../coordinator-feedback.mjs';

const MAX_REQUEST_BYTES = 50000;
const OUTPUT_TOKENS = 7500;
const INPUT_OVERHEAD = 2000;
const SLOT_MICRO_USD = 205000;
const PLAN_ID = 'eventbrief-hosted-ai-v1';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const changed = () => new PackageAllowanceError('The hosted AI spending plan needs checking. AI stays off.');
const unsupported = () => new PackageAllowanceError('These messages exceed the supported AI size or settings.');

function envelope(request) {
  try {
    if (!object(request) || request.model !== LIVE_MODEL || request.store !== false || request.max_output_tokens !== OUTPUT_TOKENS ||
        request.reasoning?.effort !== 'medium' || typeof request.instructions !== 'string' || !request.instructions.trim() ||
        request.text?.format?.type !== 'json_schema' || request.text.format.name !== 'event_package_record' || request.text.format.strict !== true ||
        packageHash(request.text.format.schema) !== packageHash(packageOutputSchema) ||
        !Array.isArray(request.input) || request.input.length !== 1 || request.input[0]?.role !== 'user' ||
        Object.keys(request.input[0]).sort().join('|') !== 'content|role' || typeof request.input[0].content !== 'string') throw unsupported();
    const content = JSON.parse(request.input[0].content);
    if (!object(content) || !Array.isArray(content.messages) || content.messages.length < 1 || content.messages.length > 50 ||
        content.messages.some(message => !object(message) || typeof message.body !== 'string' || !message.body.trim())) throw unsupported();
    const copy = structuredClone(request);
    copy.input[0].content = { ...withoutLessons(content), messages: [] };
    return packageHash(copy);
  } catch { throw unsupported(); }
}

async function writeOnce(fs, path, bytes) {
  const file = await fs.open(path, 'wx', 0o600);
  try { await file.writeFile(bytes, 'utf8'); await file.sync(); }
  finally { await file.close(); }
}

// directory is one fixed, private, deployment-independent global namespace.
// The injected fs must implement atomic exclusive creation across instances.
// A slot is spent permanently before execute; success, failures, crashes and
// missing final receipts never refund it. No request or visitor data lives here.
export async function createHostedPackageAllowance({ fs, directory, templates, attemptStore, maxAttempts = 20 }) {
  if (!fs || !directory || !attemptStore || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw changed();
  if (!Array.isArray(templates) || !templates.length || templates.some(request => Buffer.byteLength(JSON.stringify(request)) > MAX_REQUEST_BYTES)) throw unsupported();
  if (Math.ceil((MAX_REQUEST_BYTES + INPUT_OVERHEAD) * LIVE_RATES.input_usd_per_million + OUTPUT_TOKENS * LIVE_RATES.output_usd_per_million) !== SLOT_MICRO_USD) throw changed();
  const plan = { schema_version: 'eventbrief.hosted-allowance.v1', id: PLAN_ID, model: LIVE_MODEL, max_attempts: maxAttempts,
    request_envelopes: [...new Set(templates.map(envelope))].sort(), max_request_bytes: MAX_REQUEST_BYTES,
    max_output_tokens: OUTPUT_TOKENS, input_overhead_tokens: INPUT_OVERHEAD, rates: LIVE_RATES,
    slot_reserved_micro_usd: SLOT_MICRO_USD, total_reserved_micro_usd: SLOT_MICRO_USD * maxAttempts };
  const planBytes = JSON.stringify(plan) + '\n';
  const planHash = packageHash(plan);
  const planPath = join(directory, 'plan.json');
  const slotsDirectory = join(directory, 'slots');
  const names = Array.from({ length: maxAttempts }, (_, index) => `${String(index + 1).padStart(2, '0')}.json`);
  const slotBytes = name => JSON.stringify({ schema_version: 'eventbrief.hosted-reservation.v1', plan_id: PLAN_ID, plan_hash: planHash,
    slot: name, reserved_micro_usd: SLOT_MICRO_USD }) + '\n';
  await fs.mkdir(slotsDirectory, { recursive: true });
  try {
    const saved = await fs.readFile(planPath, 'utf8');
    if (saved !== planBytes) throw changed();
  } catch (error) {
    if (error.code !== 'ENOENT') throw changed();
    // An absent plan with spent slots cannot be treated as a fresh allowance.
    if ((await fs.readdir(slotsDirectory)).length) throw changed();
    try { await writeOnce(fs, planPath, planBytes); }
    catch (writeError) {
      if (writeError.code !== 'EEXIST' || await fs.readFile(planPath, 'utf8') !== planBytes) throw changed();
    }
  }
  const context = new AsyncLocalStorage();
  const store = {
    async begin(data) {
      const active = context.getStore();
      if (!active || active.closed || active.begun || packageHash(data?.request) !== active.requestHash) throw new PackageAllowanceError('No matching AI request has reserved an allowance.');
      active.begun = true;
      active.runId = await attemptStore.begin(data);
      return active.runId;
    },
    async finish(id, data) {
      const active = context.getStore();
      if (!active?.runId || active.closed || active.runId !== id || active.finished) throw new PackageAllowanceError('No matching AI attempt is active.');
      active.finished = true;
      return attemptStore.finish(id, data);
    },
    read: id => attemptStore.read(id)
  };
  async function state() {
    if (await fs.readFile(planPath, 'utf8') !== planBytes) throw changed();
    const entries = await fs.readdir(slotsDirectory);
    for (const name of entries) {
      if (!names.includes(name) || await fs.readFile(join(slotsDirectory, name), 'utf8') !== slotBytes(name)) throw changed();
    }
    return entries.length;
  }
  async function status() {
    try {
      const used = await state();
      return { remaining: maxAttempts - used, used, reserved_micro_usd: used * SLOT_MICRO_USD,
        budget_cents: Math.ceil(maxAttempts * SLOT_MICRO_USD / 10000), limit_kind: 'persistent', paused: false, in_flight: false };
    } catch { return { remaining: 0, paused: true, in_flight: false, limit_kind: 'persistent' }; }
  }
  async function run({ request, execute }) {
    if (typeof execute !== 'function' || Buffer.byteLength(JSON.stringify(request)) > MAX_REQUEST_BYTES || !plan.request_envelopes.includes(envelope(request))) throw unsupported();
    const requestHash = packageHash(request);
    await state();
    for (const name of names) {
      try { await writeOnce(fs, join(slotsDirectory, name), slotBytes(name)); }
      catch (error) { if (error.code === 'EEXIST') continue; throw changed(); }
      if (packageHash(request) !== requestHash) throw unsupported();
      const active = { requestHash, begun: false, finished: false, runId: null, closed: false };
      try { return await context.run(active, execute); }
      finally { active.closed = true; }
    }
    throw new PackageAllowanceError('The hosted AI allowance is used up. Saved drafts and the public sample remain available.');
  }
  return { store, status, run, plan, history: async () => [] };
}
