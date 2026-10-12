# Calendar and asset workspace validation — October 12, 2026

This change adds an event board, calendar, four document libraries, audience-specific document layouts, and a calendar import file. It reuses the existing saved record, review storage, quote calculations and internal document templates.

## Automated checks

`node --test tests/*.test.mjs`: **161 passed, 0 failed, 0 skipped**.

Coverage includes:

- Calendar month grouping, incomplete schedules and undated events.
- UTC export in winter and summer; rejection of ambiguous or nonexistent clock-change times.
- Calendar text escaping, CRLF injection resistance, Unicode line folding and stable event identity.
- Board stages derived from preparation and current review state, with stale quotes suppressed.
- Quote arithmetic, audience separation, escaped document content and blocked-draft labels.
- Corrected dates in shared summaries, document revision changes and fresh review requirements.
- Two private clients seeing the same corrected event; pending new messages clearing obsolete summaries.
- Existing source-history, allowance, shared-workspace, authentication and public-sample isolation checks.

Provider tests use fake transports or authored data. This work made no paid model requests.

## Browser checks

An isolated local workspace used the authored Alex Morgan event: November 14, 2027, 6–9 PM, Garden Patio, 30 Guests, no children, Menu 2, beer and wine, no dietary restrictions. The fictional quote totals $2,280.

- Opened the board and calendar; changed months using the month picker and navigation arrows.
- Opened each of the four document libraries and its matching draft.
- Downloaded all five files through the UI. Checked the actual calendar file's UTC times and tentative status and the downloaded quote's total and audience boundary.
- Marked the quote reviewed, reopened the workspace, and confirmed that review survived.
- Inspected the desktop board against the owner's screenshot: white columns, thin card borders, stage markers and compact metadata.
- Checked the 390-pixel calendar agenda and horizontally scrolling board/navigation, then restored the browser viewport.
- Invoked the guarded browser print action. Automated control could not inspect Chrome's native print preview; the standalone HTML layout and print styles remain available for a human print check. This does not claim a verified printer or PDF output.

## Limits

The calendar is a workspace view with manual `.ics` import, not external-calendar synchronization. HTML downloads and browser printing supply documents; no email, reservation, invoice, payment, account role or production service was added. Kitchen production quantities and course times are not inferred from attendance. The existing Yannis application was inspected as source material only.
