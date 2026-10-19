# Public demo checks — October 19, 2026

Five synthetic conversations were run through the live OpenAI-backed app without an access code. These are authored demonstration cases, **not independent held-out evaluation data**. Expected checks were written before the calls. Original responses are preserved in `cases.json`.

| Test | First live attempt | After saved-answer replay |
| --- | --- | --- |
| Birthday dinner | All five drafts ready | Pass |
| Changed count, no end time | 28 guests + 2 children; 5:30–9:30 PM; all five ready | Pass |
| Juice and soda | AI kept the drink details; app blocked four drafts because its matcher rejected the wording | Pass after the matching repair |
| Pending allergy | Calendar and quote ready; kitchen, staff and guest plans blocked | Pass — expected behavior |
| Changed date | December 5 used instead of December 4; all five ready | Pass |

**First attempt: 4/5 workflows behaved as expected. Replay after the repair: 5/5.** The replay uses the same five original AI answers, with no coordinator correction and no additional AI call. The drink repair recognizes included soft drinks and an explicit “no beer or wine” instruction under Nonalcoholic service; it keeps the full wording in the quote, staff plan and guest plan. Alcoholic additions, exceptions and unsupported prices still block.

Run `node --test tests/public-demo-replay.test.mjs` to replay the saved answers offline. The hosted handler tests separately prove anonymous AI access, preserved saved events and allowance, and rejection of call 21 across multiple visitors/cold starts. Existing Noah, Lena and Sofia drink regressions remain covered.

The five calls consumed five of the existing hosted slots: **11 → 6 remaining**. Estimated token cost at the repository's conservative configured rates was **$0.1217825**; the permanent slot reservation was **$1.025**. This is part of the original $5 authorization, not an additional budget. Provider billing remains authoritative. No automatic retries were made. Reopening these exact conversations uses their saved real-AI results; changing the text can consume one of the remaining calls.

The changed-count result was also exercised through the public browser. All four PDFs downloaded without authentication. The capstone host is permitted by the deployed page's frame policy. Acceptance by the Product Faculty submission form still needs to be checked in that platform.
