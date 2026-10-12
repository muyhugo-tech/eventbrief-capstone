import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createBlobFiles } from '../lib/hosted/blob-files.mjs';
import { createPackageWorkspace } from '../lib/package-workspace.mjs';
import { createAttemptStore } from '../lib/attempt-store.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { demoText, demoReply, demoRecord } from '../lib/package-demo.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';

const visitorA = 'visitor-a-0000000000000000', visitorB = 'visitor-b-0000000000000000';
const root = resolve('out', 'virtual-hosted-test');
const profile = packageFixtures.get('patio-complete').profile;

// Models the SDK boundary, including an atomic no-overwrite operation and
// paginated object listings. Tests never contact Blob or a model provider.
function memoryBlob() {
  const files = new Map(), calls = [];
  class BlobError extends Error {}
  return {
    files, calls, BlobError,
    async put(path, data, options) {
      calls.push({ method: 'put', path, options });
      assert.equal(options.access, 'private');
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.addRandomSuffix, false);
      await Promise.resolve();
      if (files.has(path)) throw new BlobError('Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.');
      files.set(path, Buffer.from(data));
      return { pathname: path };
    },
    async get(path, options) {
      calls.push({ method: 'get', path, options });
      assert.equal(options.access, 'private'); assert.equal(options.useCache, false);
      const value = files.get(path);
      return value === undefined ? null : { statusCode: 200, blob: { pathname: path, size: value.length }, stream: new Blob([value]).stream() };
    },
    async list(options) {
      calls.push({ method: 'list', options });
      const names = [...files.keys()].filter(name => name.startsWith(options.prefix)).sort();
      const offset = Number(options.cursor ?? 0), next = offset + 2;
      return { blobs: names.slice(offset, next).map(pathname => ({ pathname })), hasMore: next < names.length, cursor: String(next) };
    }
  };
}

async function put(fs, path, content) {
  const handle = await fs.open(path, 'wx');
  try { await handle.writeFile(content); await handle.sync(); }
  finally { await handle.close(); }
}

test('private Blob storage isolates visitors, confines paths, and lists virtual directories across pages', async () => {
  const sdk = memoryBlob();
  const a = createBlobFiles({ root, visitorId: visitorA, sdk });
  const b = createBlobFiles({ root, visitorId: visitorB, sdk });
  const folder = join(root, 'sources');
  await a.mkdir(folder, { recursive: true }); assert.deepEqual(await a.readdir(folder), []);
  for (const name of ['c.json', 'a.json', 'b.json']) await put(a, join(folder, name), name);
  await put(a, join(folder, 'nested', 'child.json'), 'child');
  assert.deepEqual(await a.readdir(folder), ['a.json', 'b.json', 'c.json', 'nested']);
  assert.deepEqual(await b.readdir(folder), []);
  await assert.rejects(b.readFile(join(folder, 'a.json'), 'utf8'), { code: 'ENOENT' });
  await put(b, join(folder, 'a.json'), 'Other visitor');
  assert.equal(await a.readFile(join(folder, 'a.json'), 'utf8'), 'a.json');
  assert.equal(await b.readFile(join(folder, 'a.json'), 'utf8'), 'Other visitor');
  assert.throws(() => createBlobFiles({ root, visitorId: '../../other', sdk }), /identity/);
  for (const path of [join(root, '..', 'other', 'a.json'), `${root}/sources/../a.json`, `${root}/a\0.json`]) {
    await assert.rejects(a.open(path, 'wx'), /path/);
    await assert.rejects(a.readFile(path), /path/);
  }
  await assert.rejects(a.open(join(root, 'a.json'), 'w'), /immutable/);
});

test('atomic create has exactly one winner and never converts general provider failures into conflicts', async () => {
  const sdk = memoryBlob(), a = createBlobFiles({ root, visitorId: visitorA, sdk }), b = createBlobFiles({ root, visitorId: visitorA, sdk });
  const path = join(root, 'review.json');
  const results = await Promise.allSettled([put(a, path, 'first'), put(b, path, 'second')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'EEXIST');
  assert.equal(await a.readFile(path, 'utf8'), 'first');
  await assert.rejects(put(a, path, 'replacement'), { code: 'EEXIST' });
  assert.equal(await a.readFile(path, 'utf8'), 'first');
  for (const failure of [new Error('Temporary failure'), new sdk.BlobError('Vercel Blob: Access denied'), new Error('Vercel Blob: This blob already exists, use allowOverwrite')]) {
    const failing = createBlobFiles({ root, visitorId: visitorA, sdk: { ...sdk, put: async () => { throw failure; } } });
    await assert.rejects(put(failing, join(root, 'failed.json'), '{}'), error => error === failure && error.code !== 'EEXIST');
  }
});

test('request-scoped reads reuse immutable files while directory reads stay fresh', async () => {
  const sdk = memoryBlob(), a = createBlobFiles({ root, visitorId: visitorA, sdk });
  const folder = join(root, 'reviews'), one = join(folder, 'one.json'), two = join(folder, 'two.json');
  await put(a, one, '{}'); await a.readFile(one, 'utf8'); await a.readFile(one, 'utf8');
  assert.equal(sdk.calls.filter(call => call.method === 'get').length, 1);
  assert.deepEqual(await a.readdir(folder), ['one.json']);
  await a.readdir(folder);
  assert.equal(sdk.calls.filter(call => call.method === 'list').length, 2);
  const b = createBlobFiles({ root, visitorId: visitorA, sdk });
  await put(b, two, '{}');
  await assert.rejects(put(a, two, '{}'), { code: 'EEXIST' });
  assert.deepEqual(await a.readdir(folder), ['one.json', 'two.json']);
  const nextRequest = createBlobFiles({ root, visitorId: visitorA, sdk });
  assert.deepEqual(await nextRequest.readdir(folder), ['one.json', 'two.json']);
  const missing = join(folder, 'missing.json');
  await assert.rejects(a.readFile(missing), { code: 'ENOENT' });
  await put(b, missing, 'found');
  assert.equal(await a.readFile(missing, 'utf8'), 'found');
});

test('the same adapter sees another request append a source revision after its first listing', async () => {
  const sdk = memoryBlob();
  const inFlight = createBlobFiles({ root, visitorId: visitorA, sdk });
  const anotherTab = createBlobFiles({ root, visitorId: visitorA, sdk });
  const folder = join(root, 'events', 'example');
  await put(inFlight, join(folder, '00000002.json'), '{"revision":2}');
  assert.deepEqual(await inFlight.readdir(folder), ['00000002.json']);
  await put(anotherTab, join(folder, '00000003.json'), '{"revision":3}');
  // No local write or collision occurs to invalidate a cached listing.
  assert.deepEqual(await inFlight.readdir(folder), ['00000002.json', '00000003.json']);
});

test('Blob storage bounds files and refuses malformed pagination or out-of-scope provider responses', async () => {
  const sdk = memoryBlob(), fs = createBlobFiles({ root, visitorId: visitorA, sdk });
  await assert.rejects(put(fs, join(root, 'huge.json'), 'x'.repeat(1024 * 1024 + 1)), /size limit/);
  assert.equal(sdk.files.size, 0);
  for (const list of [
    async () => ({ blobs: [], hasMore: true, cursor: 'same' }),
    async () => ({ blobs: [{ pathname: 'other-visitor/file' }], hasMore: false })
  ]) {
    const unsafe = createBlobFiles({ root, visitorId: visitorA, sdk: { ...sdk, list } });
    await assert.rejects(unsafe.readdir(join(root, 'sources')), /cursor|outside/);
  }
});

for (const backend of ['native', 'blob']) {
  test(`${backend} stores preserve replies, review concurrency, receipts and restart recovery`, async () => {
    const directory = backend === 'native' ? await mkdtemp(join(tmpdir(), 'eventbrief-hosted-contract-')) : root;
    const sdk = memoryBlob();
    const options = () => backend === 'native' ? undefined : { fs: createBlobFiles({ root: directory, visitorId: visitorA, sdk }) };
    const workspace = () => createPackageWorkspace(join(directory, 'workspace'), profile, options());
    const attempts = () => createAttemptStore(join(directory, 'attempts'), options());
    const first = await workspace(), initial = await first.save(demoText);
    assert.deepEqual(await first.save(demoText), initial);
    const updated = await first.appendReply(initial.input.id, demoReply);
    assert.deepEqual(updated.input.messages[0], initial.input.messages[0]);
    assert.deepEqual(await (await workspace()).appendReply(initial.input.id, demoReply), updated);
    await assert.rejects((await workspace()).appendReply(initial.input.id, 'A different reply'), /another tab/);
    const data = prepareEventPackage({ ...updated, original: demoRecord(updated.input) });
    const marks = Object.fromEntries(data.documents.map(doc => [doc.id, { decision: 'reviewed', revision: doc.revision, reviewed_at: new Date().toISOString() }]));
    const [one, two] = await Promise.all([workspace(), workspace()]);
    const reviews = await Promise.allSettled([one.saveReview(data, marks, 0), two.saveReview(data, {}, 0)]);
    assert.equal(reviews.filter(result => result.status === 'fulfilled').length, 1);
    const saved = await (await workspace()).loadReview(updated.input.id, null);
    assert.equal(saved.sequence, 1);
    assert.deepEqual(saved.reviews, reviews.find(result => result.status === 'fulfilled').value.reviews);
    const started = await attempts().begin({ marker: 'durable before model dispatch' });
    assert.equal((await attempts().read(started)).status, 'started');
    const outcomes = await Promise.allSettled([attempts().finish(started, { status: 'succeeded', output: 'first' }), attempts().finish(started, { status: 'failed', output: 'second' })]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'EEXIST');
    assert.equal((await attempts().read(started)).status, outcomes[0].status === 'fulfilled' ? 'succeeded' : 'failed');
    await (await workspace()).rememberResult(updated.input, { run_id: started, mode: 'simulated' });
    assert.equal((await (await workspace()).history())[0].run_id, started);
    assert.equal((await (await workspace()).status()).source_versions[initial.input.id].superseded, true);
    if (backend === 'blob') {
      const other = { fs: createBlobFiles({ root: directory, visitorId: visitorB, sdk }) };
      assert.deepEqual(await (await createPackageWorkspace(join(directory, 'workspace'), profile, other)).list(), []);
      await assert.rejects(createAttemptStore(join(directory, 'attempts'), other).read(started), { code: 'ENOENT' });
    }
  });
}
