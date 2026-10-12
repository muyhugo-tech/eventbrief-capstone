import { readFile } from 'node:fs/promises';
import { validatePackageRecord } from './package-contract.mjs';
import { validateRestaurant } from './event-package.mjs';

const root = new URL('../fixtures/package/', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const profile = validateRestaurant(await read('restaurant-v2.json'));
export const packageFixtures = new Map();
for (const id of ['patio-complete', 'patio-awaiting-dietary']) {
  const input = await read(`inputs/${id}.json`);
  const original = await read(`expected/${id}.json`);
  if (input.id !== id || input.synthetic !== true) throw new Error('Package fixture identity mismatch.');
  const ids = new Set();
  let previous = -Infinity;
  for (const message of input.messages) {
    if (ids.has(message.id) || !['customer', 'coordinator'].includes(message.role)) throw new Error('Invalid package message identity or role.');
    ids.add(message.id);
    for (const key of ['id', 'sender', 'recipient', 'subject', 'body', 'sent_at']) {
      if (typeof message[key] !== 'string' || !message[key].trim()) throw new Error(`Package message requires ${key}.`);
    }
    const time = Date.parse(message.sent_at);
    if (!Number.isFinite(time) || time <= previous) throw new Error('Package messages must be chronological.');
    previous = time;
  }
  validatePackageRecord(original, input);
  packageFixtures.set(id, { input, original, profile });
}
