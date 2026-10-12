# Demo walkthrough

Use a fictional event. The public checkout contains no customer messages or previous user's review progress.

## Complete the workflow without a key

1. Run `npm start` and open `/package`.
2. Choose **New event**, then **Try the full workflow · free example**.
3. Check that two drafts are ready and three are blocked. The missing detail is the host's dietary reply.
4. Choose **Add a reply**, then **Fill with the sample reply**.
5. Click **Update drafts**. All five should now be ready, with zero reviews.
6. Check **30 Guests**, **0 Children**, and the **$2,280** fictional quote.
7. Review each draft, then refresh. The five review marks should remain.
8. Open **Earlier versions & saved results**. The old version is preserved and cannot be treated as current.
9. Open the latest version and choose **Download reviewed draft** for a printable HTML file.

This path is an exact authored demonstration, with no model request. The sample reply is:

> I checked with everyone. No allergies or dietary restrictions. Everything else stays as confirmed.

Changed sample text or arbitrary replies require real AI. Authored answers are never supplied as if the model generated them.

If you have already used the guided example, **Try the full workflow** reopens its latest saved version. It does not erase reviews or reset the event. Use **Earlier versions & saved results** to inspect the original missing-detail version.

## Inspect the separate complete example

Choose the complete birthday example in **Saved example** mode, then prepare the five drafts. Open a source quote to find the supporting message. The example is authored; no AI call happens. It is a separate fixture from the guided conversation above.

Each draft needs its own review. The guest and quote outputs should exclude internal staff notes. Downloads are optional; a reviewed draft can be downloaded as printable HTML.

## Then: inspect missing information

Open the earlier example where the host's dietary reply is missing. The calendar and quote can be ready while kitchen, staff, and guest plans remain blocked. This host explicitly raised dietary needs, which is why the guest plan also needs the answer.

The app must not invent “no allergies.” A blocked draft stays unreviewed. An event whose host never raises dietary needs does not gain that guest-plan requirement merely from silence; kitchen and staff checks still apply.

## Real AI demonstration

After optional [API setup](SETUP.md), paste a new fictional event conversation and choose **Real AI**. Make one intentional preparation, inspect the actual saved result, and show a source excerpt. State that this made a model request. Do not show the API key or replace a failed result with an authored example while calling it AI output.

Review saved results without repeated paid calls. A replay demonstrates the saved response and current application rules; it is not a new extraction.

## Four-minute video

Aim for **3:50 including titles and closing**.

| Time | Show and explain |
| --- | --- |
| 0:00–0:30 | The coordinator's problem: reconstructing current arrangements and repeating them across five materials. Identify the firsthand source of the problem statement. |
| 0:30–1:15 | The solution: one conversation, one shared AI record, five drafts, human review. Explain that code checks rules and calculates prices. |
| 1:15–2:20 | One complete workflow: prepare, inspect evidence, identify a missing detail, resolve it, review the updated draft. Label any replay or saved example. |
| 2:20–3:25 | Evaluation: the frozen fictional cases, exact field/status checks, draft decisions and quote arithmetic. Show the retained failure and the limits of development-set results. Separate automated tests from actual model results. |
| 3:25–3:50 | The supported conclusion and one limitation. State that independent semantic accuracy and time savings still need measurement. |

Do not narrate every field. One event and one consequential correction tell the story. Keep the final video under four minutes; the supplied rubric penalizes overruns.
