# Sofia: new conversation with changed attendance and no end time

**The first attempt failed the full workflow: 1/5 drafts ready.** The AI correctly extracted the final **32 Guests and 2 Children**, **34 total**, and left the end time unknown. The application correctly applied **5:45–9:45 PM**, but rejected `Nonalcoholic service: juice and soda for everyone, no alcohol.` because its option/notes parser did not recognize a colon. The calendar worked; all four PDF endpoints returned HTTP 409.

This was a new assistant-authored fictional conversation, submitted once with expectations and scorer saved before the call. No event, prompt, model, lesson or restaurant-setting correction was made before scoring. [Conversation and protocol](protocol.json) · [Original result](results/2026-10-13.json)

The application fix matches the full configured drink option before common punctuation separators, then validates every remaining note. It does not guess an option from a substring, drop extra requests or weaken checks on alcohol, pricing or unresolved arrangements. `supported-details-v3` remains available to reproduce the failure; the app uses `supported-details-v4`.

Replaying the **same answer with no corrections and no additional AI call** now passes **all five draft checks**:

| Draft | Repaired result |
| --- | --- |
| Calendar | January 22, 2027, 5:45–9:45 PM Pacific; labelled four-hour default; correct tentative calendar file |
| Guest quote | 32 guests and 2 children, **$2,104**, juice/soda/no-alcohol instructions retained |
| Kitchen sheet | 34 people; 4 salad bowls, 4 squash trays, 4 chicken platters, 34 dessert portions under the fictional prep guide |
| Staff event plan | Correct final count, schedule, menu and drinks; missing optional details remain unconfirmed |
| Guest event plan | Correct final count, schedule, menu and drinks, with guest-facing wording |

[Saved-answer replay](results/replay-2026-10-13.json). Unknown allergy details are left unknown; they do not block this example because the conversation never raises a dietary requirement. Human review still precedes use.

**Budget:** one AI call, no retry, estimated **$0.0217875** using the existing conservative rates. One already-reserved hosted slot consumed: **15 → 14**. Combined allocations remain **$4.56384 within $5**, with no added allocation or allowance refill.

Reproduce offline:

```sh
node scripts/check-sofia-event.mjs
node scripts/replay-sofia.mjs
node --test tests/sofia-beverages.test.mjs
```

Confidence is high for these observed outputs. Broader unseen-conversation accuracy remains unproven. The fresh run was a failure followed by a software repair, not a first-attempt success.

## Hosted check after the repair

[Production verification](results/hosted-replay-2026-10-13.json) passed on `3d0c1b6`: all five previews opened; four PDF endpoints returned 200; the calendar file had the correct times; reopening the saved result was free. Other events, review revisions, corrections, settings and the original AI receipt were unchanged. No new event corrections or review marks were added. All 232 software checks passed.

PDF content and all six pages were inspected. The quote and kitchen sheet currently spill their footer onto a second page; staff and guest sheets fit one page. All event content is present and readable. **Footer pagination still needs formatting polish.**

## Subsequent print fix

The October 13 print change now keeps the hosted Sofia quote and kitchen sheet to one page each, with identical text after whitespace normalization. Long-note versions continue onto a second page without an isolated footer. This changes the layout, not the first-attempt failure or replay score. [Verified pagination](../../docs/PDF-PAGINATION-2026-10-13.md)
