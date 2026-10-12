import { packageFixtures } from './package-fixtures.mjs';
import { pastedInput } from './package-workspace.mjs';
import { validatePackageRecord } from './package-contract.mjs';

// Authored, exact-match walkthrough. This never substitutes invented results
// for arbitrary pasted messages or a failed AI call.
const fixture = packageFixtures.get('patio-awaiting-dietary');
const replacements = [
  ['30 guests aged 13 or older and zero children aged 0 through 12', '30 guests and 0 children'],
  ['before preparing the kitchen sheet and staff plan', 'before preparing the kitchen sheet, staff plan, and guest plan']
];
const adapt = value => replacements.reduce((result, [old, next]) => result.replaceAll(old, next), value);
export const demoText = fixture.input.messages.map(message => `${message.role === 'customer' ? 'HOST' : 'RESTAURANT'}:\n${adapt(message.body)}`).join('\n\n');
export const demoReply = 'I checked with everyone. No allergies or dietary restrictions. Everything else stays as confirmed.';
export const demoInput = pastedInput(demoText);
const initial = structuredClone(fixture.original);
for (const detail of Object.values(initial.fields)) for (const citation of detail.evidence) { citation.message_id = 'pasted'; citation.quote = adapt(citation.quote); }
initial.open_questions = [{ field: 'dietary', question: 'Are there any allergies or dietary restrictions?', evidence: [{message_id: 'pasted', quote: 'I will check dietary requirements and send those separately.'}] }];
validatePackageRecord(initial, demoInput);

export function demoRecord(input) {
  if (input.id === demoInput.id) return structuredClone(initial);
  if (input.event_id !== demoInput.id || input.source_revision_number !== 2 || input.messages.length !== 2
    || input.messages[0].body !== demoText || input.messages[1].role !== 'host' || input.messages[1].body !== demoReply) return null;
  const record = structuredClone(initial);
  record.fields.dietary = { value: 'No allergies or dietary restrictions', status: 'stated', evidence: [{message_id: input.messages[1].id, quote: 'No allergies or dietary restrictions.'}] };
  record.open_questions = [];
  return validatePackageRecord(record, input);
}
