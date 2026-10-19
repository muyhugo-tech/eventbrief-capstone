# Hosting EventBrief

The public app is live at [eventbrief-capstone.vercel.app](https://eventbrief-capstone.vercel.app). The capstone opens directly with real AI available within its existing allowance; no access code is required. It contains shared fictional events only. The separate Vercel project is linked only to `muyhugo-tech/eventbrief-capstone`, with `codex/capstone-submission` as its production branch. Earlier protected-workspace validation is retained as historical evidence.

Pushing to that branch automatically deploys EventBrief. A Git-triggered deployment was verified successfully, including saved review progress and the remaining AI allowance after redeployment.

## What visitors can do

The page permits embedding by `https://capstone.productfaculty.com`, the submission host shown in the capstone instructions. Other external frame origins stay blocked. Public demo operations do not depend on third-party cookies.

- Choose one of five fictional conversations and click **Use this conversation**, then **Prepare five drafts**. Each test lists its expected checks.
- Copy a conversation, change it, or paste a new fictional conversation to test the real agent.
- Reopen a saved real-AI result without a new call. The interface labels saved results.
- Review source evidence, edit details, save review marks, and download PDFs or the calendar. Those actions do not call AI.
- Open the separate written sample when AI is unavailable. It is labeled and never substitutes for a failed AI request.

## Set up the separate project

1. Use a new Vercel project named `eventbrief-capstone` linked to this public repository. Do not reuse the Yannis project, secrets, database, or storage.
2. Create a **private** Vercel Blob store for EventBrief and connect it to this project. Keep the resulting `BLOB_READ_WRITE_TOKEN` server-side.
3. Add the environment settings below to the intended deployment environment.
4. Install packages with `npm install`. Dependencies are pinned in `package-lock.json`. Vercel uses Node.js 24, `npm run build`, and the `dist` output directory from `vercel.json`.
5. Deploy, then run the checks below before giving out the link.

| Setting | Purpose |
| --- | --- |
| `EVENTBRIEF_PUBLIC_ORIGIN` | The exact HTTPS site origin, for example `https://eventbrief-capstone.vercel.app`, with no trailing slash |
| `EVENTBRIEF_REQUIRE_ACCESS_CODE` | Leave unset or `false` for the public capstone. `true` is an optional legacy mode for a separate private installation. |
| `EVENTBRIEF_ACCESS_CODE` | Unused by the public capstone; required only by the optional legacy mode |
| `EVENTBRIEF_SESSION_SECRET` | Unused by the public capstone; required only by the optional legacy mode |
| `EVENTBRIEF_OPENAI_API_KEY` | The separate capstone API key; never use the living restaurant system's key |
| `EVENTBRIEF_LIVE_ENABLED` | `true` to allow public AI requests; `false` leaves the public sample available |
| `BLOB_READ_WRITE_TOKEN` | The token for this project's private Blob store |

Keep any local access-code handoff file under ignored `out/` or an ignored environment file. Never commit access codes, keys, session secrets, or Blob tokens. Hosting and storage usage follow the existing Vercel plan; they are not included in the AI allowance.

## How the hosted version reuses the app

`scripts/build-hosted.mjs` copies only an explicit static-file allowlist into `dist/`. It does not copy environment files or local saved work. `api/index.mjs` runs one Vercel function using `lib/hosted/handler.mjs` to adapt HTTPS requests to the existing server and event workflow.

The adapters add browser access, a small filesystem interface backed by private Blob storage, and a global paid-request allowance. The existing extraction, source validation, deterministic pricing, draft generation, source versions, and review logic remain shared with the local app. `npm start` still runs the local version with its local `out/` storage.

Build future features in the shared core or extend these adapters. A new dashboard or additional agent behavior does not require a second event engine.

## Saved progress

The public demo reuses the existing synthetic workspace at `eventbrief/v1/visitors/shared-private-workspace-v1/`. The historical namespace name stays unchanged to preserve saved work. Everyone with the link can view and edit these fictional events and restaurant settings; no code, account or authentication cookie is needed. The Blob store itself stays private and is accessed only by the server.

Earlier separate browser samples are not copied or deleted. Browser selections and unfinished text remain local. Open **Events** to refresh changes from another browser. Concurrent stale saves are rejected. Old pages declaring the previous workspace are asked to reload before writing. Source messages and original model receipts remain unchanged by coordinator corrections.

This is a synthetic public capstone, not a private customer-data service. The live restaurant system is separate and untouched.

## AI allowance

All hosted visitors share one persistent plan: **20 slots × $0.205 = $4.10** in conservative request reservations. A slot is permanently consumed before the model request. Failures, timeouts, and unknown outcomes do not refund it. There are no automatic retries or refills, and unlocking again or redeploying does not reset it.

The current model is `gpt-6.1-sol`, with bounded request size, 7,500 maximum output tokens, and fixed conservative price constants. These reservation limits are not a provider account-wide invoice cap. The provider's billing records remain the source for actual charges.

The $4.10 plan comes from the owner's existing **$5 authorization**. Two earlier local validation calls were estimated at **$0.05384**, leaving about **$4.94616** before hosted use. This setup does not authorize an additional $5. Keep further local paid calls within the same remaining budget; local and hosted ledgers do not automatically reconcile with one another.

The October 12 beverage lesson comparison permanently reserved **$0.41** in a separate local two-slot ledger. Its two completed calls cost an estimated **$0.057705**. Keep the full reservation in the budget accounting: **$4.10 + $0.05384 + $0.41 = $4.56384 allocated**, leaving **$0.43616 unallocated**. Hosted slots are unchanged. Do not recreate this test ledger or assign a new batch to obtain unaccounted calls. See the [protocol and receipts summary](../evaluation/lesson-comparison-v1/README.md).

The first hosted verification consumed one slot and an estimated **$0.0266275** in model usage. At that checkpoint, 19 hosted slots remained. These are historical checkpoint figures, not a live balance.

Keep the same private Blob store and the global namespace `eventbrief/v1/visitors/global-paid-allowance-v1/paid/`. Do not rename it, delete reservations, or connect an empty store to replenish the plan. The sealed plan includes request-envelope hashes, model, schema, rates, and limits. Changes to prompts, model, schema, or pricing require a deliberate plan migration preserving consumed reservations and the approved remaining budget. A mismatched plan keeps AI off until checked.

## Check before sharing

Guest quote, kitchen, staff, and guest-plan PDF downloads use the same saved-data and workspace checks as reviews. The endpoints accept only event/run identifiers, a review sequence, and a document revision, then build their own audience-filtered HTML. They reject blocked or superseded documents and recheck for changes after rendering. They do not accept arbitrary HTML, quantities or URLs. The PDF engine runs with page scripts disabled and network requests blocked; fonts are embedded from pinned local packages. Vercel includes Chromium and those fonts in the function bundle. Local development uses an installed Edge or Chrome. PDF generation does not call AI or consume AI preparations.

Kitchen prep rules are separate from the extraction profile so this format update preserves saved AI receipts and the sealed paid-call allowance. The computed prep plan is included in the kitchen document revision; changing prep rules invalidates old kitchen review marks. It does not change unrelated document revisions or discard saved coordinator corrections.

Run `npm test`, `npm run build`, and `npm run check:public`. Automated tests use fake providers; they do not spend the AI allowance.

On the deployed site:

1. Open a fresh browser. The live demo and five example choices must appear without a code.
2. Use a new example and prepare its drafts. Compare all five with the listed checks. The allergy example intentionally blocks three drafts.
3. Change a count in **Edit event details** and confirm the affected drafts update without an AI call.
4. Mark a draft reviewed and refresh; confirm it stays saved.
5. Open another browser without a code and confirm the shared synthetic events and remaining allowance match.
6. Verify the existing allowance survives deployment. Offline tests also prove exhaustion blocks new AI while saved results remain usable.

The repository intentionally has no license at the owner's request.
