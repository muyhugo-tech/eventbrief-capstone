# EventBrief

Turn a restaurant event conversation into five drafts that a person can check: a calendar entry, guest quote, kitchen sheet, staff event plan, and guest event plan.

This is a **local capstone prototype with fictional messages and prices**. It does not connect to an inbox, book events, send messages, or change a live restaurant system.

## Try it

You need **Node.js 24 or newer**. No package installation is required.

```sh
npm start
```

Open [the event workspace](http://127.0.0.1:3135/package). Choose **New event**, then **Try the full workflow · free example**. No API key is needed.

1. Inspect the missing dietary detail and the blocked drafts.
2. Select **Add a reply**, then **Fill with the sample reply**.
3. Select **Update drafts**. The five drafts are now ready for review.
4. Check each draft and mark it reviewed. Refresh to see the saved progress.
5. Use **Download reviewed draft** when you want a printable copy.

This guided example uses explicitly authored records for one exact conversation and reply. New arbitrary messages or different replies require real AI; the example is never a fallback for a failed request.

The workspace keeps these states separate:

- **Saved example:** an authored demonstration. No model call.
- **Real AI:** the model extracts facts from the supplied fictional conversation. A server-side key and an enabled allowance are required.
- **Ready to review:** the required details are present. A person still needs to check them.
- **Reviewed:** a person checked this particular draft version.
- **Blocked:** a required detail is missing, unresolved, conflicting, or outside the fictional restaurant rules.

[Simple setup](docs/SETUP.md) · [Demo walkthrough](docs/DEMO.md) · [Product decisions](PRODUCT.md) · [Reuse and attribution](docs/ATTRIBUTION.md)

## How it works

The LLM reads the messages once and produces a shared event record with source excerpts. Ordinary code checks the record, calculates the fictional quote, and builds the five drafts. This keeps the drafts consistent and makes the calculations inspectable.

Reviewers can inspect source quotes, correct facts, mark ready drafts reviewed, and download printable HTML. Corrections remain separate from the original model response. Changed facts invalidate affected review marks. Saved sources, results, corrections, and reviews stay on the same computer under ignored `out/`; they survive refresh and restart.

**Add a reply** appends a message to the same event without replacing earlier messages. Updating drafts uses the full revised conversation and starts a fresh review. Earlier versions remain readable and are marked as superseded; they cannot be reviewed or exported as the current version. The searchable **Events** view and **Earlier versions & saved results** let you return to saved work without another AI call.

| Draft | Main check |
| --- | --- |
| Calendar entry | Supported date, times, place, and booking details |
| Guest quote | Supported counts and options; deterministic fictional line items |
| Kitchen sheet | Food, counts, and resolved dietary information |
| Staff event plan | Operational arrangements and resolved dietary information |
| Guest event plan | Guest-facing arrangements; unresolved dietary information blocks it when the host raises that topic |

The visible attendance labels are **Guests** and **Children (0–12)**. The guest plan excludes internal staff notes. An internal JSON review package contains the full conversation and review record; it is not a guest handout. Calendar export is HTML, not a calendar integration.

## Real AI is optional

Follow [the setup guide](docs/SETUP.md) to use a separate API key. The default example configuration leaves paid requests off. Keys stay server-side, local attempt records preserve failures, and a persistent allowance stops new requests when exhausted. Restarting does not reset it. Failed or uncertain attempts count; requests are not automatically retried.

The allowance is a conservative local token-cost estimate, not a provider account-wide spending limit. The example model configuration must be supported by the API account used to run it.

## Evaluation

```sh
npm test
npm run check:fixtures
npm run eval:self-check
npm run eval:package:self-check
```

These commands run offline and use synthetic or fake-provider data. They do not load the API key or call a model. Scorer self-checks test the scoring code; they are not AI accuracy results.

The [October 12 workflow validation](docs/VALIDATION-2026-10-12.md) records the complete same-event reply journey: two actual API calls retained the changed count and quote, blocked the three affected drafts while dietary details were missing, then restored all five ready drafts after the reply. The two calls cost an estimated $0.05384 under conservative token accounting. The result remained unreviewed for the user.

The [recorded October 11 development experiment](evaluation/package-v1/results/2026-10-11-sol.md) contains both the baseline and clarified run on twelve fictional cases. The clarified run produced **215/216 exact field/status matches**, **60/60 document decisions**, and **12/12 quote checks** under that experiment's original readiness policy. The remaining exact mismatch is retained. The later conditional guest-dietary rule is tested separately; the earlier score does not evaluate that new rule.

These are development cases used during prompt refinement, not a held-out benchmark. Human semantic review, independent accuracy, time savings, and comparative usability remain unmeasured. See [the evaluation framework](evaluation/package-v1/README.md) for denominators and limits. Raw local development receipts are excluded from the public package; committed result summaries report those runs without pretending that the public checkout contains their raw responses.

## Public submission

```sh
node scripts/public-check.mjs
node scripts/public-check.mjs --export
```

The export creates an audited ZIP and SHA-256 manifest under ignored `out/submission/`. It contains selected source and synthetic fixtures, excluding credentials, saved conversations, runtime output, and Git history. [Publication instructions](docs/PUBLIC-SUBMISSION.md) explain the boundary and the separate history check.

The repository is prepared for public submission, but no remote publication or hosting is required to run this demo. A publication license has not been selected. Reused application code and design references are disclosed in [ATTRIBUTION.md](docs/ATTRIBUTION.md).
