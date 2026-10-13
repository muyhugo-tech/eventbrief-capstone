# Developer handoff

This is the standalone synthetic EventBrief capstone. Local and hosted modes reuse the same workflow. Keep both independent of the living Yannis restaurant system.

The hosted app is live at `https://eventbrief-capstone.vercel.app`. Public sample, private reviews, access-code gating, and one real AI request passed deployed verification on October 12, 2026. GitHub's `codex/capstone-submission` branch is linked as the production branch of the separate `eventbrief-capstone` Vercel project. See [hosting](docs/HOSTING.md) and [deployment evidence](docs/HOSTED-VALIDATION-2026-10-12.md).

## Run and check

The [new Noah event check](evaluation/new-event-v1/README.md) exposed another beverage-matching failure against `7a713eb`: calendar ready, four documents blocked. One separately recorded coordinator correction yields 5/5 ready and $1,776, but the PDFs omit the specific juice-and-soda wording. No app/prompt change was made. Run `node scripts/check-new-event.mjs` offline to reproduce both stages. Keep this initial failure unchanged when implementing a future fix. One existing hosted slot was used (18 → 17 remaining), estimated $0.02701; combined allocations remain $4.56384. Preserve ignored `out/new-event-v1/` receipts, frozen expectations, exports and recovery evidence.

The beverage app fix has a [saved-answer replay](evaluation/lesson-comparison-v1/APP-REPLAY.md): both original failed answers now yield five ready drafts and $1,300 with no new AI calls. `lib/package-normalization.mjs` runs only after extraction/corrections and preserves originals. Keep its matching conservative. Drink notes live on the prepared/corrected beverage field, outside the unchanged model schema. The historical scorer uses `as-extracted-v1`; do not retroactively inflate the original scores. Current scorecard: [evaluation](docs/EVALUATION-SCORECARD.md).

```sh
npm install
npm start
npm run build
npm test
npm run check:fixtures
npm run eval:self-check
npm run eval:package:self-check
node scripts/public-check.mjs
```

The main workspace is `/package`. See [setup](docs/SETUP.md), [product rules](PRODUCT.md), and [reuse provenance](docs/ATTRIBUTION.md).

`scripts/build-hosted.mjs` copies the static allowlist to `dist/`. `api/index.mjs` is the single Vercel function. `lib/hosted/handler.mjs` adapts requests to the existing server; `access.mjs`, `blob-files.mjs`, and `allowance.mjs` supply browser access, private persistence, and the shared paid-request limit. `@vercel/blob` is the only direct dependency. Extend these boundaries instead of creating a second event engine.

The [October 12 validation note](docs/VALIDATION-2026-10-12.md) records the completed authored and actual-AI reply workflows, export checks, bounded visual review, and measured token usage. Subsequent changes need their own verification; the note is evidence of that run, not a permanent guarantee.

## Preserve these boundaries

- Do not add customer records, production credentials, database clients, or sending routes.
- Use only the independent EventBrief Vercel project and its private Blob store. Never import Yannis environment settings or attach its storage.
- Preserve original AI receipts and failures. Corrections are separate reviewer decisions.
- Do not reset spending records or count unknown outcomes as free.
- Hosted AI has 20 permanently reserved slots at $0.205 each: $4.10 maximum conservative reservations. The earlier $0.05384 estimate belongs to the same existing $5 authorization. Do not treat deployment as a new budget.
- The beverage lesson comparison adds a separate permanent $0.41 local reservation for two used slots (estimated usage $0.057705). Combined allocations are $4.56384, leaving $0.43616 unallocated; hosted slots stay unchanged. Preserve `out/beverage-lesson-pair/` and its failed results. See [comparison](evaluation/lesson-comparison-v1/README.md).
- Keep the hosted Blob store and global namespace `eventbrief/v1/visitors/global-paid-allowance-v1/paid/` fixed across deployments. Model, prompt, rates, schema, or plan changes require an explicit migration that preserves spent reservations. Do not delete or rename the ledger to refill it.
- Do not silently substitute authored examples for failed AI requests.
- Keep frozen evaluation inputs/expectations separate from model requests.
- Preserve the historical readiness policy when reproducing old evaluation reports.
- Do not commit `out/`, `.env.local`, browser state, private operational notes, or copied source-project history.
- Keep access-code files, session secrets, Blob tokens, and API keys outside Git. Keep the session secret stable to preserve browser access to saved work; rotating the access code revokes AI unlocks.
- Before publication, export the allowlisted working tree and review the manifest. The development repository's Git history is not the public submission package.

## Verification boundary

Run the current tests for the current count; documentation does not pin a stale total. Fake-provider tests exercise application behavior without spending. Recorded model results describe their exact dataset, prompt, model, and policy, and are not independent real-world accuracy estimates.

Local historical handoff notes, receipts, screenshot evidence, and spending ledgers are preserved outside the public source tree under ignored `out/`. A clean public checkout starts with synthetic examples and no user progress.

Hosted workspaces use signed, secure, HttpOnly cookies: the visitor identity lasts 30 days and AI unlock lasts 12 hours. Locking AI preserves the workspace. Clearing or losing the visitor cookie, letting it expire, or changing the session secret loses browser access; there is no account or cross-device recovery. Blob records are not automatically deleted at cookie expiry. Review that retention design before expanding beyond synthetic demonstrations.

No remote push, deployment, customer message, calendar write, or live booking is part of this repository's setup or test commands.

No publication license is included, by the owner's decision.
