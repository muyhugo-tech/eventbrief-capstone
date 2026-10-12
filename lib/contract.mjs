const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const string = { type: 'string' };
const evidence = { type: 'array', items: object({ message_id: string, quote: string }) };
const status = { type: 'string', enum: ['unknown', 'stated', 'requested', 'agreed'] };
const detail = type => object({ value: { type: [type, 'null'] }, status, evidence });
export const outputSchema = object({
  fields: object({ event_date: detail('string'), guest_count: detail('integer'), venue: detail('string') }),
  pending_changes: { type: 'array', items: object({ field: { type: 'string', enum: ['event_date', 'guest_count', 'venue'] }, value: { anyOf: [string, { type: 'integer' }] }, status: { type: 'string', enum: ['requested'] }, evidence }) },
  open_questions: { type: 'array', items: object({ topic: string, question: string, evidence }) }
});

export function validateOutput(value, input) {
  const fail = message => { throw new Error(message); };
  function shape(data, keys) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).sort().join('|') !== [...keys].sort().join('|')) fail('Unexpected output structure.');
  }
  function validValue(field, val) {
    if (field === 'guest_count') {
      if (!Number.isInteger(val) || val < 1 || val > 100000) fail('Invalid attendance.');
    } else if (field === 'event_date') {
      if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) fail('Invalid event date.');
      const parsed = new Date(`${val}T00:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== val) fail('Invalid event date.');
    } else if (field !== 'venue' || typeof val !== 'string' || !val.trim() || val.length > 300) fail('Invalid venue.');
  }
  function citations(items, allowEmpty = false) {
    if (!Array.isArray(items) || (!allowEmpty && !items.length) || items.length > 20) fail('Missing or excessive source evidence.');
    for (const item of items) {
      shape(item, ['message_id', 'quote']);
      const message = input.messages.find(m => m.id === item.message_id);
      if (!message || typeof item.quote !== 'string' || !item.quote.trim() || !message.body.includes(item.quote)) fail('A supporting quote does not match the source.');
    }
  }
  shape(value, ['fields', 'pending_changes', 'open_questions']);
  shape(value.fields, ['event_date', 'guest_count', 'venue']);
  for (const [field, item] of Object.entries(value.fields)) {
    shape(item, ['value', 'status', 'evidence']);
    if (!status.enum.includes(item.status)) fail('Unknown field status.');
    if (item.status === 'unknown') {
      if (item.value !== null || !Array.isArray(item.evidence) || item.evidence.length !== 0) fail('Unknown fields must have no value or evidence.');
    } else {
      validValue(field, item.value);
      citations(item.evidence);
    }
  }
  if (!Array.isArray(value.pending_changes) || value.pending_changes.length > 20) fail('Invalid pending changes.');
  for (const item of value.pending_changes) {
    shape(item, ['field', 'value', 'status', 'evidence']);
    validValue(item.field, item.value);
    if (item.status !== 'requested') fail('A pending change must remain a request.');
    citations(item.evidence);
  }
  if (!Array.isArray(value.open_questions) || value.open_questions.length > 20) fail('Invalid questions.');
  const topics = new Set();
  for (const item of value.open_questions) {
    shape(item, ['topic', 'question', 'evidence']);
    if (typeof item.topic !== 'string' || !item.topic.trim() || item.topic.length > 100 || topics.has(item.topic)) fail('Question topics must be unique and nonempty.');
    topics.add(item.topic);
    if (typeof item.question !== 'string' || !item.question.trim() || item.question.length > 1000) fail('Invalid question.');
    citations(item.evidence);
  }
  return value;
}

export function referenceOutput(expected) {
  const { fields, pending_changes, open_questions } = expected;
  return structuredClone({ fields, pending_changes, open_questions });
}
