import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot, sha256 } from './dataset.mjs';
import { scoreRun, SCORER_VERSION } from './evaluation.mjs';

const sourceFiles = [
  'lib/contract.mjs',
  'lib/dataset.mjs',
  'lib/evaluation.mjs',
  'lib/evaluation-report.mjs',
  'scripts/evaluate.mjs'
];

export async function writeImmutable(path, content) {
  try {
    await writeFile(path, content, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (await readFile(path, 'utf8') !== content) {
      throw new Error(`Refusing to replace different existing content: ${path}`);
    }
  }
}

export async function evaluateSavedFile({ inputPath, outDir, dataset }) {
  const savedBytes = await readFile(inputPath);
  const run = JSON.parse(savedBytes);
  const report = scoreRun(run, dataset);
  const sources = {};
  for (const path of sourceFiles) {
    const text = await readFile(join(projectRoot, path), 'utf8');
    sources[path] = sha256(text.replaceAll('\r\n', '\n'));
  }
  report.reproducibility = {
    saved_output_bytes_sha256: sha256(savedBytes),
    scorer_sources_sha256: sources,
    scorer_bundle_sha256: sha256(JSON.stringify(sources)),
    serialization: 'UTF-8 JSON with two-space indentation and final LF; no wall-clock timestamp.'
  };
  const bytes = JSON.stringify(report, null, 2) + '\n';
  const filename = `${run.run_id}--${dataset.version}--${SCORER_VERSION}--${sha256(bytes).slice(0, 16)}.json`;
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, filename);
  await writeImmutable(path, bytes);
  return { report, path };
}
