# Restaurant settings and Alex replay

Restaurant settings now let a coordinator save spaces and capacities, menu dishes and per-person prices, allowed drink combinations, drink prices or separate billing, and exact equivalent drink wording. Changes are shared only in the private workspace. The public sample keeps the original profile.

The rehearsal example is invented: Garden Patio capacity 60, Menu 3 at $64 per guest / $24 per child, and à la carte drinks with guests paying for their own alcoholic drinks. These values are not Yannis policies. The original extraction profile and historical results remain unchanged.

## Saved-answer result

Alex's original AI answer is replayed with these explicitly supplied settings. No second extraction, event corrections or invented event details are used.

| Check | Result |
| --- | --- |
| Accepted attendance | 46 retained |
| Menu 3 and patio capacity | Supported by the new fictional settings |
| À la carte / cash bar | Matched by complete coordinator-configured wording; full source wording retained |
| Ten unknown fields | Remain unknown |
| Calendar | Still blocked: end time and timezone |
| Guest quote | Still blocked: guest/child pricing split |
| Kitchen sheet | Still blocked: timezone and dietary details |
| Staff plan | Still blocked: schedule, timezone and operational details |
| Guest plan | Still blocked: end time, timezone and guest notes; dietary silence does not block it |

**0/5 ready documents remains the correct result for this incomplete conversation.** Removing configuration problems does not supply missing facts. This known-answer replay is not evidence of general model accuracy.

Run `node scripts/replay-restaurant-settings.mjs` to reproduce the saved result without AI. Run `node scripts/check-alex-rehearsal.mjs` to reproduce the unchanged original blocked result.

## Feature checks

- Shared private settings survive fresh handler instances; public writes are refused and the public profile stays unchanged.
- Stale simultaneous saves conflict instead of overwriting each other. Each accepted settings revision retains a change note.
- Original AI receipts and the frozen request vocabulary remain unchanged. Future AI extraction still preserves unlisted requests; operational configuration is applied after extraction. The paid allowance is not reset or reallocated.
- Existing Menu 2 event reviews survive adding unused Menu 3/drinks and raising capacity. Changing Menu 2 prices resets quote and staff review only; stale quotes cannot export.
- A separate complete authored fixture produces five drafts with Menu 3 and separate drinks. Its quote has food lines only and explicitly excludes drinks; the staff sheet repeats that limitation. This is software evidence, not another Alex AI result.
- New menu dishes appear on kitchen sheets, but automatic prep quantities remain available only for the original Menu 2 recipe. Other menus explicitly require the kitchen lead to fill quantities.
- Full automated suite: **221 tests passed**, fake providers only. Added AI calls/cost: **0 / $0**.

Source checks: [settings tests](../../tests/restaurant-settings.test.mjs), [hosted boundary tests](../../tests/hosted-handler.test.mjs), [recorded replay](results/2026-10-12.json).
