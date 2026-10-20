# Run the capstone tests

1. Open [the public test runner](https://eventbrief-capstone.vercel.app/tests). No sign-in is needed.
2. Click **Run all 5 tests — free**.
3. Read the pass/fail result. Expand **See expected vs actual** to inspect each check.
4. Refresh the page to reopen saved results, or download the JSON report.

| Named case | Expected decision |
| --- | --- |
| Birthday dinner | 18 guests, 2 children; November 6, 6–9 PM; all five drafts ready. |
| Rehearsal dinner: changed count, no end time | Latest count of 28 guests and 2 children; November 12, 5:30–9:30 PM using the four-hour default; all five drafts ready. |
| Team dinner: juice and soda | 22 guests; preserve juice and soda and “no beer or wine” in quote, staff and guest outputs; all five drafts ready. |
| Family dinner: pending allergy | 26 guests and 2 children; calendar and quote ready; kitchen, staff and guest plans blocked specifically for the unanswered allergy. Correct blocking is a pass. |
| Anniversary dinner: changed date | December 5 replaces December 4; 30 guests; all five drafts use the new date. |

The checker runs 111 assertions across the five cases: current facts, five distinct drafts, readiness decisions, the details in each ready draft, the reason for each allergy block, and rendered drink instructions.

## Replay and fresh AI are different

**Free replay** uses the original, uncorrected real-AI answers committed in `evaluation/public-demo-v1/cases.json`. It executes the current `prepareEventPackage` and document-rendering code and scores the resulting outputs. This tests regressions in the application; it does not measure a fresh model response.

**Run new AI test — 1 call** calls the same provider, prompt, schema, immutable receipt store and persistent allowance as the event workspace. Expected results never enter the model request. Tests use the app's frozen extraction vocabulary and a fixed synthetic restaurant profile afterward, with no coordinator corrections or saved lessons, so results stay comparable when someone edits the shared workspace. Tests do not create or modify workspace events.

The server scores and saves every completed run, including failed assertions and request errors. Reports include the time, mode, build revision, fixture hash, expected/actual values and (for a fresh answer) its receipt ID. The hosted report history uses the existing capstone Blob store and survives refreshes and deployments. The page displays the latest ten runs; older reports remain stored. If report storage fails, the response is explicitly unsaved and remains downloadable. It does not retry paid AI.

The existing 20-call lifetime demo allowance also covers fresh tests. All visitors share it. No new paid allowance or budget reset was added. Replays do not use model calls. Bulk paid execution is deliberately unavailable; each fresh case is one explicit button click.

These five known synthetic cases are a regression suite, not an independent held-out accuracy estimate. The earlier first-pass failures remain in the original evaluation evidence. The submission platform's acceptance is a separate check.
