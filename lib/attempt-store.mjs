import { mkdir, open, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
async function writeOnce(path, data) {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(data, null, 2) + '\n', 'utf8'); await file.sync(); }
  finally { await file.close(); }
}

// A pre-dispatch file survives even when the process stops before a final receipt.
// No overwrite, directory listing endpoint, arbitrary path, or automatic retry.
export function createAttemptStore(directory) {
  const root = resolve(directory);
  const folder = id => {
    if (!validId(id)) throw new Error('Invalid attempt ID.');
    return join(root, id);
  };
  return {
    async begin(data) {
      const id = randomUUID();
      await mkdir(root, { recursive: true });
      await mkdir(folder(id));
      await writeOnce(join(folder(id), 'attempt.json'), { ...data, run_id: id, status: 'started', schema_version: 'eventbrief.model-attempt.v1' });
      return id;
    },
    async finish(id, data) {
      const started = JSON.parse(await readFile(join(folder(id), 'attempt.json'), 'utf8'));
      await writeOnce(join(folder(id), 'receipt.json'), { ...started, ...data, run_id: id });
    },
    async read(id) {
      const dir = folder(id);
      try { return JSON.parse(await readFile(join(dir, 'receipt.json'), 'utf8')); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return JSON.parse(await readFile(join(dir, 'attempt.json'), 'utf8'));
      }
    }
  };
}
