import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { referenceOutput, validateOutput } from './contract.mjs';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaultManifest = new URL('../evaluation/dataset-v1.json', import.meta.url);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
// Ignore JSON whitespace/line endings so a Windows checkout has the same dataset identity.
export const jsonSha256 = value => sha256(JSON.stringify(value));

function fixturePath(path, kind) {
  assert.equal(typeof path, 'string', 'Fixture path must be a string');
  assert.match(path, /^fixtures\/(?:development\/)?(?:inputs|expected)\/[a-z0-9-]+\.json$/);
  assert.ok(path.includes(`/${kind}/`), `Expected a ${kind} path`);
  const absolute = resolve(projectRoot, path);
  assert.ok(absolute.startsWith(resolve(projectRoot, 'fixtures') + sep));
  return absolute;
}

export function validateInput(input, caseId) {
  assert.deepEqual(Object.keys(input).sort(), ['id', 'messages', 'synthetic', 'title']);
  assert.equal(input.id, caseId);
  assert.equal(input.synthetic, true, 'Evaluation inputs must be explicitly synthetic');
  assert.ok(typeof input.title === 'string' && input.title.trim());
  assert.ok(Array.isArray(input.messages) && input.messages.length > 0);
  const ids = new Set();
  let previousTime = -Infinity;
  for (const message of input.messages) {
    assert.deepEqual(Object.keys(message).sort(), ['body', 'id', 'role', 'sent_at']);
    assert.ok(typeof message.id === 'string' && message.id && !ids.has(message.id));
    ids.add(message.id);
    assert.ok(['customer', 'coordinator'].includes(message.role));
    assert.ok(typeof message.body === 'string' && message.body.trim());
    assert.equal(typeof message.sent_at, 'string');
    const time = Date.parse(message.sent_at);
    assert.ok(Number.isFinite(time) && time > previousTime, 'Messages must be strictly chronological');
    previousTime = time;
  }
}

export async function loadDataset(manifestPath = defaultManifest) {
  const bytes = await readFile(manifestPath);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.schema_version, 'eventbrief.dataset.v1');
  assert.match(manifest.version, /^[a-z0-9-]+$/);
  assert.ok(Array.isArray(manifest.cases) && manifest.cases.length > 0);
  const ids = new Set();
  const cases = [];
  for (const entry of manifest.cases) {
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(entry.id), `Duplicate dataset case: ${entry.id}`);
    ids.add(entry.id);
    assert.ok(['starter', 'development'].includes(entry.group));
    assert.ok(Array.isArray(entry.tags) && entry.tags.length > 0);
    assert.ok(entry.tags.every(tag => typeof tag === 'string' && tag.trim()));
    const inputBytes = await readFile(fixturePath(entry.input, 'inputs'));
    const expectedBytes = await readFile(fixturePath(entry.expected, 'expected'));
    const input = JSON.parse(inputBytes);
    const expected = JSON.parse(expectedBytes);
    assert.equal(jsonSha256(input), entry.input_sha256, `Input changed since freeze: ${entry.id}`);
    assert.equal(jsonSha256(expected), entry.expected_sha256, `Expected answer changed since freeze: ${entry.id}`);
    validateInput(input, entry.id);
    assert.deepEqual(Object.keys(expected).sort(), ['fields', 'id', 'open_questions', 'pending_changes', 'rationale']);
    assert.equal(expected.id, entry.id);
    assert.ok(typeof expected.rationale === 'string' && expected.rationale.trim());
    validateOutput(referenceOutput(expected), input);
    cases.push({ ...entry, input_path: entry.input, expected_path: entry.expected, input, expected });
  }
  return { version: manifest.version, sha256: jsonSha256(manifest), cases };
}
