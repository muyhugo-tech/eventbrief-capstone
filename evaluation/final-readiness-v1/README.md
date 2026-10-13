# Final readiness check: three new conversations

**The app did not pass this final check.** One of three complete workflows matched the intended outcome. None passed every frozen check, because even the working event had a raw extraction omission. Seven of fifteen document checks passed. These are development-set observations, not general accuracy estimates.

All three fictional conversations and expected outcomes were [written down first](protocol.json). They ran once each against production commit `dcab9a6adf8f8ef4e832c3590e4156c7967be533`, without changing app code, prompt, model, restaurant settings or the three existing lessons between calls. There were no retries or coordinator corrections. [Original answers and scores](results/2026-10-13.json)

| Case | Expected | First attempt | What happened |
| --- | --- | --- | --- |
| Diego: changed count, no end | 26 guests, 0 children; 5–9 PM; five drafts; $1,664 | **Workflow passed: 5/5. Raw-count check failed.** | AI captured total 26 and children 0 but left the separate Guests field unknown. Existing code calculated 26 guests with provenance. All five assets worked without manual entry. |
| Priya: changed counts and explicit end | 16 guests, 3 children; 5:45–8:15 PM; five drafts; $1,300 | **Failed: 1/5** | Counts and explicit end were correct. Natural drink wording did not match the configured option. Staff also treated “Anniversary celebration” as an unsupported service request. |
| Jordan: missing allergy details | 26 guests, 2 children; 6–10 PM; calendar and $1,720 quote ready; kitchen/staff/guest blocked for allergy | **Failed: 1/5** | Drink matching blocked the quote unnecessarily. Kitchen/staff recognized the pending allergy. Guest plan missed the allergy dependency because the source label was “Jordan” while the extracted host was “Jordan Wells.” |

Jordan's guest PDF returned 409 because of drinks, **not because the allergy rule worked**. A separate offline diagnostic changed only the drink value in an in-memory copy to the configured option. The guest plan then incorrectly became ready with the same unanswered allergy. This diagnostic changed neither the hosted event nor its original answer and made no AI request.

## What was verified

- All three used the latest accepted attendance and correct schedule in the prepared record. Missing ends defaulted to four hours; Priya's explicit end won over that default.
- Source excerpts occurred in the supplied conversations. Manual review also checked their meanings; quote matching alone was not treated as semantic accuracy.
- Diego's quote, kitchen, staff and guest PDFs downloaded, had the correct content, and each fit one page. All four pages were rendered and inspected. Its tentative calendar file had the correct UTC times.
- All three calendar files worked. Priya's four PDFs and Jordan's four PDFs returned 409; no completed layouts existed for those blocked assets. Seven of twelve PDF endpoint results matched the expected status, but correct status alone did not prove the right blocking reason.
- Saved results reopened unchanged with no AI calls. Existing six events, corrections, review marks, restaurant settings and original receipts were retained. New drafts were left unreviewed.
- All **232 existing software tests passed** before the batch. Their passing result did not catch these new language and identity failures.

## Fix next, using these saved answers

1. **Guest allergy dependency:** recognize the host's source identity across first-name/full-name speaker labels. Keep restaurant-only questions and silence separate. Jordan must remain blocked for allergy even after drinks are resolved.
2. **Drink matching:** separate the configured drink option from its included instructions without relying on punctuation. Preserve juice/soda, alcohol restrictions and unrecognized additions; do not guess prices or silently drop text.
3. **Event purpose:** “Anniversary celebration” describes the event. It must not become a required custom service unless the source actually requests one. Preserve real unsupported requests for review.

Retain these first failures. Report future saved-answer repairs separately; do not rerun paid extraction just to obtain a better score. Any broader extraction-contract change needs its own frozen test and budget check.

## Cost and reproduction

Three AI requests, estimated **$0.0666375** using the existing conservative rates, not a billing statement. Slots **14 → 11**. The $0.615 maximum reservation comes from existing allocated slots; no new allocation or refill occurred. Combined allocations stay **$4.56384 within the $5 authorization**.

```sh
node scripts/check-final-readiness.mjs
```

This command reproduces the stored scores offline. Success means the report was reproduced, **not** that all three events passed.

**Confidence: high** in the observed outputs and identified failures. **Unknown** for broad real-world accuracy and time savings. This three-case set was authored and reviewed by the development assistant, not an independent evaluator. It is valid failure evidence and a repair checklist, not a readiness endorsement.
