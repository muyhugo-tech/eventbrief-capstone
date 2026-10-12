# Five-document package evaluation

This is the next capstone evaluation framework: a frozen fictional development set, exact record comparisons, deterministic document checks, and manual semantic review. It covers the v3 package contract and the five documents. It is separate from the original three-field evaluation set.

## Current evidence

Twelve fictional cases are frozen in `manifest.json`, including their input, expected-answer, and restaurant-profile hashes. The scorer has been checked using authored good and deliberately flawed outputs and captured fake-provider attempts. Real GPT-6.1 Sol runs began October 11, 2026; see [recorded model results](results/2026-10-11-sol.md). The reference answers remain unchanged.

The twelve cases cover complete details, a missing dietary reply, Guests/Children pricing, requested and accepted date changes, conflicting attendance, missing age-group counts, excessive capacity, service hours, unsupported menus, staff-only information, and instructions embedded in a message. These are development cases, not a held-out independent benchmark. The prompt may be improved against these cases; improvement must be disclosed accordingly.

As of October 12, the app additionally blocks a guest event plan when the host raises dietary needs and those details remain unresolved (`host-raised-dietary-v1`). This frozen evaluation explicitly uses `profile-only-v1`, the original readiness behavior. Its original profile, case inputs, authored expectations and saved reports are unchanged. Do not present the old readiness score as an evaluation of the new conditional rule. That rule has separate local regression tests and a saved-response replay under ignored `out/guest-dietary-qa/`; no new model call was made for it. Report source hashes now include the readiness-policy helper.

## Simple next steps

1. Run the checks below.
2. Use a separate capstone API key and agree on a model and spending limit before a real test.
3. Save every attempt in a dedicated batch folder.
4. Score the whole batch, including errors and unfinished attempts.
5. Read the source quotes and questions yourself before claiming the AI got a case right.

The evaluation command below scores captured attempts offline. It does not make calls, load environment files, or spend money. The separate bounded live runner is documented later on this page.

```sh
npm run eval:package:self-check
npm run eval:package -- --input out/evaluation/package-v1/self-checks/<printed-saved-output-name>.saved.json
npm run eval:package -- --attempts-dir out/model-attempts/<dedicated-batch-folder> --run-id first-package-batch
```

Use the exact saved-output path printed by the self-check. Reports go under ignored `out/evaluation/package-v1/`. `--out-dir` chooses another local output folder. Do not select individual successful receipts to make a score look better. The receipt importer reads every attempt folder in the selected batch, rejects repeated case IDs, rejects unknown cases, and requires matching frozen sources/profile plus one model/prompt/schema/implementation configuration and provider mode. Failed or started attempts stay failures; cases never attempted remain missing. Repeated experiments need separately declared batches.

## What is scored

| Check | Denominator and meaning |
| --- | --- |
| Field values and statuses | 216 fixed pairs: 18 fields × 12 cases. Typed, exact comparison. Equivalent phrasing can fail this check. |
| Document readiness | 60 fixed decisions: 5 documents × 12 cases. Expected states are authored separately from application code. |
| Quote correctness | 12 case decisions. Every line's source fields, quantity, unit price, amount, and total must match. A correctly blocked quote passes only when a valid completed record produces the expected block. Missing/error records receive no credit. |
| Pending changes | One-to-one matching by field, typed value, and requested status. Precision/recall are null when their denominators are zero. |
| Exact source quotes | Actual valid quotation count divided by actual quotations; a quotation must occur verbatim in the stated message body. Missing output produces no observed quotation rate. |
| Expected claim coverage | A fixed denominator of expected non-unknown fields and expected unresolved items. Missing/error/omitted claims cannot improve the score. Question coverage matches field associations only, not question meaning. |
| Mismatched agreement claims | Claims labeled agreed whose field value/status differs from the authored reference. This is a reference mismatch, not an independent assessment of business truth. |
| Guest information boundary | Literal scans for frozen internal text in quote and guest-plan HTML. This detects the supplied test strings; paraphrased/private information requires manual review. |
| Structured case pass | Valid record, exact fields/pending requests, valid exact quotations, document states, quote, and known guest-text scan. This is not a full semantic pass. |

Question meaning/completeness, quotation support, and audience suitability remain manual/unscored. Each report includes expected and actual questions plus the review checklist. A deliberate dessert-question error in the attendance-conflict self-check passes the automated structure and remains visible for manual review. Do not present 12/12 structural self-checks as model accuracy.

## Scorer self-checks

These expected totals are hand counted before using the scorer:

| Authored vector | Fields | Readiness | Quotes | Structured cases | Missing / failed / unfinished |
| --- | --- | --- | --- | --- | --- |
| Good | 216/216 | 60/60 | 12/12 | 12/12 | 0 / 0 / 0 |
| Flawed | 157/216 | 34/60 | 7/12 | 4/12 | 1 / 1 / 1 |

The flawed readiness count by case is 5+3+5+1+0+5+5+5+0+5+0+0 = 34. Correct outputs were copied from authored references only for checking the scorer. These are not model results or evidence of time savings.

## Reproducibility and safeguards

The saved-run format is `eventbrief.package-saved-run.v1`, with explicit purpose (`scorer_self_check`, `fake_provider_test`, or `model_evaluation`), a dataset fingerprint, provenance, and per-case receipt states. Completed output is retained even when malformed. Failed/unfinished receipts retain their error classification and original receipt hash. The scorer never substitutes authored reference answers for a failure or applies coordinator corrections to improve an original score.

Reports record dataset, saved-run and scorer-source fingerprints, retain per-case expected/actual details, and use immutable content-addressed filenames. Identical saved data and code produce identical report bytes. Existing different content cannot be overwritten. Raw attempts/receipts stay in the source batch folder; preserve them with the report for review.

Exit `0`: report written, including poor scores. Exit `1`: invalid metadata, changed fixtures, ambiguous receipts, or IO failure. Exit `2`: `--require-structured-pass` was requested and failed; the report is written first. The gate does not certify semantics.

Expected answers, document rules, calculated totals, and manual review notes are separate from model input. Request construction sends only fictional messages and the allowed vocabulary/category meanings. No external inbox or real customer information is involved.

## Bounded live testing

`npm run test:ai` is an offline allowance preview. It loads no key and makes no request. It defaults to preserved prompt v3; `--prompt-version 2` selects the original model-tested prompt. `--max-output-tokens` records an allowance of at most 10,000, including reasoning tokens.

Paid execution requires explicit `--live --batch name`, a model-matching separate capstone key in this repository's `.env.local`, and an agreed budget. Example for one newly authorized attempt:

```sh
npm run test:ai -- --live --batch example-name --limit 1 --budget-cents 153 --prompt-version 3 --max-output-tokens 7500
```

This bypasses the browser's disabled flag only for the explicit CLI invocation. It does not enable browser calls. Never replay a recorded experiment by assigning a new batch name without accounting for the additional spending.

The pre-dispatch plan freezes dataset/profile/request/prompt/source hashes, selected cases, model, prices and estimated allowance. A request allowance uses every serialized request byte as one input token plus 2,000 overhead tokens and the full output limit. Input cost uses the higher cache-write rate. These estimates do not replace an exact tokenizer, updated pricing or the provider's bill. Set a project hard spend limit for provider enforcement; the runner's cap applies only to its named batch.

The runner locks overlapping invocations, persists every provider attempt, advances past successful previously attempted cases without repeating them, and stops on failure or unavailable/excessive usage. An existing failed or unfinished attempt prevents resuming that batch. A separately declared set of previously unattempted cases can be run after inspecting a known failure; original failed receipts must remain in the combined report. `--cases` selects unique frozen IDs in dataset order. The scorer always retains all twelve expected cases in its denominators, including those outside a subset.

Changed model/prompt/output allowances or source code cannot enter an existing batch. A separate improvement run must retain its own configuration and must not replace the baseline. On this Windows host, the npm command supplies `--use-system-ca`; it uses the trusted certificate store and keeps certificate verification enabled.
