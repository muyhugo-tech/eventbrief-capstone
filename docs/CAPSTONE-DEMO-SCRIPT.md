# EventBrief capstone video

Aim for **3 minutes 50 seconds**, including screen changes. The rubric penalizes videos over four minutes. This is a practice script based on the October 13 evidence; update the evaluation paragraph if the remaining bugs are repaired before recording.

The demo can show a working prototype today. The final check still has two workflow failures, so do not describe EventBrief as generally reliable or all tests as passing. [Current scorecard](EVALUATION-SCORECARD.md)

## Before you record

1. Open the private workspace. Keep the access code off screen.
2. Open **Diego Chen**. Start with **26 Guests, 0 Children**, a **$1,664** quote and **5–9 PM**. This is a saved real AI result; reopening it costs nothing.
3. Keep the scorecard and downloaded quote ready. Practise once with a timer. Read only the quoted speech below; the screen directions are for you.

For the change demonstration, use **28 Guests** and leave **0 Children**. The expected quote is **$1,792**. Kitchen dessert portions become **28**; bowls, trays and platters remain **3 each**. The event time stays the same. This is a demonstration change, not part of the frozen AI score. Restore 26 afterward if you want to practise again; no AI is needed.

## 0:00–0:25 — The problem

Show the event conversation in Inbox.

> I coordinate restaurant events. A host changes a guest count in a message, and that change has to reach the quote, kitchen sheet, staff plan and guest plan. Repeating those edits creates opportunities for mistakes. This project came from my own event work. The insight was to keep one current record that every document uses.

## 0:25–1:15 — The solution

Show the five draft buttons, then a source excerpt and the labelled end-time default.

> EventBrief turns an event conversation into five drafts: a calendar entry, guest quote, kitchen sheet, staff plan and guest plan. My hypothesis is that an LLM can identify the latest accepted details and attach evidence, while code applies restaurant rules and calculates prices.
>
> The AI does not send messages or book the event. A coordinator checks the result, corrects details and reviews each draft. Corrections keep their reason and leave the original AI answer intact. Missing end times use our four-hour default, clearly labelled as a rule rather than something the host said. Everything shown here is fictional.

## 1:15–2:15 — The demonstration

Open Diego's saved result. Show the final 26-guest message, quote and kitchen sheet. Check the quote, then mark that draft reviewed. Open **Edit event details**, set Guests to **28**, add the note **“Demo: host confirmed two additional guests.”**, and choose **Save changes**. Leave the lesson option off. Reopen the quote and kitchen sheet, then briefly show staff, guest and calendar.

> This is a saved result from a real AI call, not a new call or a written sample answer. Diego originally asked for twenty-two guests, then confirmed twenty-six. The prepared record uses twenty-six and ends at nine, four hours after the five o'clock start. The quote is sixteen hundred sixty-four dollars.
>
> Now I change Guests to twenty-eight and save the reason. The quote becomes seventeen hundred ninety-two dollars, and the kitchen quantity changes too. The staff and guest plans use the same updated count. The changed quote needs review again. The calendar time stays unchanged. These outputs can be downloaded for review.

## 2:15–3:20 — How we evaluated it

Show the three-row table in the current scorecard. Keep failures visible.

> We tested three layers: source details, application rules, and the finished documents. We wrote expected results before each call, checked counts, times, drink notes, prices and blocking reasons, and inspected the downloads. We also kept first attempts separate from later repairs.
>
> In the latest three new conversations, one complete workflow passed and two failed. Even the working example missed one raw count field; the app calculated it from the supplied total and children. So none passed every strict extraction check.
>
> The failures exposed drink-matching problems, an anniversary label treated as a service request, and an allergy check that missed a first-name speaker. Those remain work to fix. Two hundred thirty-two software checks passed, but that did not prove the AI workflow would always work. These are small synthetic development tests, not independent accuracy evidence.

## 3:20–3:50 — The takeaway

Return to the event with its five assets visible.

> What this prototype demonstrates is a working path from a changing conversation to five connected drafts, with evidence, coordinator corrections and human review. It also shows exactly where the current system fails. The next step is to repair those saved cases, then test with independent conversations and measure time saved. The goal is fewer repeated edits while the coordinator stays in control.

## Recording checks

- Say **“saved real AI result”** when reopening Diego. Do not imply a new extraction occurred during the recording.
- Say **“working path”**, not “all conversations work.” Keep first-attempt failures separate from repaired replays.
- Show a PDF briefly; do not spend the video downloading every file.
- If clicking takes too long, shorten the narration. Stop before **4:00**.

The suggested timings are a rehearsal target, not a measured recording duration. No independent interviews, time savings or business impact are claimed.
