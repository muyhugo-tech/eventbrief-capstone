# EventBrief evaluation scorecard

Evidence through October 12, 2026 (Pacific time). All events are fictional. Includes the beverage lesson comparison, saved-answer replays, two assistant-authored events and one user-authored rehearsal-dinner test.

**Alex's original workflow failed. The repaired saved-answer replay now fills 46 Guests and produces four usable document drafts; the original conversation still needs an end time for calendar export.** Children stay unspecified, and the $2,944 food quote clearly states its standard-rate assumption. The existing private event, with its earlier saved end-time/dietary/timezone corrections, now shows all five drafts ready on the live app. No new AI call or new event correction. [Workflow repair](../evaluation/draft-workflow-v1/README.md)

The original user-authored test passed narrow extraction and blocking checks under the old rules, but delivered **0/5 documents: an end-to-end failure**. The checks reflected overly restrictive implementation rules, not successful event preparation. That historical result remains unchanged. [Original test](../evaluation/new-event-v3/README.md)

Lena's and Noah's saved answers still pass all five draft checks after the combined-drink fix, at $1,420 and $1,776. Those were replays without another AI call; their original failures remain recorded. [Replay evidence](../evaluation/drink-matcher-v3/README.md)

## What passed and what needs work

“Passed” applies to the tested examples. “Passed after a fix” keeps the original problem visible.

| Check | Result | What we observed |
| --- | --- | --- |
| Make five drafts from a complete conversation | **Passed** | The earlier hosted Alex Morgan example produced a calendar entry, quote, kitchen sheet, staff plan and guest plan, all ready for human review. It is separate from the new Alex rehearsal-dinner test. [Evidence](HOSTED-VALIDATION-2026-10-12.md) |
| Handle a new conversation with changed counts and times | **Passed after app fix on saved answer** | Noah's original run retained **26 guests, 4 children and 6–9 PM**, but blocked four drafts. Replaying the unchanged answer now yields **5/5 ready at $1,776**, with no coordinator corrections to the replay. [Original](../evaluation/new-event-v1/README.md) · [Replay](../evaluation/new-event-v1/APP-REPLAY.md) |
| Use the latest confirmed guest count | **Passed** | The actual-AI rehearsal retained **22 guests and 2 children**, with the expected **$1,464** quote. [Evidence](VALIDATION-2026-10-12.md) |
| Turn Alex's conversation into usable drafts | **Failed originally; improved after workflow fix** | The AI kept total attendance 46, but the app left Guests blank and blocked all five assets. The saved-answer repair fills Guests automatically, uses restaurant timezone and removes optional-field gates: **4/5 ready without corrections**, with end time still needed for the calendar. [Repair](../evaluation/draft-workflow-v1/README.md) |
| Update assets after a coordinator changes attendance | **Passed** | Maya’s change to **24 guests and 2 children** updated four documents and reset their reviews. The unchanged calendar kept its review. [Attendance checks](../tests/package-edits.test.mjs) |
| Configure menus, drink billing and venue limits | **Passed for tested settings** | Private settings save across browsers; the public sample remains separate. Menu 3 and cash-bar terms are supported. The earlier settings-only replay still produced 0/5; the later workflow repair addresses the count mapping and optional-field failures. [Settings evidence](../evaluation/restaurant-settings-v1/README.md) |
| Block drafts when allergy details are outstanding | **Passed after a fix** | Kitchen, staff and guest plans blocked when the host raised unresolved dietary needs. A reply resolved the issue. Silence alone does not block the guest plan. [Rehearsal](VALIDATION-2026-10-12.md) · [Rule checks](../tests/guest-dietary.test.mjs) |
| Fix a blocked detail and explain the correction | **Passed after a fix** | Confirmed corrections resolve old questions, save the reason and preserve the original AI answer. Verified without real AI. [Evidence](COORDINATOR-FEEDBACK.md) |
| Save progress and share private events between browsers | **Passed** | Reload and Chrome/in-app browser checks restored saved events and reviews. Public samples stayed separate. [Saved evidence](#saved-evidence) |
| Download event assets | **Passed** | Hosted checks returned four document PDFs. Calendar download worked as a tentative `.ics` file. Blocked dietary drafts could not export PDFs. [Saved evidence](#saved-evidence) |
| Interpret natural beverage wording | **Passed after app fix for saved examples** | Combined supported instructions now match while preserving the exact drink notes. Lena and Noah both replay to 5/5 ready; unsupported extras and contradictions remain blocked. Broader language accuracy remains unproven. [Original Lena failure](../evaluation/new-event-v2/README.md) · [Current replay](../evaluation/drink-matcher-v3/README.md) |
| Edit drink notes and keep assets consistent | **Passed** | Notes save separately, survive reload and appear in the quote, staff and guest outputs. Notes-only edits reset those three reviews and retain the calendar and kitchen reviews. [Checks](../tests/package-normalization.test.mjs) |
| Remember a coordinator lesson | **Mechanism passed; main test failed** | Lesson inclusion, disabling and separation work. The first actual-AI pair failed the beverage/quote check in both conditions. This lesson did not solve the issue in that example. [Comparison](../evaluation/lesson-comparison-v1/README.md) |

## Latest repair: Alex's saved event

| Check | Result |
| --- | --- |
| Guests populate automatically | **Passed: 46**, from the accepted attendance; superseded 40 is not used |
| Blank optional details | **Passed:** guest/staff notes, setup, AV and special details no longer prevent drafts |
| Untouched conversation replay | **4/5 ready:** only calendar export needs the missing end time |
| Existing saved event, with earlier corrections | **5/5 ready:** calendar, quote, kitchen, staff and guest |
| Price | **$2,944 food estimate:** 46 at the standard guest rate; children unspecified; drinks excluded |
| Downloads | **Passed:** four one-page PDFs visually checked; correct tentative calendar file |
| Preserve data and budget | **Passed:** receipt, prior corrections/reviews and settings unchanged; **0 AI calls, $0, 15 preparations left** |

Children and Menu 3 prep quantities still need confirmation before final pricing/service. The original failure is retained; these replays do not establish unseen-event accuracy. [Reproducible method and hosted evidence](../evaluation/draft-workflow-v1/README.md)

## Latest new conversation: Alex's rehearsal dinner

**Historical first attempt, before settings and workflow repairs. Overall outcome: failed.** The table below reports narrower checks; “correctly blocked” means consistent with the then-current rules, not that those rules met the user's needs.

The user wrote this fictional inquiry. It was submitted unchanged once, with expectations saved before the request and no app/profile/prompt changes or corrections.

| Check | Result |
| --- | --- |
| Accepted guest count | **Passed: 40 → 46** |
| Event details and drink terms | **Passed:** October 16 at 5:30 PM, Garden Patio, Menu 3, à la carte and cash bar with guests paying for their own alcoholic drinks |
| Missing fields | **Passed:** end time, timezone, pricing-group counts and other unspecified details stayed unknown |
| Calendar | **Correctly blocked:** missing schedule details and configured capacity |
| Quote | **Correctly blocked:** unsupported menu/drink pricing, capacity and unknown pricing groups |
| Kitchen sheet | **Correctly blocked:** unsupported menu, capacity and required unknown details |
| Staff event plan | **Correctly blocked:** unsupported arrangements, capacity and missing operational details |
| Guest event plan | **Correctly blocked:** unsupported arrangements, capacity and missing schedule/arrival details; dietary silence did not block it |

At the time of this original test, the fictional profile only defined Menu 2, two fixed drink packages and a patio limit of 40. Those are EventBrief settings, not Yanni's actual restaurant policies. All four PDF exports returned 409; the calendar export function also refused the blocked draft. **No completed document bodies or layouts were available to inspect.** Saved reopening preserved the original answer and left other events unchanged. The subsequent [settings replay](../evaluation/restaurant-settings-v1/README.md) removes those configuration issues without inventing the remaining event details.

**One AI call, no retry/correction, estimated cost $0.019585 (about two cents). 15 hosted preparations remain.** This shows faithful extraction and appropriate refusal to invent facts, while exposing incomplete restaurant configuration. [Conversation, method and result](../evaluation/new-event-v3/README.md)

## Previous fix: Lena and Noah saved-answer replay

| Draft | Lena | Noah |
| --- | --- | --- |
| Calendar | **Passed:** July 17, 5:30–8:30 PM Pacific | **Passed:** December 4, 6–9 PM Pacific |
| Guest quote | **Passed:** 20 guests, 5 children, **$1,420** | **Passed:** 26 guests, 4 children, **$1,776** |
| Kitchen sheet | **Passed:** 25 people and correct prep quantities | **Passed:** 30 people and correct prep quantities |
| Staff event plan | **Passed:** event details, drink instructions and internal notes | **Passed:** updated details, drink instructions and internal notes |
| Guest event plan | **Passed:** event details, arrival instructions and drinks; no staff-only note | **Passed:** updated details, arrival instructions and drinks; no staff-only note |

All eight hosted PDFs passed content and visual checks; both tentative calendar files had the correct time conversion. Exact soda/juice/no-alcohol notes remain in the quote, staff and guest outputs. Both original answers replay with empty corrections. Noah's pre-existing private-workspace corrections were also preserved and separately checked. Existing events and review marks were retained; neither event was marked reviewed by this test.

**Additional AI calls: 0. Added AI cost: $0. Preparations remaining at that point: 16** (15 after Alex). These are regression replays of known examples, not new AI trials. [Method, safeguards and reproducible evidence](../evaluation/drink-matcher-v3/README.md)

## Original first attempt: Lena

One new fictional conversation, expectations saved before the call, no app or prompt changes, no saved lessons, no retry and no correction.

| Draft | Result | What was checked |
| --- | --- | --- |
| Calendar | **Passed** | July 17, 2027, 5:30–8:30 PM Pacific, Garden Patio, correct tentative calendar file |
| Guest quote | **Blocked** | Beverage mismatch; expected $1,420 was not generated; PDF export rejected |
| Kitchen sheet | **Blocked** | Menu/beverage compatibility; quantities could not be inspected; PDF export rejected |
| Staff event plan | **Blocked** | Beverage mismatch; document content unverified; PDF export rejected |
| Guest event plan | **Blocked** | Beverage mismatch; document content unverified; PDF export rejected |

The AI correctly retained the accepted change to **20 guests and 5 children**, 25 total, and all 18 field meanings were supported by source excerpts. Exact prepared values matched **17/18** expectations; the app did not normalize `Nonalcoholic service, with soda and juice for everybody and no alcohol`. Source understanding and successful asset creation are separate checks.

All four blocked PDF endpoints returned HTTP 409. The saved record reopened unchanged, with no corrections or review marks; other events remained unchanged. These safeguards passed, but the event remains an overall failure. **Estimated cost: $0.0266675 (about three cents); 16 hosted preparations remain.** Existing allocations remain $4.56384 within the $5 budget. [Conversation, frozen method, original output and reproduction](../evaluation/new-event-v2/README.md)

## Earlier new-event check: Noah

One new synthetic conversation, one AI attempt, expectations saved before the request. No app or prompt changes were made for this test. No saved lessons were present in the request.

| Draft | First attempt | After one coordinator correction |
| --- | --- | --- |
| Calendar | **Passed** | Correct date, 6–9 PM Pacific, patio and tentative calendar file |
| Guest quote | **Blocked** | Correct 26 guests, 4 children and **$1,776**; PDF checked |
| Kitchen sheet | **Blocked** | Correct 30 people, menu, dietary confirmation and prep quantities; PDF checked |
| Staff event plan | **Blocked** | Correct schedule, setup and internal instruction; PDF checked |
| Guest event plan | **Blocked** | Correct details, thankful wording and arrival instruction; no staff-only note; PDF checked |

The AI supplied `Nonalcoholic service; juice and soda for everyone, with no alcohol`. The app could not match it to the supported priced option. Selecting **Nonalcoholic service** through a saved coordinator correction unblocked the assets. The original failed output remains unchanged; this is **not an unassisted AI pass**.

Source excerpts were checked against all 18 fields. All four PDFs were visually inspected. Blocked exports correctly rejected download before correction. A reload retained the correction, and existing events were unchanged. **Limitation of that first recovery:** the PDFs used general nonalcoholic-service wording; the specific juice-and-soda request remained only in the source and correction reason. The follow-up below addresses this omission. Owner review marks remain pending.

**Estimated AI cost: $0.02701 (about three cents).** One existing hosted slot used; **17 remained at that point** (16 after Lena). No additional AI calls for recovery or checks. Existing allocations stay within the $5 authorization. [Conversation, method, original output and recovery](../evaluation/new-event-v1/README.md)

### Follow-up: saved-answer replay after the drink fix

| Check | Result |
| --- | --- |
| All five drafts ready from the unchanged saved answer | **Passed, with no coordinator corrections to the replay** |
| Quote, attendance and time | **$1,776; 26 guests, 4 children; 6–9 PM** |
| Exact juice-and-soda notes in quote, staff and guest previews/PDFs | **Passed** |
| Preserve historical failure, source evidence and prior corrections | **Passed** |
| Reload the restored private event; keep other events unchanged | **Passed** |
| Additional AI calls / cost | **0 / $0; 17 hosted preparations available at that point** |

The existing private event had an explicit blank-notes correction from the first recovery. A separately recorded edit restored its source instructions; the app does not silently override coordinator edits. The quote, staff and guest PDFs were checked for exact text and readable layout. Calendar and kitchen revisions stayed unchanged after that note-only edit. [Method, boundaries and evidence](../evaluation/new-event-v1/APP-REPLAY.md)

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

The workflow repair suite reported **226 passed, 0 failed, 0 skipped** using `node --test --test-concurrency=1 tests/*.test.mjs`. These software checks use synthetic data, saved responses and fake providers, not 226 AI trials. The new checks cover automatic Guests, explicit price assumptions, optional fields, unresolved requests, source preservation and review invalidation. Historical checkers still reproduce the original failures under their recorded policies.

## What still needs work

1. **Genuine follow-ups:** Alex's original conversation lacks an end time and child count. Drafts now show what is known; the calendar still needs the end time, and the price assumption needs confirmation. Menu 3 kitchen quantities also require confirmation.
2. **Broader drink requests:** the saved soda/juice examples and configured à la carte/cash-bar wording pass. Other arrangements still need supported settings or coordinator review. This is not broad language coverage.
3. **Independent conversations:** one user-authored case is now recorded. A broader independent set is still needed to measure performance, including source support and follow-up questions.
4. **Time saved:** time the same event done manually and with EventBrief, including review and corrections.

For the capstone: “In twelve development cases, the clarified run matched 215 of 216 detail-and-status checks and all twelve quote checks. Later real-use tests exposed drink matching and workflow failures. Alex's total of 46 was extracted but did not populate the usable Guests field. We fixed that mapping and removed optional-field blocks, then replayed the saved answer without another AI call. Four drafts now work directly; the calendar still needs an end time. Broader independent testing and measured time savings remain unfinished.”

**Confidence: high** in these recorded outcomes. **Unknown** for accuracy on unseen events, time savings and improvement from saved lessons.

## Saved evidence

Numbers were checked against the original saved score reports, workflow receipt, dietary replay and `out/coordinator-feedback-tests.txt`. Additional local records include `out/deployment/shared-verification.json`, `shared-browser-verification.md`, and `event-edit-hosted-verification.json`; each of the four document design folders has a `hosted-verification.json` PDF record. Maya’s results come from the saved rehearsal screenshots and owner review conversation, separately from the benchmark.

Public summaries are linked above. Raw receipts and workspace state stay outside the public repository. A clean checkout can run the automated checks and authored example.
