# Simple setup

## Run without an API key

1. Install Node.js 24.
2. Open a terminal in the EventBrief folder.
3. Run `npm install`, then `npm start`.
4. Open [EventBrief](http://127.0.0.1:3135/package).
5. Choose **New event**, then **Try the full workflow · free example**.
6. Open **Add a reply**, choose **Fill with the sample reply**, then **Update drafts**.
7. Check the updated drafts and mark each one reviewed.

Saved examples are authored demonstrations, clearly labeled in the app. They do not prove that a model extracted the facts. The guided workflow recognizes one exact sample conversation and reply. Editing that text or supplying a new conversation requires real AI. You can review and correct saved results without spending money.

The server listens only on your computer. Keep the terminal running while you use the app. Press **Ctrl+C** to stop it. If port 3135 is already occupied, stop the other copy of EventBrief or set `PORT` in your local configuration.

There is one direct package dependency, `@vercel/blob`, for hosted storage. Local examples do not need a Vercel account or cloud credentials.

## Use the hosted demo

Open [eventbrief-capstone.vercel.app](https://eventbrief-capstone.vercel.app). The public sample and access-code AI workflow are deployed.

1. Click **Try a sample**. No code is needed.
2. Open a blocked draft to see the missing detail.
3. Click **Add a reply**, **Fill with the sample reply**, then **Update drafts**.
4. Check the five drafts and mark them reviewed.

For real AI, enter the privately supplied **Access code**, then click **Unlock AI**. Choose **New event**, paste fictional messages, and click **Prepare five drafts**. **Lock AI** turns off paid generation for this browser without removing saved work. The code unlock lasts 12 hours.

The public sample uses written results. Real AI requires the access code and available allowance. If AI is off or the limit is reached, the sample and saved drafts remain usable. Hosting setup is in [HOSTING.md](HOSTING.md).

## Enable real AI locally

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

On your computer, completed conversations, AI receipts, source versions, corrections, and review marks are stored under `out/`. Browser storage remembers the current selection and unfinished message text.

On the hosted demo, completed work is stored privately in Blob storage and stays associated with this browser for up to 30 days through a signed cookie. Keep using the same browser to return to it. Redeploying the app does not remove the records. Clearing the cookie or letting it expire loses access; it does not automatically delete the stored records. There is no account, cross-device recovery, or progress transfer between local and hosted versions.

- **Download draft:** printable HTML for that audience.
- **Download review package:** internal JSON containing sources, original facts, corrections, and review marks.

The internal package is useful for inspection, but importing it back into the application is not implemented. Downloads are optional for continuing the workflow.

## If something stops

- **Missing information:** read the reason shown on the blocked draft. Do not mark it reviewed until the required information is resolved.
- **Allowance exhausted:** saved results and offline examples remain available. Do not delete the ledger to bypass the limit.
- **AI request failed:** inspect the displayed failure. The app does not replace a failed response with a saved example or automatically retry it.
- **Save failed:** keep the page open and follow the displayed message. Avoid making conflicting edits in two tabs.

For a clean engineering check, run `npm test`. The tests use fake providers and temporary storage; they make no paid requests.
