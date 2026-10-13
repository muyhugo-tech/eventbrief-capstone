---
name: EventBrief
description: A compact event workspace for preparing and reviewing five drafts.
colors:
  primary: "#275a48"
  primary-hover: "#194635"
  canvas: "#ffffff"
  navigation: "#f7f8f8"
  reading-well: "#fafbfb"
  ink: "#202927"
  muted: "#66706d"
  divider: "#e2e7e5"
  selected: "#e9efec"
  selected-draft: "#eaf1ed"
  warning: "#805113"
  warning-ground: "#fff1d5"
  blocked-ground: "#fff9ed"
  evidence: "#f5d37f"
  focus: "#397b63"
  stage-messages: "#77817b"
  stage-needs-details: "#b87512"
  stage-ready: "#3984ca"
  stage-reviewing: "#8364b2"
  stage-reviewed: "#23815c"
typography:
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    lineHeight: 1.55
  page-title:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  event-title:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 700
    letterSpacing: "-0.035em"
  supporting:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "0.75rem"
  draft-brand:
    fontFamily: "Georgia, serif"
    fontSize: "1.55rem"
rounded:
  compact: "4px"
  control: "6px"
  surface: "7px"
  paste-panel: "8px"
  event-card: "10px"
spacing:
  compact: "8px"
  group: "16px"
  section: "24px"
  canvas: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.surface}"
    padding: "9px 13px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "9px 13px"
  sidebar:
    backgroundColor: "{colors.navigation}"
    textColor: "{colors.ink}"
    width: "222px"
  draft-choice:
    backgroundColor: "{colors.selected-draft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 11px"
---

# Design System: EventBrief

## Overview

**Creative North Star: "A working event record"**

A quiet CRM shell puts the event, its current drafts, and the next action ahead of decoration. The event board, calendar, and four asset lists are views of the same saved event record. Pale navigation, compact controls, thin dividers, and white reading surfaces carry the workspace. The coordinator can open source evidence without losing the current draft.

The owner supplied a CRM board screenshot, the [AI CRM dashboard reference](https://21st.dev/@larsen66/templates/ai-crm-dashboard), and [opportunities preview](https://21st-crm.vercel.app/opportunities). This is a code-led visual adaptation, not copied template source. No paid template was purchased or downloaded. Existing Yanni's sidebar SVG geometry, event-list count behavior, and EventBrief's evidence interaction remain part of the implemented system. [Attribution](docs/ATTRIBUTION.md) records the reuse boundary.

This system describes the event workspace at the [public demo](https://eventbrief-capstone.vercel.app/) and its `/package` route. The older three-field extraction page and the copied printable document templates have their own retained styles; their values do not become dashboard defaults.

**Key Characteristics:**

- Pale navigation and white reading surfaces
- Thin dividers with gently rounded controls
- Written readiness and review states
- Source-linked facts
- Simple next actions

## Reference lock and decisions

The owner's screenshot governs the dashboard composition. It supplies five white columns, concise cards, small outlined stage markers, numeric count pills, fine gray borders, and horizontal scrolling. Yanni's event calendar and quote pages supply functional patterns for finding an event and producing a usable asset. They do not replace the screenshot's dashboard styling.

| Decision | Reference and purpose | Implemented boundary |
| --- | --- | --- |
| Five-column event board | Owner's CRM screenshot; show progress at a glance. | Columns are Messages, Needs details, Ready to review, In review, and Reviewed. Their positions come from saved readiness and review counts; no drag action invents progress. |
| Concise event cards | Screenshot's title and short metadata rows. | Cards show supplied venue, date, Guests, Children (0–12), a ready quote's draft total, and links to four document drafts. Missing values are labeled. |
| Outlined stage markers and count pills | Screenshot's compact column headers. | Color is paired with a written stage. Counts describe events in the current filtered view. |
| White surfaces and fine outlines | Screenshot's quiet column and card treatment. | Cards have a restrained one-pixel shadow; other workspace panels retain fills and borders. Five columns scroll horizontally when needed. |
| Month calendar with a narrow-screen agenda | Yanni's event calendar behavior. | Entries open the saved event's calendar draft. Undated events remain visible. No reservation or external calendar connection is created. |
| Dedicated asset lists | Yanni's event-to-document and quote workflows. | Each row opens the selected event's guest quote, kitchen sheet, staff plan, or guest plan, with its saved readiness and review state. |
| Itemized quote and clear total | Yanni's quote preview and printable document pattern. | EventBrief's fictional prices and deterministic cents calculation remain authoritative. No production commercial terms are copied. |
| Useful print outputs | Existing kitchen and event-order builders, plus the owner's quote PDF. | The original kitchen and staff HTML builders provide reference patterns; current quotes, kitchen sheets, and staff plans use shared preview/PDF templates with audience filters. |

The UI uses ordinary words and visible actions: **New event**, **Prepare five drafts**, **Mark this draft reviewed**, and **Download reviewed draft**. It does not present a board stage as a booking status. Exact controls and current boundaries are recorded in [the asset workflow](docs/ASSET-WORKFLOW.md).

## Colors

Forest green identifies the primary action; amber and warm yellow distinguish unresolved details and cited source text. Blue, purple, and green stage markers distinguish review progress on the event board. Quiet neutral tones carry the rest of the workspace.

### Primary

The primary and hover greens belong to preparation actions, supported by a related green focus outline. Green does not replace written state labels.

### Secondary

Warning text and its pale ground mark blocked or unreviewed material. Source evidence uses a separate yellow highlight so a citation cannot be mistaken for a readiness state.

### Neutral

Canvas white carries the main workspace. Navigation and reading-well neutrals separate the rail, messages, and draft selector. Ink, muted text, and dividers establish hierarchy without shadows.

**The Written State Rule.** Always pair state color with its visible state text.

## Typography

**Body Font:** Segoe UI, Arial, sans-serif. The native UI stack keeps the local demo self-contained. Page and event headings are interface hierarchy, not display typography. The restaurant name within document previews retains Georgia; it is not a dashboard heading face.

### Hierarchy

- **Page title:** compact semibold interface heading, with the size and tracking recorded in the frontmatter.
- **Event title:** stronger heading identifying the selected event; it reduces to 1.23rem below the mobile breakpoint.
- **Body:** 16px base; paragraphs use 1.55 line height. Source-message text uses .96rem and 1.8 line height for reading.
- **Controls and labels:** mostly .75–.88rem. Supporting text stays sentence case. Tabular numbers are used for counts and quote amounts.
- **Draft brand:** the serif restaurant name belongs inside the document preview.

## Layout

The desktop workspace has a fixed pale sidebar and an independently scrolling main document. The rail is 222px wide, narrowing to 196px at 1100px. The main surface uses 32px horizontal padding, 24px in the compact layout, and 46px above 1600px. Its maximum width is 1800px.

The event board uses five columns with a 236px minimum and 20px gaps. The board owns horizontal overflow. Below 800px, columns use a 250px minimum or 78vw width with 14px gaps so the next column remains reachable. The **List** option retains the compact event-table view. Asset lists use event details, state, and one action per row; below 800px, the event details span the row.

The calendar uses a seven-day month grid with month navigation and a picker. Below 700px it switches to a dated agenda. Events without usable dates occupy a separate **Date needed** section.

The draft selector and preview use a 190px/minmax grid, narrowing the selector to 165px at 1100px. Source messages and the shared record use two reading columns inside a disclosure. Document text is bounded to 78ch; source-message bodies to 70ch.

At 800px and below, the rail becomes a top row, the recent list hides, controls stack, draft choices wrap, and the source/record panes become one column. Main padding becomes 18px. Event-table rows become labeled stacked blocks rather than forcing horizontal scrolling. The primary preparation button fills the available width.

## Elevation & Depth

The workspace uses tonal separation and single-pixel borders. Event cards add only the subtle one-pixel shadow from the screenshot reference. Selection adds a pale fill and a border. A focused control receives a visible green outline with an offset. An active source excerpt receives a warm highlight and outline; this is an evidence state rather than elevation.

**The Quiet Workspace Rule.** Use existing fills, borders, and focus treatment to distinguish states. Do not expand the event card's slight separation into heavy shadows or decorative elevation across the app.

## Shapes

Controls use modest rounding. The primary buttons and main surfaces follow the surface radius; draft choices and text fields follow the control radius. Small labels use the compact radius. The paste panel and event cards have their own radii. Navigation icons are inline SVG with a consistent 1.7 stroke; status dots accompany text and are not standalone controls.

## Components

### Buttons

Primary actions use the green fill and white text. Secondary actions use white, a divider-colored border, and ink text. Primary buttons are at least 38px tall. Small review buttons keep their separate 34px minimum. Hover changes fill/border; keyboard focus uses the common visible outline. Disabled controls lower opacity and use a not-allowed cursor.

### Inputs and fields

Search, selects, and reply fields are white with thin muted green-gray borders. Labels remain visible. Textareas resize vertically. The reply form has a separator from the existing event summary so new input does not resemble an already accepted fact.

### Navigation and draft choices

The selected navigation row has a pale green fill and a written label. The sidebar exposes Events, Calendar, Guest quotes, Kitchen sheets, Staff event plans, Guest event plans, and New event. Recent events truncate long titles while keeping the event state visible. Draft choices show a title and one explicit readiness/review line. Below the mobile breakpoint they wrap into multiple rows.

### Labels and reading surfaces

Source mode, local-demo status, and draft review labels are small contextual tags. Draft and message surfaces are bordered reading areas, not decorative metric cards. Preparation details, source records, policy, history, and internal export remain disclosures.

### Asset previews and copies

The guest event sheet builds on the staff sheet's white paper, centered restaurant name, thin gray table rules, and clear section hierarchy. The owner's request supplies its warmer voice: thank the host, summarize the saved arrangements, and invite last-minute change requests. Refero's copywriting guidance supplies short, concrete sentences and a clear next step; live Refero tools were unavailable.

| Guest-sheet decision | Source and role | Boundary |
| --- | --- | --- |
| Familiar event summary table | Existing staff sheet, requested by the owner. | White Letter paper, black sans-serif text, gray lead row, no new dashboard styling or decorative imagery. |
| Personal greeting and thank-you | Owner's guest-facing brief. | Address the saved host; thank them for choosing the saved restaurant. Do not invent an occasion or call an unconfirmed booking confirmed. |
| Menu, drinks, and arrival notes | Existing guest audience allowlist. | Exclude staff instructions, individual dietary information, prices, and raw source messages. |
| Last-minute changes and warm closing | Owner's brief plus Refero's concrete-next-step guidance. | Invite contact with the restaurant; promise only to review and confirm what can be accommodated. Do not invent contact details or guarantee changes. |
| Shared preview and PDF | Existing quote, kitchen, and staff exports. | Preserve saved-data checks, review labels and conditional dietary blocking. Change only the guest document revision for this presentation update. |

The staff execution sheet uses the owner's staff-sheet photo as its primary reference: centered restaurant name, left-aligned uppercase document title, a bordered two-column event summary, gray leading rows, a service timeline, and plain food/beverage and setup sections. The existing event-order builder supplies the audience boundary and internal-note grouping. The kitchen sheet supplies the already packaged sans-serif fonts, black/gray print palette, and shared preview/PDF delivery. Refero's typography guidance supports compact, neutral hierarchy for scanning during service; live Refero tools were unavailable.

| Staff-sheet decision | Source and role | Boundary |
| --- | --- | --- |
| Event summary and service timeline tables | Owner's staff-facing execution-sheet photo. | Use saved event times, location, attendance and menu. Do not substitute the photo's event, coordinator, pricing or serving times. |
| Plain headings and bullet notes | Photo and existing event-order grouping. | Food/beverage, dietary, setup/equipment, and team instructions stay distinct. No decorative colors or guest-quote styling. |
| Internal pricing summary | Photo's pricing row; existing EventBrief quote calculation. | Reuse current quote cents when the quote is ready. Show a confirmation prompt when pricing is blocked. Staff pricing never enters the kitchen or guest event plan. |
| Explicit missing operational details | Saved-record contract. | Coordinator and course times are not separate fields. Do not infer them from the host or handover notes. Existing internal notes remain verbatim and editable through Event details. |
| Matching preview and PDF | Existing quote/kitchen infrastructure. | One shared staff template, saved revision/review checks, source controls outside paper, no AI call. |

The reference lock is white Letter paper, thin gray table rules, shaded lead rows, black sans-serif text, bold section headings, and compact event metadata. `public/staff-document.mjs` owns the rendered sheet. Long notes flow to additional pages without clipping or shrinking below the print text size.

The kitchen sheet is reference-locked to the owner's photographed prep checklist: white Letter paper, a centered uppercase title, compact event facts, gray table headings, quantities, and two empty checkoff columns. The reused kitchen builder supplies the high-contrast, plain sans-serif approach; Refero's typography guidance supplies clear hierarchy and tabular quantities. No live Refero tools were available. The existing quote's embedded-font and download infrastructure supplies PDF delivery, without its decorative serif or colored total band.

| Kitchen decision | Source and role | Boundary |
| --- | --- | --- |
| Grouped food tables, Qty / Prepped / Checked columns | Owner's photo; working paper for the kitchen. | Empty cells are for handwritten checks, not saved event-review decisions. Only selected-menu food appears. |
| Black type, gray headers, white paper | Photo and existing kitchen template; legibility when printed. | Dashboard colors remain outside the paper. Montserrat uses the already packaged regular/semibold fonts. |
| Dietary box and attendance split | EventBrief's existing kitchen requirements and user terminology. | Guests, Children (0–12), and total attendance stay explicit. Missing required dietary details still block export. |
| Shared preview/PDF template | Existing guest quote delivery pattern. | Saved details and review state are authoritative. No new AI call is needed. |
| Visible prep guide | Synthetic-data brief; no real production quantity rules supplied. | Fictional Menu 2 quantities are calculated in code, labeled on the paper, and included in the kitchen revision. Unknown menus show Confirm instead of borrowing the demo rules. |

`public/kitchen-document.mjs` owns both kitchen preview and PDF. A typical event fits one page. Long content flows to extra pages with repeating table headings; it is not clipped or reduced to unreadable text. Source-check controls remain outside the printable paper. Notes and both checkoff columns provide handwriting space.

The guest quote is reference-locked to the owner's one-page Yannis wedding estimate: a serif brand/title, thin dividing rule, two-column pale event summary, dark total band, and itemized rows. The EventBrief green palette owns the color role; no production contact details or commercial rules are carried over. Montserrat body text and Playfair Display headings follow that document, supplied by pinned Fontsource packages. Preview and PDF share `public/quote-document.mjs`; the PDF embeds the same fonts. Source-check buttons sit outside the paper. The normal synthetic quote fits one Letter page; longer text flows to more pages rather than clipping. This document styling does not restyle the dashboard. The direct **Download PDF** action exports only the saved, current, ready quote and retains its review label.

Previews group approved facts for their audience. Quotes lead into an itemized estimate and draft total. Kitchen sheets emphasize courses and dietary requirements. Staff plans expose schedule, setup, and internal instructions. Guest plans show the host's schedule, food, drinks, and arrival information without internal notes, prices, or individual dietary details.

Standalone HTML preserves source-mode, fictional-data, and review labels. The kitchen and staff exports use the photo-referenced templates described above; their print styling does not alter dashboard styles. Print / Save PDF isolates the selected draft. The calendar download is a tentative `.ics` import file; it does not synchronize a calendar or confirm a booking.

### Public and private scope

The header names the current scope: public sample or private workspace. The access disclosure explains the switch. A private code opens the same saved cloud record across browsers; public samples remain in a separate visitor area. Changes in another browser are fetched when a workspace listing is reopened and before a current draft is reviewed, printed, or downloaded. The interface does not claim live collaboration.

### Evidence interaction

The Inbox extends the existing EventBrief design system. Its reference lock is the current white CRM shell and Yanni's conversation review queue/panel: a searchable source list, original messages, separately identified corrections, and links to affected event work. A compact **Messages → Event details → Five drafts** strip shows actual saved state. Five asset buttons stay above the long reading area. The source and extracted fields sit side by side on wide screens and stack on smaller screens. The palette, font, borders, and button roles remain unchanged. Refero's bundled form/focus guidance supplies visible labels and keyboard focus; live Refero MCP research was unavailable.

Message previews use the saved source text. No delivery dates, sender identities, confidence percentages, unread badges, or agent activity are invented. Authored examples are labeled. Pending source versions cannot reuse an earlier version's facts or ready-asset status. Public samples and private conversations use the existing separate storage scopes.

Choosing a source reference brings the original message into focus and highlights its exact excerpt. The control remains keyboard accessible. Original facts and reviewer corrections stay visibly distinct.

**The Actual Progress Rule.** Display real saved results and review counts; do not invent agent activity or confidence metrics.

Button color/border transitions use .16s easing. Reduced-motion preferences disable transitions, animation, and smooth scrolling.

## Do's and Don'ts

### Do:

- **Do** keep authored examples distinct from AI results.
- **Do** use written state labels alongside color.
- **Do** keep source evidence reachable from the selected draft.
- **Do** preserve visible focus and the mobile stacked layout.

### Don't:

- **Don't** label an unreviewed draft approved.
- **Don't** add decorative charts or invented agent progress.
- **Don't** apply the old extraction page's purple tokens to new event-workspace surfaces.
- **Don't** treat printed document styling as the dashboard's component system.
