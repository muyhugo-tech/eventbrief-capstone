# EventBrief product contract

## User and problem

A restaurant private-events coordinator reconstructs agreed arrangements from an evolving conversation, then repeats those facts across materials for guests, kitchen staff, service staff, and a calendar. The capstone owner's firsthand event-work account motivated the project. No independent interview count, quantified business impact, or measured time savings is claimed.

The intended outcome is one action that prepares five consistent drafts for human review. The AI hypothesis is that an LLM can identify current facts, separate requests from accepted changes, and attach evidence so a coordinator can check the result before using it.

## Scope

One event conversation produces a shared record and five views: calendar entry, guest quote, kitchen sheet, staff event plan, and guest event plan. All bundled people, conversations, restaurant settings, and prices are fictional. The demo uses local storage adapters and has no live inbox, database, sending, booking, or calendar write connection.

The implementation uses native Node.js HTTP/fetch and browser JavaScript. Pure workflow and document modules from the owner's existing event application are adapted where they fit this local demo; production clients, operational data, and delivery routes are excluded. See [the reuse inventory](docs/ATTRIBUTION.md).

## Rules

- A requested change does not become an accepted fact merely because it appears later in the conversation.
- Source quotations must occur in the supplied message. Matching a quote is not proof that it supports the AI's interpretation.
- A coordinator can explicitly confirm a corrected detail with a reason, resolving its old pending requests or questions in the working draft. The original extraction remains unchanged. A custom operational arrangement requires a separate confirmation; prices, capacity and valid dates are still checked.
- Restaurant policy, arithmetic, source facts, and reviewer corrections retain distinct provenance.
- Review approval belongs to a particular draft revision. A changed dependent fact requires another review.
- A blocked draft cannot be reviewed or exported as a complete current draft.
- Ready for review is not a confirmed booking, a verified AI answer, or a binding quotation.
- Guest-facing drafts exclude internal staff notes.
- Counts are labeled **Guests** and **Children (0–12)**. The combined total includes both.
- Unresolved dietary information blocks the kitchen and staff plans. It also blocks the guest plan when the host raised that topic. Silence alone or a restaurant-only question does not add that guest dependency.
- Dietary topic detection is a bounded local rule over structured roles and recognizable speaker labels, not a guarantee for every arbitrary email format.

## Fictional policy boundary

The profile supports one venue, one menu, two beverage choices, and same-day service. Prices are placeholders. Capacity and operating hours checks do not establish availability. Unsupported options require coordinator attention. Real tax, deposits, cancellation terms, binding quote rules, multi-event scheduling, and external integrations are outside this capstone.

The LLM extracts facts; code calculates the quote and checks output requirements. Five drafts do not imply five model calls or five autonomous agents. The coordinator stays responsible for reviewing every ready output.

## Evidence and remaining claims

The repository contains frozen fictional development cases, automated checks, scorer self-checks, and summaries of recorded model development runs. Automated test passes, fake-provider results, actual model results, and human review are different evidence types and must remain labeled separately.

No independent accuracy, comparative benefit, time savings, or production suitability is established. Formatting can be refined after the complete workflow works. The capstone video should demonstrate one bounded task, explain the evaluation method and observed failures, and stay under four minutes.

Coordinator feedback keeps before/after values and a reason in the saved review history. Optional general lessons can be enabled or disabled by the coordinator. Up to five newest enabled lessons are passed as bounded reference context on future extractions within that workspace; original event facts are not automatically copied into lessons. This is application memory, not model training. Corrected drafts do not improve the original AI evaluation score. The first paired beverage test failed its main check with and without a lesson; broader effectiveness remains unknown. See [the recorded comparison](evaluation/lesson-comparison-v1/README.md).
