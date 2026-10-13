# Four-hour default: Alex saved-answer replay

The coordinator requested a four-hour event duration when no end time is specified. With this preparation rule, Alex's unchanged saved answer now produces **5/5 drafts ready for review**, with **46 Guests**, a **5:30–9:30 PM** schedule and a **$2,944 food estimate**. No manual corrections or new AI call are needed for this replay.

The end time is labelled as a default in the source-to-details view, all five previews, the four PDF templates and the tentative calendar file. It is not presented as a statement from Alex. The original AI receipt still has no end time. Children remain unspecified; pricing and kitchen-quantity follow-ups remain visible.

- Changing the start time recalculates an automatic end time.
- An explicit source or coordinator end time takes priority, including one equal to the current default.
- Clearing the end-time input restores the default.
- Conflicts and unresolved timing questions are not overwritten. Restaurant hours and the existing same-day restriction still apply; a late default does not create an invalid calendar export.
- Changed documents need another review. Existing events with explicit times keep their times and review revisions.

Reproduce without keys or network:

```sh
node scripts/replay-end-time-default.mjs
node --test tests/draft-workflow.test.mjs
```

[Recorded result](results/2026-10-13.json). The earlier [4/5 workflow replay](../draft-workflow-v1/README.md) is retained under `usable-drafts-v1`. The app now uses `usable-drafts-v2`. Alex's original 0/5 failure remains recorded; this is a regression replay of that answer, not evidence of unseen-event accuracy.

## Deployed verification

[Production check](results/hosted-2026-10-13.json) passed at `1e41d1a`. The saved-answer prepare endpoint, with empty corrections, returned all five drafts and the labelled 9:30 PM default. The existing private event kept its explicit 9:30 PM correction and all saved reviews; settings and the original receipt were unchanged. Four hosted PDFs and the tentative calendar exported successfully. The browser shows the new simple editing instructions. The original-answer PDF templates were also rendered and visually checked: four one-page documents with the default visible. **229 software checks passed; zero new AI calls, $0 added, 15 preparations remain.**
