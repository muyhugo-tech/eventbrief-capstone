# Beverage answer replay after app fixes

October 12, 2026 (Pacific time). **Both saved answers now produce five reviewable drafts and a $1,300 quote. No new AI requests or manual corrections were used for this replay.**

| Condition of the original answer | Before app fix | After app fix | Quote |
| --- | --- | --- | --- |
| Without lesson | 1/5 ready | 5/5 ready | $1,300 |
| With lesson | 1/5 ready | 5/5 ready | $1,300 |

The [original AI comparison](README.md) and [failed results](results/2026-10-12.json) are unchanged. The original predeclared main test still failed twice. This is application recovery on known failure examples, not a new extraction score or evidence that the lesson helped.

## What changed

- The app separates the exact saved drink option from a bounded set of included notes: children's juice/soda or nonalcoholic drinks, no spirits/cocktails, and the existing 21-or-older restriction. Every note clause must be recognized; premium drinks, price changes and unrecognized exceptions cannot silently receive the standard package price.
- A missing total can be calculated from explicit Guests and Children. It retains their certainty and source citations and is labeled as an app calculation. Missing categories, conflicting totals, unresolved count questions and deliberate coordinator clearing are not overwritten.
- Table setups can match by capitalization and spacing. No fuzzy or custom setup matching was added.
- Coordinators can edit the option and drink notes separately. The quote, staff and guest documents show those notes. A notes-only edit requires fresh review of those three documents. Calendar and kitchen reviews remain valid when their content is unchanged.

Original source messages and AI answers remain available in the record and Inbox. The model prompt, strict output schema, restaurant profile, prices, paid allowance and hosted workspace namespace did not change.

## Reproduce without AI

```sh
node scripts/replay-beverage-pair.mjs
node --test tests/package-normalization.test.mjs
```

The replay reads the frozen conversation and both public original outputs. It prepares each output under the previous and current app policies, with zero corrections. The [saved replay report](results/2026-10-12-app-replay.json) includes input/result and implementation hashes. `--write` creates that immutable report; it refuses to replace differing evidence. Historical twelve-case scoring explicitly keeps the old preparation behavior.

## Verification

The full software suite passed **207/207** sequentially, with no failures or skips. The targeted checks cover both saved outputs; unknown, requested and inconsistent attendance; venue capacity; unsupported beverage notes; equivalent table labels; preserved originals; audience separation; editable notes; review invalidation; saved reload; stale-edit rejection; and current PDF output. Existing fixture validation, evaluator self-check, build and public-source scanning passed.

An isolated local workspace opened the actual no-lesson receipt with AI disabled. In the browser, all five drafts were ready. A coordinator note edit updated three documents, retained the $1,300 price, survived reload, and downloaded a quote PDF containing the edited notes and age restriction. This separate UI exercise used a manual note edit; the scored replay above did not. It did not alter the hosted Maya or Alex events. Local evidence is in ignored `out/beverage-replay-proof/` and `out/normalization-tests.txt`.

**Confidence: high** in these reproducible outcomes. **Unknown** for general performance on unseen conversations or a benefit from saved lessons. A constrained matching rule does not replace human review.
