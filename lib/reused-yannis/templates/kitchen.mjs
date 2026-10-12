// Adapted from the user's existing application: lib/kitchen/template.ts
// Original SHA-256: 234fdd2b5111745e96336b015fec4fa811b905f338a67afcab7245649dc88c04
// TypeScript erased; fictional branding and neutral draft/attendance labels.
// Pure HTML builder for the kitchen-facing Kitchen Order sheet. Type-only imports
// keep it runtime-dependency-free (unit-testable under Node type-stripping) and,
// per the codebase convention (see lib/beo/template.ts), it inlines its own label
// maps + formatters rather than runtime-importing them.
//
// DESIGN GOAL: LEGIBILITY, NOT BRAND. Big, bold, plain, high-contrast, centered —
// readable on a kitchen counter mid-service. NO Marcellus/Playfair, NO gold. This
// is deliberately a different visual language from the Event Order / Proposal docs.
                                                  
                                                                       

const TZ = "America/Los_Angeles";

const COURSE_LABELS                                = {
  apps: "Appetizers",
  salads: "Salads",
  entrees: "Entrées",
  dessert: "Dessert",
  coffee: "Coffee",
};

function esc(s                           )         {
  if (!s) return "";
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ,
  );
}

function fmtDate(iso               )         {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleDateString("en-US", {
      timeZone: TZ,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

// Corpus time format: no space, uppercase, drop ":00" on the hour.
//   "17:30" → "5:30PM"   "18:00" → "6PM"   "11:00" → "11AM"
function fmtCorpusTime(hhmm                           )         {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return min === "00" ? `${h}${ampm}` : `${h}:${min}${ampm}`;
}

// A UTC ISO timestamp → venue-local "HH:MM" (24h), for reuse by fmtCorpusTime.
function isoToVenueHHMM(iso               )         {
  if (!iso) return "";
  const s = new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

function label(ev                )         {
  return ev.title || ev.contact_name || ev.patios?.name || "Event";
}

function fmtQty(q               )         {
  if (q == null) return "";
  return Number.isInteger(q) ? String(q) : String(q);
}

function courseBlock(
  course                                 ,
  format                        ,
)         {
  const title = (COURSE_LABELS[course.course] ?? course.course).toUpperCase();
  // Corpus style: when a course has a serve time, the time IS the header —
  // "APPETIZERS — SERVED 5:30PM" as one loud, bold, underlined line. No time →
  // just the category. Offsite orders carry a single ready-time up top instead.
  const serveTime = format === "served" ? fmtCorpusTime(course.serve_time) : "";
  const heading = serveTime ? `${title} — SERVED ${serveTime}` : title;
  const rows = course.lines
    .map((l) => {
      const qty = fmtQty(l.quantity);
      const vessel = esc(l.vessel);
      const prep = esc(l.prep_notes);
      return `<tr>
        <td class="q">${qty}</td>
        <td class="it">${esc(l.name)}</td>
        <td class="ve">${vessel}</td>
        <td class="pr">${prep ? `(${prep})` : ""}</td>
      </tr>`;
    })
    .join("");
  return `<section class="course">
    <h2 class="course-head">${esc(heading)}</h2>
    <table class="lines">${rows}</table>
  </section>`;
}

// Scale-to-fit: every VERTICAL spacing value is × var(--s) and every FONT size is
// × var(--f). The density level (set on <html data-density>) drives those two
// vars; the render loop steps the level down until the page fits. Spacing tightens
// before fonts shrink, and fonts stop at the floor.
//
// These blocks MUST mirror DENSITY_LEVELS in ./density.ts — inlined here (not
// imported) to keep this module self-contained for `node --test` type-stripping,
// per the codebase convention. A drift guard in density.test.ts asserts they match.
const CSS = `
:root{--s:1;--f:1;}
:root[data-density="0"]{--s:1;--f:1;}
:root[data-density="1"]{--s:0.8;--f:1;}
:root[data-density="2"]{--s:0.62;--f:1;}
:root[data-density="3"]{--s:0.48;--f:1;}
:root[data-density="4"]{--s:0.42;--f:0.94;}
:root[data-density="5"]{--s:0.4;--f:0.86;}
:root[data-density="6"]{--s:0.38;--f:0.78;}
:root[data-density="7"]{--s:0.36;--f:0.72;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;}
body{font-family:'KitchenSans',Arial,Helvetica,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
main{max-width:760px;margin:0 auto;padding:calc(28px * var(--s)) 40px calc(30px * var(--s));}
.header{text-align:center;border-bottom:4px solid #000;padding-bottom:calc(12px * var(--s));margin-bottom:calc(6px * var(--s));}
h1{font-size:calc(38px * var(--f));font-weight:600;letter-spacing:.01em;margin:0 0 calc(7px * var(--s));text-transform:uppercase;line-height:1.05;}
.occasion{font-size:calc(20px * var(--f));font-weight:600;margin:0 0 calc(8px * var(--s));text-transform:uppercase;}
.meta{font-size:calc(20px * var(--f));font-weight:600;margin:calc(3px * var(--s)) 0;}
.meta .sep{padding:0 8px;}
.subtle{font-size:calc(16px * var(--f));font-weight:400;margin:calc(5px * var(--s)) 0 0;letter-spacing:.03em;}
.readybig{margin:calc(16px * var(--s)) auto 0;border:4px solid #000;padding:calc(10px * var(--s)) 18px;display:inline-block;font-size:calc(30px * var(--f));font-weight:600;text-transform:uppercase;letter-spacing:.02em;}
.course{margin-top:calc(18px * var(--s));}
h2.course-head{font-size:calc(27px * var(--f));font-weight:600;text-transform:uppercase;letter-spacing:.03em;text-align:center;border-bottom:3px solid #000;padding-bottom:calc(5px * var(--s));margin:0 0 calc(6px * var(--s));line-height:1.15;}
table.lines{width:100%;border-collapse:collapse;}
table.lines td{font-size:calc(22px * var(--f));font-weight:400;padding:calc(6px * var(--s)) 8px;border-bottom:1px solid #bbb;vertical-align:top;}
td.q{width:70px;text-align:center;font-weight:600;font-size:calc(24px * var(--f));white-space:nowrap;}
td.it{font-weight:600;}
td.ve{width:200px;font-weight:400;}
td.pr{width:190px;font-weight:400;}
.prodnotes{margin-top:calc(18px * var(--s));border:3px solid #000;padding:calc(11px * var(--s)) 16px;}
.prodnotes .pl{font-size:calc(16px * var(--f));font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin:0 0 calc(5px * var(--s));}
.prodnotes .pv{font-size:calc(20px * var(--f));font-weight:400;white-space:pre-wrap;margin:0;}
.foot{text-align:center;margin-top:calc(16px * var(--s));font-size:13px;color:#555;}
`;

export function buildKitchenOrderHtml(
  event                ,
  order                                                                            ,
  opts                                                                   = {},
)         {
  const fontFaceCss = opts.fontFaceCss ?? "";
  const isOffsite = order.format === "offsite";
  // Initial density level (0 = full size). The render loop re-sets this attribute
  // as it measures; a direct call defaults to full size.
  const density = Number.isFinite(opts.density) ? Math.max(0, opts.density          ) : 0;

  const guests = event.guest_count != null ? `${event.guest_count} TOTAL ATTENDANCE` : "";
  const place = isOffsite
    ? "OFFSITE"
    : event.patios?.name
      ? esc(event.patios.name).toUpperCase()
      : "";
  const metaParts = [guests, place].filter(Boolean);
  const meta = metaParts.length
    ? `<div class="meta">${metaParts.join('<span class="sep">·</span>')}</div>`
    : "";

  const arrival =
    !isOffsite && event.start_at
      ? `ARRIVAL ${fmtCorpusTime(isoToVenueHHMM(event.start_at))}`
      : "";
  const cc = event.coordinator ? `CC: ${esc(event.coordinator).toUpperCase()}` : "";
  const subtleParts = [arrival, cc].filter(Boolean);
  const subtle = subtleParts.length ? `<p class="subtle">${subtleParts.join("  ·  ")}</p>` : "";

  const readyBig =
    isOffsite && order.ready_at
      ? `<div class="readybig">All food ready at ${fmtCorpusTime(order.ready_at)}</div>`
      : "";

  const occasion = event.occasion ? `<p class="occasion">${esc(event.occasion)}</p>` : "";

  const courses = order.courses
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => courseBlock(c, order.format))
    .join("");

  const prod = order.production_notes
    ? `<div class="prodnotes"><p class="pl">Production notes</p><p class="pv">${esc(order.production_notes)}</p></div>`
    : "";

  const generated = fmtDate(opts.generatedAt ?? new Date().toISOString());

  return `<!doctype html><html lang="en" data-density="${density}"><head><meta charset="utf-8"/><title>Kitchen Order</title>
<style>${fontFaceCss}${CSS}</style></head>
<body>
<main>
  <div class="header">
    <h1>${esc(label(event).toUpperCase())}</h1>
    ${occasion}
    <div class="meta">${fmtDate(event.start_at)}</div>
    ${meta}
    ${subtle}
    ${readyBig}
  </div>
  ${courses}
  ${prod}
  <div class="foot">Kitchen Order · Generated ${generated}</div>
</main>
</body></html>`;
}
