import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPackageDataset } from '../lib/package-dataset.mjs';
import { packageRunFromAttempts, writePackageReport } from '../lib/package-evaluation-report.mjs';
import { projectRoot } from '../lib/dataset.mjs';

try {
  const { values } = parseArgs({ options: { input: { type: 'string' }, 'attempts-dir': { type: 'string' }, 'run-id': { type: 'string' },
    'out-dir': { type: 'string' }, 'require-structured-pass': { type: 'boolean', default: false }, help: { type: 'boolean', default: false } } });
  if (values.help) {
    console.log('Offline package evaluation: --input saved-run.json OR --attempts-dir batch-folder --run-id batch-name');
    console.log('Optional: --out-dir folder --require-structured-pass. Every expected case stays in the denominator. No model calls.');
  } else {
    if (Boolean(values.input) === Boolean(values['attempts-dir'])) throw new Error('Choose one --input or --attempts-dir.');
    const dataset = await loadPackageDataset();
    if (values['attempts-dir'] && !values['run-id']) throw new Error('--run-id is required for captured attempts.');
    const run = values.input ? JSON.parse(await readFile(resolve(values.input), 'utf8')) : await packageRunFromAttempts(resolve(values['attempts-dir']), dataset, values['run-id']);
    const { report, path } = await writePackageReport({ run, dataset, outDir: values['out-dir'] ? resolve(values['out-dir']) : resolve(projectRoot, 'out/evaluation/package-v1') });
    const fraction = metric => `${metric.numerator}/${metric.denominator}`;
    console.log(report.label);
    console.log(`Fields: ${fraction(report.metrics.field_pairs)}; document readiness: ${fraction(report.metrics.document_readiness)}; quotes: ${fraction(report.metrics.quote_cases)}`);
    console.log(`Structured cases: ${fraction(report.metrics.structured_cases)}; question/evidence meaning: manual/unscored`);
    console.log(`Missing: ${report.metrics.receipts.missing.numerator}; failed: ${report.metrics.receipts.errors.numerator}; unfinished: ${report.metrics.receipts.started.numerator}`);
    console.log(`Report: ${path}`);
    if (values['require-structured-pass'] && report.metrics.structured_cases.numerator !== report.metrics.case_count) process.exitCode = 2;
  }
} catch (error) { console.error(`Package evaluation failed: ${error.message}`); process.exitCode = 1; }
