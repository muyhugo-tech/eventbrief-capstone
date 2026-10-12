export function buildPackageSelfChecks(dataset) {
  const base = { schema_version: 'eventbrief.package-saved-run.v1', purpose: 'scorer_self_check',
    dataset: { version: dataset.version, sha256: dataset.sha256 },
    provenance: { producer: 'Authored scorer test vectors; no model call', model: null, prompt_sha256: null } };
  const good = { ...base, run_id: 'package-self-check-good-v1', cases: dataset.cases.map(entry => ({ case_id: entry.id, status: 'completed', output: structuredClone(entry.expected.record) })) };
  const bad = structuredClone(good); bad.run_id = 'package-self-check-flawed-v1';
  const byId = id => bad.cases.find(item => item.case_id === id);
  const first = byId('complete').output;
  first.fields.guest_notes = structuredClone(first.fields.staff_notes);
  const dietary = byId('dietary-missing').output;
  dietary.fields.dietary = { value: 'No allergies or dietary restrictions', status: 'stated', evidence: [{ message_id: 'm3', quote: 'We still need your dietary reply before preparing the kitchen sheet and staff plan.' }] };
  dietary.open_questions = [];
  const mixed = byId('mixed-party').output;
  mixed.fields.guest_13_plus_count.value = 30; mixed.fields.child_count.value = 0;
  const requested = byId('date-requested').output;
  requested.fields.event_date = { value: '2027-11-21', status: 'agreed', evidence: structuredClone(requested.pending_changes[0].evidence) };
  requested.pending_changes = []; requested.open_questions = [];
  byId('date-accepted').output.fields.event_date.evidence[0].quote = 'Invented acceptance quotation';
  // Preserve a subtle semantic question error to expose the automated boundary.
  byId('count-conflict').output.open_questions[0].question = 'Which dessert should be served?';
  const failed = byId('staff-private'); delete failed.output; failed.status = 'error'; failed.error = { kind: 'synthetic_refusal', message: 'Authored failure test.' };
  const unfinished = byId('after-hours'); delete unfinished.output; unfinished.status = 'started'; unfinished.error = { kind: 'unknown_outcome', message: 'Authored missing terminal receipt.' };
  bad.cases = bad.cases.filter(item => item.case_id !== 'message-instructions');
  return { good, bad };
}
