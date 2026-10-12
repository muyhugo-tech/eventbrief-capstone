// Adapted from the user's existing application: lib/beo/template.ts
// Original SHA-256: bf690e2c71880b57101c94fdfa0d2fce668f77c821dca3d95f7c9c12ef4eb86f
// TypeScript erased; fictional branding and neutral draft/attendance labels.
// Pure HTML builders for the Event Order Details (internal/staff-facing) and
// the Proposal (client-facing) PDFs. Type-only import keeps this module
// runtime-dependency-free, so it can be unit tested under Node's type-stripping.
                                                                                          
                                                   

                                           

// Just the bits of the attached menu the Event Order doc renders.
                                                                            

const MENU_CATS                     = [
  ["starter", "Starters"],
  ["salad", "Salads"],
  ["entree", "Entrées"],
  ["dessert", "Dessert"],
];

const TZ = "America/Los_Angeles"; // PDFs format explicitly in the venue zone (server-rendered)

const STATUS_LABELS                              = {
  draft: "Draft",
  lead: "Lead",
  tentative: "Tentative",
  confirmed: "Confirmed",
  done: "Done",
  lost: "Lost",
};
const TYPE_LABELS                            = {
  private_party: "Private party",
  baby_shower: "Baby shower",
  corporate: "Corporate",
  catering: "Catering",
  offsite_catering: "Offsite catering",
};
const BAR_LABELS                                 = {
  cash_carry: "Cash & carry",
  beer_and_wine: "Beer & wine hosted",
  full_bar: "Full bar (hosted)",
};

function label(ev                )         {
  return ev.title || ev.contact_name || ev.patios?.name || "Event";
}
function fmtDate(iso               )         {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function fmtTime(iso               )         {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}
function fmtRange(s               , e               )         {
  if (!s) return "To be confirmed";
  return `${fmtTime(s)}${e ? ` – ${fmtTime(e)}` : ""}`;
}
function money(n        )         {
  return `$${Number(n).toLocaleString("en-US")}`;
}
function esc(s                           )         {
  if (!s) return "";
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ,
  );
}
function nl2br(s        )         {
  return esc(s).replace(/\n/g, "<br/>");
}
function field(lbl        , value        )         {
  return `<div class="f"><div class="fl">${lbl}</div><div class="fv">${value || "—"}</div></div>`;
}

// Staff-facing menu block: item names by category + final pp, no quantities and
// no per-item prices. Falls back to menu_notes when no structured menu.
function menuBlock(menu                              , menuNotes               )         {
  if (menu && menu.lines.length) {
    const cats = MENU_CATS.map(([key, label]) => {
      const items = menu.lines.filter((l) => l.category === key);
      if (!items.length) return "";
      return `<div class="menucat"><div class="menucat-label">${label}</div><div class="menucat-items">${items
        .map((l) => esc(l.name))
        .join(" · ")}</div></div>`;
    }).join("");
    const price =
      menu.final_price_per_person != null
        ? `<div class="menuprice">$${Number(menu.final_price_per_person).toFixed(2)} per person</div>`
        : "";
    return cats + price;
  }
  return `<div class="prose">${menuNotes ? nl2br(menuNotes) : "<em>Menu to be attached.</em>"}</div>`;
}

function orderBody(ev                , menu                   )         {
  return `
  <div class="titlerow">
    <h1>${esc(label(ev))}</h1>
    <span class="status">${STATUS_LABELS[ev.status]}</span>
  </div>
  <section class="grid">
    ${field("Occasion", esc(ev.occasion))}
    ${field("Coordinator", esc(ev.coordinator))}
    ${field("Date", fmtDate(ev.start_at))}
    ${field("Time", fmtRange(ev.start_at, ev.end_at))}
    ${field("Venue", esc(ev.patios?.name))}
    ${field("Total attendance", ev.guest_count != null ? String(ev.guest_count) : "—")}
    ${field("Event type", TYPE_LABELS[ev.event_type])}
    ${field("Bar", ev.bar_arrangement ? esc(BAR_LABELS[ev.bar_arrangement]) : "—")}
  </section>
  <section class="block">
    <h2>Bar</h2>
    <div class="prose">${ev.bar_notes ? nl2br(ev.bar_notes) : "<em>None.</em>"}</div>
  </section>
  <section class="block">
    <h2>Setup &amp; add-ons</h2>
    <div class="prose">${ev.setup_notes ? nl2br(ev.setup_notes) : "<em>None.</em>"}</div>
  </section>
  <section class="block">
    <h2>Menu — summary</h2>
    ${menuBlock(menu, ev.menu_notes)}
  </section>
  <section class="block">
    <h2>Contact</h2>
    <div class="grid">
      ${field("Name", esc(ev.contact_name))}
      ${field("Company", esc(ev.company))}
      ${field("Email", esc(ev.contact_email))}
      ${field("Phone", esc(ev.contact_phone))}
    </div>
  </section>
  <section class="block">
    <h2>Internal notes</h2>
    <div class="prose">${ev.internal_notes ? nl2br(ev.internal_notes) : "<em>None.</em>"}</div>
  </section>`;
}

function proposalBody(ev                , menu                   )         {
  const greeting = ev.contact_name ? esc(ev.contact_name) : "Guest";
  return `
  <div class="titlerow"><h1>${esc(label(ev))}</h1></div>
  <p class="lede">Dear ${greeting},</p>
  <p class="lede">Thank you for considering Linden &amp; Fig for your upcoming ${ev.event_type === "offsite_catering" ? "catering order" : "event"}. Here are the details for your review:</p>
  <section class="grid">
    ${field("Date", fmtDate(ev.start_at))}
    ${field("Time", fmtRange(ev.start_at, ev.end_at))}
    ${field("Patio", esc(ev.patios?.name))}
    ${field("Guests", ev.adult_count != null ? String(ev.adult_count) : "To be confirmed")}
  </section>
  <section class="block">
    <h2>Your menu</h2>
    ${menuBlock(menu, null)}
  </section>
  ${ev.event_type !== "offsite_catering" ? `<p class="fineprint">A food &amp; beverage minimum of ${money(ev.fnb_minimum)} applies to private events.</p>` : ""}
  <p class="lede">We can't wait to welcome you and your guests. Please reach out with any questions or to
  confirm your date.</p>
  <p class="sign">Warm regards,<br/><strong>The Linden &amp; Fig Events Team</strong></p>`;
}

const BASE_CSS = `
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:'Montserrat',system-ui,sans-serif;color:#2b2b2b;font-size:12px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.brandbar{background:#2b2b2b;color:#fff;padding:26px 40px;border-bottom:4px solid #b08423;}
.brand{font-family:'Playfair Display',serif;font-weight:700;font-size:26px;letter-spacing:.02em;}
.brand span{color:#b08423;}
.brand-sub{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#d8d2c4;margin-top:4px;}
.doctitle{font-family:'Playfair Display',serif;font-style:italic;color:#b08423;font-size:15px;margin-top:14px;}
main{padding:32px 40px;}
.proposal main{max-width:680px;margin:0 auto;}
.titlerow{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2dccd;padding-bottom:12px;margin-bottom:18px;}
h1{font-family:'Playfair Display',serif;font-weight:700;font-size:22px;margin:0;}
.status{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#fff;background:#b08423;padding:3px 10px;border-radius:999px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e2dccd;border:1px solid #e2dccd;border-radius:6px;overflow:hidden;}
.f{background:#fff;padding:9px 14px;}
.fl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#7a756c;font-weight:600;}
.fv{font-size:13px;margin-top:2px;}
.block{margin-top:22px;}
h2{font-family:'Playfair Display',serif;font-size:14px;border-left:3px solid #b08423;padding-left:8px;margin:0 0 8px;}
.lede{font-size:13px;margin:0 0 12px;}
.fineprint{font-size:11px;color:#7a756c;font-style:italic;margin:18px 0;}
.sign{margin-top:24px;font-size:13px;}
.docfoot{padding:16px 40px;border-top:1px solid #e2dccd;color:#7a756c;font-size:9px;text-align:center;}
.menucat{margin-bottom:8px;}
.menucat-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#7a756c;font-weight:600;}
.menucat-items{font-size:12px;margin-top:2px;}
.menuprice{margin-top:10px;font-size:13px;font-weight:600;color:#b08423;}
`;

export function buildDocumentHtml(
  event                ,
  docType         ,
  opts                                                                          = {},
)         {
  const fontFaceCss = opts.fontFaceCss ?? "";
  const docTitle = docType === "order" ? "Event Order Details" : "Event Proposal";
  // Correspondence and internal free text are never client proposal content.
  const body = docType === "order" ? orderBody(event, opts.menu) : proposalBody(event, opts.menu);
  const generated = fmtDate(opts.generatedAt ?? new Date().toISOString());

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${docTitle}</title>
<style>${fontFaceCss}${BASE_CSS}</style></head>
<body class="${docType}">
<header class="brandbar">
  <div class="brand">LINDEN <span>&amp; FIG</span></div>
  <div class="brand-sub">Fictional restaurant · Capstone demo</div>
  <div class="doctitle">${docTitle}</div>
</header>
<main>${body}</main>
<footer class="docfoot">Linden &amp; Fig · Fictional capstone restaurant<br/>Generated ${generated}</footer>
</body></html>`;
}
