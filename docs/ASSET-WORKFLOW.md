# EventBrief assets

Open [EventBrief](https://eventbrief-capstone.vercel.app/). One saved event supplies the calendar entry, guest quote, kitchen sheet, staff event plan, and guest event plan.

## Start here

1. Open the public site. A first-time visit opens a complete sample event automatically; no sign-in is needed.
2. Choose **Open sample event** to return to that sample, or **Try a missing-detail example** to practise resolving a block. The optional **Owner access** panel opens the private workspace with its access code.
3. Open an event. For a new event, choose **New event**, paste fictional event messages, and click **Prepare five drafts**.
4. Open each draft. Check the details, then click **Mark this draft reviewed**.
5. Download or print the draft when you want a copy.

The public sample uses written example results and makes no AI call. Real AI is available in the private workspace when it is configured and allowance remains. Opening saved results does not require another AI call.

## See where the details came from

1. Click **Inbox** in the sidebar.
2. Choose a conversation. The original messages appear beside the current event details.
3. Open a detail and click **See source** to highlight its exact quotation. A coordinator change shows its reason and original value separately.
4. Open any of the five assets at the top. Each field also links to the drafts that use or check it.

**Add conversation** saves pasted fictional messages without calling AI. **Add a reply** appends a message to the selected event. When a new source still needs preparation, the inbox shows **Needs preparation** and does not present older details or assets as current. **Prepare five drafts** uses the existing AI allowance in the private workspace. Authored sample results are labeled as written examples.

Use **Refresh inbox** to load changes saved from another browser. Search covers names and source message text; the filter separates messages awaiting preparation, missing details, and prepared drafts. The inbox is an intake and evidence view for pasted conversations and replies. It is not connected to Gmail, Outlook, or a live email account, and it does not invent received dates or unread counts.

## Find the right asset

| Sidebar item | What to check | What you can keep |
| --- | --- | --- |
| **Calendar** | Date, start and end times, restaurant timezone, and venue. | A calendar `.ics` file. |
| **Guest quotes** | Guests, Children (0–12), menu, drinks, itemized prices, and estimated total. | A direct PDF download or printed copy. |
| **Kitchen sheets** | Attendance, dishes, prep quantities, and allergy or dietary information. | A direct PDF download or printed checklist. |
| **Staff event plans** | Event summary, pricing, schedule, food/drinks, allergies, setup, and internal team instructions. | A direct staff execution PDF or printed copy. |
| **Guest event plans** | Schedule, venue, menu, drinks, and arrival instructions for the host. | A direct PDF download or printed copy. |

Each asset list opens the matching draft for that event. A draft marked **Needs details** opens its missing-information explanation. It cannot be downloaded or printed as a completed draft until those details are resolved.

The kitchen sheet uses the fictional Menu 2 prep guide in `lib/kitchen-prep.mjs`: one salad bowl, squash tray and chicken platter per ten people, rounded up, plus one dessert per person. Guests and children each count as one person for these demo quantities. The guide is printed on the sheet. It is a capstone assumption, not a tested production recipe. A different menu without a prep guide shows **Confirm** in the quantity cells. Course serve times are not inferred from event start time.

## Download or print

- **Download PDF** on a guest quote saves the presented estimate directly as a PDF. The preview and PDF use one EventBrief template, including the current prices and review status. No AI call or email delivery occurs. A normal estimate fits one Letter page; longer content can continue onto more pages.
- **Download PDF** on a kitchen sheet saves the presented prep checklist, including quantities, allergy details, empty **Prepped** and **Checked** cells, and space for handwritten notes. Saved attendance changes recalculate the demo quantities and clear the affected review. Downloads are snapshots; download a fresh PDF after changes.
- **Download PDF** on a staff plan saves the presented execution sheet. Its pricing comes from the current ready guest quote; if pricing is blocked, the sheet asks for confirmation instead of displaying an old total. Saved changes update the staff sheet and clear an affected review.
- **Download PDF** on a guest plan saves a welcoming event summary: a thank-you, saved event details, menu and drinks, arrival notes, and an invitation to request last-minute changes. Staff notes, individual dietary details and prices stay out. An unreviewed copy is labeled **Draft · not reviewed**.
- **Print / Save PDF** opens the browser's print window for the selected draft. Choose a printer or **Save as PDF**.
- **Download calendar file (.ics)** saves a tentative calendar entry. Open that file in your calendar app to import it yourself. EventBrief does not connect to or synchronize an external calendar. Importing is not a reservation or invitation.

Calendar files remain tentative even after review. Their times use the event's restaurant timezone, and their description retains the draft and fictional-data labels.

The staff timeline shows the saved event start and end. Separate course times and a named coordinator are not fields in the current extraction contract; the sheet asks the team to confirm them. Add confirmed operational instructions through **Edit event details → Internal staff notes**. These notes print exactly as saved under **Team instructions**; they are not parsed into new timeline rows or a coordinator assignment. Check any times written in notes after changing the main event schedule. The photo supplies the layout, not its operational facts, service fees or payment instructions.

Guest plans use the current saved arrangements without declaring a booking confirmed. Change **Edit event details → Guest instructions** to update their arrival notes. Changed guest details clear the guest review; internal-only staff edits do not. A downloaded file remains a snapshot, so download again after an update. The existing host-raised dietary rule still blocks a guest plan until that detail is resolved.

**Download review package** is different: it saves the full internal review record, including source messages, corrections, staff notes, and review marks. Use an individual draft download for its intended audience.

## The event board

**Events** offers **Board** and **List** views. Search by event name or click a card to open its current event. The board moves cards according to saved work:

| Column | Meaning |
| --- | --- |
| Messages | Messages are saved, or a new reply still needs preparation. |
| Needs details | At least one of the five drafts is blocked. |
| Ready to review | All five drafts are ready; none has been marked reviewed. |
| In review | Some drafts have been reviewed and others remain. |
| Reviewed | All five current drafts have been marked reviewed. |

These are review stages. They do not represent sales, payments, reservations, or confirmed bookings. Cards are not dragged into a later stage; their saved readiness and review marks determine the stage.

The calendar opens near a saved event date. Use the month arrows, **Today**, or the month picker to change the view. Events without a usable date stay under **Date needed**. On a narrow screen, the calendar becomes a dated list.

## Make a change

Blocked drafts now include **Fix this detail**. This opens the relevant field in **Edit event details**. Type the confirmed value, add a short explanation, and save. The app resolves old questions and pending requests for that confirmed field, rebuilds the affected drafts, and clears their old review marks. The original messages, extracted values, and questions remain preserved for comparison.

For a custom dietary, setup, AV, or special arrangement, select **I checked this custom arrangement with the event team** after confirming it. This is an event-specific coordinator decision; it does not change restaurant policy. Unknown prices, unsupported venues, invalid dates, inconsistent totals, and capacity or service-hour conflicts still need valid details. A correction can be saved even if another issue keeps the draft blocked.

**Remember a lesson for future drafts** is optional. Write a general interpretation lesson, not another event's facts. The five newest enabled lessons from the same workspace are included as bounded context in the next AI request. Saving makes no model call and does not train or fine-tune the model. The request receipt preserves the exact lessons sent. The [first paired beverage test](../evaluation/lesson-comparison-v1/README.md) did not resolve its main failure; a saved lesson does not guarantee a better answer.

Open **Coordinator notes & AI lessons** to see the before/after details and explanation, or turn a lesson off. Review saves and browser refresh preserve this history. Public sample lessons stay separate from the shared private workspace. Coordinator notes and lessons are included only in the internal review export, never guest PDFs.

1. Open the event and click **Edit event details**.
2. Choose what changed and enter the new value. Enter **Guests** and **Children (0–12)** together; the total is calculated for you.
3. Add a note about what you checked or changed. Optionally write a lesson for future drafts.
4. Click **Save changes**. The saved event, calendar, and affected documents update together. Check the updated drafts again.

This makes no AI call. Changed drafts lose their old review marks; unchanged drafts keep theirs. The change is recorded separately from the original conversation. In the private workspace, the next browser to open the event sees the same saved details. An older edit cannot overwrite a newer save.

Use details you have confirmed. Restaurant rules still apply, and unresolved pricing or venue limits can block drafts. A confirmed correction resolves questions about that field in the working record; the original source request remains preserved. Use **Add a reply** when you want to capture a new message and prepare a new extraction. If you change a time, check any free-text guest instructions or staff notes that mention the old time; EventBrief does not rewrite those notes for you.

Use **Add a reply** for a new message. Use **Event record & source conversation** to inspect evidence or make an advanced correction with a reason and status. Earlier versions remain available for comparison; review and individual-asset downloads use the current version. Previously downloaded files and entries imported into another calendar do not update themselves; download a new copy after changing an event.

If another browser has changed the saved review, EventBrief opens the latest version before letting you continue reviewing, printing, or downloading. Check that version first.

## Where progress lives

The access code opens one shared private cloud workspace. Use the same code in another browser to see its saved events, corrections, and review progress. Open a sidebar workspace again to refresh its saved listing; this is not a live collaborative editor.

The public sample area is separate and belongs to that browser's visitor session. Locking the private workspace returns to the public sample; it does not copy private events into the sample area. In the local development app, progress stays in local storage files on that computer.

Quote, kitchen, staff, and guest outputs all come from the same event record. Guest-facing documents omit internal staff notes. Individual dietary details stay in the kitchen and staff outputs. A host-raised dietary question can still block the guest event plan until resolved; that does not put private dietary details into the guest handout.

All event data and restaurant prices in this capstone are fictional. The live Yannis application is not connected to this workflow.
