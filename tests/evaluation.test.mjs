import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadDataset, validateInput, projectRoot, jsonSha256 } from '../lib/dataset.mjs';
import { ratio, scoreRun } from '../lib/evaluation.mjs';
import { evaluateSavedFile, writeImmutable } from '../lib/evaluation-report.mjs';
import { buildRequest } from '../lib/provider.mjs';
import { buildSelfCheckRuns } from '../evaluation/self-check-runs.mjs';

const dataset = await loadDataset();
const runs = buildSelfCheckRuns(dataset);
const copy = () => structuredClone(runs.good);
const pair = metric => [metric.numerator, metric.denominator];
const caseOutput = (run, id) => run.cases.find(entry => entry.case_id === id).output;
await mkdir(join(projectRoot, 'out/evaluation/tests'), { recursive: true });
const temporaryDirectory = await mkdtemp(join(projectRoot, 'out/evaluation/tests/run-'));

test('frozen suite contains three starter and nine development cases, with request/answer separation', () => {
  assert.equal(dataset.cases.length, 12);
  assert.equal(dataset.cases.filter(entry => entry.group === 'starter').length, 3);
  assert.equal(dataset.cases.filter(entry => entry.group === 'development').length, 9);
  for (const entry of dataset.cases) {
    const request = buildRequest(entry.input, 'Extract.', 'fake');
    assert.deepEqual(JSON.parse(request.input[0].content), { messages: entry.input.messages });
    assert.ok(!JSON.stringify(request).includes(entry.expected.rationale));
    assert.ok(!Object.hasOwn(entry.input, 'expected'));
  }
});

test('dataset hashing ignores JSON formatting but rejects changed frozen references', async () => {
  const manifest = JSON.parse(await readFile(join(projectRoot, 'evaluation/dataset-v1.json'), 'utf8'));
  assert.equal(jsonSha256(JSON.parse(JSON.stringify(manifest, null, 4))), dataset.sha256);
  manifest.cases[0].expected_sha256 = '0'.repeat(64);
  const path = join(temporaryDirectory, 'changed-manifest.json');
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(loadDataset(path), /Expected answer changed since freeze/);
});

test('input checks reject answer leakage, duplicate messages, and chronology errors', () => {
  for (const mutate of [
    input => { input.expected = {}; },
    input => { input.messages[1].id = input.messages[0].id; },
    input => { input.messages[1].sent_at = input.messages[0].sent_at; }
  ]) {
    const input = structuredClone(dataset.cases[1].input);
    mutate(input);
    assert.throws(() => validateInput(input, input.id));
  }
});

test('known-good authored outputs have hand-counted denominators and explicitly unscored semantics', () => {
  const report = scoreRun(runs.good, dataset);
  const metrics = report.metrics;
  assert.equal(report.purpose, 'scorer_self_check');
  assert.match(report.label, /not model performance/);
  assert.deepEqual(pair(metrics.fields.value_correct), [36, 36]);
  assert.deepEqual(pair(metrics.fields.status_correct), [36, 36]);
  assert.deepEqual(pair(metrics.fields.value_and_status_correct), [36, 36]);
  for (const field of Object.values(metrics.by_field)) assert.deepEqual(pair(field.value_and_status_correct), [12, 12]);
  assert.deepEqual(pair(metrics.structured_case_passes), [12, 12]);
  assert.deepEqual(pair(metrics.contract_and_source_valid_cases), [12, 12]);
  assert.deepEqual(pair(metrics.evidence.exact_citations), [60, 60]);
  assert.deepEqual(pair(metrics.evidence.claims_with_valid_evidence), [39, 39]);
  assert.deepEqual(pair(metrics.pending_changes.precision), [2, 2]);
  assert.deepEqual(pair(metrics.pending_changes.recall), [2, 2]);
  assert.deepEqual(pair(metrics.unsupported_agreements.errors_per_agreement_claim), [0, 26]);
  assert.deepEqual(pair(report.by_group.starter.structured_case_passes), [3, 3]);
  assert.deepEqual(pair(report.by_group.development.structured_case_passes), [9, 9]);
  assert.equal(metrics.full_semantic_case_passes.numerator, null);
  assert.deepEqual(metrics.questions, { precision: null, recall: null, status: 'manual/unscored' });
});

test('deliberately flawed authored outputs expose exact arithmetic, failures, and source limits', () => {
  const report = scoreRun(runs.flawed, dataset);
  const metrics = report.metrics;
  assert.deepEqual(pair(metrics.receipts.completed), [10, 12]);
  assert.deepEqual(pair(metrics.receipts.errors), [1, 12]);
  assert.deepEqual(pair(metrics.receipts.missing), [1, 12]);
  assert.deepEqual(pair(metrics.fields.value_correct), [21, 36]);
  assert.deepEqual(pair(metrics.fields.status_correct), [25, 36]);
  assert.deepEqual(pair(metrics.fields.value_and_status_correct), [20, 36]);
  assert.deepEqual(pair(metrics.contract_and_source_valid_cases), [6, 12]);
  assert.deepEqual(pair(metrics.evidence.exact_citations), [46, 48]);
  assert.deepEqual(pair(metrics.evidence.claims_with_valid_evidence), [31, 36]);
  assert.deepEqual(pair(metrics.evidence.all_evidence_valid_cases), [7, 12]);
  assert.deepEqual(pair(metrics.pending_changes.precision), [1, 2]);
  assert.deepEqual(pair(metrics.pending_changes.recall), [1, 2]);
  assert.deepEqual(pair(metrics.pending_changes.exact_cases), [7, 12]);
  assert.deepEqual(pair(metrics.unsupported_agreements.errors_per_agreement_claim), [6, 22]);
  assert.deepEqual(pair(metrics.unsupported_agreements.affected_cases), [4, 12]);
  assert.deepEqual(pair(metrics.structured_case_passes), [2, 12]);
  assert.deepEqual(report.cases.filter(item => item.structured_case_pass).map(item => item.case_id), ['07-answered-access', '11-partial-answers']);
  const injection = report.cases.find(item => item.case_id === '10-message-instructions');
  assert.equal(injection.evidence.all_evidence_valid, true);
  assert.equal(injection.agreements.errors.length, 3);
  assert.equal(injection.structured_case_pass, false);
});

test('missing runs never shrink expected denominators or turn zero observations into a rate', () => {
  const run = copy();
  run.cases = [];
  const metrics = scoreRun(run, dataset).metrics;
  assert.deepEqual(pair(metrics.receipts.missing), [12, 12]);
  assert.deepEqual(pair(metrics.fields.value_and_status_correct), [0, 36]);
  assert.deepEqual(pair(metrics.structured_case_passes), [0, 12]);
  assert.deepEqual(pair(metrics.pending_changes.recall), [0, 2]);
  assert.equal(metrics.pending_changes.precision.rate, null);
  assert.equal(metrics.unsupported_agreements.errors_per_agreement_claim.rate, null);
  assert.equal(metrics.evidence.exact_citations.rate, null);
  assert.deepEqual(ratio(0, 0), { numerator: 0, denominator: 0, rate: null });
});

test('malformed completed outputs are retained and scored as failures instead of discarded', () => {
  for (const output of [null, 'not valid JSON', 9, [], {}, { fields: [] }, { pending_changes: [null], open_questions: [null] }]) {
    const run = copy();
    run.cases[0].output = output;
    const metrics = scoreRun(run, dataset).metrics;
    assert.deepEqual(pair(metrics.receipts.completed), [12, 12]);
    assert.deepEqual(pair(metrics.fields.value_and_status_correct), [33, 36]);
    assert.deepEqual(pair(metrics.contract_and_source_valid_cases), [11, 12]);
    assert.deepEqual(pair(metrics.structured_case_passes), [11, 12]);
  }
});

test('empty/malformed evidence fails coverage even when remaining exact quotes all match', () => {
  const run = copy();
  const output = caseOutput(run, '02-count-correction');
  output.fields.venue.evidence = [];
  const report = scoreRun(run, dataset);
  assert.deepEqual(pair(report.metrics.fields.value_and_status_correct), [36, 36]);
  assert.deepEqual(pair(report.metrics.evidence.exact_citations), [58, 58]);
  assert.deepEqual(pair(report.metrics.evidence.claims_with_valid_evidence), [38, 39]);
  assert.deepEqual(pair(report.metrics.structured_case_passes), [11, 12]);
  output.fields.venue.evidence = [null, { message_id: 'm1', quote: '' }];
  assert.deepEqual(pair(scoreRun(run, dataset).metrics.evidence.exact_citations), [58, 60]);
});

test('pending changes match once per typed tuple and invalid agreements are counted', () => {
  const run = copy();
  const output = caseOutput(run, '03-pending-date');
  output.pending_changes.push(structuredClone(output.pending_changes[0]));
  assert.deepEqual(pair(scoreRun(run, dataset).metrics.pending_changes.precision), [2, 3]);
  output.pending_changes[0].status = 'agreed';
  const metrics = scoreRun(run, dataset).metrics;
  assert.deepEqual(pair(metrics.unsupported_agreements.errors_per_agreement_claim), [1, 27]);
  assert.deepEqual(pair(metrics.pending_changes.precision), [2, 3]);
  assert.deepEqual(pair(metrics.structured_case_passes), [11, 12]);
});

test('arbitrary question topics and paraphrases are not used as semantic labels', () => {
  const run = copy();
  const question = caseOutput(run, '03-pending-date').open_questions[0];
  question.topic = 'another_free_text_name';
  question.question = 'Would the proposed later date be possible?';
  const metrics = scoreRun(run, dataset).metrics;
  assert.deepEqual(pair(metrics.structured_case_passes), [12, 12]);
  assert.equal(metrics.questions.precision, null);
  assert.equal(metrics.questions.recall, null);
});

test('ambiguous receipts and mismatched datasets are rejected instead of selecting a favorable result', () => {
  for (const mutate of [
    run => { run.cases.push(structuredClone(run.cases[0])); },
    run => { run.cases[0].case_id = 'unknown-case'; },
    run => { run.dataset.sha256 = '0'.repeat(64); },
    run => { run.cases[0].status = 'skipped'; },
    run => { delete run.cases[0].output; },
    run => { run.cases[0].error = { kind: 'error', message: 'error' }; },
    run => { run.cases[0].status = 'error'; run.cases[0].error = { kind: 'error', message: 'error' }; },
    run => { run.purpose = 'model_evaluation'; },
    run => { run.run_id = '../unsafe'; }
  ]) {
    const run = copy();
    mutate(run);
    assert.throws(() => scoreRun(run, dataset));
  }
});

test('saved-output CLI is deterministic, content-addressed, and cannot overwrite a different report', async () => {
  const inputPath = join(temporaryDirectory, 'good.saved.json');
  await writeFile(inputPath, JSON.stringify(runs.good, null, 2) + '\n');
  const options = { inputPath, outDir: temporaryDirectory, dataset };
  const first = await evaluateSavedFile(options);
  const second = await evaluateSavedFile(options);
  assert.equal(first.path, second.path);
  assert.deepEqual(first.report, second.report);
  assert.match(first.path, /self-check-known-good-v1--development-v1--scorer-v1--[a-f0-9]{16}\.json$/);
  assert.equal(first.report.reproducibility.saved_output_bytes_sha256.length, 64);
  assert.equal(first.report.reproducibility.scorer_bundle_sha256.length, 64);
  await assert.rejects(writeImmutable(first.path, 'different content'), /Refusing to replace/);
  const result = spawnSync(process.execPath, ['scripts/evaluate.mjs', '--input', inputPath, '--out-dir', temporaryDirectory, '--require-structured-pass'], {
    cwd: projectRoot, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SCORER SELF-CHECK/);
  assert.match(result.stdout, /full semantic cases: manual\/unscored/);
  assert.ok(result.stdout.includes(first.path));
  assert.equal(await readFile(first.path, 'utf8'), JSON.stringify(first.report, null, 2) + '\n');
});

test('CLI writes failing scores, gates only when requested, and rejects malformed run JSON', async () => {
  const inputPath = join(temporaryDirectory, 'flawed.saved.json');
  await writeFile(inputPath, JSON.stringify(runs.flawed));
  const invoke = args => spawnSync(process.execPath, ['scripts/evaluate.mjs', ...args], { cwd: projectRoot, encoding: 'utf8' });
  const args = ['--input', inputPath, '--out-dir', temporaryDirectory];
  assert.equal(invoke(args).status, 0);
  const gated = invoke([...args, '--require-structured-pass']);
  assert.equal(gated.status, 2, gated.stderr);
  assert.match(gated.stdout, /Field value\/status: 20\/36/);
  assert.match(gated.stdout, /Report:/);
  await writeFile(inputPath, '{broken');
  const bad = invoke(args);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Evaluation failed/);
  assert.equal(invoke(['--help']).status, 0);
  assert.equal(invoke([]).status, 1);
});
