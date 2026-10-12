import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { scanText, inspectPublicTree, exportPublicTree } from '../scripts/public-check.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'eventbrief-public-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = { 'README.md': '# Fictional demo\n', 'server.mjs': '// local demo\n', '.env.example': 'EVENTBRIEF_OPENAI_API_KEY=\n', 'package.json': '{"type":"module"}\n' };
  for (const [name, text] of Object.entries(base)) await writeFile(join(root, name), text);
  return root;
}

test('public scanner identifies leak classes without returning the matched value', () => {
  const secret = 'sk-' + 'Ab7_'.repeat(16);
  const personalPath = ['C:', 'Users', 'person', 'workspace'].join('/');
  const email = ['person', 'private-business.invaliddomain'].join('@');
  const source = [secret, personalPath, email, 'postgres://' + 'admin:password' + '@localhost'].join('\n');
  const findings = scanText('source.mjs', source);
  assert.deepEqual(findings.map(item => item.rule), ['credential-token', 'personal-absolute-path', 'non-synthetic-email', 'credential-in-url']);
  assert.equal(JSON.stringify(findings).includes(secret), false);
  assert.equal(scanText('fixture.json', 'Alex <alex@example.test> Riley <riley@linden-fig.example>').length, 0);
  assert.equal(scanText('.env.example', 'EVENTBRIEF_OPENAI_API_KEY=placeholder').at(-1).rule, 'nonempty-example-secret');
});

test('public export excludes local state and includes a verifiable complete manifest', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'out'));
  await writeFile(join(root, 'out', 'private.txt'), 'Not public.');
  await writeFile(join(root, '.env.local'), 'PRIVATE=not-public');
  await mkdir(join(root, '.impeccable', 'review'), { recursive: true });
  await writeFile(join(root, '.impeccable', 'design.json'), '{"schemaVersion":2}\n');
  await writeFile(join(root, '.impeccable', 'review', 'private.json'), '{"private":"not-public"}');
  const inspection = await inspectPublicTree(root);
  assert.equal(inspection.findings.length, 0);
  const output = join(root, 'out', 'submission.zip');
  const receipt = await exportPublicTree(root, output);
  assert.equal(receipt.files, 5);
  const bytes = await readFile(output), entries = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30, start = nameStart + nameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString('utf8');
    entries.set(name, bytes.subarray(start, start + size)); offset = start + size;
  }
  assert.equal(entries.size, 6);
  assert.equal([...entries.keys()].some(name => name.includes('.env.local') || name.includes('/out/') || name.includes('/review/')), false);
  assert.ok(entries.has('eventbrief/.impeccable/design.json'));
  const manifest = JSON.parse(entries.get('eventbrief/PUBLIC-MANIFEST.json'));
  assert.equal(manifest.files.length, 5);
  for (const file of manifest.files) {
    const content = entries.get(`eventbrief/${file.path}`);
    assert.equal(content.length, file.size);
    assert.equal(createHash('sha256').update(content).digest('hex'), file.sha256);
  }
  await assert.rejects(exportPublicTree(root, output), { code: 'EEXIST' });
});

test('public export refuses nested private state and suspicious content', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'lib', 'out'), { recursive: true });
  await writeFile(join(root, 'lib', 'out', 'conversation.json'), '{}');
  await writeFile(join(root, 'lib', 'leak.mjs'), 'sk-' + 'A9'.repeat(24));
  const inspected = await inspectPublicTree(root);
  assert.ok(inspected.findings.some(item => item.rule === 'private-path-in-source-directory'));
  assert.ok(inspected.findings.some(item => item.rule === 'credential-token'));
  await assert.rejects(exportPublicTree(root, join(root, 'out', 'submission.zip')), /blocked/);
});

test('public export does not follow symlinks into other directories', async t => {
  const root = await fixture(t), outside = await fixture(t);
  try { await symlink(outside, join(root, 'lib'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) return t.skip('Filesystem does not permit test symlinks.'); throw error; }
  const result = await inspectPublicTree(root);
  assert.deepEqual(result.findings, [{ path: 'lib', rule: 'symlink-not-exported' }]);
});
