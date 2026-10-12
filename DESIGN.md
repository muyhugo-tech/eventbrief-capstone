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

A quiet CRM shell puts the event, its current drafts, and the next action ahead of decoration. Pale navigation, compact controls, thin dividers, and white reading surfaces carry the workspace. The coordinator can open source evidence without losing the current draft.

The owner supplied the [AI CRM dashboard reference](https://21st.dev/@larsen66/templates/ai-crm-dashboard) and [opportunities preview](https://21st-crm.vercel.app/opportunities). This is a code-led visual adaptation, not copied template source. No paid template was purchased or downloaded. Existing Yanni's sidebar SVG geometry, event-list count behavior, and EventBrief's evidence interaction remain part of the implemented system. [Attribution](docs/ATTRIBUTION.md) records the reuse boundary.

This system describes the `/package` workspace. The older three-field extraction page and the copied printable document templates have their own retained styles; their values do not become dashboard defaults.

**Key Characteristics:**

- Pale navigation and white reading surfaces
- Thin dividers with gently rounded controls
- Written readiness and review states
- Source-linked facts
- Simple next actions

## Colors

Forest green identifies the primary action; amber and warm yellow distinguish unresolved details and cited source text. Quiet neutral tones carry the rest of the workspace.

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

The draft selector and preview use a 190px/minmax grid, narrowing the selector to 165px at 1100px. Source messages and the shared record use two reading columns inside a disclosure. Document text is bounded to 78ch; source-message bodies to 70ch.

At 800px and below, the rail becomes a top row, the recent list hides, controls stack, draft choices wrap, and the source/record panes become one column. Main padding becomes 18px. Event-table rows become labeled stacked blocks rather than forcing horizontal scrolling. The primary preparation button fills the available width.

## Elevation & Depth

The workspace uses tonal separation and single-pixel borders, without decorative shadows. Selection adds a pale fill and a border. A focused control receives a 3px outline with a 3px offset. An active source excerpt receives a warm highlight and outline; this is an evidence state rather than elevation.

**The Flat Workspace Rule.** Use existing fills, borders, and focus treatment to distinguish states instead of introducing shadow-based cards.

## Shapes

Controls use modest rounding. The primary buttons and main surfaces follow the surface radius; draft choices and text fields follow the control radius. Small labels use the compact radius. The paste panel has its own larger radius. Navigation icons are inline SVG with a consistent 1.7 stroke; status dots accompany text and are not standalone controls.

## Components

### Buttons

Primary actions use the green fill and white text. Secondary actions use white, a divider-colored border, and ink text. Primary buttons are at least 38px tall. Small review buttons keep their separate 34px minimum. Hover changes fill/border; keyboard focus uses the common visible outline. Disabled controls lower opacity and use a not-allowed cursor.

### Inputs and fields

Search, selects, and reply fields are white with thin muted green-gray borders. Labels remain visible. Textareas resize vertically. The reply form has a separator from the existing event summary so new input does not resemble an already accepted fact.

### Navigation and draft choices

The selected navigation row has a pale green fill and a written label. Recent events truncate long titles while keeping the event state visible. Draft choices show a title and one explicit readiness/review line. Below the mobile breakpoint they wrap into multiple rows.

### Labels and reading surfaces

Source mode, local-demo status, and draft review labels are small contextual tags. Draft and message surfaces are bordered reading areas, not decorative metric cards. Preparation details, source records, policy, history, and internal export remain disclosures.

### Evidence interaction

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
