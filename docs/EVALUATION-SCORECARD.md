# EventBrief evaluation scorecard

Evidence through October 12, 2026 (Pacific time). All events are fictional. Includes two actual AI calls for a beverage lesson comparison, followed by an offline replay of the same answers after app fixes.

**Both saved beverage answers now produce five reviewable drafts and the expected $1,300 quote after app fixes. The original AI comparison still failed in both conditions; it did not demonstrate a benefit from the lesson.**

## What passed and what needs work

“Passed” applies to the tested examples. “Passed after a fix” keeps the original problem visible.

| Check | Result | What we observed |
| --- | --- | --- |
| Make five drafts from a complete conversation | **Passed** | The hosted Alex example produced a calendar entry, quote, kitchen sheet, staff plan and guest plan, all ready for human review. [Evidence](HOSTED-VALIDATION-2026-10-12.md) |
| Use the latest confirmed guest count | **Passed** | The actual-AI rehearsal retained **22 guests and 2 children**, with the expected **$1,464** quote. [Evidence](VALIDATION-2026-10-12.md) |
| Update assets after a coordinator changes attendance | **Passed** | Maya’s change to **24 guests and 2 children** updated four documents and reset their reviews. The unchanged calendar kept its review. [Attendance checks](../tests/package-edits.test.mjs) |
| Block drafts when allergy details are outstanding | **Passed after a fix** | Kitchen, staff and guest plans blocked when the host raised unresolved dietary needs. A reply resolved the issue. Silence alone does not block the guest plan. [Rehearsal](VALIDATION-2026-10-12.md) · [Rule checks](../tests/guest-dietary.test.mjs) |
| Fix a blocked detail and explain the correction | **Passed after a fix** | Confirmed corrections resolve old questions, save the reason and preserve the original AI answer. Verified without real AI. [Evidence](COORDINATOR-FEEDBACK.md) |
| Save progress and share private events between browsers | **Passed** | Reload and Chrome/in-app browser checks restored saved events and reviews. Public samples stayed separate. [Saved evidence](#saved-evidence) |
| Download event assets | **Passed** | Hosted checks returned four document PDFs. Calendar download worked as a tentative `.ics` file. Blocked dietary drafts could not export PDFs. [Saved evidence](#saved-evidence) |
| Interpret natural beverage wording | **Passed after an app fix for the tested wording** | The original Elena runs both blocked. Replaying those same answers now separates the saved drink option from included notes, calculates a missing attendance total and matches table capitalization. Both yield **5/5 drafts and $1,300**. Custom drink arrangements still need correction. [Replay](../evaluation/lesson-comparison-v1/APP-REPLAY.md) |
| Edit drink notes and keep assets consistent | **Passed** | Notes save separately, survive reload and appear in the quote, staff and guest outputs. Notes-only edits reset those three reviews and retain the calendar and kitchen reviews. [Checks](../tests/package-normalization.test.mjs) |
| Remember a coordinator lesson | **Mechanism passed; main test failed** | Lesson inclusion, disabling and separation work. The first actual-AI pair failed the beverage/quote check in both conditions. This lesson did not solve the issue in that example. [Comparison](../evaluation/lesson-comparison-v1/README.md) |

## New beverage comparison

Same fictional conversation and model settings; one attempt per condition; no retries or manual corrections.

| Result | Without lesson | With lesson |
| --- | --- | --- |
| Supported beverage option | Failed | Failed |
| Quote ready at expected $1,300 | Blocked | Blocked |
| Drafts ready | 1/5 | 1/5 |
| 16 guests and 3 children extracted | Passed | Passed |
| Total attendance of 19 supplied | Missing | Passed |

Both outputs added notes after **Beer and wine service**, which the app requires as an exact option name. The no-lesson run also had a table-name capitalization mismatch. These observations identify fixes; they do not prove that the lesson caused the secondary differences. **Estimated cost: $0.057705, about six cents.** [Full method, original outputs and results](../evaluation/lesson-comparison-v1/README.md)

### Saved-answer replay after the app fixes

| Result | Without-lesson answer | With-lesson answer |
| --- | --- | --- |
| Drafts ready before → after | **1/5 → 5/5** | **1/5 → 5/5** |
| Quote after fix | **$1,300** | **$1,300** |
| Original AI answer retained | Yes | Yes |
| New AI calls / added AI cost | **0 / $0** | **0 / $0** |

This is a regression replay of the failure examples used to develop the fix, not an unseen-event test or a new AI accuracy score. Drink notes remain visible; unresolved counts and unsupported options stay blocked. [Method and reproducible results](../evaluation/lesson-comparison-v1/APP-REPLAY.md)

## Recorded AI scores

The October 11 GPT-6.1 Sol experiment used **12 fictional development cases**, each with 18 expected details and statuses. Both the prompt and output allowance changed. The same cases were used during refinement; this is not an unseen-event benchmark.

| Automated measure | Original run | Clarified run |
| --- | ---: | ---: |
| Records accepted by the app | 11/12 | **12/12** |
| Exact detail and status matches | 185/216 | **215/216** |
| Correct ready/blocked decisions | 55/60 | **60/60** |
| Correct quote results, including expected blocks | 11/12 | **12/12** |
| Cases passing every strict structural check | 0/12 | **11/12** |

The remaining exact mismatch was capitalization: `manager-only` versus `Manager-only`. It stays counted as a failure. The original strict score included a repeated status-label mismatch and one rejected conflict record.

The **60/60** readiness score uses the original policy; the later dietary rule was checked separately. Question meaning and source support remain unscored. [Full results](../evaluation/package-v1/results/2026-10-11-sol.md) · [Scoring framework](../evaluation/package-v1/README.md)

## App checks

The app-fix run reports **207 passed, 0 failed, 0 skipped** using `node --test --test-concurrency=1 tests/*.test.mjs`. These software checks use synthetic data, saved responses and fake providers. They are not 207 AI trials; older totals are not added to them. The saved-response browser rehearsal also verified a drink-note edit, reload and quote PDF download.

## What still needs work

1. **Broader beverage wording:** the app fix handles a bounded set of included drink notes. Check new phrases and custom drink requests; do not assume this pair demonstrates general understanding or improved lesson effectiveness.
2. **Unseen conversations:** check new examples, whether source excerpts support the facts, and whether follow-up questions make sense.
3. **Time saved:** time the same event done manually and with EventBrief, including review and corrections.

For the capstone: “In twelve development cases, the clarified run matched 215 of 216 detail-and-status checks and all twelve quote checks. A new beverage example failed with and without a saved lesson. We fixed the app’s handling of drink notes, attendance totals and table names, then replayed both saved answers: each produced five reviewable drafts and the expected $1,300 quote, without another AI call. Human review remains part of the workflow.”

**Confidence: high** in these recorded outcomes. **Unknown** for accuracy on unseen events, time savings and improvement from saved lessons.

## Saved evidence

Numbers were checked against the original saved score reports, workflow receipt, dietary replay and `out/coordinator-feedback-tests.txt`. Additional local records include `out/deployment/shared-verification.json`, `shared-browser-verification.md`, and `event-edit-hosted-verification.json`; each of the four document design folders has a `hosted-verification.json` PDF record. Maya’s results come from the saved rehearsal screenshots and owner review conversation, separately from the benchmark.

Public summaries are linked above. Raw receipts and workspace state stay outside the public repository. A clean checkout can run the automated checks and authored example.
