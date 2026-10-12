import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHostedPackageAllowance } from '../lib/hosted/allowance.mjs';
import { createAttemptStore } from '../lib/attempt-store.mjs';
import { packageOutputSchema } from '../lib/package-contract.mjs';

const request = { model: 'gpt-6.1-sol', store: false, reasoning: { effort: 'medium' }, max_output_tokens: 7500,
  instructions: 'Extract the synthetic event facts.',
  input: [{ role: 'user', content: JSON.stringify({ messages: [{ id: 'sample', role: 'conversation', body: 'Fictional event for 20 guests.' }], vocabulary: {} }) }],
  text: { format: { type: 'json_schema', name: 'event_package_record', strict: true, schema: packageOutputSchema } } };

async function setup(t, maxAttempts = 2) {
  const root = await fs.mkdtemp(join(tmpdir(), 'eventbrief-hosted-allowance-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = { fs, directory: join(root, 'global'), templates: [request], attemptStore: createAttemptStore(join(root, 'visitor-a')), maxAttempts };
  return { root, options, allowance: await createHostedPackageAllowance(options) };
}
async function attempt(allowance, selectedRequest = request, callback = () => {}) {
  return allowance.run({ request: selectedRequest, execute: async () => {
    callback();
    const id = await allowance.store.begin({ request: selectedRequest, mode: 'simulated', scenario_id: 'synthetic' });
    await allowance.store.finish(id, { status: 'succeeded', meta: { usage: { input_tokens: 10, output_tokens: 10 } } });
    return id;
  } });
}

test('hosted slots are permanently reserved and a new instance cannot refill the allowance', async t => {
  const { options, allowance } = await setup(t);
  const first = await attempt(allowance);
  assert.equal((await allowance.store.read(first)).status, 'succeeded');
  const restarted = await createHostedPackageAllowance(options);
  const state = await restarted.status();
  assert.equal(state.remaining, 1);
  assert.equal(state.used, 1);
  assert.equal(state.reserved_micro_usd, 205000);
  assert.equal(state.budget_cents, 41);
  assert.equal('last_attempt' in state, false);
  assert.equal('last_successful' in state, false);
  assert.deepEqual(await restarted.history(), []);
  await attempt(restarted);
  await assert.rejects(attempt(allowance), /used up/);
  assert.equal((await allowance.status()).remaining, 0);
});

test('two independent instances competing for the final global slot dispatch at most once', async t => {
  const { root, options, allowance } = await setup(t);
  await attempt(allowance);
  const otherVisitor = await createHostedPackageAllowance({ ...options, attemptStore: createAttemptStore(join(root, 'visitor-b')) });
  let dispatched = 0;
  const results = await Promise.allSettled([attempt(allowance, request, () => dispatched++), attempt(otherVisitor, request, () => dispatched++)]);
  assert.equal(dispatched, 1);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal((await otherVisitor.status()).remaining, 0);
});

test('reservation remains spent when execution fails or the final receipt is missing', async t => {
  const { options, allowance } = await setup(t);
  await assert.rejects(allowance.run({ request, execute: async () => { throw Error('synthetic interrupted request'); } }), /interrupted/);
  await allowance.run({ request, execute: async () => allowance.store.begin({ request }) });
  const restarted = await createHostedPackageAllowance(options);
  assert.equal((await restarted.status()).remaining, 0);
  assert.equal((await restarted.status()).reserved_micro_usd, 410000);
  await assert.rejects(attempt(restarted), /used up/);
});

test('only the reserved request may begin once and finish its own attempt', async t => {
  const { allowance } = await setup(t);
  await assert.rejects(allowance.store.begin({ request }), /reserved/);
  await assert.rejects(allowance.store.finish('not-a-run', {}), /active/);
  await allowance.run({ request, execute: async () => {
    await assert.rejects(allowance.store.begin({ request: { ...request, instructions: 'changed' } }), /reserved/);
    const id = await allowance.store.begin({ request });
    await assert.rejects(allowance.store.begin({ request }), /reserved/);
    await assert.rejects(allowance.store.finish('not-the-run', {}), /active/);
    await allowance.store.finish(id, { status: 'succeeded' });
    await assert.rejects(allowance.store.finish(id, { status: 'succeeded' }), /active/);
  } });
});

test('oversized messages, altered schema/model/envelope and extra provider inputs reject before dispatch', async t => {
  const { allowance } = await setup(t);
  const variants = [
    { ...request, model: 'other' }, { ...request, store: true }, { ...request, max_output_tokens: 7501 },
    { ...request, instructions: 'changed prompt' }, { ...request, tools: [{ type: 'web_search' }] },
    { ...request, text: { format: { ...request.text.format, schema: {} } } },
    { ...request, input: [...request.input, { role: 'user', content: 'additional provider input' }] },
    { ...request, input: [{ ...request.input[0], extra: 'unapproved' }] },
    { ...request, input: [{ role: 'user', content: JSON.stringify({ messages: [{ body: 'x'.repeat(50000) }], vocabulary: {} }) }] }
  ];
  for (const variant of variants) await assert.rejects(attempt(allowance, variant, () => assert.fail('must not execute')), /size or settings/);
  assert.equal((await allowance.status()).used, 0);
  const allowedChange = { ...request, input: [{ role: 'user', content: JSON.stringify({ messages: [{ body: 'Changed synthetic guest count to 24.' }], vocabulary: {} }) }] };
  await attempt(allowance, allowedChange);
  assert.equal((await allowance.status()).used, 1);
});

test('changed configuration or removed plan cannot create a new allowance', async t => {
  const { options, allowance } = await setup(t);
  await attempt(allowance);
  await assert.rejects(createHostedPackageAllowance({ ...options, maxAttempts: 3 }), /plan/);
  await assert.rejects(createHostedPackageAllowance({ ...options, templates: [{ ...request, instructions: 'new unapproved prompt' }] }), /plan/);
  await assert.rejects(createHostedPackageAllowance({ ...options, maxAttempts: 21 }), /plan/);
  await fs.unlink(join(options.directory, 'plan.json'));
  await assert.rejects(createHostedPackageAllowance(options), /plan/);
  assert.equal((await allowance.status()).paused, true);
});

test('the default ceiling reserves at most $4.10 and corrupted reservations pause AI', async t => {
  const { options, allowance } = await setup(t, 20);
  assert.equal(allowance.plan.total_reserved_micro_usd, 4100000);
  assert.equal((await allowance.status()).remaining, 20);
  await fs.writeFile(join(options.directory, 'slots', '01.json'), 'incomplete reservation');
  assert.equal((await allowance.status()).remaining, 0);
  assert.equal((await allowance.status()).paused, true);
  await assert.rejects(attempt(allowance), /plan/);
});

test('exclusive-write conflicts at writeFile are treated as spent slots', async t => {
  const { options, allowance } = await setup(t);
  await attempt(allowance);
  // Blob commits exclusive objects at writeFile rather than at open.
  const blobStyleFs = { ...fs, async open(path, flags, mode) {
    if (!path.endsWith('01.json')) return fs.open(path, flags, mode);
    return { writeFile: async () => { const error = new Error('exists'); error.code = 'EEXIST'; throw error; }, sync: async () => {}, close: async () => {} };
  } };
  const instance = await createHostedPackageAllowance({ ...options, fs: blobStyleFs });
  await attempt(instance);
  assert.equal((await instance.status()).remaining, 0);
});

test('a request mutated while its reservation is being saved cannot dispatch', async t => {
  const { options } = await setup(t);
  const pending = structuredClone(request);
  let mutate = false;
  const delayedFs = { ...fs, async readFile(path, encoding) {
    const saved = await fs.readFile(path, encoding);
    if (mutate && path.endsWith('plan.json')) pending.max_output_tokens = 10000;
    return saved;
  } };
  const allowance = await createHostedPackageAllowance({ ...options, fs: delayedFs });
  mutate = true;
  await assert.rejects(attempt(allowance, pending, () => assert.fail('must not execute')), /size or settings/);
  assert.equal((await allowance.status()).used, 1);
});
