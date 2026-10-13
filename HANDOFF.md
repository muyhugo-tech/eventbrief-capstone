# Developer handoff

This is the standalone synthetic EventBrief capstone. Local and hosted modes reuse the same workflow. Keep both independent of the living Yannis restaurant system.

The hosted app is live at `https://eventbrief-capstone.vercel.app`. Public sample, private reviews, access-code gating, and one real AI request passed deployed verification on October 12, 2026. GitHub's `codex/capstone-submission` branch is linked as the production branch of the separate `eventbrief-capstone` Vercel project. See [hosting](docs/HOSTING.md) and [deployment evidence](docs/HOSTED-VALIDATION-2026-10-12.md).

## Run and check

Current repair checkpoint, October 13: production app commit `d934c5c` (preceded by `775bd6d`), verified Vercel deployment `dpl_5MCrESyz2cZuoUoKgdNVwoc1jqM4`. `supported-details-v5` accepts supported drink instructions without punctuation and annotates bare event purposes; `host-raised-dietary-v2` recognizes unambiguous first-name hosts while separating unknown speakers, quoted text and sentence colons. Previous policies are retained. Diego/Priya/Jordan unchanged answers now pass **15/15 document checks, 3/3 intended workflows, 2/3 full frozen-check cases**. Diego's raw Guests omission remains. Jordan's quote/calendar work; all three dietary-dependent plans block for the actual allergy. Nine PDFs are one page and visually checked; three calendar files work; blocked exports return 409. Hosted records/reviews/receipts/settings were preserved, including Maya's five approvals. No event edits/review marks, **0 AI calls/$0, 11 slots remain**. Full suite: **240 passed**. `node scripts/replay-final-readiness.mjs` reproduces the repair and original failures. See [evidence](evaluation/final-readiness-v1/README.md), updated [scorecard](docs/EVALUATION-SCORECARD.md), and [video script](docs/CAPSTONE-DEMO-SCRIPT.md). Next: practise the video; independent unseen-event evaluation remains unproven. Preserve ignored `out/final-repair/` (before/after checks, PDFs and browser evidence).

The entries below are historical checkpoints; their remaining-slot counts and unresolved work describe those earlier stages.

Current October 13 checkpoint: [three-case final check](evaluation/final-readiness-v1/README.md), production app commit `dcab9a6`. PDF pagination is fixed and verified (Sofia quote/kitchen now one page, identical content; Diego four PDFs one page). Three new real calls, no retries/corrections or changes between calls: Diego workflow 5/5 but raw Guests omitted and derived correctly; Priya 1/5 due drink prefix without punctuation and anniversary purpose in `special`; Jordan 1/5 due drink wording, and **guest allergy dependency missing because source `Jordan` does not equal extracted `Jordan Wells`**. Offline isolation confirms guest incorrectly becomes ready when only beverage is made valid. Do not call the incidental drink block an allergy pass. Strict cases 0/3; intended workflows 1/3; document checks 7/15. Original outputs/protocol/scorer frozen, reproducible with `node scripts/check-final-readiness.mjs`. Estimated $0.0666375, **11 slots remain**, allocations unchanged. Next: fix these saved cases without another AI call, retain failures. Practice script: docs/CAPSTONE-DEMO-SCRIPT.md; update its evaluation speech after any repair. Existing events/reviews/settings/receipts retained. Ignored evidence: out/final-readiness-v1 and out/pdf-pagination. All 232 existing tests passed, which does not override these failures.

Latest test and fix: [Sofia new event](evaluation/new-event-v4/README.md). One actual AI call on `ee5fe8a` captured 32 guests + 2 children, 34 total, and raw missing end correctly; four-hour preparation yielded 5:45–9:45 PM. First attempt failed 1/5 because `Nonalcoholic service: juice and soda for everyone, no alcohol.` used a colon. `supported-details-v4` matches a whole configured option before punctuation and still validates all notes. Preserve v3 and the original failure. Saved answer now passes 5/5, $2,104, with zero corrections or further AI calls. Full suite: 232 passed; Lena/Noah and Alex defaults still pass. `node scripts/check-sofia-event.mjs` reproduces the failure; `node scripts/replay-sofia.mjs` checks the repair. Production `3d0c1b6` is verified: five live previews, four PDF downloads plus calendar, saved reopening, prior reviews/settings/receipt unchanged. Quote and kitchen footer spill to page 2; content is intact, but pagination remains formatting work. Preserve out/new-event-v4/. Estimated call cost $0.0217875; allowance **14 remaining**, total allocations unchanged at $4.56384. No reset or new allocation.

Current rule: [Four-hour default replay](evaluation/end-time-default-v1/README.md). The app uses `usable-drafts-v2`: when no end is specified, calculate start + four hours with explicit provenance. Source/coordinator end times take priority. Clearing the edit input restores the default; the automatic end input stays blank so changing the start does not accidentally pin the old end. Alex's untouched saved answer now produces **5/5 ready, 46 Guests, 5:30–9:30 PM, $2,944 provisional food estimate**, with zero new AI calls. Original answers, corrections and historical scores stay intact. The earlier `usable-drafts-v1` four-draft replay remains reproducible; older scorers use `strict-drafts-v1`. Restaurant-hours and same-day checks still apply. Production `1e41d1a` is verified: empty-correction saved replay 5/5, existing edits/reviews/settings/receipt preserved, four PDFs and calendar exported, browser instructions checked. Full suite: 229 passed. The allowance remains 15; no new AI calls. See evaluation/end-time-default-v1/results/hosted-2026-10-13.json; local evidence is in out/end-time-default/.

Latest build: [restaurant settings](evaluation/restaurant-settings-v1/README.md). Coordinators can edit spaces/capacity, menus/prices/allowed drinks, separately billed beverages and exact aliases. `lib/restaurant-settings.mjs` stores append-only revisions with stale-write protection; hosted settings use the existing private namespace at `restaurant-settings/`, while public samples retain the original profile. The extraction profile, request envelope and global paid ledger are unchanged. Saved receipts validate against the original profile, then prepare against current operational settings. Document review hashes retain unaffected reviews. `node scripts/replay-restaurant-settings.mjs` verifies Alex against explicit fictional rehearsal settings with zero new AI calls: configuration issues gone, ten unknown fields preserved, **0/5 ready** until missing details are confirmed. New menus use explicit manual kitchen-quantity placeholders. Full suite: **221 passing tests**.

Newest: [user-authored Alex rehearsal test](evaluation/new-event-v3/README.md), one call at `054f60cb043c9b276e93c44d0480d9d63bc80f71`. **Extraction and expected blocking passed; 0/5 completed documents.** It preserves the accepted 46 guests, Menu 3, à la carte/cash-bar terms and ten unknown fields. Current fictional profile has Menu 2, fixed drink packages and patio capacity 40, so every document correctly blocks; four PDF endpoints returned 409 and the calendar file function refused export. No app/profile/prompt changes, retries, corrections or saved lessons. Estimated $0.019585, one slot **16 → 15 remaining**, allocations unchanged at $4.56384. Keep `out/new-event-v3/` and frozen expectations. `node scripts/check-alex-rehearsal.mjs` reproduces this result without AI. Next product gap is explicit restaurant/menu/beverage configuration; do not rewrite this historical test to fit a later profile.

Latest app fix: [combined-drink fix and replay](evaluation/drink-matcher-v3/README.md), deployed app commit `731a35a96fafa025a6c8cc4278ba8889459b5e29`. `supported-details-v3` recognizes conjunctions between complete supported instructions and preserves exact notes. Lena and Noah original answers both pass **5/5 with no corrections** at **$1,420 / $1,776**. Hosted checks also passed: eight one-page PDFs, two calendar files, saved reload, existing corrections/reviews and other events retained. **215 software tests pass. Zero new AI calls for that replay; 16 preparations remained then; allocations stay $4.56384.** `node scripts/replay-drink-matcher.mjs` checks both current replays. Preserve ignored `out/drink-v3/`.

[Lena's original new-event test](evaluation/new-event-v2/README.md) remains a **first-attempt failure: 1/5 ready** under `supported-details-v2` at `e8a50828ef7fb9c95ca680823b3859117d6e2c1d`. The app rejected `Nonalcoholic service, with soda and juice for everybody and no alcohol`. That call cost an estimated $0.0266675 and used one existing slot (17 → 16). Preserve `out/new-event-v2/`, the frozen protocol, and v2 behavior. `node scripts/check-lena-event.mjs` reproduces the historical failure without AI. Do not replace original failures with later replay results.

The [new Noah event check](evaluation/new-event-v1/README.md) originally failed against `7a713eb`. Its [app-fix replay](evaluation/new-event-v1/APP-REPLAY.md) under `supported-details-v2` now yields 5/5 ready and $1,776, with exact juice-and-soda notes and no manual correction or new AI call. `supported-details-v1` remains frozen for historical reproduction. Run `node scripts/check-new-event.mjs` for the original failure/recovery and `node scripts/replay-noah.mjs` for the current fix. A separate explained coordinator edit restored the blank notes on the existing hosted event; prior corrections remain intact. Preserve ignored `out/new-event-v1/` and `out/noah-drink-fix/` evidence. The original call used one hosted slot (18 → 17 remaining), estimated $0.02701; the fix used zero, and combined allocations remain $4.56384.

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

Historical settings deployment `349d78b` was verified in production with Chrome and the in-app browser. Private settings revision 1 is the explicit fictional rehearsal example; public settings remain original. That settings-only test still blocked Alex's PDFs, before the subsequent workflow fixes. Preserve `out/settings-v1/` and its historical evidence. Do not infer zero children or attribute a default end time to the conversation. The coordinator now explicitly authorizes a four-hour duration default.

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
