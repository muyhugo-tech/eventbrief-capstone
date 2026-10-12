import { readFile, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { packageFixtures } from './package-fixtures.mjs';
import { fingerprint } from './event-package.mjs';
import { validatePackageRecord } from './package-contract.mjs';

const change = JSON.parse(await readFile(new URL('../fixtures/package-updates/messages.json', import.meta.url), 'utf8'));
const parent = packageFixtures.get(change.parent_scenario_id);
const input = { id: change.id, title: change.title, synthetic: true, messages: [...structuredClone(parent.input.messages), ...change.messages] };
const original = JSON.parse(await readFile(new URL('../fixtures/package-updates/record.json', import.meta.url), 'utf8'));
validatePackageRecord(original, input);
export const updatedBundle = { input, original, profile: parent.profile };
export const updateDescription = change.summary;
const identity = { schema_version: 'eventbrief.message-update.v1', event_id: 'birthday-dinner',
  scenario_id: input.id, parent_scenario_id: parent.input.id, input_hash: fingerprint(input), profile_hash: fingerprint(parent.profile) };

// One controlled, append-only fictional update. It never accepts arbitrary email text.
export async function createPackageUpdateStore({ directory }) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'activated.json');
  async function status() {
    let saved;
    try { saved = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { available: true, active_scenario_id: null, summary: change.summary }; throw new Error('The saved message update needs checking.'); }
    if (Object.keys(saved).sort().join('|') !== [...Object.keys(identity), 'activated_at'].sort().join('|') ||
      Object.entries(identity).some(([key, value]) => saved[key] !== value) || !Number.isFinite(Date.parse(saved.activated_at))) throw new Error('The saved message update does not match these demo messages.');
    return { available: false, active_scenario_id: input.id, activated_at: saved.activated_at, summary: change.summary };
  }
  async function activate() {
    const saved = { ...identity, activated_at: new Date().toISOString() };
    let file;
    try { file = await open(path, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') return status(); throw new Error('The demo update could not be saved.'); }
    try { await file.writeFile(JSON.stringify(saved, null, 2) + '\n'); await file.sync(); } finally { await file.close(); }
    return status();
  }
  return { status, activate, bundle: updatedBundle };
}
