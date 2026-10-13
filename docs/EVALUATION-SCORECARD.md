# EventBrief evaluation scorecard

Evidence through October 12, 2026 (Pacific time). All events are fictional. The initial scorecard used saved results; this update adds two actual AI calls for a beverage lesson comparison.

**Earlier workflow checks passed, but the new beverage conversation left drafts blocked both with and without a saved lesson. Human review and further fixes are still needed.**

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
| Interpret natural beverage wording | **Needs work** | Maya needed a coordinator correction. In the new Elena test, both runs added drink notes to the option name, leaving the quote blocked. [Comparison](../evaluation/lesson-comparison-v1/README.md) |
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

The saved run for revision `e13264b` reports **200 passed, 0 failed, 0 skipped**. These software checks use synthetic data and fake providers. They are not 200 AI trials; older totals are not added to them.

## What still needs work

1. **Extraction and app agreement:** separate the drink option from its notes, calculate attendance totals consistently and handle equivalent table-name capitalization. Then retest; preserve these failed results.
2. **Unseen conversations:** check new examples, whether source excerpts support the facts, and whether follow-up questions make sense.
3. **Time saved:** time the same event done manually and with EventBrief, including review and corrections.

For the capstone: “In twelve development cases, the clarified run matched 215 of 216 detail-and-status checks and all twelve quote checks. A new beverage example failed with and without a saved lesson, exposing an option-matching problem. A coordinator can correct it, and human review remains part of the workflow.”

**Confidence: high** in these recorded outcomes. **Unknown** for accuracy on unseen events, time savings and improvement from saved lessons.

## Saved evidence

Numbers were checked against the original saved score reports, workflow receipt, dietary replay and `out/coordinator-feedback-tests.txt`. Additional local records include `out/deployment/shared-verification.json`, `shared-browser-verification.md`, and `event-edit-hosted-verification.json`; each of the four document design folders has a `hosted-verification.json` PDF record. Maya’s results come from the saved rehearsal screenshots and owner review conversation, separately from the benchmark.

Public summaries are linked above. Raw receipts and workspace state stay outside the public repository. A clean checkout can run the automated checks and authored example.
