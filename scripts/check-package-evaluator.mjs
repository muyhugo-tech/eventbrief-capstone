import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPackageDataset, packageHash } from '../lib/package-dataset.mjs';
import { writePackageReport } from '../lib/package-evaluation-report.mjs';
import { writeImmutable } from '../lib/evaluation-report.mjs';
import { projectRoot } from '../lib/dataset.mjs';
import { buildPackageSelfChecks } from '../evaluation/package-v1/self-check-runs.mjs';

const dataset = await loadPackageDataset();
const outDir = resolve(projectRoot, 'out/evaluation/package-v1/self-checks');
await mkdir(outDir, { recursive: true });
for (const [kind, run] of Object.entries(buildPackageSelfChecks(dataset))) {
  const inputPath = resolve(outDir, `${run.run_id}--${packageHash(run).slice(0, 16)}.saved.json`);
  await writeImmutable(inputPath, JSON.stringify(run, null, 2) + '\n');
  const { report, path } = await writePackageReport({ run, dataset, outDir });
  // Independent hand counts of this fixed 12-case vector, not scorer-generated targets.
  const expected = kind === 'good' ? { fields: 216, readiness: 60, quotes: 12, structured: 12, missing: 0, errors: 0, started: 0 }
    : { fields: 157, readiness: 34, quotes: 7, structured: 4, missing: 1, errors: 1, started: 1 };
  // Flawed readiness by case: 5+3+5+1+0+5+5+5+0+5+0+0 = 34 of 60.
  for (const [key, numerator, denominator] of [
    ['field_pairs', expected.fields, 216], ['document_readiness', expected.readiness, 60],
    ['quote_cases', expected.quotes, 12], ['structured_cases', expected.structured, 12]
  ]) assert.deepEqual([report.metrics[key].numerator, report.metrics[key].denominator], [numerator, denominator]);
  for (const key of ['missing', 'errors', 'started']) assert.equal(report.metrics.receipts[key].numerator, expected[key]);
  assert.equal(report.metrics.full_semantic_cases.numerator, null);
  console.log(`PASS ${kind}: ${report.metrics.structured_cases.numerator}/12 structured cases. Authored self-check only.`);
  console.log(`Saved outputs: ${inputPath}\nReport: ${path}`);
}
console.log('No model was called. Question meaning and source support remain manual/unscored.');
