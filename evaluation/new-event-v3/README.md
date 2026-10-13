# User-authored test: Alex's rehearsal dinner

**Extraction and protective blocking passed. Completed documents: 0/5, as expected for this conversation under the current demo rules.** The AI retained the accepted increase to 46 guests, Menu 3, and à la carte drinks with a cash bar. It did not invent the missing details or substitute a fixed drink package. The application cannot yet produce this event's assets with its narrow restaurant configuration.

Tested October 12, 2026, Pacific time (October 13 UTC), against deployed commit `054f60cb043c9b276e93c44d0480d9d63bc80f71`, with `supported-details-v3`. The user supplied the conversation unchanged in response to a request for a fresh fictional example. The mention of Yanni's is retained as source text; the test uses only the separate EventBrief synthetic workspace and does not access the live restaurant system.

## Expectations set before the call

The [protocol](protocol.json) was frozen at `2026-10-13T05:00:39.027Z`, before the request, with SHA-256 `c2b36d859fea00e4c6f98ad11ef2e47a84e5478201487bc3be99d9c4a8123f56`. It contains the complete user-authored conversation and expected checks. The [saved result](results/2026-10-12.json) preserves the original answer, per-field checks, blockers and export responses.

Expected known facts: Alex, October 16, 2026, 5:30 PM, Garden Patio, **46 total guests**, Menu 3 and the custom drink arrangement. The accepted 46 supersedes 40. The source does not establish an end time, timezone, guest/child pricing split, dietary requirements, setup, AV, special requirements or audience-specific instructions. Unknown does not mean none or zero.

The fictional Linden & Fig profile currently contains **Menu 2 only**, two fixed drink packages, and a **40-person patio limit**. It does not define Menu 3 pricing or à la carte/cash-bar handling. Those limitations were known and recorded before the AI request; all five drafts were expected to block. These are demo settings, not claims about Yanni's capacity, menu or policies.

## Observed result

| Check | Result |
| --- | --- |
| Accepted count 40 → 46 | **Passed:** 46, agreed, with both the change and coordinator acceptance cited |
| Date, start time, patio and Menu 3 | **Passed:** retained as supplied; no supported-menu substitution |
| Drink arrangement | **Passed:** `Beverages à la carte; cash bar. Guests will pay for their own alcoholic drinks.` |
| Unspecified fields | **Passed:** all ten stayed null/unknown with no invented evidence |
| Pending changes and source questions | **Passed:** none remained; the coordinator's beverage question was answered |
| Source support and certainty | **Passed in manual review:** all 18 fields and labels checked against the thread |
| Guest-plan allergy rule | **Passed:** dietary silence did not add an allergy blocker to the guest plan |

The booking-status field cites the booking request and the coordinator's “Yes, we can arrange that.” It describes acceptance within the conversation. It does not mean the app made a booking or verified that the request fits its configured restaurant rules.

## All five draft checks

| Draft | Outcome | Main blocking reasons |
| --- | --- | --- |
| Calendar | **Correctly blocked** | Missing end time and timezone; 46 exceeds the configured patio limit |
| Guest quote | **Correctly blocked** | Unsupported Menu 3 and à la carte/cash-bar pricing, unknown pricing groups and capacity |
| Kitchen sheet | **Correctly blocked** | Unsupported menu, capacity, missing timezone and required dietary details |
| Staff event plan | **Correctly blocked** | Unsupported arrangements, capacity and missing schedule/operational details |
| Guest event plan | **Correctly blocked** | Unsupported arrangements, capacity, missing schedule/arrival details; no dietary-silence blocker |

All four PDF endpoints rejected export with **HTTP 409**. The same calendar-file function used by the browser refused the blocked calendar. No quote total or kitchen quantities were produced. No PDFs or completed document layouts existed to inspect. These are successful protective checks, **not successful asset generation**.

The saved answer reopened unchanged with no corrections or review marks. All previous event metadata remained unchanged.

## Cost and reproduction

One GPT-6.1 Sol call, medium reasoning, 7,500-token output allowance; **zero retries, zero corrections, zero saved lessons** in the request. Usage was 2,706 input tokens (2,703 cache-write tokens), 1,282 output tokens including 131 reasoning tokens, 3,988 total. Recorded provider latency was 28.5 seconds.

Using the existing conservative budget rates of $2.50/million input tokens and $10/million output tokens, the estimate is **$0.019585**, about two cents. This is an estimate, not a provider invoice. One existing hosted slot was used: **16 → 15 remaining**. No new allocation; combined permanent allocations remain **$4.56384 within the $5 authorization**.

Reproduce the recorded checks without credentials or another AI call:

```sh
node scripts/check-alex-rehearsal.mjs
```

Local raw evidence remains in ignored `out/new-event-v3/`: the frozen plan and code hashes, request marker, original receipt, response, four export rejections, saved reload and browser screenshot. Published evidence contains only the synthetic conversation and sanitized results.

## What this changes about the next build step

The current restaurant configuration is too narrow for this realistic request. Before claiming broader event coverage, EventBrief needs explicit menu pricing, cash-bar/à la carte handling and coordinator-managed venue rules. Required unknown details must still be resolved; any defaults should come from documented restaurant settings rather than invented conversation facts. Do not change this historical result when that configuration expands.

**Confidence: high** in the recorded extraction and blocking behavior. Broad reliability remains **unknown**. This is one user-authored example, not a representative benchmark, and it does not measure successful cash-bar pricing or time saved.
