# Developer handoff

This is the standalone synthetic EventBrief capstone. The application is local and must remain independent of the living restaurant system.

## Run and check

```sh
npm start
npm test
npm run check:fixtures
npm run eval:self-check
npm run eval:package:self-check
node scripts/public-check.mjs
```

The main workspace is `/package`. See [setup](docs/SETUP.md), [product rules](PRODUCT.md), and [reuse provenance](docs/ATTRIBUTION.md).

The [October 12 validation note](docs/VALIDATION-2026-10-12.md) records the completed authored and actual-AI reply workflows, export checks, bounded visual review, and measured token usage. Subsequent changes need their own verification; the note is evidence of that run, not a permanent guarantee.

## Preserve these boundaries

- Do not add customer records, production credentials, database clients, or sending routes.
- Preserve original AI receipts and failures. Corrections are separate reviewer decisions.
- Do not reset spending records or count unknown outcomes as free.
- Do not silently substitute authored examples for failed AI requests.
- Keep frozen evaluation inputs/expectations separate from model requests.
- Preserve the historical readiness policy when reproducing old evaluation reports.
- Do not commit `out/`, `.env.local`, browser state, private operational notes, or copied source-project history.
- Before publication, export the allowlisted working tree and review the manifest. The development repository's Git history is not the public submission package.

## Verification boundary

Run the current tests for the current count; documentation does not pin a stale total. Fake-provider tests exercise application behavior without spending. Recorded model results describe their exact dataset, prompt, model, and policy, and are not independent real-world accuracy estimates.

Local historical handoff notes, receipts, screenshot evidence, and spending ledgers are preserved outside the public source tree under ignored `out/`. A clean public checkout starts with synthetic examples and no user progress.

No remote push, deployment, customer message, calendar write, or live booking is part of this repository's setup or test commands.
