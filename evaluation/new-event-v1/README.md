# New event check: Noah's retirement dinner

Tested October 12, 2026 (Pacific time), against app commit `7a713eba3100642b2592f7d82331e552ef30260e`.

**Later follow-up:** the [app-fix replay](APP-REPLAY.md) now produces all five drafts from the same unchanged answer, including the exact drink notes, with no AI calls. The first-attempt results below remain historical evidence.

**The first attempt failed to produce all five drafts.** The AI extracted the changed counts and times correctly, but returned a beverage description the app could not match to its priced option. Only the calendar was ready. A separately recorded coordinator correction made all five assets available, without another AI call.

## Method

The [conversation and expected answers](protocol.json) were saved before the request. This newly authored fictional event had not previously been submitted to the app. It changed the count from 24 to **26 guests plus 4 children**, and the time from 5:30–8:30 PM to **6–9 PM**, for December 4, 2027 on the Garden Patio. It included Menu 2, three tables of ten, juice and soda for everyone, explicit dietary confirmation and separate guest/staff instructions.

One hosted request used GPT-6.1 Sol, medium reasoning and a 7,500-token output limit. There were no retries, no prompt or application changes, and no manual corrections to the scored first attempt. The actual request contained **zero saved lessons**; this is not a lesson comparison. The developer authored and reviewed this case with knowledge of the restaurant profile. It is not an independent blinded benchmark.

The [saved result](results/2026-10-12.json) includes the original model output, initial blockers, later correction, export hashes, usage and evidence fingerprints. Raw authenticated receipts remain in ignored local storage.

## Five-asset results

| Asset | First attempt | After coordinator correction |
| --- | --- | --- |
| Calendar | **Passed** | Correct December 4, 6–9 PM Pacific, host and patio. Tentative calendar file uses December 5, 02:00–05:00 UTC. Nothing was booked or sent. |
| Guest quote | **Blocked** | Correct 26 guests, 4 children, Menu 2 and **$1,776** total. PDF exported and checked. |
| Kitchen sheet | **Blocked** | Correct 30 people and dietary confirmation; 3 salad bowls, 3 squash trays, 3 chicken platters and 30 desserts under fictional prep rules. PDF exported and checked. |
| Staff event plan | **Blocked** | Correct final schedule, attendance, setup and internal place-setting instruction. PDF exported and checked. |
| Guest event plan | **Blocked** | Correct final details, thankful introduction and garden-gate arrival instruction; no internal staff instruction. PDF exported and checked. |

All 18 extracted fields were compared manually with their source excerpts. The final confirmed reply supports the changed count and time. No follow-up requests were outstanding. The beverage meaning was supported, but the value was incompatible with the app's option list:

`Nonalcoholic service; juice and soda for everyone, with no alcohol`

All four blocked PDF routes correctly rejected export with HTTP 409. That gate passed; the failure to generate four expected drafts still counts as a failure.

## Coordinator recovery

One saved correction selected the existing **Nonalcoholic service** option and explained why. The original conversation and AI response stayed intact. No lesson was added. The expected quote is:

`26 × ($58 menu + $6 drinks) + 4 × ($22 menu + $6 drinks) = $1,776`

After the correction, all five drafts were ready, all four PDF exports returned HTTP 200, and the calendar file generated correctly. Each PDF was one page and visually inspected for clipping, overlap and readability. A saved reload retained the correction; other events were unchanged. Owner review marks remain pending.

**Remaining limitation:** recovered documents use the general nonalcoholic-service wording. The exact juice-and-soda request remains in the conversation and correction reason, but is absent from a separate drink note on the PDFs. The recovery verifies core details, calculations and exports; it does not demonstrate complete beverage-detail preservation or an unassisted AI pass.

## Budget

One request used 2,932 input tokens and 1,968 output tokens; provider latency was about 40.2 seconds. A conservative usage estimate is **$0.02701**, about three cents, using $2.50 per million input tokens (the cache-write rate for every input token) and $10 per million output tokens. [Official pricing basis](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

The request consumed one already-reserved hosted slot: **18 → 17 remaining**. Recovery and offline checks used **zero additional AI calls**. Combined budget allocations remain **$4.56384 of the existing $5 authorization**, with $0.43616 unallocated. Do not add this request's reservation a second time. Reservations and usage estimates are not a provider invoice or hard billing cap.

## Reproduce without AI

```sh
node scripts/check-new-event.mjs
```

This replays the saved model output and the separate correction against the app, checks the frozen protocol fingerprint, and fails if the results no longer match. It does not call a model, access private storage, or regenerate hosted PDFs. PDF and source-support findings are recorded manual checks, not additional automated trials. Future app fixes need their own replay report while preserving the original failure.

**Confidence: high** in the observed results. **Unknown** for general accuracy, time savings or saved-lesson effectiveness. The next technical priority is preserving drink-option identity separately from requested drink details, so ordinary wording does not block otherwise complete events.
