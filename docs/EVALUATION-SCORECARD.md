# EventBrief evaluation scorecard

Evidence through October 12, 2026 (Pacific time). All events are fictional. This scorecard summarizes saved results; no new AI calls were made to create it.

**The core workflow passed the recorded checks. AI interpretation still needs human review, and improvement from saved lessons is not yet measured.**

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
| Interpret natural beverage wording | **Needs work** | Maya’s quote needed a coordinator to map the AI’s wording to **Beer and wine service**. This does not count as an original AI pass. |
| Remember a coordinator lesson | **Mechanism passed; benefit untested** | Fake-provider checks confirmed lesson inclusion, disabling and workspace separation. Whether lessons improve real AI answers remains untested. [Evidence](COORDINATOR-FEEDBACK.md) |

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

## What still needs testing

1. **Lesson effectiveness:** compare a new beverage-wording example with and without a saved lesson.
2. **Unseen conversations:** check new examples, whether source excerpts support the facts, and whether follow-up questions make sense.
3. **Time saved:** time the same event done manually and with EventBrief, including review and corrections.

For the capstone: “In twelve development cases, the clarified run matched 215 of 216 detail-and-status checks and all twelve quote checks. Our rehearsals also showed how a coordinator can resolve missing information and update the assets. Human review remains part of the workflow.”

**Confidence: high** in these recorded outcomes. **Unknown** for accuracy on unseen events, time savings and improvement from saved lessons.

## Saved evidence

Numbers were checked against the original saved score reports, workflow receipt, dietary replay and `out/coordinator-feedback-tests.txt`. Additional local records include `out/deployment/shared-verification.json`, `shared-browser-verification.md`, and `event-edit-hosted-verification.json`; each of the four document design folders has a `hosted-verification.json` PDF record. Maya’s results come from the saved rehearsal screenshots and owner review conversation, separately from the benchmark.

Public summaries are linked above. Raw receipts and workspace state stay outside the public repository. A clean checkout can run the automated checks and authored example.
