import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { loadDataset, projectRoot } from '../lib/dataset.mjs';

const dataset = await loadDataset();
let messageCount = 0;
let citationCount = 0;
for (const entry of dataset.cases) {
  const { input, expected } = entry;
  messageCount += input.messages.length;
  const claims = [...Object.values(expected.fields), ...expected.pending_changes, ...expected.open_questions];
  citationCount += claims.reduce((sum, claim) => sum + claim.evidence.length, 0);
  console.log(`PASS ${input.id} (${entry.group})`);
}
// Detect orphan files as well as modified/missing files in the frozen manifest.
for (const base of ['fixtures', 'fixtures/development']) {
  for (const kind of ['inputs', 'expected']) {
    const directory = `${base}/${kind}`;
    const files = (await readdir(`${projectRoot}/${directory}`))
      .filter(file => file.endsWith('.json')).map(file => `${directory}/${file}`).sort();
    const registered = dataset.cases.map(entry => entry[kind === 'inputs' ? 'input_path' : 'expected_path'])
      .filter(path => path.startsWith(`${directory}/`)).sort();
    assert.deepEqual(files, registered, `Unregistered or missing fixture in ${directory}`);
  }
}
console.log(`Validated ${dataset.cases.length} synthetic cases, ${messageCount} messages, and ${citationCount} exact citations.`);
console.log(`Dataset ${dataset.version}: ${dataset.sha256}`);
console.log('Fixture consistency only; not model accuracy or semantic evidence validation.');
