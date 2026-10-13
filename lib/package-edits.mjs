import { applyPackageCorrections, FIELD_DEFINITIONS, COORDINATOR_OPERATIONS, validatePackageValue } from './package-contract.mjs';

// Coordinator edits are saved as corrections; source messages and AI receipts stay intact.
export function eventEditCorrections(original, previous, changes, reason = '', { resolve = false, acceptCustom = false, currentRecord = null } = {}) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) ||
      !Object.keys(changes).length || Object.keys(changes).length > Object.keys(FIELD_DEFINITIONS).length + 1) {
    throw new Error('Choose an event detail to change.');
  }
  if (typeof reason !== 'string' || reason.length > 1000) throw new Error('Keep the change note under 1,000 characters.');
  if (typeof resolve !== 'boolean' || typeof acceptCustom !== 'boolean') throw new Error('Invalid coordinator confirmation.');
  if ((resolve || acceptCustom) && !reason.trim()) throw new Error('Add a short note about what you checked or changed.');
  if (acceptCustom && (!resolve || Object.keys(changes).some(field => !COORDINATOR_OPERATIONS.includes(field)))) throw new Error('Confirm only dietary, setup, AV, or special arrangements here.');
  const note = reason.trim() || 'Coordinator updated event details.';
  const current = currentRecord ?? applyPackageCorrections(original, previous);
  const corrections = structuredClone(previous);
  const values = {...changes};
  const hasNotes = Object.hasOwn(values, 'beverage_notes');
  if (hasNotes && (!Object.hasOwn(values, 'beverage') || typeof values.beverage_notes !== 'string' || values.beverage_notes.length > 1000)) throw new Error('Save a drink option with notes under 1,000 characters.');
  const drinkNotes = hasNotes ? values.beverage_notes.trim() : current.fields.beverage.notes;
  delete values.beverage_notes;
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
    const hasUnresolved = [...original.pending_changes, ...original.open_questions].some(item => item.field === field);
    const confirmation = resolve && value !== null;
    const custom = acceptCustom && value !== null;
    const notesChanged = field === 'beverage' && hasNotes && (current.fields.beverage.notes ?? '') !== drinkNotes;
    if (!notesChanged && current.fields[field].value === value && (!confirmation || current.fields[field].status === status && (!hasUnresolved || current.fields[field].resolved)) && Boolean(current.fields[field].accept_custom) === custom) continue;
    corrections[field] = {value, status, reason: note, ...(field === 'beverage' && drinkNotes !== undefined ? {notes: drinkNotes} : {}), ...(confirmation ? {resolved:true} : {}), ...(custom ? {accept_custom:true} : {})};
  }
  return corrections;
}
