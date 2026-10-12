import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot } from '../lib/dataset.mjs';
import { loadPackageDataset } from '../lib/package-dataset.mjs';
import { createLivePlan, runLiveBatch, LIVE_MODEL } from '../lib/package-live-evaluation.mjs';
import { packageRunFromAttempts, writePackageReport } from '../lib/package-evaluation-report.mjs';

try {
  const { values } = parseArgs({ options: { live: { type: 'boolean', default: false }, batch: { type: 'string' },
    limit: { type: 'string', default: '1' }, cases: { type: 'string' }, 'budget-cents': { type: 'string', default: '200' },
    'prompt-version': { type: 'string', default: '3' }, 'max-output-tokens': { type: 'string', default: '10000' }, help: { type: 'boolean', default: false } } });
  if (values.help) {
    console.log('Default: offline budget preview. Paid execution requires --live --batch name.');
    console.log('Optional: --limit 1 (new attempts this invocation), --budget-cents 200 (maximum $2 per batch).');
    console.log('--cases comma-separated-case-ids predeclares a subset; scoring still retains all twelve expected cases.');
    console.log('--prompt-version 2|3 selects a preserved prompt; --max-output-tokens 10000 sets a recorded allowance.');
  } else {
    const dataset = await loadPackageDataset();
    if (!['2', '3'].includes(values['prompt-version'])) throw new Error('Choose prompt version 2 or 3.');
    const prompt = await readFile(join(projectRoot, `prompts/extract-package-v${values['prompt-version']}.txt`), 'utf8');
    const budgetCents = Number(values['budget-cents']);
    const maxOutputTokens = Number(values['max-output-tokens']);
    const caseIds = values.cases?.split(',');
    const plan = await createLivePlan({ dataset, prompt, budgetCents, caseIds, maxOutputTokens });
    console.log(`${LIVE_MODEL}: ${plan.cases.length} fixed cases; $${(plan.reserved_micro_usd / 1000000).toFixed(2)} conservative allowance; $${(budgetCents / 100).toFixed(2)} batch budget.`);
    if (!values.live) console.log('Offline preview only. No key loaded; no API calls.');
    else {
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(values.batch ?? '')) throw new Error('Provide a simple --batch name.');
      if (!process.execArgv.includes('--use-system-ca')) throw new Error('Use npm run test:ai so Windows trusted certificates are available.');
      process.loadEnvFile(join(projectRoot, '.env.local'));
      if (process.env.EVENTBRIEF_MODEL !== LIVE_MODEL) throw new Error('The saved model must match the approved test model.');
      const result = await runLiveBatch({ dataset, prompt, key: process.env.EVENTBRIEF_OPENAI_API_KEY,
        root: join(projectRoot, 'out/model-evaluations', values.batch), limit: Number(values.limit), budgetCents, caseIds, maxOutputTokens,
        onAttempt: attempt => console.log(JSON.stringify(attempt)) });
      console.log(`Completed ${result.completed}/${dataset.cases.length}; stopped: ${result.stopped ?? 'no'}; usage-based upper cost estimate $${(result.usage_estimate_micro_usd / 1000000).toFixed(4)}.`);
      if (result.attempted.some(item => item.attempt_id)) {
        const run = await packageRunFromAttempts(result.attemptsDir, dataset, values.batch);
        const { path } = await writePackageReport({ run, dataset, outDir: join(projectRoot, 'out/evaluation/package-v1') });
        console.log(`Offline score report: ${path}`);
      }
      if (result.stopped) process.exitCode = 2;
    }
  }
} catch { console.error('Test stopped. No automatic retry. Inspect the saved plan and receipts; no credential or raw exception is printed.'); process.exitCode = 1; }
