# Combined drink instructions: saved-answer replay

**Lena and Noah both pass all five draft checks under `supported-details-v3`.** Their original AI answers were reused without coordinator corrections to the replay. No AI call or additional AI spending was needed. Their original first-attempt failures remain recorded.

Verified October 12, 2026, Pacific time, against deployed application commit `731a35a96fafa025a6c8cc4278ba8889459b5e29`. [Machine-readable evidence](results/2026-10-12.json) includes offline results, hosted checks, file hashes and PDF content checks.

## What changed

The app already separated a recognized priced package from supported drink notes. It now accepts complete supported instructions joined by **and**, without blindly splitting drink names or audiences. For example, it recognizes both `soda and juice for everybody` and `no alcohol` inside Lena's combined note. The exact original instructions remain visible in the documents.

Every part must still match a supported instruction. Extra charges, alcoholic additions, exceptions, unknown packages, uncertain requests and open questions still block the affected outputs. A price is never inferred from beverage notes alone. The original record, certainty labels and source quotes are preserved. Earlier matching policies remain available to reproduce historical failures.

## All five drafts

| Draft | Lena | Noah |
| --- | --- | --- |
| Calendar | **Passed:** July 17, 2027, 5:30–8:30 PM Pacific; correct daylight-time conversion | **Passed:** December 4, 2027, 6–9 PM Pacific; correct standard-time conversion |
| Guest quote | **Passed:** 20 guests, 5 children, **$1,420** | **Passed:** 26 guests, 4 children, **$1,776** |
| Kitchen sheet | **Passed:** 25 people; 3 salad bowls, 3 squash trays, 3 chicken platters, 25 desserts | **Passed:** 30 people; 3 salad bowls, 3 squash trays, 3 chicken platters, 30 desserts |
| Staff event plan | **Passed:** correct schedule, setup, diet, drink instructions and Morgan's internal instruction | **Passed:** correct updated schedule/counts, setup, diet, drink instructions and Sam's internal instruction |
| Guest event plan | **Passed:** thankful wording, confirmed event details, arrival note and drink instructions; no staff-only instruction | **Passed:** thankful wording, updated event details, arrival note and drink instructions; no staff-only instruction |

Both cases retain Menu 2 and Garden Patio. Quote, staff and guest documents preserve the exact requested soda/juice/no-alcohol instructions, rather than relying only on a generic package description. Both calendar files remain tentative; nothing was booked or sent.

The hosted app returned **eight PDFs with HTTP 200**, one page per document. Extracted text checks covered the event data, totals, notes, kitchen quantities and separation of staff/guest information. All eight rendered pages were visually inspected: no clipped content, overlapping sections or unreadable layout was observed.

## Replay and saved-workspace boundaries

- Offline checks and the hosted saved-receipt preparation route both replayed **the original answers with empty corrections**, yielding 5/5 ready for each event.
- Lena's untouched private event now opens as 5/5 ready without adding a review record or correction. Her summary changed from blocked to ready with a $1,420 quote.
- Noah's private event already had an earlier coordinator correction and restored drink notes. Those existing edits and their history were preserved. Its PDF endpoints use that saved workspace state. The separate original-answer replay establishes that the current app also works without those corrections.
- Existing review marks, other events and public/private separation were preserved. Neither event was marked reviewed by this verification; both still require owner review.
- The historical Lena and Noah failure checkers still reproduce their original blocked outcomes under their recorded policies. The previous Noah success under v2 retains identical document revisions under v3.

## Verification and budget

The full software suite passed **215 tests, 0 failures, 0 skipped**. This count describes software tests using fixtures and fake providers; it is not 215 new AI trials. An initial sandboxed suite run could not connect to local test servers. The complete rerun with loopback access passed.

Reproduce without credentials, network access or an AI call:

```sh
node scripts/replay-drink-matcher.mjs
node scripts/check-lena-event.mjs
node scripts/check-new-event.mjs
```

The first command checks the current fix; the last two preserve the earlier failures. The replay reuses the predeclared expectations from [Lena](../new-event-v2/protocol.json) and [Noah](../new-event-v1/protocol.json), with additional exact drink-note checks. Tests also cover reordered instructions, punctuation, conjunctions inside drink names/audiences, unsupported additions and explicit coordinator choices.

**New AI calls: 0. Added AI cost: $0. Hosted preparations remaining: 16.** Existing combined allocations remain $4.56384 within the $5 authorization. No model, prompt, output schema or paid allowance was changed.

Local evidence stays in ignored `out/drink-v3/`, including the hosted before/after records, eight PDFs, two calendar files, rendered pages, content checks and browser screenshot. Private access settings and raw workspace records are excluded from the public result.

**Confidence: high** for these saved-answer and hosted-document results. Broader accuracy is **unknown**: these are development regression examples used to build the fix, not new AI trials or an independent benchmark. Custom drink packages and other unsupported wording still require a coordinator decision.
