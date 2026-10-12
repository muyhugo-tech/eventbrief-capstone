import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadPackageDataset, packageManifest, packageHash } from '../lib/package-dataset.mjs';
import { scorePackageRun } from '../lib/package-evaluation.mjs';
import { writePackageReport, packageRunFromAttempts } from '../lib/package-evaluation-report.mjs';
import { buildPackageSelfChecks } from '../evaluation/package-v1/self-check-runs.mjs';
import { createAttemptStore } from '../lib/attempt-store.mjs';
import { capturePackageAttempt, buildPackageRequest } from '../lib/package-provider.mjs';
import { fingerprint } from '../lib/event-package.mjs';
import { packageOutputSchema } from '../lib/package-contract.mjs';
import { sha256, projectRoot } from '../lib/dataset.mjs';

const dataset = await loadPackageDataset();
const vectors = () => buildPackageSelfChecks(dataset);
const temporary = () => mkdtemp(join(tmpdir(), 'eventbrief-package-eval-'));

test('separate frozen package suite has 12 cases, 216 field pairs, 60 document decisions and input/answer separation', () => {
  assert.equal(dataset.cases.length, 12);
  assert.equal(dataset.version, 'package-development-v1');
  assert.equal(dataset.profile.categories.guest_13_plus_count.label, 'Guests');
  for (const entry of dataset.cases) {
    const request = buildPackageRequest(entry.input, dataset.profile, 'Extract.', 'fake-model');
    assert.deepEqual(Object.keys(JSON.parse(request.input[0].content)).sort(), ['messages', 'vocabulary']);
    assert.ok(!request.input[0].content.includes('document_states'));
    assert.ok(!request.input[0].content.includes('manual_review'));
  }
});

test('authored self-check totals are hand counted and semantic errors remain visibly unscored', () => {
  const { good, bad } = vectors();
  const a = scorePackageRun(good, dataset); const b = scorePackageRun(bad, dataset);
  assert.deepEqual([a.metrics.field_pairs.numerator, a.metrics.field_pairs.denominator], [216, 216]);
  assert.deepEqual([a.metrics.document_readiness.numerator, a.metrics.document_readiness.denominator], [60, 60]);
  assert.equal(a.metrics.structured_cases.numerator, 12);
  assert.equal(a.metrics.quote_cases.numerator, 12);
  assert.equal(b.metrics.field_pairs.numerator, 157);
  assert.equal(b.metrics.document_readiness.numerator, 34);
  assert.equal(b.metrics.quote_cases.numerator, 7);
  assert.equal(b.metrics.structured_cases.numerator, 4);
  assert.equal(b.metrics.receipts.errors.numerator, 1);
  assert.equal(b.metrics.receipts.started.numerator, 1);
  assert.equal(b.metrics.receipts.missing.numerator, 1);
  assert.equal(b.metrics.mismatched_agreement_claims.numerator, 1);
  assert.equal(b.metrics.full_semantic_cases.numerator, null);
  const subtle = b.cases.find(item => item.case_id === 'count-conflict');
  assert.equal(subtle.structured_pass, true);
  assert.match(subtle.manual_review.questions_actual[0].question, /dessert/);
  assert.equal(subtle.manual_review.status, 'unscored');
  assert.equal(b.cases[0].guest_boundary.leaks[0].document, 'guest');
});

test('empty, failed and malformed outputs retain fixed denominators and never get a null-quote pass', () => {
  const empty = vectors().good; empty.cases = [];
  const a = scorePackageRun(empty, dataset);
  assert.equal(a.metrics.receipts.missing.numerator, 12);
  assert.deepEqual([a.metrics.field_pairs.numerator, a.metrics.field_pairs.denominator], [0, 216]);
  assert.deepEqual([a.metrics.document_readiness.numerator, a.metrics.document_readiness.denominator], [0, 60]);
  assert.deepEqual([a.metrics.quote_cases.numerator, a.metrics.quote_cases.denominator], [0, 12]);
  assert.equal(a.metrics.evidence.exact_citations.rate, null);
  assert.equal(a.metrics.evidence.expected_claim_coverage.numerator, 0);
  const malformed = vectors().good;
  malformed.cases[0].output = null;
  const b = scorePackageRun(malformed, dataset);
  assert.equal(b.metrics.receipts.completed.numerator, 12);
  assert.equal(b.metrics.field_pairs.numerator, 198);
  assert.equal(b.cases[0].valid, false);
});

test('duplicate cases, changed dataset identity and unsupported run labels are rejected', () => {
  for (const mutate of [run => run.cases.push(run.cases[0]), run => run.cases[0].case_id = 'not-in-suite',
    run => run.dataset.sha256 = 'bad', run => run.purpose = 'accuracy-proven',
    run => { run.cases[0].status = 'error'; run.cases[0].error = { kind: 'bad' }; }]) {
    const run = vectors().good; mutate(run); assert.throws(() => scorePackageRun(run, dataset));
  }
});

test('frozen package hashes ignore formatting but reject changed expectations and unsafe paths', async () => {
  const root = await temporary();
  const original = JSON.parse(await readFile(packageManifest, 'utf8'));
  await mkdir(join(root, 'inputs')); await mkdir(join(root, 'expected'));
  await writeFile(join(root, 'profile.json'), JSON.stringify(dataset.profile));
  for (const entry of dataset.cases) {
    await writeFile(join(root, `inputs/${entry.id}.json`), JSON.stringify(entry.input));
    await writeFile(join(root, `expected/${entry.id}.json`), JSON.stringify(entry.expected));
  }
  const manifestPath = join(root, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(original));
  assert.equal((await loadPackageDataset(manifestPath)).sha256, dataset.sha256);
  const expected = structuredClone(dataset.cases[0].expected); expected.record.fields.host_name.value = 'Changed';
  await writeFile(join(root, 'expected/complete.json'), JSON.stringify(expected));
  await assert.rejects(loadPackageDataset(manifestPath), /Frozen package expectation changed/);
  original.cases[0].input = '../secret.json'; await writeFile(manifestPath, JSON.stringify(original));
  await assert.rejects(loadPackageDataset(manifestPath));
});

test('captured fake-provider batches include failed and unfinished attempts, reject retries and separate source modes', async () => {
  const root = await temporary(); const store = createAttemptStore(root);
  const completed = dataset.cases[0]; const failed = dataset.cases[1]; const unfinished = dataset.cases[2];
  const envelope = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(completed.expected.record) }] }] };
  await capturePackageAttempt({ input: completed.input, profile: dataset.profile, prompt: 'Frozen test prompt.', model: 'fake-model', key: 'fake', mode: 'simulated', store,
    transport: async () => ({ ok: true, status: 200, body: JSON.stringify(envelope) }) });
  await capturePackageAttempt({ input: failed.input, profile: dataset.profile, prompt: 'Frozen test prompt.', model: 'fake-model', key: 'fake', mode: 'simulated', store,
    transport: async () => ({ ok: false, status: 429, body: 'Authored HTTP error' }) });
  const first = await store.read((await readdir(root))[0]);
  const request = buildPackageRequest(unfinished.input, dataset.profile, 'Frozen test prompt.', 'fake-model');
  const id = await store.begin({ scenario_id: unfinished.id, mode: 'simulated', purpose: 'fake_provider_test', input: unfinished.input, profile: dataset.profile,
    input_hash: fingerprint(unfinished.input), profile_hash: fingerprint(dataset.profile), request, request_hash: fingerprint(request),
    prompt_hash: sha256(request.instructions), schema_hash: sha256(JSON.stringify(packageOutputSchema)), implementation: first.implementation });
  const run = await packageRunFromAttempts(root, dataset, 'fake-captured-batch');
  assert.equal(run.purpose, 'fake_provider_test');
  assert.equal(run.cases.length, 3);
  const report = scorePackageRun(run, dataset);
  assert.equal(report.metrics.receipts.errors.numerator, 1);
  assert.equal(report.metrics.receipts.started.numerator, 1);
  assert.equal(report.metrics.receipts.missing.numerator, 9);
  assert.equal(report.metrics.structured_cases.numerator, 1);
  await store.begin({ ...(await store.read(id)), scenario_id: unfinished.id });
  await assert.rejects(packageRunFromAttempts(root, dataset, 'duplicate-batch'), /Multiple attempts/);
});

test('receipt conversion rejects source, request and model-configuration mismatches', async () => {
  const entry = dataset.cases[0];
  for (const mutate of [
    data => { data.input.messages[0].body = 'Changed source'; data.input_hash = fingerprint(data.input); },
    data => { data.request.input[0].content = '{}'; data.request_hash = fingerprint(data.request); },
    data => { data.profile.version = 'wrong'; data.profile_hash = fingerprint(data.profile); }
  ]) {
    const root = await temporary(); const store = createAttemptStore(root);
    const request = buildPackageRequest(entry.input, dataset.profile, 'Test.', 'fake-model');
    const data = { scenario_id: entry.id, mode: 'simulated', purpose: 'fake_provider_test', input: structuredClone(entry.input), profile: structuredClone(dataset.profile),
      input_hash: fingerprint(entry.input), profile_hash: fingerprint(dataset.profile), request, request_hash: fingerprint(request), prompt_hash: sha256('Test.'), implementation: {} };
    mutate(data); await store.begin(data);
    await assert.rejects(packageRunFromAttempts(root, dataset, 'bad-batch'), /mismatch|does not match/);
  }
  for (const variation of ['prompt', 'mode', 'implementation']) {
    const root = await temporary(); const store = createAttemptStore(root);
    for (const [index, item] of dataset.cases.slice(0, 2).entries()) {
      const prompt = index === 1 && variation === 'prompt' ? 'Different prompt.' : 'Frozen prompt.';
      const request = buildPackageRequest(item.input, dataset.profile, prompt, 'fake-model');
      const mode = index === 1 && variation === 'mode' ? 'live' : 'simulated';
      await store.begin({ scenario_id: item.id, mode, purpose: mode === 'live' ? 'development_model_run' : 'fake_provider_test',
        input: item.input, profile: dataset.profile, input_hash: fingerprint(item.input), profile_hash: fingerprint(dataset.profile),
        request, request_hash: fingerprint(request), prompt_hash: sha256(prompt), schema_hash: sha256(JSON.stringify(packageOutputSchema)),
        implementation: { 'package-provider.mjs': index === 1 && variation === 'implementation' ? 'b'.repeat(64) : 'a'.repeat(64) } });
    }
    await assert.rejects(packageRunFromAttempts(root, dataset, 'mixed-batch'), /Batch mixes/);
  }
});

test('package reports are reproducible and CLI writes a failing gate before exit 2', async () => {
  const outDir = await temporary(); const run = vectors().bad;
  const a = await writePackageReport({ run, dataset, outDir }); const b = await writePackageReport({ run, dataset, outDir });
  assert.equal(a.path, b.path);
  assert.equal(await readFile(a.path, 'utf8'), await readFile(b.path, 'utf8'));
  assert.equal(a.report.reproducibility.saved_run_sha256, packageHash(run));
  const inputPath = join(outDir, 'saved.json'); await writeFile(inputPath, JSON.stringify(run));
  const result = spawnSync(process.execPath, ['scripts/evaluate-package.mjs', '--input', inputPath, '--out-dir', outDir, '--require-structured-pass'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /Structured cases: 4\/12/);
  assert.match(result.stdout, /Report:/);
  await writeFile(a.path, 'different');
  await assert.rejects(writePackageReport({ run, dataset, outDir }), /Refusing to replace/);
});
