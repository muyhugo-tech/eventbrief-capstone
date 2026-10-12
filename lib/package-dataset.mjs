import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './dataset.mjs';
import { PACKAGE_MODEL_VERSION, validatePackageRecord } from './package-contract.mjs';
import { DOCUMENTS, validateRestaurant } from './event-package.mjs';

export const packageManifest = new URL('../evaluation/package-v1/manifest.json', import.meta.url);
const canonicalValue = value => value === null || typeof value !== 'object' ? value : Array.isArray(value)
  ? value.map(canonicalValue) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
export const packageHash = value => sha256(JSON.stringify(canonicalValue(value)));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export async function loadPackageDataset(manifestPath = packageManifest) {
  const path = manifestPath instanceof URL ? fileURLToPath(manifestPath) : resolve(manifestPath);
  const root = dirname(path);
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(manifest.schema_version, 'eventbrief.package-dataset.v1');
  assert.equal(manifest.contract_version, PACKAGE_MODEL_VERSION);
  assert.equal(manifest.synthetic, true);
  assert.equal(manifest.purpose, 'development_evaluation');
  assert.match(manifest.version, /^[a-z0-9-]+$/);
  assert.deepEqual(Object.keys(manifest.profile).sort(), ['path', 'sha256']);
  assert.equal(manifest.profile.path, 'profile.json');
  const profile = JSON.parse(await readFile(resolve(root, 'profile.json'), 'utf8'));
  assert.equal(packageHash(profile), manifest.profile.sha256, 'Frozen package profile changed');
  validateRestaurant(profile);
  assert.ok(Array.isArray(manifest.cases) && manifest.cases.length > 0);
  const ids = new Set();
  const cases = [];
  for (const entry of manifest.cases) {
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(entry.id), 'Duplicate package case'); ids.add(entry.id);
    assert.equal(entry.input, `inputs/${entry.id}.json`);
    assert.equal(entry.expected, `expected/${entry.id}.json`);
    const input = JSON.parse(await readFile(resolve(root, entry.input), 'utf8'));
    const expected = JSON.parse(await readFile(resolve(root, entry.expected), 'utf8'));
    assert.equal(packageHash(input), entry.input_sha256, `Frozen package input changed: ${entry.id}`);
    assert.equal(packageHash(expected), entry.expected_sha256, `Frozen package expectation changed: ${entry.id}`);
    assert.deepEqual(Object.keys(input).sort(), ['id', 'messages', 'synthetic', 'title']);
    assert.equal(input.id, entry.id); assert.equal(input.synthetic, true);
    assert.ok(typeof input.title === 'string' && input.title.trim());
    assert.ok(Array.isArray(input.messages) && input.messages.length > 0);
    const messageIds = new Set(); let previous = -Infinity;
    for (const message of input.messages) {
      assert.deepEqual(Object.keys(message).sort(), ['body', 'id', 'recipient', 'role', 'sender', 'sent_at', 'subject']);
      assert.ok(['customer', 'coordinator'].includes(message.role));
      assert.ok(!messageIds.has(message.id)); messageIds.add(message.id);
      for (const key of ['id', 'sender', 'recipient', 'subject', 'body']) assert.ok(typeof message[key] === 'string' && message[key].trim());
      const time = Date.parse(message.sent_at); assert.ok(Number.isFinite(time) && time > previous); previous = time;
    }
    assert.equal(expected.schema_version, 'eventbrief.package-expectation.v1');
    validatePackageRecord(expected.record, input);
    assert.deepEqual(Object.keys(expected.document_states).sort(), DOCUMENTS.map(item => item.id).sort());
    assert.ok(Object.values(expected.document_states).every(state => ['ready_for_review', 'blocked'].includes(state)));
    assert.equal(expected.quote === null, expected.document_states.quote === 'blocked');
    if (expected.quote !== null) {
      assert.ok(object(expected.quote) && Number.isSafeInteger(expected.quote.total_cents));
      assert.ok(Array.isArray(expected.quote.lines) && expected.quote.lines.length > 0);
      for (const line of expected.quote.lines) {
        assert.ok(['quantity', 'unit_cents', 'amount_cents'].every(key => Number.isSafeInteger(line[key]) && line[key] >= 0));
        assert.equal(line.amount_cents, line.quantity * line.unit_cents, 'Authored quote arithmetic inconsistent');
      }
      assert.equal(expected.quote.total_cents, expected.quote.lines.reduce((sum, line) => sum + line.amount_cents, 0));
    }
    assert.ok(Array.isArray(expected.forbidden_guest_text) && expected.forbidden_guest_text.every(text => typeof text === 'string' && text.length));
    assert.ok(Array.isArray(expected.manual_review));
    cases.push({ id: entry.id, title: entry.title, input, expected });
  }
  return { version: manifest.version, sha256: packageHash(manifest), profile, cases };
}
