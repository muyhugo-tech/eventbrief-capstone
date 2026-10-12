import { applyPackageCorrections, FIELD_DEFINITIONS, validatePackageValue } from './package-contract.mjs';

// Coordinator edits are saved as corrections; source messages and AI receipts stay intact.
export function eventEditCorrections(original, previous, changes, reason = '') {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) ||
      !Object.keys(changes).length || Object.keys(changes).length > Object.keys(FIELD_DEFINITIONS).length) {
    throw new Error('Choose an event detail to change.');
  }
  if (typeof reason !== 'string' || reason.length > 1000) throw new Error('Keep the change note under 1,000 characters.');
  const note = reason.trim() || 'Coordinator updated event details.';
  const current = applyPackageCorrections(original, previous);
  const corrections = structuredClone(previous);
  const values = {...changes};
  if (Object.hasOwn(values, 'guest_count')) throw new Error('Change Guests and Children together. The total is calculated for you.');
  const attendance = ['guest_13_plus_count', 'child_count'];
  if (attendance.some(field => Object.hasOwn(values, field))) {
    if (!attendance.every(field => Object.hasOwn(values, field) && Number.isInteger(values[field]))) {
      throw new Error('Enter both Guests and Children. Use 0 if there are none.');
    }
    values.guest_count = values.guest_13_plus_count + values.child_count;
  }
  for (const [field, raw] of Object.entries(values)) {
    const value = typeof raw === 'string' ? raw.trim() || null : raw;
    const status = value === null ? 'unknown' : 'agreed';
    validatePackageValue(field, value, status);
    if (current.fields[field].value === value) continue;
    corrections[field] = {value, status, reason: note};
  }
  return corrections;
}
