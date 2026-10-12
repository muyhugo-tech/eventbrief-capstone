# EventBrief assets

Open [EventBrief](https://eventbrief-capstone.vercel.app/). One saved event supplies the calendar entry, guest quote, kitchen sheet, staff event plan, and guest event plan.

## Start here

1. Open **Public sample & private workspace**.
2. Choose **Try a sample**, or enter your access code to open the private workspace.
3. Open an event. For a new event, choose **New event**, paste fictional event messages, and click **Prepare five drafts**.
4. Open each draft. Check the details, then click **Mark this draft reviewed**.
5. Download or print the draft when you want a copy.

The public sample uses written example results and makes no AI call. Real AI is available in the private workspace when it is configured and allowance remains. Opening saved results does not require another AI call.

## Find the right asset

| Sidebar item | What to check | What you can keep |
| --- | --- | --- |
| **Calendar** | Date, start and end times, restaurant timezone, and venue. | A calendar `.ics` file. |
| **Guest quotes** | Guests, Children (0–12), menu, drinks, itemized prices, and draft total. | A standalone HTML draft, or a printed/PDF copy. |
| **Kitchen sheets** | Attendance, menu courses, and allergy or dietary information. | A standalone HTML sheet, or a printed/PDF copy. |
| **Staff event plans** | Schedule, setup, equipment, service details, and internal team instructions. | A standalone HTML plan, or a printed/PDF copy. |
| **Guest event plans** | Schedule, venue, menu, drinks, and arrival instructions for the host. | A standalone HTML plan, or a printed/PDF copy. |

Each asset list opens the matching draft for that event. A draft marked **Needs details** opens its missing-information explanation. It cannot be downloaded or printed as a completed draft until those details are resolved.

The kitchen sheet does not invent course times or production quantities. Those are not supplied by the current event record. Confirm them with the event team before service.

## Download or print

- **Download reviewed draft** saves an HTML file for a document. Open the file in a browser to present it or print it. An unreviewed download is labeled **Draft · not reviewed**.
- **Print / Save PDF** opens the browser's print window for the selected draft. Choose a printer or **Save as PDF**.
- **Download calendar file (.ics)** saves a tentative calendar entry. Open that file in your calendar app to import it yourself. EventBrief does not connect to or synchronize an external calendar. Importing is not a reservation or invitation.

Calendar files remain tentative even after review. Their times use the event's restaurant timezone, and their description retains the draft and fictional-data labels.

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

Use **Add a reply** for a new message. Use **Event record & source conversation** to inspect evidence or make a correction with a reason. Changed details can require fresh review of the affected drafts. Earlier versions remain available for comparison; review and individual-asset downloads use the current version.

If another browser has changed the saved review, EventBrief opens the latest version before letting you continue reviewing, printing, or downloading. Check that version first.

## Where progress lives

The access code opens one shared private cloud workspace. Use the same code in another browser to see its saved events, corrections, and review progress. Open a sidebar workspace again to refresh its saved listing; this is not a live collaborative editor.

The public sample area is separate and belongs to that browser's visitor session. Locking the private workspace returns to the public sample; it does not copy private events into the sample area. In the local development app, progress stays in local storage files on that computer.

Quote, kitchen, staff, and guest outputs all come from the same event record. Guest-facing documents omit internal staff notes. Individual dietary details stay in the kitchen and staff outputs. A host-raised dietary question can still block the guest event plan until resolved; that does not put private dietary details into the guest handout.

All event data and restaurant prices in this capstone are fictional. The live Yannis application is not connected to this workflow.
