# Hosted verification — October 12, 2026

Target: the independent EventBrief production site at `https://eventbrief-capstone.vercel.app`. Initial deployed code: `280d15c`. No Yannis production service, data store, or configuration was changed.

## Evidence

- 135 automated tests passed, including the existing local workflow and new hosted tests. Automated tests use fake providers.
- Public-source scanning found no flagged credentials, private paths, or customer data.
- A real private Blob test confirmed only one concurrent write can create an immutable file, a new adapter can read it, and another visitor cannot see it.
- The public site and sample API returned HTTP 200 without a Vercel login.
- The authored sample initially blocked kitchen, staff, and guest plans for the host-raised missing dietary detail. Adding the exact sample reply made all five drafts ready.
- Saved reviews reopened through new HTTP requests and in the browser after reload.
- A wrong code and a locked browser could not request AI. A different visitor could not access the tested visitor's conversation, review, or AI receipt.
- One real OpenAI request through the deployed Vercel function succeeded. It extracted Alex Morgan's November 14, 2027 event: 30 guests, 0 children, Garden Patio, Menu 2, 18:00–21:00 Los Angeles time, and the supplied no-allergies reply. All five drafts were ready for human review.
- Review persistence and locking were checked after the real result. Test-created review marks are verification data, not independent customer approval.
- The browser access-code form unlocked AI without another model call. The code was cleared from the form and was not stored in localStorage.
- The post-check Vercel error-log query returned no entries for the project in the checked 30-minute window.

## Real request usage

Model: `gpt-6.1-sol`. Receipt ID: `82160e84-056c-451b-a088-4681bf9c7b77`.

| Measure | Result |
| --- | ---: |
| Input tokens | 2,827 |
| Output tokens, including reasoning | 1,956 |
| Provider latency | 45,593 ms |
| Automatic retries | 0 |
| Conservative token-cost estimate | $0.0266275 |
| Hosted slots remaining after the test | 19 of 20 |

The estimate uses $2.50 per million input tokens and $10 per million output tokens, including cache-write input conservatively. It is not an invoice. The fixed hosted reservation was $0.205 for the consumed slot; it is not refunded. Together with the two earlier local calls estimated at $0.05384, measured model usage for those three calls totals about $0.08047.

## Limits of the result

This verifies deployment and one actual hosted extraction case. It does not establish broad model accuracy or production readiness. The prototype has browser-scoped workspaces, a shared tester access code, fictional event data, and no inbox/calendar integration or automatic sending. See [hosting](HOSTING.md) for cookie expiration, retention, spending limits, and future extension boundaries.
