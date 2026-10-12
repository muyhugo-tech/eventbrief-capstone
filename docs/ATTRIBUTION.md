# Reuse and attribution

## Existing event application

EventBrief adapts selected source from the capstone owner's existing Yanni's event application, with the owner's instruction to reuse working infrastructure. The source application stays untouched. This public demo supplies fictional messages, fictional restaurant settings, and local storage adapters instead of production services.

| Existing application source | Capstone reuse |
| --- | --- |
| `lib/mailbox/conversation/evidence.ts` | Complete `sourceQuote` and `currentBody` algorithms, with TypeScript annotations removed, in `lib/reused-yannis/evidence.mjs`. |
| `lib/mailbox/conversation/history.ts` | Stable fingerprinting and immutable source/identity/baseline guards adapted for append-only local event revisions in `lib/reused-yannis/source-history.mjs`. |
| `lib/conversation-review/snapshot.ts` | Informed the rule that an earlier source version remains readable but cannot be reviewed as current. |
| `lib/kitchen/template.ts` | Pure kitchen HTML builder copied to `lib/reused-yannis/templates/kitchen.mjs` with TypeScript removed. |
| `lib/beo/template.ts` | Pure event document builder copied to `lib/reused-yannis/templates/event.mjs` with TypeScript removed; used for the internal staff export. |
| Application sidebar components | Sidebar SVGs and count-label behavior adapted for this framework-free synthetic dashboard; source comments identify the original components. |

[The source inventory](../lib/reused-yannis/README.md) records source hashes and precise adaptation boundaries. The full production claim reconciler is **not** imported. Replies trigger a new extraction of the complete bounded conversation using EventBrief's existing 18-field contract. New local-storage adapters connect the reused pure functions to this demo; this is not a migration of the production database or entire application.

The document adapter in `public/package-export.mjs` supplies only ready, audience-approved rows to the reused builders. It adds fictional-data, source-mode, and review labels and converts approved venue times for rendering. It does not pass the source conversation or complete extracted record into either builder. Existing guest and quote rendering stays in place to retain its audience boundary.

No ownership transfer, third-party license, or general permission to reuse this repository is implied by this disclosure. A publication license has not yet been selected.

No customer corpus, production environment file, live database client, operational report, automatic delivery route, or source-project Git history belongs in the submission. Readiness, correction provenance, saved review marks, and bounded AI request handling already developed in EventBrief remain part of the adapted workflow.

## Design references

The owner supplied these references for the dashboard direction:

- [AI CRM Dashboard by Larsen66 on 21st.dev](https://21st.dev/@larsen66/templates/ai-crm-dashboard)
- [CRM opportunities reference](https://21st-crm.vercel.app/opportunities)

They are visual and interaction references, not a license to copy their implementation or assets. No purchased template source is included. The sidebar, event list, summary counts, restrained panels, and review workspace are independently styled around EventBrief's own workflow and plain-language controls. See [DESIGN.md](../DESIGN.md) for the implemented direction.

## AI assistance and evidence

Codex assisted with implementation, tests, synthetic fixtures, and documentation. Optional runtime AI extracts a shared event record; deterministic code creates the documents and quote. Authored demonstration records and fake-provider tests are labeled separately from real model outputs.

The initial product need comes from the capstone owner's firsthand event work. Synthetic fixtures are newly authored demonstration material. Reported development results retain their limits; no independent user research, measured time savings, or production outcomes are claimed.
