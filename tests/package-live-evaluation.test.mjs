import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackageDataset } from '../lib/package-dataset.mjs';
import { createLivePlan, runLiveBatch, LIVE_MODEL } from '../lib/package-live-evaluation.mjs';

const dataset = await loadPackageDataset();
const prompt = await readFile(new URL('../prompts/extract-package-v2.txt', import.meta.url), 'utf8');
const setup = async () => ({ dataset, prompt, key: 'fake-key-not-for-network', mode: 'simulated', root: await mkdtemp(join(tmpdir(), 'eventbrief-batch-')) });
const response = (request, usage = { input_tokens: 1000, output_tokens: 1000 }) => {
  const messages = JSON.parse(request.input[0].content).messages;
  const entry = dataset.cases.find(item => JSON.stringify(item.input.messages) === JSON.stringify(messages));
  return { status: 200, ok: true, body: JSON.stringify({ status: 'completed', model: LIVE_MODEL, usage,
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(entry.expected.record) }] }] }) };
};

test('budget preview rejects oversized and insufficient budgets before any dispatch', async () => {
  const plan = await createLivePlan({ dataset, prompt });
  assert.equal(plan.cases.length, 12);
  assert.ok(plan.reserved_micro_usd < 2000000);
  await assert.rejects(createLivePlan({ dataset, prompt, budgetCents: 201 }), /at most/);
  const options = await setup(); let calls = 0;
  await assert.rejects(runLiveBatch({ ...options, budgetCents: 1, transport: async () => { calls++; } }), /exceed/);
  assert.equal(calls, 0);
});

test('a declared subset sends only selected inputs and rejects duplicate or unknown cases', async () => {
  const options = await setup(); const sent = [];
  const caseIds = ['category-missing', 'capacity-exceeded'];
  const result = await runLiveBatch({ ...options, caseIds, limit: 12, budgetCents: 50,
    transport: async ({request}) => { sent.push(request); return response(request); } });
  assert.deepEqual(result.attempted.map(item => item.case_id), caseIds);
  assert.equal(sent.length, 2); assert.equal(result.plan.dataset.sha256, dataset.sha256);
  assert.equal(result.plan.cases.length, 2);
  await assert.rejects(createLivePlan({dataset,prompt,caseIds:['complete','complete']}), /unique cases/);
  await assert.rejects(createLivePlan({dataset,prompt,caseIds:['invented']}), /unique cases/);
});

test('bounded resume advances to the next case and preserves the original receipt', async () => {
  const options = await setup(); let calls = 0;
  const transport = async ({ request }) => { calls++; return response(request); };
  const first = await runLiveBatch({ ...options, transport });
  assert.equal(first.completed, 1); assert.equal(first.attempted[0].case_id, 'complete');
  const receiptPath = join(first.attemptsDir, first.attempted[0].attempt_id, 'receipt.json');
  const original = await readFile(receiptPath, 'utf8');
  const second = await runLiveBatch({ ...options, transport });
  assert.equal(second.completed, 2); assert.equal(second.attempted[0].case_id, 'dietary-missing');
  assert.equal(calls, 2); assert.equal(await readFile(receiptPath, 'utf8'), original);
  assert.ok(!(await readFile(join(options.root, 'plan.json'), 'utf8')).includes(options.key));
});

test('a failed provider request stops the batch and is never automatically retried', async () => {
  const options = await setup(); let calls = 0;
  const transport = async () => { calls++; throw new Error('Secret-bearing exception'); };
  const result = await runLiveBatch({ ...options, limit: 12, transport });
  assert.equal(result.stopped, 'transport_error'); assert.equal(calls, 1);
  await assert.rejects(runLiveBatch({ ...options, transport }), /failed or unfinished/);
  assert.equal(calls, 1);
});

test('unknown or excessive usage stops paid dispatch and prevents resume', async () => {
  for (const usage of [null, { input_tokens: 1000000, output_tokens: 1000 }]) {
    const options = await setup(); let calls = 0;
    const transport = async ({ request }) => { calls++; return response(request, usage); };
    const result = await runLiveBatch({ ...options, limit: 12, transport });
    assert.equal(result.stopped, 'unknown_or_excessive_usage'); assert.equal(calls, 1);
    await assert.rejects(runLiveBatch({ ...options, transport }), /unknown or excessive usage/);
    assert.equal(calls, 1);
  }
});

test('a changed prompt cannot enter an existing paid batch', async () => {
  const options = await setup(); let calls = 0;
  const transport = async ({ request }) => { calls++; return response(request); };
  await runLiveBatch({ ...options, transport });
  await assert.rejects(runLiveBatch({ ...options, prompt: prompt + '\nChanged.', transport }), /configuration changed/);
  assert.equal(calls, 1); assert.equal((await readdir(join(options.root, 'attempts'))).length, 1);
});

test('a lower output allowance is recorded, reconstructed, and cannot change on resume', async () => {
  const options = await setup(); let calls = 0;
  const transport = async ({ request }) => { calls++; assert.equal(request.max_output_tokens, 7500); return response(request); };
  const first = await runLiveBatch({ ...options, transport, maxOutputTokens: 7500, budgetCents: 153 });
  assert.ok(first.plan.cases.every(item => item.max_output_tokens === 7500));
  const second = await runLiveBatch({ ...options, transport, maxOutputTokens: 7500, budgetCents: 153 });
  assert.equal(second.completed, 2); assert.equal(calls, 2);
  await assert.rejects(runLiveBatch({ ...options, transport, maxOutputTokens: 10000, budgetCents: 200 }), /configuration changed/);
  await assert.rejects(createLivePlan({ dataset, prompt, maxOutputTokens: 10001 }), /output-token allowance/);
  assert.equal(calls, 2);
});

test('the batch lock prevents overlapping paid calls', async () => {
  const options = await setup(); let release, signal; let calls = 0;
  const entered = new Promise(resolve => { signal = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const transport = async ({ request }) => { calls++; signal(); await blocked; return response(request); };
  const first = runLiveBatch({ ...options, transport });
  await entered;
  await assert.rejects(runLiveBatch({ ...options, transport }), /running or has a stale lock/);
  release(); await first; assert.equal(calls, 1);
});
