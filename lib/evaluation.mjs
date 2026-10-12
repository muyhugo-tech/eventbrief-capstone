import assert from 'node:assert/strict';
import { validateOutput } from './contract.mjs';

export const SCORER_VERSION = 'scorer-v1';
export const FIELD_NAMES = ['event_date', 'guest_count', 'venue'];
export const ratio = (numerator, denominator) => ({
  numerator,
  denominator,
  rate: denominator === 0 ? null : numerator / denominator
});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (value, key) => record(value) && Object.hasOwn(value, key);
const same = (a, b) => a === b; // Deliberately typed, exact comparison; no aliases or fuzzy matching.

function validateRun(run, dataset) {
  assert.ok(record(run), 'Saved run must be an object');
  assert.equal(run.schema_version, 'eventbrief.saved-run.v1');
  assert.match(run.run_id, /^[a-z0-9][a-z0-9-]{0,79}$/);
  assert.ok(['scorer_self_check', 'model_evaluation'].includes(run.purpose), 'Declare run purpose');
  assert.deepEqual(run.dataset, { version: dataset.version, sha256: dataset.sha256 }, 'Dataset fingerprint mismatch');
  assert.ok(record(run.provenance), 'Saved run needs provenance');
  assert.ok(typeof run.provenance.producer === 'string' && run.provenance.producer.trim());
  if (run.purpose === 'model_evaluation') {
    assert.ok(typeof run.provenance.model === 'string' && run.provenance.model.trim(), 'Declare model');
    assert.match(run.provenance.prompt_sha256, /^[a-f0-9]{64}$/, 'Declare the actual prompt hash');
  } else {
    assert.equal(run.provenance.model, null, 'Self-checks must not claim a model');
    assert.equal(run.provenance.prompt_sha256, null, 'Self-checks do not use a model prompt');
  }
  assert.ok(Array.isArray(run.cases), 'Saved run cases must be an array');
  const allowed = new Set(dataset.cases.map(entry => entry.id));
  const receipts = new Map();
  for (const receipt of run.cases) {
    assert.ok(record(receipt), 'Each case receipt must be an object');
    assert.ok(allowed.has(receipt.case_id), `Unknown case ID: ${receipt.case_id}`);
    assert.ok(!receipts.has(receipt.case_id), `Duplicate case ID: ${receipt.case_id}`);
    assert.ok(['completed', 'error'].includes(receipt.status), 'Unknown receipt status');
    if (receipt.status === 'completed') {
      assert.ok(has(receipt, 'output'), 'Completed receipt must contain output, even if null or malformed');
      assert.ok(!has(receipt, 'error'), 'Completed receipt cannot also contain an error');
    } else {
      assert.ok(!has(receipt, 'output'), 'Error receipt cannot hide an output; save it as completed for scoring');
      assert.ok(record(receipt.error));
      assert.ok(typeof receipt.error.kind === 'string' && receipt.error.kind.trim());
      assert.ok(typeof receipt.error.message === 'string' && receipt.error.message.trim());
    }
    receipts.set(receipt.case_id, receipt);
  }
  return receipts;
}

function scoreEvidence(output, input) {
  const issues = [];
  let citations = 0;
  let validCitations = 0;
  let requiredClaims = 0;
  let coveredClaims = 0;
  const inspect = (item, path, required) => {
    if (required) requiredClaims++;
    const evidence = item?.evidence;
    if (!Array.isArray(evidence)) {
      issues.push(`${path}: evidence must be an array`);
      return;
    }
    let allValid = true;
    for (const [index, citation] of evidence.entries()) {
      citations++;
      const source = input.messages.find(message => message.id === citation?.message_id);
      const valid = record(citation)
        && Object.keys(citation).sort().join('|') === 'message_id|quote'
        && typeof citation.quote === 'string' && citation.quote.trim().length > 0
        && Boolean(source?.body.includes(citation.quote));
      if (valid) validCitations++;
      else {
        allValid = false;
        issues.push(`${path}.evidence[${index}]: invalid citation shape, message ID, or exact quote`);
      }
    }
    if (evidence.length > 20) issues.push(`${path}: more than 20 citations`);
    if (required) {
      if (evidence.length === 0) issues.push(`${path}: missing required evidence`);
      if (evidence.length > 0 && evidence.length <= 20 && allValid) coveredClaims++;
    } else if (evidence.length !== 0) {
      issues.push(`${path}: unknown fields must have empty evidence`);
    }
  };
  for (const field of FIELD_NAMES) {
    const item = output?.fields?.[field];
    const unknown = item?.status === 'unknown' && item?.value === null;
    inspect(item, `fields.${field}`, !unknown);
  }
  for (const key of ['pending_changes', 'open_questions']) {
    if (!Array.isArray(output?.[key])) issues.push(`${key}: missing claim array`);
    else output[key].forEach((item, index) => inspect(item, `${key}[${index}]`, true));
  }
  return {
    exact_citations: ratio(validCitations, citations),
    claims_with_valid_evidence: ratio(coveredClaims, requiredClaims),
    all_evidence_valid: issues.length === 0,
    issues
  };
}

function scorePending(predicted, expected) {
  // One-to-one matching makes repeated predictions false positives, not extra credit.
  const remaining = new Set(expected.map((_, index) => index));
  let matched = 0;
  for (const item of Array.isArray(predicted) ? predicted : []) {
    const index = [...remaining].find(i => record(item)
      && item.field === expected[i].field
      && same(item.value, expected[i].value)
      && item.status === expected[i].status);
    if (index !== undefined) {
      remaining.delete(index);
      matched++;
    }
  }
  const count = Array.isArray(predicted) ? predicted.length : 0;
  return {
    matched,
    predicted: count,
    expected: expected.length,
    exact: Array.isArray(predicted) && matched === count && matched === expected.length
  };
}

function scoreAgreements(output, expected) {
  const claims = [];
  for (const field of FIELD_NAMES) {
    const item = output?.fields?.[field];
    if (item?.status === 'agreed') {
      claims.push({
        path: `fields.${field}`,
        supported_by_reference: expected.fields[field].status === 'agreed'
          && same(item.value, expected.fields[field].value)
      });
    }
  }
  // An agreement in a pending slot is invalid even when its value is the current agreement.
  if (Array.isArray(output?.pending_changes)) {
    output.pending_changes.forEach((item, index) => {
      if (item?.status === 'agreed') claims.push({ path: `pending_changes[${index}]`, supported_by_reference: false });
    });
  }
  return { claims: claims.length, errors: claims.filter(claim => !claim.supported_by_reference) };
}

function scoreCase(entry, receipt) {
  const completed = receipt?.status === 'completed';
  const output = completed ? receipt.output : null;
  let contractError = null;
  if (completed) {
    try { validateOutput(output, entry.input); }
    catch (error) { contractError = error.message; }
  }
  const fields = Object.fromEntries(FIELD_NAMES.map(field => {
    const actual = output?.fields?.[field];
    const expected = entry.expected.fields[field];
    const valueCorrect = completed && has(actual, 'value') && same(actual.value, expected.value);
    const statusCorrect = completed && has(actual, 'status') && same(actual.status, expected.status);
    return [field, {
      expected: { value: expected.value, status: expected.status },
      actual: record(actual) ? actual : null,
      value_correct: valueCorrect,
      status_correct: statusCorrect,
      value_and_status_correct: valueCorrect && statusCorrect
    }];
  }));
  const pending = scorePending(output?.pending_changes, entry.expected.pending_changes);
  const evidence = completed ? scoreEvidence(output, entry.input) : null;
  const agreements = scoreAgreements(output, entry.expected);
  const structuredPass = completed && contractError === null
    && Object.values(fields).every(field => field.value_and_status_correct) && pending.exact;
  return {
    case_id: entry.id,
    group: entry.group,
    tags: entry.tags,
    receipt_status: receipt?.status ?? 'missing',
    error: receipt?.error ?? null,
    contract_and_source_valid: completed && contractError === null,
    contract_error: contractError,
    fields,
    pending,
    evidence,
    agreements,
    structured_case_pass: structuredPass,
    full_semantic_case_pass: null,
    manual_review: {
      status: 'unscored',
      expected_questions: entry.expected.open_questions,
      actual_questions: output?.open_questions ?? null,
      expected_rationale: entry.expected.rationale,
      reason: 'Question meaning, completeness, and semantic evidence support require human review. Topic strings are not matched.'
    }
  };
}

function summarize(cases) {
  const count = predicate => cases.filter(predicate).length;
  const sum = get => cases.reduce((total, item) => total + get(item), 0);
  const fieldMetrics = fieldCases => ({
    value_correct: ratio(fieldCases.filter(field => field.value_correct).length, fieldCases.length),
    status_correct: ratio(fieldCases.filter(field => field.status_correct).length, fieldCases.length),
    value_and_status_correct: ratio(fieldCases.filter(field => field.value_and_status_correct).length, fieldCases.length)
  });
  const agreementErrors = sum(item => item.agreements.errors.length);
  return {
    case_count: cases.length,
    receipts: {
      completed: ratio(count(item => item.receipt_status === 'completed'), cases.length),
      errors: ratio(count(item => item.receipt_status === 'error'), cases.length),
      missing: ratio(count(item => item.receipt_status === 'missing'), cases.length)
    },
    fields: fieldMetrics(cases.flatMap(item => Object.values(item.fields))),
    by_field: Object.fromEntries(FIELD_NAMES.map(field => [field, fieldMetrics(cases.map(item => item.fields[field]))])),
    contract_and_source_valid_cases: ratio(count(item => item.contract_and_source_valid), cases.length),
    pending_changes: {
      precision: ratio(sum(item => item.pending.matched), sum(item => item.pending.predicted)),
      recall: ratio(sum(item => item.pending.matched), sum(item => item.pending.expected)),
      exact_cases: ratio(count(item => item.receipt_status === 'completed' && item.pending.exact), cases.length)
    },
    evidence: {
      exact_citations: ratio(sum(item => item.evidence?.exact_citations.numerator ?? 0), sum(item => item.evidence?.exact_citations.denominator ?? 0)),
      claims_with_valid_evidence: ratio(sum(item => item.evidence?.claims_with_valid_evidence.numerator ?? 0), sum(item => item.evidence?.claims_with_valid_evidence.denominator ?? 0)),
      all_evidence_valid_cases: ratio(count(item => item.evidence?.all_evidence_valid), cases.length),
      semantic_support: 'manual/unscored'
    },
    unsupported_agreements: {
      errors_per_agreement_claim: ratio(agreementErrors, sum(item => item.agreements.claims)),
      affected_cases: ratio(count(item => item.agreements.errors.length > 0), cases.length),
      scope: 'Current field and pending-change status/value claims versus the authored reference; not semantic citation support or question prose.'
    },
    structured_case_passes: ratio(count(item => item.structured_case_pass), cases.length),
    full_semantic_case_passes: { numerator: null, denominator: cases.length, rate: null, status: 'manual/unscored' },
    questions: { precision: null, recall: null, status: 'manual/unscored' }
  };
}

export function scoreRun(run, dataset) {
  const receipts = validateRun(run, dataset);
  const cases = dataset.cases.map(entry => scoreCase(entry, receipts.get(entry.id)));
  return {
    schema_version: 'eventbrief.evaluation-report.v1',
    scorer_version: SCORER_VERSION,
    run_id: run.run_id,
    purpose: run.purpose,
    label: run.purpose === 'scorer_self_check'
      ? 'SCORER SELF-CHECK — authored outputs; not model performance.'
      : 'SAVED MODEL OUTPUT EVALUATION — supplied provenance is not independently verified.',
    dataset: { version: dataset.version, sha256: dataset.sha256 },
    provenance: run.provenance,
    limitations: [
      'All cases are synthetic development examples, not a held-out or real-world test set.',
      'Field values and statuses use typed exact matching; venue aliases and paraphrases can fail.',
      'Missing, error, and invalid outputs remain in all-case and field denominators.',
      'Citation and claim coverage denominators include submitted claims only. Read them with all-case validity and completion rates.',
      'Zero denominators produce null rates, never 100%. Missing outputs can yield zero agreement claims without establishing safety.',
      'Structured case passes exclude question semantics and semantic support of evidence. Full semantic case passes are unscored.',
      'No latency, cost, review time, user feedback, or human approval is inferred by this scorer.'
    ],
    metrics: summarize(cases),
    by_group: Object.fromEntries(['starter', 'development'].map(group => [group, summarize(cases.filter(entry => entry.group === group))])),
    cases
  };
}
