# Beverage lesson comparison

October 12, 2026 (Pacific time). **The lesson did not resolve the beverage failure in this two-run test.** Both uncorrected outputs left the quote blocked. This is a development spot check on one new fictional conversation, separate from the twelve-case benchmark.

## Test and result

Elena requested **16 guests and 3 children**, Menu 2, and beer and wine with juice and soda for the children. The restaurant accepted. The expected saved drink option was **Beer and wine service**, with a fictional quote of **$1,300**: `16 × ($58 + $18) + 3 × ($22 + $6)`.

| Check | Without the lesson | With the lesson |
| --- | --- | --- |
| Valid record accepted | Passed | Passed |
| Exact supported drink option | **Failed** | **Failed** |
| Agreement and exact source evidence for drinks | Passed | Passed |
| Quote ready with expected total | **Failed — blocked** | **Failed — blocked** |
| Predeclared main test | **Failed** | **Failed** |
| Drafts ready for review | 1/5 — calendar only | 1/5 — calendar only |
| Separate guest and child counts | 16 and 3 | 16 and 3 |
| Total attendance | Missing | 19 |
| Table setup recognized by the app | Failed — lowercase wording | Passed |
| Internal note kept out of guest notes | Passed | Passed |

The beverage outputs were:

- **Without:** “Beer and wine service, with juice and soda for the children. No spirits or cocktails. Beer and wine will only be served to guests confirmed to be 21 or older.”
- **With:** “Beer and wine service; juice and soda for the children; no spirits or cocktails. Beer and wine only for guests confirmed to be 21 or older.”

Both identify the intended drink arrangement, but append supported notes to a field the application matches against an exact option name. That prevents pricing and blocks dependent drafts. Neither request produced a quote total; $1,300 is the predeclared expected result, not an actual generated quote.

The first run also omitted total attendance and returned `one long table`, while the profile expects `One long table`. The prompt prohibits calculated totals and the request vocabulary omits setup options, so these are extraction/application design gaps to investigate. The second run handled both, but one attempt per condition cannot establish that the beverage lesson caused those differences.

## Controls and evidence

The [protocol](protocol.json) fixed the conversation, lesson, expectations, order and budget before either request. The lesson was saved in an isolated local workspace using the existing feedback store. It was manually supplied from the earlier Maya correction, not learned automatically. No private event or public sample was changed.

Both calls used GPT-6.1 Sol, medium reasoning, the same current extraction prompt, restaurant profile and strict output schema, and a 7,500-token output allowance. The first had no lessons; the second loaded the one saved lesson. Request comparison verified that lesson context was the only difference. Expected answers were not sent. There was one attempt per condition, no retry and no coordinator correction to either scored output.

[Saved results](results/2026-10-12.json) include both original extracted records, checks, usage, latency, request hashes and receipt hashes. The local frozen plan and full provider receipts remain in ignored `out/beverage-lesson-pair/`. Failed checks were retained. Exact source quotation checks do not substitute for a full semantic review.

## Cost and conclusion

The calls used 5,822 input and 4,315 output tokens. At conservative rates of $2.50 per million input tokens and $10 per million output tokens, the estimate is **$0.057705**, about six cents. Provider request times were 42.290 and 39.966 seconds. These are usage estimates, not invoices or human task-time measurements. [Published model rates](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

The isolated local allowance permanently reserved two $0.205 slots, **$0.41** total. Keeping the existing hosted $4.10 reservation and earlier $0.05384 local estimate gives **$4.56384 allocated against the existing $5 budget**, leaving **$0.43616 unallocated**. Hosted slots were not consumed or reset by this local test; local and hosted ledgers require explicit reconciliation.

**Follow-up completed:** the app now separates supported drink notes, calculates a missing total from explicit categories, and accepts equivalent setup capitalization. A [separately recorded offline replay](APP-REPLAY.md) produced five ready drafts and $1,300 from each saved answer. The original results above remain unchanged and the lesson's original main test remains a failure.

**Confidence: high** in the observed failures. **Unknown** for the lesson’s general effectiveness. A single fixed-order pair cannot establish a dependable effect; the main failure occurred in both conditions. This follows the limited-comparison approach described in [OpenAI’s evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).
