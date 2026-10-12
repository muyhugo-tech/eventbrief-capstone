# Simple setup

## Run without an API key

1. Install Node.js 24 or newer.
2. Open a terminal in the EventBrief folder.
3. Run `npm start`.
4. Open [EventBrief](http://127.0.0.1:3135/package).
5. Choose **New event**, then **Try the full workflow · free example**.
6. Open **Add a reply**, choose **Fill with the sample reply**, then **Update drafts**.
7. Check the updated drafts and mark each one reviewed.

Saved examples are authored demonstrations, clearly labeled in the app. They do not prove that a model extracted the facts. The guided workflow recognizes one exact sample conversation and reply. Editing that text or supplying a new conversation requires real AI. You can review and correct saved results without spending money.

The server listens only on your computer. Keep the terminal running while you use the app. Press **Ctrl+C** to stop it. If port 3135 is already occupied, stop the other copy of EventBrief or set `PORT` in your local configuration.

## Enable real AI

1. Copy `.env.example` to `.env.local` in this folder.
2. Open `.env.local` in a text editor.
3. Put your separate API key after `EVENTBRIEF_OPENAI_API_KEY=`.
4. Change `EVENTBRIEF_LIVE_ENABLED=false` to `EVENTBRIEF_LIVE_ENABLED=true`.
5. Check the model, call count, and budget settings before starting.
6. Restart with `npm start`.

Never paste your key into the app, a conversation, a screenshot, or a Git commit. `.env.local` is ignored by Git and excluded from the public export. The browser receives no key.

Real AI processes the fictional messages you supply. Use **Prepare five drafts** only when you intend to make a paid request. Opening an existing saved result, editing a correction, reviewing a draft, or downloading it does not need another model call.

For an existing event, use **Add a reply** and **Update drafts**. A real-AI update also makes a paid request. It preserves the earlier conversation and results, creates the next source version, and requires a fresh review. If preparation fails, the new messages remain saved and pending; the earlier result does not become current again.

The default configuration permits a small persistent local allowance. Each attempt reserves its full conservative estimate, including failed or uncertain attempts. The allowance can run out before the nominal call count if messages are longer. Restarting does not refill it. Preserve the records in `out/`; deleting them destroys the spending and review history. Unknown outcomes pause new calls instead of assuming they were free.

If you explicitly choose an additional test budget after the first allowance, the commented `EVENTBRIEF_EXTENSION_BUDGET_CENTS` and `EVENTBRIEF_EXTENSION_MAX_CALLS` settings enable a separate persistent plan. For example, 100 cents and 8 calls authorizes up to one additional dollar of conservative reservations. Supported maximums are 500 cents and 30 calls. These are **additional** limits, not a reset of the original allowance; leave the settings commented out unless you intend to add that budget. Changing an existing sealed plan or restarting does not refill it.

The configured model and price constants are part of the recorded experiment. A different API account may not offer that model. Changing only the model name does not provide a validated new pricing allowance; adjust and verify the provider/allowance implementation before using another model.

## What is saved

Completed conversations, AI receipts, source versions, corrections, and review marks are stored locally under `out/`. Browser storage remembers the current selection and unfinished message text. There is no account or cloud sync. Another computer starts with the bundled examples.

- **Download draft:** printable HTML for that audience.
- **Download review package:** internal JSON containing sources, original facts, corrections, and review marks.

The internal package is useful for inspection, but importing it back into the application is not implemented. Downloads are optional for continuing the workflow.

## If something stops

- **Missing information:** read the reason shown on the blocked draft. Do not mark it reviewed until the required information is resolved.
- **Allowance exhausted:** saved results and offline examples remain available. Do not delete the ledger to bypass the limit.
- **AI request failed:** inspect the displayed failure. The app does not replace a failed response with a saved example or automatically retry it.
- **Save failed:** keep the page open and follow the displayed message. Avoid making conflicting edits in two tabs.

For a clean engineering check, run `npm test`. The tests use fake providers and temporary storage; they make no paid requests.
