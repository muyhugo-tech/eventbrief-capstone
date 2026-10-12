# Offline development evaluation

This evaluator scores saved JSON. It does not call a model, load `.env.local`, or use credentials. The bundled checks use authored outputs to test the scorer. **There are no model-performance results yet.**

## Run

Use Node.js 22 or newer from this repository; no dependencies are required.

```sh
npm run check:fixtures
npm test
npm run eval:self-check
npm run eval -- --input path/to/saved-run.json
```

`eval:self-check` writes two saved runs and two reports under ignored `out/evaluation/v1/self-checks/`, printing each absolute path. To reproduce a report, pass the printed **saved outputs** path to `eval`. The CLI defaults to `out/evaluation/v1/`; use `--out-dir` to choose another directory. Use a path inside this capstone repository.

```sh
node scripts/evaluate.mjs --input out/evaluation/v1/self-checks/self-check-known-good-v1--228543dc76a8ade1.saved.json --require-structured-pass
node scripts/evaluate.mjs --help
```

Exit codes: `0` means the report was written, even if scores are poor; `1` means invalid run metadata, changed fixtures, invalid whole-file JSON, or an IO failure; `2` means the optional `--require-structured-pass` gate failed. A report is still written before exit `2`. That gate does not certify question semantics or evidence meaning.

## Dataset and separation

`dataset-v1.json` freezes **12 fictional development cases: 3 original examples and 9 additions**. The three original input/answer pairs remain unchanged and are still the only scenarios in the browser demo. New files live in `fixtures/development/inputs/` and `fixtures/development/expected/`. References, coverage tags, and rationales are not model input. The provider request builder sends only the selected input's `messages`.

| Cases | Coverage |
| --- | --- |
| 01–03 | Original inquiry, accepted attendance correction, pending date request with answered dietary question |
| 04 | Explicitly accepted replacement date |
| 05 | Rejected and dropped date request |
| 06 | Tentative attendance; missing date and venue |
| 07 | Answered accessibility and equipment questions, including a negative answer |
| 08 | All current fields missing; compound planning question |
| 09 | Conflicting dates explicitly left unresolved |
| 10 | Instructions embedded in a message, with exact but misleading potential citations |
| 11 | Partial answer; meal subset must not replace total attendance |
| 12 | Withdrawn date request and still-pending attendance change |

These labels were authored for development, not independently adjudicated. They are not held out. The current contract maps a single tentative numeric estimate to `stated`; it has no tentative status. The quote retains the qualification. A disputed date can be `unknown`, with its conflicting evidence carried by the unresolved question because unknown fields require empty evidence.

Fixture hashes use SHA-256 over `JSON.stringify(JSON.parse(file))`, so JSON whitespace and checkout line endings do not change dataset identity. Property order remains significant. The manifest uses the same fingerprint rule. Any changed fixture content is rejected against the frozen hashes. To revise labels, preserve the old files and manifest, create versioned replacement files and a new manifest, and score with `--dataset path/to/new-manifest.json`; do not silently alter a run's reference answers. The default fixture check also catches unregistered JSON files in the current fixture directories.

## Saved-run format

Use this envelope, with the real captured metadata. The example below is a **format example**, not a recorded model run. Replace `ACTUAL_MODEL_ID` and `ACTUAL_64_HEX_PROMPT_SHA256` before scoring.

```json
{
  "schema_version": "eventbrief.saved-run.v1",
  "run_id": "development-first-run",
  "purpose": "model_evaluation",
  "dataset": {
    "version": "development-v1",
    "sha256": "53db6ea8a0a05af48a7ffd173982e4be981a63b613eb8f9fe8c17ba26480ee1f"
  },
  "provenance": {
    "producer": "saved-output-capture",
    "model": "ACTUAL_MODEL_ID",
    "prompt_sha256": "ACTUAL_64_HEX_PROMPT_SHA256"
  },
  "cases": [
    {
      "case_id": "01-new-inquiry",
      "status": "error",
      "error": {
        "kind": "timeout",
        "message": "Replace this example with the actual failure receipt."
      }
    }
  ]
}
```

For a returned output, use `{"case_id":"…","status":"completed","output":{…}}`, where `output` is the original `fields`, `pending_changes`, and `open_questions` object defined in `lib/contract.mjs`. Preserve the uncorrected result. If the response is malformed, put its raw text or `null` in `output`; it will count as a completed receipt that fails validation. Do not discard it or substitute a reference answer. Keep provider/transport failures as `error` receipts. A failure must not also carry an output; save a returned malformed result as `completed` so the scorer inspects it.

An omitted dataset case is `missing`, not removed from the denominator. Unknown case IDs, duplicates, mismatched dataset hashes, and ambiguous receipt statuses are rejected. Use a separate saved run for every attempt/replicate; the scorer never selects the best of repeated attempts. The entire envelope must be valid JSON. Optional captured provenance fields such as a configuration, response receipt, or timestamp may be retained; their truth is not independently verified by this offline tool. Never put API keys in saved outputs or reports.

Authored checks must use `purpose: "scorer_self_check"`, `model: null`, and `prompt_sha256: null`. The self-check generator does this automatically. Reports clearly retain that designation.

## Metric definitions

Every numerical ratio contains `numerator`, `denominator`, and `rate` (0–1). A zero denominator produces `null`, not a perfect score. Reports include aggregate, starter/development group, per-field, and per-case results. Group comparisons are descriptive: these small, different case sets do not support significance claims.

| Metric | Numerator / denominator and limits |
| --- | --- |
| Field value correctness | Exact typed value matches / all 36 field slots. Null must be explicitly present for an unknown reference. `52` and `"52"` differ; venue aliases are not normalized. |
| Field status correctness | Exact status matches / all 36 field slots. |
| Field value + status correctness | Both match / all 36 field slots. Per-field denominator is 12. Invalid output can receive partial field credit when individual dimensions match; it cannot pass the case. |
| Completed / error / missing receipts | Each category / all 12 dataset cases. Completed means a saved response exists, not that it is valid. |
| Contract and source validity | Outputs passing the existing strict output contract and exact citation validator / all 12 cases. This does not establish semantic correctness. |
| Pending-change precision and recall | One-to-one matches of `(field, typed value, status)` / predicted changes and expected changes respectively. Order does not matter; duplicate predictions count as extras. Evidence is checked separately. Missing/error outputs have zero predictions but retain expected items in recall. |
| Exact pending cases | Present arrays with exactly the expected change tuples / all 12 cases. An absent array does not count as a correct empty array. |
| Exact citations | Well-formed, nonempty, verbatim quotations attached to existing message IDs / all submitted citations in known field, pending-change, and question slots. Duplicate citations count as submitted citations. Not a measure of whether the quote entails the claim. |
| Claims with valid evidence | Predicted claims having 1–20 citations, all valid / predicted non-unknown fields plus predicted pending changes and questions. Missing/malformed field slots in completed outputs count as uncovered claims; correctly formed unknown fields need none. Missing/error cases contribute no submitted claims. Read this with the all-case metric below. |
| All evidence valid cases | Completed outputs with present evidence/claim arrays and all applicable source checks passing / all 12 cases. Unknown fields must have empty evidence. A missing/error output fails; structural contract validity is reported separately. |
| Unsupported agreement errors | `agreed` claims whose current field value/status disagrees with the reference, plus any `agreed` pending-change item / all agreement claims in those slots. Also report affected cases / all 12. This catches a wrong value even if both statuses say `agreed`. It does not score agreement wording inside questions, unexpected extra properties, or the semantic adequacy of citations. |
| Structured case passes | All three field values and statuses correct, exact pending changes, and the entire contract/source validation passing / all 12. Question structure and exact quotations are validated; question meaning and evidence entailment are excluded. |
| Full semantic case passes | Manual/unscored: `numerator` and `rate` are null, `denominator` is 12. |
| Question precision and recall | Manual/unscored: no literal topic-name matching and no inferred semantic score. |

A run with no outputs has 0/36 field pairs, 0/12 structured passes, and 0/0 agreement claims. Zero observed agreement errors in that run establishes nothing about safety. An exact citation can point to a rejected request, historical fact, or malicious instruction. The flawed self-check deliberately demonstrates these failures.

## Manual review still required

Each case report includes expected and actual questions plus the reference rationale. Review them against the original messages. Match meanings, not topic names: one compound question can be equivalent to several individual questions. Record missed unresolved issues, answered questions incorrectly retained, invented questions, and citations that do not support their claimed value/status. Keep this review separate from automated structured passes. No manual judgments or user feedback have been entered by this milestone, and the CLI does not aggregate manual scores.

## Scorer self-checks, not model performance

The good vector copies authored references. The flawed vector introduces wrong values/statuses, fabricated quotes, an unknown message ID, a duplicate pending change, a string attendance count, malformed output, one omitted case, one synthetic error receipt, and semantic question errors. Hand-counted expectations are asserted by tests and the self-check command.

| Check | Known-good authored vector | Deliberately flawed authored vector |
| --- | --- | --- |
| Field values | 36/36 | 21/36 |
| Field statuses | 36/36 | 25/36 |
| Field value + status | 36/36 | 20/36 |
| Structured cases | 12/12 | 2/12 |
| Contract + source valid cases | 12/12 | 6/12 |
| Exact citations | 60/60 | 46/48 |
| Claims with valid evidence | 39/39 | 31/36 |
| Pending precision; recall | 2/2; 2/2 | 1/2; 1/2 |
| Unsupported agreement errors / claims | 0/26 | 6/22 |
| Cases with agreement errors | 0/12 | 4/12 |
| Missing; error cases | 0/12; 0/12 | 1/12; 1/12 |
| Question semantics; full semantic passes | Unscored | Unscored |

Both structured passes in the flawed vector have deliberate question errors. That is expected and asserts the boundary of the automated metric; those cases are not claimed to be fully correct.

Reports include the dataset fingerprint, raw saved-file hash, scorer version, and hashes of the scoring/contract/CLI sources. Code hashing normalizes CRLF to LF. Filenames include the run ID, dataset/scorer versions, and report content hash. The report contains no generated wall-clock timestamp, so identical saved bytes and code produce identical report bytes. Existing different content is never overwritten. Future scoring rule changes require a new scorer version and retained prior reports; output JSON schemas have independent version identifiers.

## Next measured run

First agree on a model, a bounded call plan, and a real monetary testing budget, then have the user enter a separate capstone key in ignored `.env.local`. The server-session attempt cap is not a dollar cap. Before a batch, add durable raw-output/error receipts and capture prompt/configuration/usage metadata; the current live adapter validates outputs before returning them and does not retain every failure. Do not connect this offline scorer to paid calls implicitly. No public hosting or publication is required to use it.
