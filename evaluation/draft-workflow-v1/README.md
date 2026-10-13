# Alex workflow repair — saved-answer replay

Alex's original end-to-end test **failed**. The AI extracted the accepted total of 46, but the application left the editable Guests field blank and blocked useful drafts behind optional fields. Passing the old extraction/blocking checks did not meet the product goal.

This repair reuses the original saved model answer and the already configured fictional Menu 3, 60-person patio and separately billed drinks. No new AI call, prompt change, receipt replacement or event correction is used for the original-answer replay.

## What changed

- Carry accepted attendance into Guests when the separate count is unknown and no count conflict, pending change or coordinator override exists. Known children are subtracted from attendance; unknown children stay unknown.
- A quote using attendance as its guest-price basis explicitly says the child count must be confirmed. Alex's estimate is **46 × $64 = $2,944 for food**. Separately billed drinks are excluded, not presented as free.
- Use the restaurant timezone when unspecified, with provenance identifying restaurant settings rather than fabricated conversation evidence.
- Allow absent arrival notes, staff notes, setup, AV and special requirements. Unresolved questions, conflicting values and unsupported explicit requests still require resolution.
- Allow draft kitchen/staff sheets when dietary information was never raised, with an explicit reminder to confirm before food service. Host-raised unresolved dietary details still block kitchen, staff and guest outputs.
- Show a missing end time on guest/staff drafts. Calendar export still requires it; no duration is invented.

## Two separate checks

| Draft | Untouched saved answer | Existing private event with earlier saved corrections |
| --- | --- | --- |
| Calendar | End time missing; export blocked | Verified live using the previously saved 9:30 PM end time |
| Guest quote | Ready: provisional $2,944 food estimate; 46 guests; children unspecified | Verified live, same estimate |
| Kitchen sheet | Ready: 46 people, Menu 3; dietary reminder; prep quantities marked Confirm | Verified live, retains earlier dietary correction |
| Staff event plan | Ready: known details, drink terms, missing end/setup clearly flagged | Verified live; blank optional notes do not block |
| Guest event plan | Ready: known details and thanks; end time flagged | Verified live; blank arrival notes do not block |

The raw conversation produces **4/5 ready**, with one legitimate follow-up for the calendar. The existing private event already has end-time, timezone and dietary corrections; replaying those produces **5/5** without adding or editing any corrections. These are distinct results, not an unassisted five-draft claim.

## Reproduce

```sh
node scripts/replay-draft-workflow.mjs
node --test tests/draft-workflow.test.mjs
node scripts/check-alex-rehearsal.mjs
node scripts/replay-restaurant-settings.mjs
```

[Recorded original-answer replay](results/2026-10-12.json). Historical scorers explicitly select `strict-drafts-v1`, preserving original failure evidence. Current application preparation uses `usable-drafts-v1`. Existing complete events retain document revisions; changed fields/content invalidate the affected reviews.

Remaining limits: this is a replay of a known answer, not a fresh AI accuracy trial. Children were not specified, and Menu 3 has no saved kitchen quantity rules. Confirm both before final pricing/service. The initial failure remains recorded.

## Hosted verification

The deployed EventBrief event now shows **5/5 ready and 46 Guests**. Its existing 9:30 PM end time, timezone and dietary correction were retained. All four PDFs downloaded, fit on one page and passed content/visual inspection. The calendar file has the correct 5:30–9:30 PM Pacific interval and remains tentative. Original AI receipt, saved corrections/reviews, restaurant settings and public/private separation were unchanged. **0 new AI calls; $0 added AI cost; 15 preparations remain.** [Sanitized hosted evidence](results/hosted-2026-10-12.json).
