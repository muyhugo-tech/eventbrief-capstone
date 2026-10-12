export const FIELD_DEFINITIONS = {
  host_name: { label: 'Host', type: 'text' },
  booking_status: { label: 'Booking status in the thread', type: 'text' },
  event_date: { label: 'Event date', type: 'date' },
  start_time: { label: 'Start time', type: 'time' },
  end_time: { label: 'End time', type: 'time' },
  timezone: { label: 'Timezone', type: 'text' },
  guest_count: { label: 'Total guests', type: 'integer', minimum: 1 },
  guest_13_plus_count: { label: 'Guests', type: 'integer', minimum: 0 },
  child_count: { label: 'Children (0–12)', type: 'integer', minimum: 0 },
  venue: { label: 'Venue section', type: 'text' },
  menu: { label: 'Menu', type: 'text' },
  beverage: { label: 'Beverage arrangement', type: 'text' },
  dietary: { label: 'Dietary requirements', type: 'text' },
  setup: { label: 'Table setup', type: 'text' },
  av: { label: 'AV needs', type: 'text' },
  special: { label: 'Special requirements', type: 'text' },
  guest_notes: { label: 'Guest instructions', type: 'text' },
  staff_notes: { label: 'Internal staff notes', type: 'text' }
};
export const PACKAGE_STATUSES = ['unknown', 'stated', 'requested', 'agreed', 'conflicting'];
export const PACKAGE_MODEL_VERSION = 'eventbrief.package-record.v3';
export const GUEST_CATEGORIES = ['guest_13_plus_count', 'child_count'];
const schemaObject = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const citationSchema = { type: 'array', items: schemaObject({ message_id: { type: 'string' }, quote: { type: 'string' } }) };
const fieldSchema = { type: 'string', enum: Object.keys(FIELD_DEFINITIONS) };
export const packageOutputSchema = schemaObject({
  schema_version: { type: 'string', enum: [PACKAGE_MODEL_VERSION] },
  fields: schemaObject(Object.fromEntries(Object.entries(FIELD_DEFINITIONS).map(([field, definition]) => [field, schemaObject({
    value: { type: [definition.type === 'integer' ? 'integer' : 'string', 'null'] },
    status: { type: 'string', enum: PACKAGE_STATUSES }, evidence: citationSchema
  })]))),
  pending_changes: { type: 'array', items: schemaObject({ field: fieldSchema, value: { anyOf: [{ type: 'string' }, { type: 'integer' }] }, status: { type: 'string', enum: ['requested'] }, evidence: citationSchema }) },
  open_questions: { type: 'array', items: schemaObject({ field: fieldSchema, question: { type: 'string' }, evidence: citationSchema }) }
});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function shape(value, keys, name) {
  if (!object(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) {
    throw new Error(`${name}: unexpected structure.`);
  }
}

export function validatePackageValue(field, value, status) {
  if (!Object.hasOwn(FIELD_DEFINITIONS, field)) throw new Error('Unknown event field.');
  const spec = FIELD_DEFINITIONS[field];
  if (!PACKAGE_STATUSES.includes(status)) throw new Error(`${spec.label}: unknown status.`);
  if (status === 'unknown' || status === 'conflicting') {
    if (value !== null) throw new Error(`${spec.label}: unresolved fields must have a null value.`);
    return;
  }
  if (spec.type === 'integer') {
    if (!Number.isInteger(value) || value < spec.minimum || value > 10000) {
      throw new Error(`${spec.label}: use a whole number from ${spec.minimum} to 10,000.`);
    }
  } else {
    if (typeof value !== 'string' || !value.trim() || value.length > 1000) {
      throw new Error(`${spec.label}: enter a nonempty value of at most 1,000 characters.`);
    }
    if (spec.type === 'date') {
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error('Event date: use a valid YYYY-MM-DD date.');
      }
    }
    if (spec.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${spec.label}: use HH:MM in 24-hour time.`);
  }
}

export function validatePackageRecord(record, input) {
  if (record?.schema_version !== PACKAGE_MODEL_VERSION) throw new Error('Unknown event record version.');
  shape(record, ['schema_version', 'fields', 'pending_changes', 'open_questions'], 'Event record');
  const citations = (items, name) => {
    if (!Array.isArray(items) || !items.length || items.length > 20) throw new Error(`${name}: source evidence is required.`);
    for (const citation of items) {
      shape(citation, ['message_id', 'quote'], 'Citation');
      const source = input.messages.find(message => message.id === citation.message_id);
      if (!source || typeof citation.quote !== 'string' || !citation.quote.trim() || !source.body.includes(citation.quote)) throw new Error(`${name}: a quotation does not match the source message.`);
    }
  };
  shape(record.fields, Object.keys(FIELD_DEFINITIONS), 'Event fields');
  for (const [field, detail] of Object.entries(record.fields)) {
    shape(detail, ['value', 'status', 'evidence'], field);
    validatePackageValue(field, detail.value, detail.status);
    if (!Array.isArray(detail.evidence) || detail.evidence.length > 20) throw new Error(`${field}: invalid evidence array.`);
    if (detail.status === 'unknown' && detail.evidence.length) throw new Error(`${field}: unknown values cannot have evidence.`);
    if (detail.status !== 'unknown' && !detail.evidence.length) throw new Error(`${field}: evidence is required.`);
    if (detail.status === 'conflicting' && detail.evidence.length < 2) throw new Error(`${field}: cite both sides of the conflict.`);
    for (const citation of detail.evidence) {
      shape(citation, ['message_id', 'quote'], 'Citation');
      const source = input.messages.find(message => message.id === citation.message_id);
      if (!source || typeof citation.quote !== 'string' || !citation.quote.trim() || !source.body.includes(citation.quote)) {
        throw new Error(`${field}: a quotation does not match the source message.`);
      }
    }
  }
  {
    for (const key of ['pending_changes', 'open_questions']) {
      if (!Array.isArray(record[key]) || record[key].length > 30) throw new Error(`Invalid ${key}.`);
    }
    const seen = new Set();
    for (const item of record.pending_changes) {
      shape(item, ['field', 'value', 'status', 'evidence'], 'Pending change');
      if (item.status !== 'requested') throw new Error('Pending changes must remain requests.');
      validatePackageValue(item.field, item.value, item.status);
      citations(item.evidence, 'Pending change');
      const identity = `${item.field}:${JSON.stringify(item.value)}`;
      if (seen.has(identity)) throw new Error('Duplicate pending change.');
      seen.add(identity);
    }
    for (const item of record.open_questions) {
      shape(item, ['field', 'question', 'evidence'], 'Open question');
      if (!Object.hasOwn(FIELD_DEFINITIONS, item.field) || typeof item.question !== 'string' || !item.question.trim() || item.question.length > 1000) throw new Error('Invalid open question.');
      citations(item.evidence, 'Open question');
    }
  }
  return record;
}

export function applyPackageCorrections(original, corrections = {}) {
  if (!object(corrections) || Object.keys(corrections).length > Object.keys(FIELD_DEFINITIONS).length) {
    throw new Error('Invalid coordinator corrections.');
  }
  const record = structuredClone(original);
  for (const [field, correction] of Object.entries(corrections)) {
    shape(correction, ['value', 'status', 'reason'], 'Correction');
    validatePackageValue(field, correction.value, correction.status);
    if (typeof correction.reason !== 'string' || !correction.reason.trim() || correction.reason.length > 1000) {
      throw new Error('Explain each correction in at most 1,000 characters.');
    }
    record.fields[field] = {
      value: correction.value,
      status: correction.status,
      evidence: [],
      provenance: 'coordinator_correction',
      reason: correction.reason
    };
  }
  return record;
}
