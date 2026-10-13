# Noah: saved-answer replay after the drink fix

October 12, 2026 (Pacific time). Application fix: `f4a4b57`.

**Noah's unchanged AI answer now produces all five drafts and the expected $1,776 quote.** The quote, staff plan and guest plan keep the exact instruction: **juice and soda for everyone, with no alcohol**. This replay makes zero AI calls and applies zero coordinator corrections to the original answer.

## What changed

The AI had already identified the supported package, but appended the host's instructions to its name. The previous matcher accepted notes about children and rejected similar notes about everyone. The updated preparation rule separates:

- **Drink option:** `Nonalcoholic service`, used to calculate the saved price.
- **Drink notes:** `juice and soda for everyone, with no alcohol`, preserved verbatim in the relevant previews and downloads.

The matcher requires a known package label and checks every note clause. It handles supported soft-drink wording and punctuation without accepting unpriced extras, alcoholic exceptions or arbitrary text. Source evidence and certainty are preserved. An outstanding drink question still blocks the appropriate drafts. Calendar and kitchen contents do not gain irrelevant drink-note fields.

The new application preparation policy is `supported-details-v2`. The previous `supported-details-v1` remains available for reproducing Noah's original failure. No model, prompt, restaurant prices, paid-request allowance or live Yannis data changed.

## Results

| Check | Original first attempt | Saved answer after app fix |
| --- | --- | --- |
| Drafts ready | 1/5 | **5/5** |
| Quote | Blocked | **$1,776** |
| Final attendance and time | 26 guests, 4 children; 6–9 PM | **Unchanged and correct** |
| Exact drink instructions in quote, staff and guest templates | Blocked | **Present in all three** |
| Original source and model output | Preserved | **Preserved** |
| Coordinator corrections applied to this replay | 0 | **0** |
| New AI calls / added AI cost for the replay | — | **0 / $0** |

The [machine-readable replay](results/2026-10-12-app-replay.json) records the original-result and protocol fingerprints. The [original result](results/2026-10-12.json) still records the first-attempt failure and the earlier manual recovery, which omitted the specific drink notes. Neither is rewritten as a clean first-attempt success.

## Hosted check and saved workspace

The deployed EventBrief app was checked at commit `f4a4b574855e5499ad8b16d373994bd9793dd2d4`. Noah's existing workspace had an earlier coordinator correction that explicitly left drink notes blank. The app respects that saved decision rather than silently overwriting it. A second, explained coordinator edit restored the exact source instructions; the earlier correction and original AI receipt remain in the history. This workspace restoration is separate from the zero-correction replay above.

All five hosted drafts are ready, the quote is **$1,776**, and the quote, staff and guest PDFs contain **juice and soda for everyone, with no alcohol**. All four document exports returned PDFs; each is one page. The three affected PDFs were rendered and visually checked for readable notes, clipping and overlap. The calendar still has the correct 6–9 PM Pacific time; the kitchen and calendar document revisions were unchanged by the note restoration. Reload preserved the restored notes, existing events stayed unchanged, and the public sample remained separate. Owner review marks remain **0/5**.

The [hosted verification record](results/2026-10-12-hosted-replay.json) includes export hashes. No AI endpoint was called. Hosted preparations stayed at **17 remaining**, with **$0 added AI cost** and no change to the existing $5 authorization or its allocations.

## Reproduce without AI

```sh
node scripts/check-new-event.mjs
node scripts/replay-noah.mjs
node --test --test-concurrency=1 tests/*.test.mjs
```

The first command reproduces the historical failure and recovery using the recorded policy. The second checks all five assets under the current policy and verifies exact note text in the quote, staff and guest HTML used by preview/download. The full software suite passed **211 tests, 0 failed, 0 skipped**. It includes saved-receipt reload and export-template checks with a provider that throws if invoked. These are software checks, not 211 AI trials.

**Confidence: high** for this saved answer and the tested boundary cases. **Unknown** for general beverage accuracy or saved-lesson effectiveness. This failure example was used to develop the fix, so its replay is a regression check rather than an unseen-event benchmark.
