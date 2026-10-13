// Preparation rules only: keep the model receipt and coordinator edits intact.
export const DRAFT_WORKFLOW = 'usable-drafts-v2';
export const DRAFT_WORKFLOW_V1 = 'usable-drafts-v1';
export const LEGACY_WORKFLOW = 'strict-drafts-v1';

const usable = detail => detail.value !== null && ['stated', 'agreed'].includes(detail.status);
export const unspecified = detail => detail.value === null && detail.status === 'unknown';

const clock = value => {const [hour,minute]=value.split(':').map(Number);return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`;};

export function applyDraftWorkflow(record, profile, corrections, policy = DRAFT_WORKFLOW) {
  const result = structuredClone(record), f = result.fields;
  const pending = field => [...result.pending_changes, ...result.open_questions].some(item => item.field === field) && !f[field].resolved;
  const untouched = field => !Object.hasOwn(corrections, field) && unspecified(f[field]) && !pending(field);
  if (untouched('timezone')) {
    f.timezone = {value: profile.timezone, status: 'agreed', evidence: [],
      preparation: {kind: 'restaurant_default', original_value: null,
        description: `Restaurant timezone: ${profile.timezone}. Taken from restaurant settings, not the conversation.`}};
  }
  // A cleared end time means "use the default". Explicit times, conflicts and
  // outstanding schedule questions remain authoritative. Recompute each time
  // from the current start; never persist the calculated value as a correction.
  if (policy === DRAFT_WORKFLOW && unspecified(f.end_time) && !pending('end_time') &&
      usable(f.start_time) && !pending('start_time')) {
    const [hour,minute]=f.start_time.value.split(':').map(Number);
    const end=hour*60+minute+240, dayOffset=Math.floor(end/1440);
    const value=`${String(Math.floor(end/60)%24).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;
    f.end_time={value,status:f.start_time.status,evidence:[],
      preparation:{kind:'default_duration',original_value:null,hours:4,day_offset:dayOffset,source_fields:['start_time'],
        description:`End time defaults to ${clock(value)}${dayOffset?' the next day':''}: 4 hours after the ${clock(f.start_time.value)} start. No end time was specified.`}};
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
  if (record.fields.end_time.preparation?.kind === 'default_duration') notices.push(record.fields.end_time.preparation.description);
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
