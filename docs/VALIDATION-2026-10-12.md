# Workflow validation — October 12, 2026

The complete local workflow was checked with both an authored free example and two actual API responses. These checks establish the observed behavior of these synthetic examples, not independent model accuracy or production suitability.

## Actual model calls

The test used `gpt-6.1-sol` and the saved fictional conversation with a changed guest count. There were **two successful calls and no automatic retries**.

| Step | Observed result | Provider latency |
| --- | --- | --- |
| Prepare the conversation with the host's allergy information outstanding | Retained 22 Guests and 2 Children; quote $1,464. Calendar and quote ready; kitchen, staff, and guest plans blocked. | 40.351 seconds |
| Append the host's no-restrictions reply and update the same event | Preserved the original messages; resolved the dietary question; all five drafts ready with zero open questions and fresh document revisions. | 39.559 seconds |

The updated actual-AI result was left **unreviewed** for the user. The app producing five ready drafts is not a substitute for human review.

The saved responses reported 5,776 input tokens and 3,940 output tokens in total. Charging every input token at $2.50 per million and output at $10 per million gives a **conservative token-cost estimate of $0.05384**, using the [model's published rates](https://developers.openai.com/api/docs/models/gpt-6.1-sol). This is not a provider invoice. Latency is request time, not the complete human task time.

The verification checked that guest and quote exports excluded the internal staff note and that the staff export did not invent an event type. These are checks of the supplied fictional content, not proof of universal audience separation.

## Free example and application checks

The exact authored sample demonstrated the same missing-detail/reply flow without an API call. A guest-plan review mark survived refresh. Earlier source versions remained available for inspection while current-version controls prevented treating them as the latest drafts.

The recorded engineering run passed **111 automated checks**, the original fixture check passed **12 synthetic cases**, and the package scorer self-checks returned their predeclared **12/12 good** and **4/12 flawed** structural-case totals. Those self-check answers are authored test vectors, not model outputs. The separate frozen twelve-case model benchmark and its previous scores were not changed by this workflow test.

Desktop and mobile browser checks covered the working application. At the 390px mobile viewport, the measured document width was also 390px; no horizontal overflow was observed. A separate finish reviewer used Impeccable's supplied degraded review instructions with supplied desktop (909px) and mobile (390px) captures and returned **ship** with no material fixes in that scope. This is a bounded visual review, not independent usability research.

The design documentation pass used the supplied degraded documenter role instructions, inspected the shipped source, and reconciled the design files without changing runtime code. It recorded the existing code-led CRM adaptation rather than creating a new design direction.

## Evidence boundary

Original responses, request metadata, assertions, exported HTML, and screenshots remain in ignored local development evidence, including `out/workflow-qa/live-verification.json`. They are excluded from the public source package along with user state. This committed note reports those results; a clean public checkout does not contain the original private local receipt store.

No live restaurant service, database, customer record, inbox, booking, or outbound message was involved. The public code can reproduce the authored walkthrough and offline tests. Repeating the actual model calls requires a separately configured key and allowance and may produce different results.
