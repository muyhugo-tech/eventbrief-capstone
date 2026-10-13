# EventBrief

Turn a restaurant event conversation into five drafts that a person can check: a calendar entry, guest quote, kitchen sheet, staff event plan, and guest event plan.

This is a **capstone prototype with fictional messages and prices**, with local and hosted entry points that share the same application core. Its Inbox holds pasted conversations and replies. It does not connect to an email account, book events, send messages, or change a live restaurant system.

## Try it

Open [eventbrief-capstone.vercel.app](https://eventbrief-capstone.vercel.app). Its **Try a sample** button needs no API key or access code. **Open private workspace** accepts the access code for shared private events and real model requests. The same code opens the same private events and saved reviews in any browser; public samples stay separate. The sample is a written demonstration, not an AI result. The hosted workflow and one real AI request were verified on October 12, 2026; see [deployment evidence](docs/HOSTED-VALIDATION-2026-10-12.md).

To run on your computer, use **Node.js 24**:

```sh
npm install
npm start
```

Open [the event workspace](http://127.0.0.1:3135/package). Choose **New event**, then **Try the full workflow · free example**. No API key is needed.

1. Inspect the missing dietary detail and the blocked drafts.
2. Select **Add a reply**, then **Fill with the sample reply**.
3. Select **Update drafts**. The five drafts are now ready for review.
4. Check each draft and mark it reviewed. Refresh to see the saved progress.
5. Open **Calendar**, **Guest quotes**, **Kitchen sheets**, **Staff event plans**, or **Guest event plans** in the sidebar. Download a draft or choose **Print / Save PDF**.
6. Open **Inbox** to compare the original messages, extracted event details, coordinator changes, and all five assets. Click **See source** on a detail to highlight its quotation. Adding a conversation or reply to the Inbox makes no AI call; preparation is a separate action.

This guided example uses explicitly authored records for one exact conversation and reply. New arbitrary messages or different replies require real AI; the example is never a fallback for a failed request.

The workspace keeps these states separate:

- **Saved example:** an authored demonstration. No model call.
- **Real AI:** the model extracts facts from the supplied fictional conversation. A server-side key and an enabled allowance are required.
- **Ready to review:** the required details are present. A person still needs to check them.
- **Reviewed:** a person checked this particular draft version.
- **Blocked:** a required detail is missing, unresolved, conflicting, or outside the fictional restaurant rules.

[Simple setup](docs/SETUP.md) · [Using the calendar and assets](docs/ASSET-WORKFLOW.md) · [Hosting and maintenance](docs/HOSTING.md) · [Demo walkthrough](docs/DEMO.md) · [Product decisions](PRODUCT.md) · [Reuse and attribution](docs/ATTRIBUTION.md)

## How it works

The LLM reads the messages once and produces a shared event record with source excerpts. Ordinary code checks the record, calculates the fictional quote, and builds the five drafts. This keeps the drafts consistent and makes the calculations inspectable.

Reviewers can inspect source quotes, correct facts, mark ready drafts reviewed, and download guest quotes, kitchen sheets, staff plans, and guest plans as PDF. Corrections remain separate from the original model response. Changed facts invalidate affected review marks. Local runs save under ignored `out/`. Hosted runs save in a separate private Blob store: unlocked browsers share one private workspace, while public samples use isolated browser workspaces. Both preserve progress across refresh and redeployment. There are no individual accounts or roles. See [storage limits](docs/HOSTING.md#saved-progress).

**Fix this detail** opens the coordinator editor from a blocked draft. A confirmed correction with a reason resolves that field's old questions and rebuilds the affected assets. Custom operational arrangements require explicit coordinator confirmation; arithmetic, pricing and venue limits still apply. An optional **Remember a lesson** note becomes context for the next AI preparation in the same workspace. This is editable application memory, not model training. The original AI response stays intact, and improvement from lessons has not yet been measured. [Correction and feedback workflow](docs/ASSET-WORKFLOW.md).

**Add a reply** appends a message to the same event without replacing earlier messages. Updating drafts uses the full revised conversation and starts a fresh review. Earlier versions remain readable and are marked as superseded; they cannot be reviewed or exported as the current version. The searchable **Events** view and **Earlier versions & saved results** let you return to saved work without another AI call.

The **Events** board groups events by actual preparation and review progress; a list view is also available. The calendar shows dated drafts and keeps undated events in **Date needed**. Each document section opens its own draft from the same saved event. Date, count, price and review summaries follow saved corrections across browsers. Unprepared new messages clear stale schedule and quote summaries until the updated drafts are prepared.

| Draft | Main check |
| --- | --- |
| Calendar entry | Supported date, times, place, and booking details |
| Guest quote | Supported counts and options; deterministic fictional line items |
| Kitchen sheet | Food, counts, and resolved dietary information |
| Staff event plan | Operational arrangements and resolved dietary information |
| Guest event plan | Guest-facing arrangements; unresolved dietary information blocks it when the host raises that topic |

The visible attendance labels are **Guests** and **Children (0–12)**. Guest documents exclude internal staff notes and individual dietary details. An internal JSON review package contains the full conversation and review record; it is not a guest handout. Calendar downloads are tentative `.ics` files for manual import. They do not sync, book space, or invite anyone. All four document types use **Download PDF**. **Print / Save PDF** uses the browser's print window. Local direct-PDF rendering requires an installed Edge or Chrome; Vercel uses bundled Chromium. Fonts are packaged locally, with their licenses included in the built site.

Kitchen sheets use a printed, fictional prep guide for the demo menu. Saved attendance changes recalculate bowls, trays, platters and dessert portions, and invalidate the kitchen review. These quantities are capstone assumptions, not production recipe validation. The sheet includes allergy details, handwritten prep/check columns, and notes space. See [the kitchen workflow](docs/ASSET-WORKFLOW.md).

## Real AI is optional

Follow [the setup guide](docs/SETUP.md) to use a separate API key. The default example configuration leaves paid requests off. Keys stay server-side, local attempt records preserve failures, and a persistent allowance stops new requests when exhausted. Restarting does not reset it. Failed or uncertain attempts count; requests are not automatically retried.

Local and hosted allowances are conservative reservations, not provider account-wide invoice limits. The hosted prototype has one shared, persistent allowance of **20 slots × $0.205 = $4.10**. A slot is consumed before a request and is not refunded after a failure. This fits within the existing $5 authorization after the two earlier calls estimated at $0.05384; it does not authorize another $5. Hosting and storage usage are separate from the AI allowance. [Hosting and maintenance](docs/HOSTING.md) explains the fixed plan and configuration.

The hosted build adds one direct dependency, `@vercel/blob`. `npm run build` copies an allowlist of static assets. One Vercel function connects the existing extraction, validation, review, and export workflow to browser access and private storage. Future features can extend these adapters and the shared core.

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

The public source is at [muyhugo-tech/eventbrief-capstone](https://github.com/muyhugo-tech/eventbrief-capstone). Hosting is optional for local use. A publication license has not been selected; no license is included. Reused application code and design references are disclosed in [ATTRIBUTION.md](docs/ATTRIBUTION.md).
