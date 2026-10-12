import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadDataset, projectRoot, jsonSha256 } from '../lib/dataset.mjs';
import { evaluateSavedFile, writeImmutable } from '../lib/evaluation-report.mjs';
import { buildSelfCheckRuns } from '../evaluation/self-check-runs.mjs';

const dataset = await loadDataset();
const directory = join(projectRoot, 'out/evaluation/v1/self-checks');
await mkdir(directory, { recursive: true });
for (const [kind, run] of Object.entries(buildSelfCheckRuns(dataset))) {
  const inputPath = join(directory, `${run.run_id}--${jsonSha256(run).slice(0, 16)}.saved.json`);
  await writeImmutable(inputPath, JSON.stringify(run, null, 2) + '\n');
  const { report, path } = await evaluateSavedFile({ inputPath, outDir: directory, dataset });
  const metrics = report.metrics;
  // Hand-counted test-vector totals, not calculated from scoreRun or its helpers.
  const expected = kind === 'good'
    ? { values: 36, statuses: 36, pairs: 36, cases: 12, agreements: [0, 26], citations: [60, 60], coverage: [39, 39] }
    : { values: 21, statuses: 25, pairs: 20, cases: 2, agreements: [6, 22], citations: [46, 48], coverage: [31, 36] };
  assert.deepEqual([metrics.fields.value_correct.numerator, metrics.fields.value_correct.denominator], [expected.values, 36]);
  assert.equal(metrics.fields.status_correct.numerator, expected.statuses);
  assert.equal(metrics.fields.value_and_status_correct.numerator, expected.pairs);
  assert.deepEqual([metrics.structured_case_passes.numerator, metrics.structured_case_passes.denominator], [expected.cases, 12]);
  for (const [metric, pair] of [
    [metrics.unsupported_agreements.errors_per_agreement_claim, expected.agreements],
    [metrics.evidence.exact_citations, expected.citations],
    [metrics.evidence.claims_with_valid_evidence, expected.coverage]
  ]) assert.deepEqual([metric.numerator, metric.denominator], pair);
  assert.equal(metrics.questions.precision, null);
  assert.equal(metrics.questions.recall, null);
  assert.equal(metrics.full_semantic_case_passes.numerator, null);
  console.log(`PASS ${kind}: scorer self-check only; ${expected.pairs}/36 field pairs, ${expected.cases}/12 structured cases.`);
  console.log(`Saved outputs: ${inputPath}`);
  console.log(`Report: ${path}`);
}
console.log('No model was called. No model-performance claim is established by these self-checks.');
