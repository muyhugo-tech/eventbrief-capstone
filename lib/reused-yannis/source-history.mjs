import { createHash } from 'node:crypto';

// Ported from history.ts: fingerprint and appendHistory's identity, baseline,
// and immutable-source guards. See README.md for the intentionally smaller adapter.
export function fingerprint(value) {
  function sorted(x) {
    if (Array.isArray(x)) return x.map(sorted);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sorted(v)]));
    return x;
  }
  return createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
}

export function appendSourceHistory(previous, input) {
  const source = new Map(input.messages.map(m => [m.id, m]));
  if (!input.event_id || source.size !== input.messages.length) throw new Error('Invalid event source identity.');
  const baseline = fingerprint(input.baseline);
  if (previous) {
    if (previous.event_id !== input.event_id || previous.baseline_fingerprint !== baseline || previous.identity !== input.identity)
      throw new Error('The event identity or original context changed.');
    for (const [id, digest] of Object.entries(previous.source_fingerprints))
      if (!source.has(id) || fingerprint(source.get(id)) !== digest) throw new Error('Earlier source messages changed.');
    // The parent history keeps its baseline revision fixed while appending
    // observations. This adapter advances source revisions one at a time.
    if (input.expected_revision !== previous.expected_revision + 1) throw new Error('This event changed in another tab. Open the latest messages.');
    if (input.messages.length !== Object.keys(previous.source_fingerprints).length + 1
      || Object.keys(previous.source_fingerprints).some((id, index) => input.messages[index]?.id !== id))
      throw new Error('A reply must append to the same event in order.');
  } else if (input.expected_revision !== 1) throw new Error('The first source revision must be 1.');
  return { schema_version: 'eventbrief.source-history.v1', event_id: input.event_id, identity: input.identity,
    expected_revision: input.expected_revision, baseline_fingerprint: baseline,
    source_fingerprints: Object.fromEntries(input.messages.map(m => [m.id, fingerprint(m)])) };
}

