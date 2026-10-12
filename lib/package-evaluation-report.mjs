import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createAttemptStore } from './attempt-store.mjs';
import { buildPackageRequest } from './package-provider.mjs';
import { packageOutputSchema } from './package-contract.mjs';
import { fingerprint } from './event-package.mjs';
import { packageHash } from './package-dataset.mjs';
import { scorePackageRun, PACKAGE_SCORER_VERSION } from './package-evaluation.mjs';
import { projectRoot, sha256 } from './dataset.mjs';
import { writeImmutable } from './evaluation-report.mjs';

// Read every directory in the selected batch; never choose a favorable retry.
export async function packageRunFromAttempts(directory, dataset, runId) {
  const folders = await readdir(directory, { withFileTypes: true });
  const store = createAttemptStore(directory); const cases = []; const configurations = new Set(); const modes = new Set();
  let provenance = null;
  for (const folder of folders.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!folder.isDirectory()) throw new Error('A batch directory must contain only attempt folders.');
    const receipt = await store.read(folder.name);
    if (receipt.schema_version !== 'eventbrief.model-attempt.v1' || receipt.run_id !== folder.name) throw new Error('Attempt identity/version mismatch.');
    const entry = dataset.cases.find(item => item.id === receipt.scenario_id);
    if (!entry) throw new Error(`Attempt is outside this dataset: ${receipt.scenario_id}`);
    if (cases.some(item => item.case_id === entry.id)) throw new Error(`Multiple attempts for ${entry.id}; use a predeclared separate batch, not selected retries.`);
    if (packageHash(receipt.input) !== packageHash(entry.input) || receipt.input_hash !== fingerprint(receipt.input)) throw new Error('Attempt source mismatch.');
    if (packageHash(receipt.profile) !== packageHash(dataset.profile) || receipt.profile_hash !== fingerprint(receipt.profile)) throw new Error('Attempt profile mismatch.');
    if (receipt.request_hash !== fingerprint(receipt.request) || receipt.prompt_hash !== sha256(receipt.request?.instructions ?? '')) throw new Error('Attempt request fingerprint mismatch.');
    const expectedRequest = buildPackageRequest(entry.input, dataset.profile, receipt.request.instructions, receipt.request.model, { maxOutputTokens: receipt.request.max_output_tokens });
    if (packageHash(receipt.request) !== packageHash(expectedRequest)) throw new Error('Attempt request does not match the frozen messages, vocabulary and schema.');
    if (receipt.schema_hash !== sha256(JSON.stringify(packageOutputSchema))) throw new Error('Attempt schema fingerprint mismatch.');
    const { input, ...settings } = receipt.request;
    configurations.add(packageHash({ settings, implementation: receipt.implementation }));
    modes.add(receipt.mode);
    if (!['live', 'simulated'].includes(receipt.mode) || receipt.purpose !== (receipt.mode === 'live' ? 'development_model_run' : 'fake_provider_test')) throw new Error('Attempt provenance mismatch.');
    provenance = { producer: 'Captured package-attempt batch', model: receipt.request.model, prompt_sha256: receipt.prompt_hash,
      configuration_sha256: packageHash({ settings, implementation: receipt.implementation }) };
    const base = { case_id: entry.id, attempt_id: receipt.run_id, receipt_sha256: packageHash(receipt) };
    if (receipt.status === 'succeeded') cases.push({ ...base, status: 'completed', output: receipt.parsed_output });
    else if (receipt.status === 'failed' || receipt.status === 'started') cases.push({ ...base, status: receipt.status === 'started' ? 'started' : 'error',
      error: { kind: receipt.error?.code ?? 'unknown_outcome', message: receipt.error?.message ?? 'Attempt has no terminal receipt; outcome unknown.' } });
    else throw new Error('Unknown attempt status.');
  }
  if (!cases.length) throw new Error('No captured attempts in this batch.');
  if (configurations.size !== 1 || modes.size !== 1) throw new Error('Batch mixes model/prompt/schema/implementation settings or provider modes.');
  return { schema_version: 'eventbrief.package-saved-run.v1', run_id: runId,
    purpose: modes.has('live') ? 'model_evaluation' : 'fake_provider_test', dataset: { version: dataset.version, sha256: dataset.sha256 }, provenance, cases };
}

export async function writePackageReport({ run, dataset, outDir }) {
  const report = scorePackageRun(run, dataset);
  const sources = {};
  for (const path of ['lib/package-contract.mjs', 'lib/event-package.mjs', 'lib/guest-dietary-policy.mjs', 'public/package-render.mjs', 'lib/package-dataset.mjs', 'lib/package-evaluation.mjs', 'lib/package-evaluation-report.mjs', 'lib/package-provider.mjs', 'lib/attempt-store.mjs', 'lib/dataset.mjs', 'lib/evaluation-report.mjs', 'scripts/evaluate-package.mjs']) {
    sources[path] = sha256((await readFile(join(projectRoot, path), 'utf8')).replaceAll('\r\n', '\n'));
  }
  report.reproducibility = { saved_run_sha256: packageHash(run), sources_sha256: sources, bundle_sha256: packageHash(sources),
    serialization: 'Canonical saved-run fingerprint; report UTF-8 JSON, two spaces and final LF, no wall-clock timestamp.' };
  const bytes = JSON.stringify(report, null, 2) + '\n';
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, `${run.run_id}--${dataset.version}--${PACKAGE_SCORER_VERSION}--${sha256(bytes).slice(0, 16)}.json`);
  await writeImmutable(path, bytes);
  return { report, path };
}
