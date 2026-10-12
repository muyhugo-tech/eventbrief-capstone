import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadDataset, defaultManifest, projectRoot } from '../lib/dataset.mjs';
import { evaluateSavedFile } from '../lib/evaluation-report.mjs';

try {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      dataset: { type: 'string' },
      'out-dir': { type: 'string' },
      'require-structured-pass': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    },
    allowPositionals: false
  });
  if (values.help) {
    console.log('Usage: node scripts/evaluate.mjs --input saved-run.json [--dataset evaluation/dataset-v1.json] [--out-dir out/evaluation/v1] [--require-structured-pass]');
    console.log('Offline only. Exit 0 = report written; exit 1 = invalid input/IO; exit 2 = requested structured gate failed. Question semantics remain unscored.');
  } else {
    if (!values.input) throw new Error('--input is required. See --help and evaluation/README.md.');
    const dataset = await loadDataset(values.dataset ? resolve(values.dataset) : defaultManifest);
    const { report, path } = await evaluateSavedFile({
      inputPath: resolve(values.input),
      outDir: values['out-dir'] ? resolve(values['out-dir']) : resolve(projectRoot, 'out/evaluation/v1'),
      dataset
    });
    const metrics = report.metrics;
    const fraction = metric => `${metric.numerator}/${metric.denominator}`;
    console.log(report.label);
    console.log(`Field value/status: ${fraction(metrics.fields.value_and_status_correct)}`);
    console.log(`Structured cases: ${fraction(metrics.structured_case_passes)}; full semantic cases: manual/unscored`);
    console.log(`Exact citations: ${fraction(metrics.evidence.exact_citations)}; semantic support: manual/unscored`);
    console.log(`Unsupported agreement errors/claims: ${fraction(metrics.unsupported_agreements.errors_per_agreement_claim)}`);
    console.log(`Missing cases: ${fraction(metrics.receipts.missing)}; error cases: ${fraction(metrics.receipts.errors)}`);
    console.log(`Report: ${path}`);
    if (values['require-structured-pass'] && metrics.structured_case_passes.numerator !== metrics.case_count) process.exitCode = 2;
  }
} catch (error) {
  console.error(`Evaluation failed: ${error.message}`);
  process.exitCode = 1;
}
