# EventBrief evaluation scorecard

Evidence through October 13, 2026 (Pacific time). All events are fictional. First attempts, repaired replays and software tests are reported separately.

**Current repair: all 15 document checks pass on the three saved answers, with no new AI calls or coordinator corrections.** This is a replay of known cases, not three new AI successes. [Original answers and separate repair evidence](../evaluation/final-readiness-v1/README.md)

| Saved event | Current result | Details |
| --- | --- | --- |
| Diego | **5/5 ready** | 26 guests, 0 children; 5–9 PM; **$1,664**. The original raw Guests omission remains recorded; code derives the correct count. |
| Priya | **5/5 ready** | 16 guests, 3 children; explicit 5:45–8:15 PM; **$1,300**. Drink instructions remain intact. Anniversary is an event purpose, not a custom service. |
| Jordan | **2 ready; 3 correctly blocked** | 26 guests, 2 children; 6–10 PM; **$1,720** quote and calendar ready. Kitchen, staff and guest plans all wait for the host's allergy details. |

The fixes recognize included drink notes without requiring punctuation and recognize an unambiguous first-name host. Unsupported drink additions, ambiguous names and unanswered allergy details still need coordinator attention. **240 software tests passed.** Confidence is **high** for these observed cases; broad real-world accuracy is **unknown**. The raw-count omission means only **2/3** repaired cases pass every frozen check, despite **3/3** intended workflow outcomes.

**Original first attempts: one of three complete workflows passed. Two failed.** None passed every frozen check. **Seven of fifteen document checks passed.** Those failures remain unchanged below.

| New test | Result | What passed / what needs work |
| --- | --- | --- |
| Diego: changed count, no end time | **5/5 assets; workflow passed** | 26 guests, 0 children; 5–9 PM; $1,664. All four PDFs fit one page and calendar works. Raw Guests field was unknown; existing code derived it from total 26 minus 0 children. |
| Priya: changed count and explicit end | **1/5 assets; failed** | Correct 16 guests, 3 children and 5:45–8:15 PM. Drink wording rejected; “Anniversary celebration” also blocks staff as an unsupported special request. Expected $1,300 quote was unavailable. |
| Jordan: missing allergy details | **1/5 assets; failed** | Correct 26 guests, 2 children and 6–10 PM default. Drink wording blocks quote unnecessarily. Kitchen/staff detect allergy; guest plan misses that dependency when “Jordan” differs from “Jordan Wells.” Its incidental drink block is not a passed allergy guard. |

**Repair completed on the saved answers:** host identity in the guest allergy rule, drink option/notes separation and event-purpose labels. Original failures remain unchanged. The remaining evaluation gap is performance on independent, previously unseen conversations.

**Cost:** the original three calls cost an estimated **$0.0666375 (about 7 cents)**. This repair used **0 new AI calls, $0 added AI cost**; **11 preparations remain**. Existing combined allocations remain $4.56384 within $5. The **232 software tests available before the original batch** did not catch those failures; the current 240 include the new regression checks.

**PDF fix complete:** saved Sofia quote and kitchen exports now fit one page with identical content. Long notes continue cleanly. [Pagination verification](PDF-PAGINATION-2026-10-13.md) · [Four-minute practice script](CAPSTONE-DEMO-SCRIPT.md)

**Previous test: Sofia's first attempt failed at 1/5 drafts.** The changed count (**32 Guests and 2 Children**) and automatic **5:45–9:45 PM** schedule passed. A colon after the drink-option name blocked four assets. The parser fix now gives **5/5 in the saved-answer replay, without coordinator corrections or another AI call**. Quote: **$2,104**. The first failure remains recorded. [Test and repair](../evaluation/new-event-v4/README.md)

**Alex's original workflow failed. The repaired saved-answer replay now fills 46 Guests and produces all five drafts, using the coordinator's new four-hour default: 5:30–9:30 PM.** The default is labelled, not attributed to the conversation. Children stay unspecified, and the $2,944 food quote states its standard-rate assumption. No new AI call or manual correction is needed for this replay. [Four-hour rule and replay](../evaluation/end-time-default-v1/README.md)

The original user-authored test passed narrow extraction and blocking checks under the old rules, but delivered **0/5 documents: an end-to-end failure**. The checks reflected overly restrictive implementation rules, not successful event preparation. That historical result remains unchanged. [Original test](../evaluation/new-event-v3/README.md)

Lena's and Noah's saved answers still pass all five draft checks after the combined-drink fix, at $1,420 and $1,776. Those were replays without another AI call; their original failures remain recorded. [Replay evidence](../evaluation/drink-matcher-v3/README.md)

## What passed and what needs work

“Passed” applies to the tested examples. “Passed after a fix” keeps the original problem visible.

| Check | Result | What we observed |
| --- | --- | --- |
| Make five drafts from a complete conversation | **Passed** | The earlier hosted Alex Morgan example produced a calendar entry, quote, kitchen sheet, staff plan and guest plan, all ready for human review. It is separate from the new Alex rehearsal-dinner test. [Evidence](HOSTED-VALIDATION-2026-10-12.md) |
| Handle a new conversation with changed counts and times | **Passed after app fix on saved answer** | Noah's original run retained **26 guests, 4 children and 6–9 PM**, but blocked four drafts. Replaying the unchanged answer now yields **5/5 ready at $1,776**, with no coordinator corrections to the replay. [Original](../evaluation/new-event-v1/README.md) · [Replay](../evaluation/new-event-v1/APP-REPLAY.md) |
| Use the latest confirmed guest count | **Passed** | The actual-AI rehearsal retained **22 guests and 2 children**, with the expected **$1,464** quote. [Evidence](VALIDATION-2026-10-12.md) |
| New conversation: changed count, no end time | **Counts/time passed first attempt; full workflow passed after app fix** | Sofia retained **32 guests + 2 children**, defaulted to **9:45 PM** and left optional details unknown. A drink-label colon caused the original 1/5 result. Saved-answer replay now yields **5/5, $2,104**, with no corrections. One AI call total, estimated **$0.0217875**; **14 preparations remain**. [Evidence](../evaluation/new-event-v4/README.md) |
| Turn Alex's conversation into usable drafts | **Failed originally; passed after workflow fix and duration rule** | The AI kept total attendance 46, but the app left Guests blank and blocked all five assets. The repaired workflow fills Guests, uses restaurant timezone, removes optional-field gates and applies the coordinator's four-hour duration default: **5/5 ready without corrections**. [Replay](../evaluation/end-time-default-v1/README.md) |
| Update assets after a coordinator changes attendance | **Passed** | Maya’s change to **24 guests and 2 children** updated four documents and reset their reviews. The unchanged calendar kept its review. [Attendance checks](../tests/package-edits.test.mjs) |
| Configure menus, drink billing and venue limits | **Passed for tested settings** | Private settings save across browsers; the public sample remains separate. Menu 3 and cash-bar terms are supported. The earlier settings-only replay still produced 0/5; the later workflow repair addresses the count mapping and optional-field failures. [Settings evidence](../evaluation/restaurant-settings-v1/README.md) |
| Block drafts when allergy details are outstanding | **First-name failure repaired on saved answer** | Jordan now blocks kitchen, staff and guest plans specifically for the unanswered allergy. Quote and calendar work. Restaurant-only questions and silence do not create the guest dependency; ambiguous speaker names are not guessed. [Repair](../evaluation/final-readiness-v1/README.md) · [Rule checks](../tests/final-readiness-repair.test.mjs) |
| Fix a blocked detail and explain the correction | **Passed after a fix** | Confirmed corrections resolve old questions, save the reason and preserve the original AI answer. Verified without real AI. [Evidence](COORDINATOR-FEEDBACK.md) |
| Save progress and share private events between browsers | **Passed** | Reload and Chrome/in-app browser checks restored saved events and reviews. Public samples stayed separate. [Saved evidence](#saved-evidence) |
| Download event assets | **Passed** | Hosted checks returned four document PDFs. Calendar download worked as a tentative `.ics` file. Blocked dietary drafts could not export PDFs. [Saved evidence](#saved-evidence) |
| Interpret natural beverage wording | **Passed after app fix for saved examples** | Combined supported instructions now match while preserving the exact drink notes. Lena and Noah both replay to 5/5 ready; unsupported extras and contradictions remain blocked. Broader language accuracy remains unproven. [Original Lena failure](../evaluation/new-event-v2/README.md) · [Current replay](../evaluation/drink-matcher-v3/README.md) |
| Edit drink notes and keep assets consistent | **Passed** | Notes save separately, survive reload and appear in the quote, staff and guest outputs. Notes-only edits reset those three reviews and retain the calendar and kitchen reviews. [Checks](../tests/package-normalization.test.mjs) |
| Remember a coordinator lesson | **Mechanism passed; main test failed** | Lesson inclusion, disabling and separation work. The first actual-AI pair failed the beverage/quote check in both conditions. This lesson did not solve the issue in that example. [Comparison](../evaluation/lesson-comparison-v1/README.md) |

## Earlier test: Sofia's retirement dinner

| Check | First attempt | After app repair, same saved answer |
| --- | --- | --- |
| Updated attendance | **Passed:** 28 → 32 guests, 2 children, 34 total | Unchanged and correct |
| Missing end time | **Passed:** 5:45 PM start → 9:45 PM default | Labelled in all previews and downloads |
| Optional details | **Passed:** remain unknown without blocking solely for absence | No manual entry required |
| Five usable assets | **Failed: 1/5**, drink-option punctuation blocked four drafts | **Passed: 5/5**, no coordinator correction |
| Quote and kitchen quantities | Blocked | **$2,104**; prep quantities for **34 people** |
| Downloads and saved reopening | Calendar only; PDFs returned 409 | Four PDFs and tentative calendar work; reopening uses no AI |
| Layout | Four PDF layouts unavailable | Original repair spilled quote/kitchen footers to page 2. **Print fix now verified: both one page, content unchanged.** [Evidence](PDF-PAGINATION-2026-10-13.md) |
| Preserve existing work | Other events unchanged | Original receipt, existing corrections/reviews and settings unchanged |

**One AI call total, estimated $0.0217875; 14 preparations remain.** The repair used the saved answer, with no additional model request. This was a fresh test failure followed by a successful regression replay, not a first-attempt success. [Full evidence](../evaluation/new-event-v4/README.md)

## Earlier repair: Alex's saved event

| Check | Result |
| --- | --- |
| Guests populate automatically | **Passed: 46**, from the accepted attendance; superseded 40 is not used |
| Blank optional details | **Passed:** guest/staff notes, setup, AV and special details no longer prevent drafts |
| Untouched conversation replay | **5/5 ready:** missing end defaults to 9:30 PM, four hours after the 5:30 PM start |
| End-time changes | **Passed:** automatic ends follow the start; explicit ends take priority; clearing the end restores the default |
| Existing saved event, with earlier corrections | **5/5 ready:** calendar, quote, kitchen, staff and guest |
| Price | **$2,944 food estimate:** 46 at the standard guest rate; children unspecified; drinks excluded |
| Downloads | **Passed:** four one-page PDFs visually checked; correct tentative calendar file |
| Preserve data and budget | **Passed:** receipt, prior corrections/reviews and settings unchanged; **0 AI calls, $0, 15 preparations left** |

Children and Menu 3 prep quantities still need confirmation before final pricing/service. The original failure is retained; these replays do not establish unseen-event accuracy. [Current default replay](../evaluation/end-time-default-v1/README.md) · [Earlier workflow and hosted evidence](../evaluation/draft-workflow-v1/README.md)

## Earlier new conversation: Alex's rehearsal dinner

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

The latest suite reported **232 passed, 0 failed, 0 skipped** using `node --test --test-concurrency=1 tests/*.test.mjs`. These software checks use synthetic data, saved responses and fake providers, not 232 AI trials. The checks cover automatic Guests, explicit price assumptions, optional fields, unresolved requests, source preservation, automatic and explicit end times, late schedules, review invalidation and drink-label punctuation. Historical checkers still reproduce the original failures under their recorded policies.

## What still needs work

1. **Genuine follow-ups:** Alex's child count and the price assumption need confirmation. Menu 3 kitchen quantities also require confirmation. The missing end time now uses the coordinator's labelled four-hour default.
2. **Broader drink requests:** the saved soda/juice examples and configured à la carte/cash-bar wording pass. Other arrangements still need supported settings or coordinator review. This is not broad language coverage.
3. **Independent conversations:** one user-authored case is now recorded. A broader independent set is still needed to measure performance, including source support and follow-up questions.
4. **Time saved:** time the same event done manually and with EventBrief, including review and corrections.

For the capstone: “In twelve development cases, the clarified run matched 215 of 216 detail-and-status checks and all twelve quote checks. Later real-use tests exposed drink matching and workflow failures. Alex's total of 46 was extracted but did not populate the usable Guests field. We fixed that mapping, removed optional-field blocks and added the coordinator's four-hour default for missing end times. Replaying the saved answer now produces all five drafts without another AI call. Broader independent testing and measured time savings remain unfinished.”

**Confidence: high** in these recorded outcomes. **Unknown** for accuracy on unseen events, time savings and improvement from saved lessons.

## Saved evidence

Numbers were checked against the original saved score reports, workflow receipt, dietary replay and `out/coordinator-feedback-tests.txt`. Additional local records include `out/deployment/shared-verification.json`, `shared-browser-verification.md`, and `event-edit-hosted-verification.json`; each of the four document design folders has a `hosted-verification.json` PDF record. Maya’s results come from the saved rehearsal screenshots and owner review conversation, separately from the benchmark.

Public summaries are linked above. Raw receipts and workspace state stay outside the public repository. A clean checkout can run the automated checks and authored example.
