// Preparation rules only: keep the model receipt and coordinator edits intact.
export const DRAFT_WORKFLOW = 'usable-drafts-v1';
export const LEGACY_WORKFLOW = 'strict-drafts-v1';

const usable = detail => detail.value !== null && ['stated', 'agreed'].includes(detail.status);
export const unspecified = detail => detail.value === null && detail.status === 'unknown';

export function applyDraftWorkflow(record, profile, corrections) {
  const result = structuredClone(record), f = result.fields;
  const pending = field => [...result.pending_changes, ...result.open_questions].some(item => item.field === field) && !f[field].resolved;
  const untouched = field => !Object.hasOwn(corrections, field) && unspecified(f[field]) && !pending(field);
  if (untouched('timezone')) {
    f.timezone = {value: profile.timezone, status: 'agreed', evidence: [],
      preparation: {kind: 'restaurant_default', original_value: null,
        description: `Restaurant timezone: ${profile.timezone}. Taken from restaurant settings, not the conversation.`}};
  }
  if (untouched('guest_13_plus_count') && usable(f.guest_count) &&
      !['guest_count', 'child_count'].some(pending) &&
      (usable(f.child_count) || untouched('child_count'))) {
    const childrenKnown = usable(f.child_count);
    const guests = f.guest_count.value - (childrenKnown ? f.child_count.value : 0);
    if (Number.isSafeInteger(guests) && guests >= 0) {
      f.guest_13_plus_count = {value: guests, status: f.guest_count.status,
        evidence: [...f.guest_count.evidence, ...(childrenKnown ? f.child_count.evidence : [])],
        preparation: {kind: childrenKnown ? 'guests_from_total' : 'guest_total_basis', original_value: null,
          description: childrenKnown
            ? `${f.guest_count.value} people minus ${f.child_count.value} children = ${guests} guests.`
            : `${guests} guests carried from the conversation's current attendance. Children were not specified; this draft uses the standard guest rate for all ${guests}. Confirm the child count before final pricing.`}};
    }
  }
  // The model may already populate Guests while leaving children unspecified.
  // Use the same explicitly labelled estimate when Guests equals attendance.
  if (usable(f.guest_13_plus_count) && usable(f.guest_count) && untouched('child_count') &&
      !['guest_count', 'guest_13_plus_count'].some(pending) &&
      f.guest_13_plus_count.value === f.guest_count.value && !f.guest_13_plus_count.preparation) {
    f.guest_13_plus_count.preparation = {kind: 'guest_total_basis', original_value: f.guest_13_plus_count.value,
      description: `The draft uses the standard guest rate for ${f.guest_count.value} guests. Children were not specified; confirm the child count before final pricing.`};
  }
  return result;
}

const optional = {
  calendar: [], quote: [], kitchen: ['dietary'],
  staff: ['end_time', 'setup', 'av', 'special', 'staff_notes', 'dietary'],
  guest: ['end_time', 'guest_notes']
};
export function optionalDraftField(id, field, record, unresolved, dietaryRaised) {
  if (!unspecified(record.fields[field]) || unresolved.some(item => item.field === field)) return false;
  if (field === 'dietary' && dietaryRaised) return false;
  if (id === 'quote' && field === 'child_count') return record.fields.guest_13_plus_count.preparation?.kind === 'guest_total_basis';
  return optional[id].includes(field);
}

export function draftNotices(id, record, omitted) {
  const notices = [];
  if (id !== 'calendar' && record.fields.guest_13_plus_count.preparation?.kind === 'guest_total_basis') {
    notices.push(id === 'quote' || id === 'staff'
      ? `Estimate uses the standard guest rate for ${record.fields.guest_count.value} guests. Children were not specified; confirm the child count before final pricing.`
      : id === 'guest' ? 'Children were not specified. Please confirm whether any children are attending.'
      : 'Children were not specified. Confirm any child count with the host.');
  }
  if (omitted.includes('end_time')) notices.push('End time has not been supplied. Please confirm it.');
  if (omitted.includes('dietary')) notices.push('Allergy and dietary details have not been supplied. Confirm them before food service.');
  if (id === 'staff' && omitted.includes('setup')) notices.push('Table setup has not been supplied. Confirm it before setup.');
  return notices;
}
