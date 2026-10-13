# EventBrief evaluation scorecard

Evidence through October 12, 2026 (Pacific time). All events are fictional. Includes the beverage lesson comparison, its saved-answer replay, and one newly authored event tested against the updated app.

**The latest new event failed on its first attempt: only the calendar was ready. A recorded coordinator correction produced all five drafts and the expected $1,776 quote, without another AI call. Ordinary drink wording still needs work.** Earlier saved beverage answers replay successfully after app fixes, but that did not generalize to this new wording.

## What passed and what needs work

“Passed” applies to the tested examples. “Passed after a fix” keeps the original problem visible.

| Check | Result | What we observed |
| --- | --- | --- |
| Make five drafts from a complete conversation | **Passed** | The hosted Alex example produced a calendar entry, quote, kitchen sheet, staff plan and guest plan, all ready for human review. [Evidence](HOSTED-VALIDATION-2026-10-12.md) |
| Handle a new conversation with changed counts and times | **Needs work; coordinator recovery succeeded** | Noah's new event retained **26 guests, 4 children and 6–9 PM**, but beverage matching blocked four drafts. One coordinator correction made **5/5 ready at $1,776**. [New-event check](../evaluation/new-event-v1/README.md) |
| Use the latest confirmed guest count | **Passed** | The actual-AI rehearsal retained **22 guests and 2 children**, with the expected **$1,464** quote. [Evidence](VALIDATION-2026-10-12.md) |
| Update assets after a coordinator changes attendance | **Passed** | Maya’s change to **24 guests and 2 children** updated four documents and reset their reviews. The unchanged calendar kept its review. [Attendance checks](../tests/package-edits.test.mjs) |
| Block drafts when allergy details are outstanding | **Passed after a fix** | Kitchen, staff and guest plans blocked when the host raised unresolved dietary needs. A reply resolved the issue. Silence alone does not block the guest plan. [Rehearsal](VALIDATION-2026-10-12.md) · [Rule checks](../tests/guest-dietary.test.mjs) |
| Fix a blocked detail and explain the correction | **Passed after a fix** | Confirmed corrections resolve old questions, save the reason and preserve the original AI answer. Verified without real AI. [Evidence](COORDINATOR-FEEDBACK.md) |
| Save progress and share private events between browsers | **Passed** | Reload and Chrome/in-app browser checks restored saved events and reviews. Public samples stayed separate. [Saved evidence](#saved-evidence) |
| Download event assets | **Passed** | Hosted checks returned four document PDFs. Calendar download worked as a tentative `.ics` file. Blocked dietary drafts could not export PDFs. [Saved evidence](#saved-evidence) |
| Interpret natural beverage wording | **Needs work** | Elena's two saved answers yield **5/5 drafts and $1,300** after the app fix. Noah's new wording, “juice and soda for everyone, with no alcohol,” still blocked four drafts. The fix handles the earlier examples but is too narrow. [Replay](../evaluation/lesson-comparison-v1/APP-REPLAY.md) · [New event](../evaluation/new-event-v1/README.md) |
| Edit drink notes and keep assets consistent | **Passed** | Notes save separately, survive reload and appear in the quote, staff and guest outputs. Notes-only edits reset those three reviews and retain the calendar and kitchen reviews. [Checks](../tests/package-normalization.test.mjs) |
| Remember a coordinator lesson | **Mechanism passed; main test failed** | Lesson inclusion, disabling and separation work. The first actual-AI pair failed the beverage/quote check in both conditions. This lesson did not solve the issue in that example. [Comparison](../evaluation/lesson-comparison-v1/README.md) |

## Latest new-event check

One new synthetic conversation, one AI attempt, expectations saved before the request. No app or prompt changes were made for this test. No saved lessons were present in the request.

| Draft | First attempt | After one coordinator correction |
| --- | --- | --- |
| Calendar | **Passed** | Correct date, 6–9 PM Pacific, patio and tentative calendar file |
| Guest quote | **Blocked** | Correct 26 guests, 4 children and **$1,776**; PDF checked |
| Kitchen sheet | **Blocked** | Correct 30 people, menu, dietary confirmation and prep quantities; PDF checked |
| Staff event plan | **Blocked** | Correct schedule, setup and internal instruction; PDF checked |
| Guest event plan | **Blocked** | Correct details, thankful wording and arrival instruction; no staff-only note; PDF checked |

The AI supplied `Nonalcoholic service; juice and soda for everyone, with no alcohol`. The app could not match it to the supported priced option. Selecting **Nonalcoholic service** through a saved coordinator correction unblocked the assets. The original failed output remains unchanged; this is **not an unassisted AI pass**.

Source excerpts were checked against all 18 fields. All four PDFs were visually inspected. Blocked exports correctly rejected download before correction. A reload retained the correction, and existing events were unchanged. **Limitation:** the recovered PDFs use general nonalcoholic-service wording; the specific juice-and-soda request remains only in the source and correction reason. Owner review marks remain pending.

**Estimated AI cost: $0.02701 (about three cents).** One existing hosted slot used; **17 remain**. No additional AI calls for recovery or checks. Existing allocations stay within the $5 authorization. [Conversation, method, original output and recovery](../evaluation/new-event-v1/README.md)

## Beverage lesson comparison

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

1. **Drink options and details:** ordinary juice-and-soda wording still blocks four assets, including the kitchen sheet. Preserve the supported price option separately from requested drink details. Avoid losing those details during coordinator recovery.
2. **More new conversations:** this one new event exposed a failure. Check more independently written examples after fixing it, including source support and follow-up questions. One case is not a general accuracy estimate.
3. **Time saved:** time the same event done manually and with EventBrief, including review and corrections.

For the capstone: “In twelve development cases, the clarified run matched 215 of 216 detail-and-status checks and all twelve quote checks. A later new-event test correctly tracked changed counts and times but exposed a drink-matching failure. One recorded coordinator correction produced all five drafts and the expected $1,776 quote without another AI call. We preserve the original failure and still need to improve drink-detail handling.”

**Confidence: high** in these recorded outcomes. **Unknown** for accuracy on unseen events, time savings and improvement from saved lessons.

## Saved evidence

Numbers were checked against the original saved score reports, workflow receipt, dietary replay and `out/coordinator-feedback-tests.txt`. Additional local records include `out/deployment/shared-verification.json`, `shared-browser-verification.md`, and `event-edit-hosted-verification.json`; each of the four document design folders has a `hosted-verification.json` PDF record. Maya’s results come from the saved rehearsal screenshots and owner review conversation, separately from the benchmark.

Public summaries are linked above. Raw receipts and workspace state stay outside the public repository. A clean checkout can run the automated checks and authored example.
