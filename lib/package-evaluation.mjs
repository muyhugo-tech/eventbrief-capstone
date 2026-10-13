import assert from 'node:assert/strict';
import { FIELD_DEFINITIONS, validatePackageRecord } from './package-contract.mjs';
import { DOCUMENTS, prepareEventPackage } from './event-package.mjs';
import { PROFILE_READINESS_POLICY } from './guest-dietary-policy.mjs';
import { standaloneDocument } from '../public/package-render.mjs';
import { packageHash } from './package-dataset.mjs';

export const PACKAGE_SCORER_VERSION = 'package-scorer-v1';
const ratio = (numerator, denominator) => ({ numerator, denominator, rate: denominator ? numerator / denominator : null });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : [];
const pendingKey = item => JSON.stringify([item?.field, item?.value, item?.status]);
const same = (a, b) => packageHash(a ?? null) === packageHash(b ?? null);
export function validatePackageRun(run, dataset) {
  assert.equal(run?.schema_version, 'eventbrief.package-saved-run.v1');
  assert.match(run.run_id, /^[a-z0-9][a-z0-9-]{0,79}$/);
  assert.deepEqual(run.dataset, { version: dataset.version, sha256: dataset.sha256 });
  assert.ok(['scorer_self_check', 'fake_provider_test', 'model_evaluation'].includes(run.purpose));
  assert.ok(object(run.provenance) && typeof run.provenance.producer === 'string' && run.provenance.producer.trim());
  if (run.purpose === 'model_evaluation') {
    assert.ok(typeof run.provenance.model === 'string' && run.provenance.model.trim());
    assert.match(run.provenance.prompt_sha256, /^[a-f0-9]{64}$/);
  } else if (run.purpose === 'scorer_self_check') {
    assert.equal(run.provenance.model, null); assert.equal(run.provenance.prompt_sha256, null);
  }
  assert.ok(Array.isArray(run.cases));
  const allowed = new Set(dataset.cases.map(item => item.id)); const receipts = new Map();
  for (const receipt of run.cases) {
    assert.ok(allowed.has(receipt.case_id), `Unknown case: ${receipt.case_id}`);
    assert.ok(!receipts.has(receipt.case_id), `Duplicate case: ${receipt.case_id}`);
    assert.ok(['completed', 'error', 'started'].includes(receipt.status));
    if (receipt.status === 'completed') {
      assert.ok(Object.hasOwn(receipt, 'output'), 'Preserve malformed completed output for scoring');
      assert.ok(!Object.hasOwn(receipt, 'error'));
    } else {
      assert.ok(!Object.hasOwn(receipt, 'output'), 'Failed attempts cannot masquerade as accepted outputs');
      assert.ok(object(receipt.error) && typeof receipt.error.kind === 'string');
    }
    receipts.set(receipt.case_id, receipt);
  }
  return receipts;
}

export function scorePackageRun(run, dataset) {
  const receipts = validatePackageRun(run, dataset);
  const totals = { fields: 0, readiness: 0, quotes: 0, structured: 0, completed: 0, errors: 0, started: 0, missing: 0,
    pendingMatched: 0, pendingActual: 0, pendingExpected: 0, citations: 0, exactCitations: 0, coverage: 0, requiredCoverage: 0, agreementClaims: 0, agreementErrors: 0, privacy: 0 };
  const results = dataset.cases.map(entry => {
    const receipt = receipts.get(entry.id);
    const state = receipt?.status ?? 'missing';
    if (state === 'error') totals.errors++; else totals[state]++;
    const output = state === 'completed' ? receipt.output : null;
    let valid = false, validation_error = null, prepared = null;
    if (state === 'completed') {
      // This frozen dataset predates the host-conditional guest-plan rule.
      // Keep its original readiness semantics and authored expectations intact.
      try { validatePackageRecord(output, entry.input); valid = true; prepared = prepareEventPackage({ input: entry.input, original: output, profile: dataset.profile, readinessPolicy: PROFILE_READINESS_POLICY, normalizationPolicy: 'as-extracted-v1' }); }
      catch (error) { validation_error = error.message; }
    }
    const fields = Object.entries(FIELD_DEFINITIONS).map(([field, definition]) => {
      const expected = entry.expected.record.fields[field]; const actual = output?.fields?.[field];
      const correct = object(actual) && actual.value === expected.value && actual.status === expected.status;
      if (correct) totals.fields++;
      if (actual?.status === 'agreed') { totals.agreementClaims++; if (!correct) totals.agreementErrors++; }
      return { field, label: definition.label, correct, expected: { value: expected.value, status: expected.status }, actual: actual ? { value: actual.value, status: actual.status } : null };
    });
    const expectedPending = list(entry.expected.record.pending_changes); const actualPending = list(output?.pending_changes);
    const available = actualPending.map(pendingKey); let matched = 0;
    for (const item of expectedPending) { const index = available.indexOf(pendingKey(item)); if (index >= 0) { matched++; available.splice(index, 1); } }
    totals.pendingMatched += matched; totals.pendingActual += actualPending.length; totals.pendingExpected += expectedPending.length;
    const pending_correct = valid && matched === expectedPending.length && actualPending.length === expectedPending.length;
    const evidenceUnits = [
      ...Object.entries(output?.fields ?? {}).filter(([, detail]) => detail?.status !== 'unknown').map(([field, detail]) => ({ key: `field:${field}`, evidence: detail?.evidence })),
      ...actualPending.map((item, index) => ({ key: `pending:${index}`, evidence: item?.evidence })),
      ...list(output?.open_questions).map((item, index) => ({ key: `question:${index}`, evidence: item?.evidence }))
    ];
    let evidence_valid = true;
    const exact = citation => typeof citation?.quote === 'string' && citation.quote.trim().length > 0 && entry.input.messages.some(message => message.id === citation.message_id && message.body.includes(citation.quote));
    for (const unit of evidenceUnits) {
      const citations = list(unit.evidence); if (!citations.length) evidence_valid = false;
      for (const citation of citations) { totals.citations++; if (exact(citation)) totals.exactCitations++; else evidence_valid = false; }
    }
    // Fixed expected claims denominator prevents omitted or failed outputs improving coverage.
    for (const [field, detail] of Object.entries(entry.expected.record.fields)) if (detail.status !== 'unknown') {
      totals.requiredCoverage++; const evidence = list(output?.fields?.[field]?.evidence);
      if (evidence.length && evidence.every(exact)) totals.coverage++;
    }
    for (const [key, match] of [['pending_changes', (a, b) => pendingKey(a) === pendingKey(b)], ['open_questions', (a, b) => a?.field === b.field]]) {
      const candidates = [...list(output?.[key])];
      for (const item of entry.expected.record[key]) {
        totals.requiredCoverage++; const index = candidates.findIndex(candidate => match(candidate, item));
        if (index >= 0) { const candidate = candidates.splice(index, 1)[0]; const evidence = list(candidate.evidence); if (evidence.length && evidence.every(exact)) totals.coverage++; }
      }
    }
    const documents = DOCUMENTS.map(({ id }) => {
      const actual = prepared?.documents.find(item => item.id === id)?.state ?? null;
      const expected = entry.expected.document_states[id]; const correct = actual === expected;
      if (correct) totals.readiness++;
      return { id, expected, actual, correct };
    });
    const quote = prepared?.documents.find(item => item.id === 'quote')?.quote;
    const actualQuote = quote ? { total_cents: quote.total_cents, lines: quote.lines.map(({ source_fields, quantity, unit_cents, amount_cents }) => ({ source_fields, quantity, unit_cents, amount_cents })) } : null;
    const quote_correct = valid && same(actualQuote, entry.expected.quote); if (quote_correct) totals.quotes++;
    const leaks = [];
    if (prepared) for (const id of ['quote', 'guest']) {
      const html = standaloneDocument(prepared.documents.find(item => item.id === id), prepared, false);
      for (const text of entry.expected.forbidden_guest_text) if (html.includes(text)) leaks.push({ document: id, text });
    }
    const privacy_correct = valid && leaks.length === 0; if (privacy_correct) totals.privacy++;
    const structured_pass = valid && fields.every(item => item.correct) && pending_correct && evidence_valid && documents.every(item => item.correct) && quote_correct && privacy_correct;
    if (structured_pass) totals.structured++;
    return { case_id: entry.id, title: entry.title, receipt_status: state, error: receipt?.error ?? null, valid, validation_error,
      fields, pending: { correct: pending_correct, matched, expected: expectedPending, actual: actualPending }, documents,
      quote: { correct: quote_correct, expected: entry.expected.quote, actual: actualQuote },
      guest_boundary: { known_text_scan_pass: privacy_correct, leaks }, structured_pass,
      manual_review: { status: 'unscored', questions_expected: entry.expected.record.open_questions, questions_actual: output?.open_questions ?? null, checklist: entry.expected.manual_review } };
  });
  const count = dataset.cases.length;
  return { schema_version: 'eventbrief.package-evaluation-report.v1', scorer_version: PACKAGE_SCORER_VERSION,
    run_id: run.run_id, purpose: run.purpose,
    label: run.purpose === 'scorer_self_check' ? 'Authored scorer self-check · no AI call' : run.purpose === 'fake_provider_test' ? 'Fake provider verification · no AI call' : 'Saved model run · semantic review still required',
    dataset: run.dataset, provenance: run.provenance,
    metrics: { case_count: count, field_pairs: ratio(totals.fields, count * Object.keys(FIELD_DEFINITIONS).length),
      document_readiness: ratio(totals.readiness, count * DOCUMENTS.length), quote_cases: ratio(totals.quotes, count),
      structured_cases: ratio(totals.structured, count), receipts: Object.fromEntries(['completed', 'errors', 'started', 'missing'].map(key => [key, ratio(totals[key], count)])),
      pending: { matched: totals.pendingMatched, expected: totals.pendingExpected, actual: totals.pendingActual, precision: ratio(totals.pendingMatched, totals.pendingActual), recall: ratio(totals.pendingMatched, totals.pendingExpected) },
      evidence: { exact_citations: ratio(totals.exactCitations, totals.citations), expected_claim_coverage: ratio(totals.coverage, totals.requiredCoverage), semantic_support: 'manual/unscored' },
      mismatched_agreement_claims: ratio(totals.agreementErrors, totals.agreementClaims), known_guest_text_scan: ratio(totals.privacy, count),
      question_semantics: 'manual/unscored', full_semantic_cases: { numerator: null, denominator: count, rate: null } },
    limitations: ['Exact value/status matching is stricter than semantic equivalence.', 'Exact quotations do not prove semantic support.',
      'Question meaning and completeness require human review.', 'Guest leakage checks detect only frozen literal test strings.',
      'Development cases are fictional and are not an independent held-out benchmark.', 'No time-saving or real-world performance claim follows from authored self-checks.'], cases: results };
}
