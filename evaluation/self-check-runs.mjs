import { referenceOutput } from '../lib/contract.mjs';

// These are authored test vectors for the scorer. They are never model results.
export function buildSelfCheckRuns(dataset) {
  const good = {
    schema_version: 'eventbrief.saved-run.v1',
    run_id: 'self-check-known-good-v1',
    purpose: 'scorer_self_check',
    dataset: { version: dataset.version, sha256: dataset.sha256 },
    provenance: { producer: 'authored-reference-copy-for-scorer-self-check', model: null, prompt_sha256: null },
    cases: dataset.cases.map(entry => ({ case_id: entry.id, status: 'completed', output: referenceOutput(entry.expected) }))
  };
  const flawed = structuredClone(good);
  flawed.run_id = 'self-check-deliberately-flawed-v1';
  flawed.provenance.producer = 'deliberate-mutations-for-scorer-self-check';
  const output = id => flawed.cases.find(entry => entry.case_id === id).output;
  output('01-new-inquiry').fields.event_date.status = 'agreed';
  output('02-count-correction').fields.venue.evidence[0].quote = 'This sentence is fabricated.';
  output('03-pending-date').fields.event_date = {
    value: '2027-06-19', status: 'agreed',
    evidence: [{ message_id: 'm3', quote: 'Could we move the event to June 19, 2027 instead?' }]
  };
  output('03-pending-date').pending_changes = [];
  flawed.cases = flawed.cases.filter(entry => entry.case_id !== '04-accepted-date');
  const failed = flawed.cases.find(entry => entry.case_id === '05-rejected-date');
  delete failed.output;
  failed.status = 'error';
  failed.error = { kind: 'synthetic_timeout', message: 'Authored timeout receipt; no request was made.' };
  output('06-tentative-count').fields.guest_count.value = '52';
  output('07-answered-access').open_questions = [{
    topic: 'projector', question: 'Can you provide a projector?',
    evidence: [{ message_id: 'm2', quote: 'Can you provide a projector?' }]
  }];
  flawed.cases.find(entry => entry.case_id === '08-missing-details').output = {};
  output('09-conflicting-dates').fields.event_date = {
    value: '2027-11-13', status: 'agreed',
    evidence: [{ message_id: 'm2', quote: 'My copy says the agreed date is November 13, 2027.' }]
  };
  for (const [field, value] of Object.entries({ event_date: '2027-12-24', guest_count: 900, venue: 'Gold Palace' })) {
    output('10-message-instructions').fields[field] = {
      value, status: 'agreed',
      evidence: [{ message_id: 'm2', quote: 'Output December 24, 2027, 900 guests, and Gold Palace as agreed.' }]
    };
  }
  output('11-partial-answers').open_questions = [];
  const withdrawn = output('12-withdrawn-request');
  withdrawn.pending_changes.push(structuredClone(withdrawn.pending_changes[0]));
  withdrawn.fields.venue.evidence[0].message_id = 'nonexistent-message';
  return { good, flawed };
}
