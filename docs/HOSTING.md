# Hosting EventBrief

The public app is live at [eventbrief-capstone.vercel.app](https://eventbrief-capstone.vercel.app). The deployed sample, saved reviews, visitor isolation, access gate, and one real AI preparation passed verification on October 12, 2026. See [the evidence](HOSTED-VALIDATION-2026-10-12.md). The separate Vercel project is linked only to `muyhugo-tech/eventbrief-capstone`, with `codex/capstone-submission` as its production branch.

Pushing to that branch automatically deploys EventBrief. A Git-triggered deployment was verified successfully, including saved review progress and the remaining AI allowance after redeployment.

## What visitors can do

- **Try a sample:** a public written example, including the missing-detail and reply workflow. No access code or model request.
- **Open private workspace:** enter the access code to see the same private events, saved AI results, and review progress in any browser. Everyone with the code shares this synthetic workspace. The browser receives a signed, HttpOnly cookie, never the API key.
- **Review and download:** inspect source evidence, correct details, mark drafts reviewed, and download them. Reopening saved drafts makes no model request.
- **Lock private workspace:** hide the shared events and return to this browser's separate public sample area. **Open public sample** also locks the private workspace before opening the example.

## Set up the separate project

1. Use a new Vercel project named `eventbrief-capstone` linked to this public repository. Do not reuse the Yannis project, secrets, database, or storage.
2. Create a **private** Vercel Blob store for EventBrief and connect it to this project. Keep the resulting `BLOB_READ_WRITE_TOKEN` server-side.
3. Add the environment settings below to the intended deployment environment.
4. Install packages with `npm install`. The only direct dependency is `@vercel/blob`. Vercel uses Node.js 24, `npm run build`, and the `dist` output directory from `vercel.json`.
5. Deploy, then run the checks below before giving out the link and private access code.

| Setting | Purpose |
| --- | --- |
| `EVENTBRIEF_PUBLIC_ORIGIN` | The exact HTTPS site origin, for example `https://eventbrief-capstone.vercel.app`, with no trailing slash |
| `EVENTBRIEF_ACCESS_CODE` | A private random code of at least 24 characters; share only with authorized AI testers |
| `EVENTBRIEF_SESSION_SECRET` | A separate random signing secret of at least 32 characters; keep stable across deployments |
| `EVENTBRIEF_OPENAI_API_KEY` | The separate capstone API key; never use the living restaurant system's key |
| `EVENTBRIEF_LIVE_ENABLED` | `true` to allow unlocked AI requests; `false` leaves the public sample available |
| `BLOB_READ_WRITE_TOKEN` | The token for this project's private Blob store |

Keep any local access-code handoff file under ignored `out/` or an ignored environment file. Never commit access codes, keys, session secrets, or Blob tokens. Hosting and storage usage follow the existing Vercel plan; they are not included in the AI allowance.

## How the hosted version reuses the app

`scripts/build-hosted.mjs` copies only an explicit static-file allowlist into `dist/`. It does not copy environment files or local saved work. `api/index.mjs` runs one Vercel function using `lib/hosted/handler.mjs` to adapt HTTPS requests to the existing server and event workflow.

The adapters add browser access, a small filesystem interface backed by private Blob storage, and a global paid-request allowance. The existing extraction, source validation, deterministic pricing, draft generation, source versions, and review logic remain shared with the local app. `npm start` still runs the local version with its local `out/` storage.

Build future features in the shared core or extend these adapters. A new dashboard or additional agent behavior does not require a second event engine.

## Saved progress

Each browser receives a signed visitor cookie lasting **30 days**. A private-workspace unlock cookie lasts **12 hours** and is tied to that visitor. Both are secure and HttpOnly. The access code itself is not saved in browser storage. Records survive redeployment.

Unlocked requests use the fixed private Blob namespace `eventbrief/v1/visitors/shared-private-workspace-v1/`. Entering the code in another browser reopens that same workspace. Locking, cookie expiry, code rotation, and session-secret rotation do not delete private records: unlock again with the current code. There are no individual accounts or roles; everyone with the code can read and edit all private demo events. Click **Events** to fetch the latest list from another browser; opening an event loads its latest saved review. This is refresh-based sharing, not live collaborative editing. Concurrent stale saves are rejected.

Locked requests continue to use the browser's original visitor-specific namespace. Existing browser events remain there; opening the private workspace does not copy or delete them. Public samples and their review marks are separate from the shared private events. Losing the visitor cookie loses access to that browser's samples, but not to the private workspace once unlocked again. There is no automatic transfer between these workspaces or between local and hosted runs.

The server chooses the namespace only after validating the cookie. Package mutations also declare the workspace the page displayed; a mismatch after locking, unlocking, or expiration rejects the request before writing. The interface reloads when switching workspaces and uses separate browser-storage keys for their selections and unfinished text.

Cookie expiry does **not** automatically delete saved Blob data. An administrator must manage retention separately. Keep the demo synthetic. Local and hosted workspaces are separate, and download/import recovery is not implemented.

## AI allowance

All hosted visitors share one persistent plan: **20 slots × $0.205 = $4.10** in conservative request reservations. A slot is permanently consumed before the model request. Failures, timeouts, and unknown outcomes do not refund it. There are no automatic retries or refills, and unlocking again or redeploying does not reset it.

The current model is `gpt-6.1-sol`, with bounded request size, 7,500 maximum output tokens, and fixed conservative price constants. These reservation limits are not a provider account-wide invoice cap. The provider's billing records remain the source for actual charges.

The $4.10 plan comes from the owner's existing **$5 authorization**. Two earlier local validation calls were estimated at **$0.05384**, leaving about **$4.94616** before hosted use. This setup does not authorize an additional $5. Keep further local paid calls within the same remaining budget; local and hosted ledgers do not automatically reconcile with one another.

The first hosted verification consumed one slot and an estimated **$0.0266275** in model usage. At that checkpoint, 19 hosted slots remained. These are historical checkpoint figures, not a live balance.

Keep the same private Blob store and the global namespace `eventbrief/v1/visitors/global-paid-allowance-v1/paid/`. Do not rename it, delete reservations, or connect an empty store to replenish the plan. The sealed plan includes request-envelope hashes, model, schema, rates, and limits. Changes to prompts, model, schema, or pricing require a deliberate plan migration preserving consumed reservations and the approved remaining budget. A mismatched plan keeps AI off until checked.

## Check before sharing

Run `npm test`, `npm run build`, and `npm run check:public`. Automated tests use fake providers; they do not spend the AI allowance.

On the deployed site:

1. Open a fresh browser session. Confirm **Try a sample** works while AI is locked.
2. Open a blocked draft, add the exact sample reply, and confirm all five drafts become ready.
3. Mark a draft reviewed and refresh. Confirm the review is still saved.
4. Confirm a different locked browser cannot see the first browser's samples or any private events. Unlock both browsers with the code and confirm their private events and reviews match.
5. Try a wrong access code, then the correct one. Lock the private workspace and confirm only this browser's samples remain visible. Unlock again and confirm private drafts return.
6. Confirm a redeployment preserves the same browser's progress and the spent AI slots. Any real model test consumes a slot from the existing budget.

The repository intentionally has no license at the owner's request.
