import { isAbsolute, relative, resolve, sep } from 'node:path';

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_LISTED_FILES = 20000;
const fileError = (code, message, cause) => Object.assign(new Error(message, { cause }), { code });

/**
 * The small filesystem subset used by EventBrief's append-only stores.
 * Construct once per HTTP request, after verifying the signed visitor session.
 * `root` is a virtual local path; no local files or directories are created.
 * Publication happens atomically in writeFile(), not in open(). Store callers
 * always await writeFile + sync before treating an operation as committed.
 */
export function createBlobFiles({ root, visitorId, sdk, token } = {}) {
  if (typeof root !== 'string' || !root) throw new Error('A hosted storage root is required.');
  if (typeof visitorId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(visitorId)) throw new Error('Invalid visitor storage identity.');
  const localRoot = resolve(root);
  const prefix = `eventbrief/v1/visitors/${visitorId}/`;
  const reads = new Map();
  let sdkPromise;
  const client = () => sdk ? Promise.resolve(sdk) : (sdkPromise ??= import('@vercel/blob'));
  const options = () => ({ ...(token ? { token } : {}), abortSignal: AbortSignal.timeout(15000) });
  function pathname(path, directory = false) {
    if (typeof path !== 'string' || /[\0\r\n]/.test(path)) throw new Error('Invalid hosted storage path.');
    // Reject traversal spelling as well as paths resolved outside the sandbox.
    if (path.split(/[\\/]/).includes('..')) throw new Error('Hosted storage paths must stay inside their visitor workspace.');
    const part = relative(localRoot, resolve(path));
    if (part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) throw new Error('Hosted storage paths must stay inside their visitor workspace.');
    const segments = part.split(/[\\/]/).filter(Boolean);
    if (segments.some(segment => !/^[a-zA-Z0-9_.-]+$/.test(segment))) throw new Error('Invalid hosted storage path.');
    if (!directory && !segments.length) throw new Error('A file path is required.');
    return prefix + segments.join('/') + (directory && segments.length ? '/' : '');
  }
  function invalidate() { reads.clear(); }
  return {
    async mkdir(path) { pathname(path, true); }, // Blob prefixes are virtual directories.
    async readFile(path, encoding) {
      const name = pathname(path);
      const format = typeof encoding === 'object' ? encoding.encoding : encoding;
      if (format && !['utf8', 'utf-8'].includes(format)) throw new Error('Hosted storage supports UTF-8 files only.');
      let pending = reads.get(name);
      if (!pending) {
        pending = (async () => {
          const api = await client();
          const result = await api.get(name, { ...options(), access: 'private', useCache: false });
          if (result === null) throw fileError('ENOENT', 'Saved file not found.');
          if (result?.statusCode !== 200 || !result.stream) throw new Error('Hosted storage returned an invalid file response.');
          if (result.blob?.size > MAX_FILE_BYTES) throw new Error('Saved file exceeds the hosted demo size limit.');
          const chunks = []; let bytes = 0;
          for await (const chunk of result.stream) {
            bytes += chunk.byteLength;
            if (bytes > MAX_FILE_BYTES) throw new Error('Saved file exceeds the hosted demo size limit.');
            chunks.push(Buffer.from(chunk));
          }
          return Buffer.concat(chunks);
        })();
        reads.set(name, pending);
      }
      try { const data = await pending; return format ? data.toString('utf8') : Buffer.from(data); }
      catch (error) { if (reads.get(name) === pending) reads.delete(name); throw error; }
    },
    async readdir(path) {
      const folder = pathname(path, true);
      // Lists are authoritative version checks. Another tab can append a reply
      // while this request awaits AI; never memoize directory snapshots.
      const pending = (async () => {
          const api = await client(), names = new Set(), cursors = new Set();
          let cursor, count = 0;
          do {
            const page = await api.list({ ...options(), prefix: folder, limit: 1000, ...(cursor ? { cursor } : {}) });
            if (!Array.isArray(page?.blobs)) throw new Error('Hosted storage returned an invalid file list.');
            for (const blob of page.blobs) {
              if (++count > MAX_LISTED_FILES) throw new Error('This visitor workspace exceeds the hosted demo file limit.');
              if (typeof blob.pathname !== 'string' || !blob.pathname.startsWith(folder)) throw new Error('Hosted storage returned a file outside this visitor workspace.');
              const name = blob.pathname.slice(folder.length).split('/')[0];
              if (name) names.add(name);
            }
            if (!page.hasMore) break;
            if (!page.cursor || cursors.has(page.cursor)) throw new Error('Hosted storage returned an invalid page cursor.');
            cursor = page.cursor; cursors.add(cursor);
          } while (true);
          return [...names].sort();
      })();
      return [...await pending];
    },
    async open(path, flags) {
      const name = pathname(path);
      if (flags !== 'wx') throw new Error('Hosted storage only supports creating new immutable files.');
      let closed = false, attempted = false, written = false;
      return {
        async writeFile(data, encoding = 'utf8') {
          if (closed || attempted) throw new Error('This immutable file handle is no longer writable.');
          attempted = true;
          if (encoding !== 'utf8') throw new Error('Hosted storage supports UTF-8 files only.');
          const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
          if (bytes.length > MAX_FILE_BYTES) throw new Error('Saved file exceeds the hosted demo size limit.');
          const api = await client();
          try {
            await api.put(name, bytes, { ...options(), access: 'private', allowOverwrite: false, addRandomSuffix: false, contentType: 'application/json' });
            written = true;
          } catch (error) {
            // The SDK exposes duplicate-path failures as BlobError, not a
            // distinct conflict class. Match only its specific service error;
            // timeouts, access failures and other bad requests remain errors.
            if (typeof api.BlobError === 'function' && error instanceof api.BlobError &&
                /^Vercel Blob: This blob already exists\b/.test(error.message) && error.message.includes('allowOverwrite')) {
              throw fileError('EEXIST', 'This saved file already exists.', error);
            }
            throw error;
          } finally { invalidate(); }
        },
        async sync() { if (!written || closed) throw new Error('The saved file has not been committed.'); },
        async close() { closed = true; }
      };
    }
  };
}
