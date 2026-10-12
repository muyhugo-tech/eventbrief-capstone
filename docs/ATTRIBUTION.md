# Reuse and attribution

## Existing event application

EventBrief adapts selected source from the capstone owner's existing Yanni's event application, with the owner's instruction to reuse working infrastructure. The source application stays untouched. This public demo supplies fictional messages, fictional restaurant settings, and EventBrief's own local or private-cloud storage adapters. It does not connect to the source application's production services.

| Existing application source | Capstone reuse |
| --- | --- |
| `lib/mailbox/conversation/evidence.ts` | Complete `sourceQuote` and `currentBody` algorithms, with TypeScript annotations removed, in `lib/reused-yannis/evidence.mjs`. |
| `lib/mailbox/conversation/history.ts` | Stable fingerprinting and immutable source/identity/baseline guards adapted for append-only local event revisions in `lib/reused-yannis/source-history.mjs`. |
| `lib/conversation-review/snapshot.ts` | Informed the rule that an earlier source version remains readable but cannot be reviewed as current. |
| `lib/kitchen/template.ts` | Pure kitchen HTML builder copied to `lib/reused-yannis/templates/kitchen.mjs` with TypeScript removed. |
| `lib/beo/template.ts` | Pure event document builder copied to `lib/reused-yannis/templates/event.mjs` with TypeScript removed; used for the internal staff export. |
| Application sidebar components | Sidebar SVGs and count-label behavior adapted for this framework-free synthetic dashboard; source comments identify the original components. |
| Event list and calendar components, including `components/calendar/CalendarView.tsx` and `lib/events/calendar.ts` | Functional reference for opening an event from a month view, using a compact agenda on narrow screens, and retaining events whose date needs attention. `public/workspace-calendar.mjs` is EventBrief's implementation over its saved event summaries; no production calendar service or database client is imported. |
| `components/quotes/QuotePreview.tsx` and `lib/quotes/document.ts` | The quote hierarchy and CSS patterns are adapted in `public/quote-document.mjs`, guided by the owner's supplied one-page estimate PDF. EventBrief keeps its deterministic cents calculation and fictional prices; the production quote calculator, commercial terms, contact details, and delivery routes are not imported. |
| `lib/beo/render.ts` and `lib/beo/fonts.ts` | HTML-to-PDF launch and embedded-font patterns adapted in `lib/quote-pdf.mjs`: local installed Edge/Chrome and bundled Chromium on Vercel. The endpoint rebuilds the current saved EventBrief quote, rejects stale or blocked output, disables page scripts/network requests, and does not call the source application's service. |

[The source inventory](../lib/reused-yannis/README.md) records source hashes and precise adaptation boundaries for copied modules. The full production claim reconciler is **not** imported. Replies trigger a new extraction of the complete bounded conversation using EventBrief's existing 18-field contract. EventBrief storage adapters connect the reused pure functions to this demo; this is not a migration of the production database or entire application.

The document adapter in `public/package-export.mjs` supplies only ready, audience-approved rows to the reused kitchen and staff builders. It adds fictional-data, source-mode, and review labels, converts approved venue times, and supplies event attendance, schedule, and dietary details where appropriate. Empty production-only fields are omitted. It does not pass the source conversation or complete extracted record into either builder. Guest plans use EventBrief's renderer in `public/package-render.mjs`; quotes use the shared HTML/PDF layout in `public/quote-document.mjs`. Guest-facing documents exclude internal staff notes and individual dietary details. The existing package engine still determines readiness and calculates quote totals.

The `.ics` builder is a tentative import-file export in `public/workspace-calendar.mjs`. It does not reuse or connect a live calendar integration. Guest quotes and kitchen sheets have a direct **Download PDF** action; staff and guest plan copies use HTML and the browser's **Print / Save PDF** action. No production email or PDF endpoint is connected. See [the asset workflow](ASSET-WORKFLOW.md) for the implemented user steps.

The owner's photographed kitchen checklist now guides the kitchen preview/PDF in `public/kitchen-document.mjs`: centered heading, compact facts, gray course tables, quantities, and two blank checkoff columns. It supersedes the older kitchen HTML adapter for current downloads. The copied kitchen builder remains a documented reference for the plain print style. EventBrief reuses its quote PDF renderer and embedded fonts. `lib/kitchen-prep.mjs` contains newly authored fictional serving assumptions; no production recipes, quantities, real event details, or coordinator identities were copied from the photo.

Quote typography uses Playfair Display and Montserrat through the pinned Fontsource packages. Their SIL Open Font License notices are included under `quote-fonts/` in the built site and in the installed packages. This third-party font licensing does not add a reuse license to EventBrief's own source.

No ownership transfer, third-party license, or general permission to reuse this repository is implied by this disclosure. A publication license has not yet been selected.

No customer corpus, production environment file, live database client, operational report, automatic delivery route, or source-project Git history belongs in the submission. Readiness, correction provenance, saved review marks, and bounded AI request handling already developed in EventBrief remain part of the adapted workflow.

## Design references

The EventBrief Inbox adapts the interaction pattern of Yanni's `ConversationReviewQueue.tsx`, `ConversationReviewPanel.tsx`, and documented intake review: original messages, extracted facts, source quotations, separate coordinator corrections, and affected event outputs. Its vanilla JavaScript view is implemented for EventBrief's existing storage and extraction contracts. No Yannis inbox connection, customer messages, matching RPC, database, or live intake credential is included.

The owner supplied a CRM board screenshot and these references for the dashboard direction:

- [AI CRM Dashboard by Larsen66 on 21st.dev](https://21st.dev/@larsen66/templates/ai-crm-dashboard)
- [CRM opportunities reference](https://21st-crm.vercel.app/opportunities)

The screenshot is the dominant dashboard reference: five white columns, outlined stage markers, count pills, concise outlined cards, and horizontal scrolling. The sales labels and financial pipeline totals are replaced with saved event-review stages and actual draft values. Yanni's calendar and quote pages serve narrower functional roles, as described above.

These are visual and interaction references, not a license to copy their implementation or assets. No purchased template source is included. The board, asset lists, sidebar, and review workspace are styled around EventBrief's workflow and plain-language controls. [DESIGN.md](../DESIGN.md) records the reference lock and decisions.

## AI assistance and evidence

Codex assisted with implementation, tests, synthetic fixtures, and documentation. Optional runtime AI extracts a shared event record; deterministic code creates the documents and quote. Authored demonstration records and fake-provider tests are labeled separately from real model outputs.

The initial product need comes from the capstone owner's firsthand event work. Synthetic fixtures are newly authored demonstration material. Reported development results retain their limits; no independent user research, measured time savings, or production outcomes are claimed.
