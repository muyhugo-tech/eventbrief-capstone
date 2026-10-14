import { restaurantName, approvedDocumentRows, draftReviewNotes } from './package-export.mjs';
import { quoteFontCss } from './quote-document.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)) : value;
const time = value => { if(!/^\d{2}:\d{2}$/.test(value))return value; const [h,m]=value.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`; };
const zone = value => new Intl.DateTimeFormat('en-US',{timeZone:value,timeZoneName:'longGeneric'}).formatToParts(new Date('2000-01-01T12:00:00Z')).find(part=>part.type==='timeZoneName').value;

// The staff sheet supplies the print structure; this guest copy keeps the
// existing audience allowlist and uses welcoming, factual restaurant language.
export const guestStyles = `${quoteFontCss}
.guest-paper,.guest-paper *{box-sizing:border-box}
.guest-paper{font:13px/1.55 'Quote Body',Arial,sans-serif;color:#111;background:#fff;text-align:left;max-width:816px;margin:0 auto;padding:38px 40px;border:1px solid #ddd}
.guest-paper .guest-restaurant{font-size:23px;font-weight:600;line-height:1.3;letter-spacing:.4px;text-align:center;text-transform:uppercase;margin:0 0 21px;overflow-wrap:anywhere}
.guest-paper .guest-title{font:600 18px/1.3 'Quote Body',Arial,sans-serif;margin:0 0 18px;color:#111}
.guest-paper p{font:inherit;margin:0 0 10px;max-width:none;white-space:pre-wrap;overflow-wrap:anywhere}
.guest-paper .guest-greeting{font-weight:600}
.guest-paper .guest-summary{width:100%;border-collapse:collapse;table-layout:fixed;font:inherit;color:#111;margin:19px 0 0}
.guest-paper .guest-summary th,.guest-paper .guest-summary td{border:1px solid #b0b0b0;padding:6px 8px;vertical-align:top;text-align:left;font:inherit;overflow-wrap:anywhere;white-space:pre-wrap}
.guest-paper .guest-summary th{width:27%;font-weight:600;color:#111}
.guest-paper .guest-summary tr:first-child{background:#dedede}
.guest-paper .guest-summary tr:first-child td{font-weight:600}
.guest-paper .guest-section{margin-top:21px}
.guest-paper .guest-section h3{font:600 15px/1.35 'Quote Body',Arial,sans-serif;margin:0 0 8px;color:#111;break-after:avoid}
.guest-paper .guest-menu-name{font-weight:600;margin-bottom:5px}
.guest-paper ul{margin:0 0 10px;padding-left:18px}
.guest-paper li{padding:2px 0;white-space:pre-wrap;overflow-wrap:anywhere}
.guest-paper .guest-small{font-size:11px;line-height:1.5;color:#444}
.guest-paper .guest-closing{margin-top:18px}
.guest-paper .guest-footer{border-top:1px solid #bbb;margin-top:21px;padding-top:8px;font-size:10px;line-height:1.5;color:#444;overflow-wrap:anywhere}
.guest-source-checks{max-width:816px;margin:17px auto 0;font-size:12px;line-height:1.8}
.guest-source-checks summary{cursor:pointer}
.guest-source-checks .fact-source{margin:4px 4px 0 0}
@media screen and (max-width:700px){.guest-paper{padding:24px 15px;font-size:12px}.guest-paper .guest-restaurant{font-size:20px}.guest-paper .guest-title{font-size:17px}.guest-paper .guest-summary th{width:33%}.guest-paper .guest-summary th,.guest-paper .guest-summary td{padding:5px 6px}.guest-paper .guest-section h3{font-size:14px}}
@media print{.guest-paper{max-width:none;border:0;padding:0;margin:0;font-size:9.5pt;line-height:1.45}.guest-paper .guest-restaurant{font-size:17pt;margin-bottom:14pt}.guest-paper .guest-title{font-size:13pt;margin-bottom:12pt}.guest-paper p{margin-bottom:7pt}.guest-paper .guest-summary{margin-top:12pt}.guest-paper .guest-summary th,.guest-paper .guest-summary td{padding:4pt 6pt}.guest-paper .guest-section{margin-top:14pt}.guest-paper .guest-section h3{font-size:11pt;margin-bottom:6pt}.guest-paper .guest-small{font-size:8pt}.guest-paper .guest-footer{font-size:7.5pt;margin-top:14pt}.guest-paper p{orphans:3;widows:3}.guest-paper .guest-restaurant,.guest-paper .guest-title,.guest-paper .guest-menu-name{break-after:avoid}.guest-paper tr,.guest-paper li,.guest-paper .guest-footer,.guest-paper .guest-closing{break-inside:avoid}.guest-paper tr{-webkit-print-color-adjust:exact;print-color-adjust:exact}.guest-source-checks{display:none}}
`;

export function renderGuestSheet(document,prepared,{reviewed=false,interactive=false}={}) {
  if(document.id!=='guest'||document.state!=='ready_for_review')throw new Error('A ready guest sheet is required.');
  const rows=approvedDocumentRows(document),v=Object.fromEntries(rows.map(row=>[row.field,row.value]));
  const row=(label,value)=>`<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`;
  const attendance=[v.guest_13_plus_count==null?null:`${v.guest_13_plus_count} Guests`,v.child_count==null?null:`${v.child_count} Children (0–12)`,`Total attendance: ${v.guest_count}`].filter(Boolean).join(' · ');
  // Omit the fictional profile's accounting preface; retain its service policy.
  const beverageNote=(document.beverage_note??'').replace(/^One demo beverage-package price for Guests\.\s*/, '');
  const mode=prepared.mode==='authored_reference'?'Authored example · no AI call':prepared.label;
  return `<article class="guest-paper" aria-label="Guest event sheet preview"><header><div class="guest-restaurant">${esc(restaurantName(prepared.profile))}</div><h2 class="guest-title">Your event details</h2></header>
    <p class="guest-greeting">Dear ${esc(v.host_name)},</p><p>Thank you for choosing ${esc(restaurantName(prepared.profile))} for your event. Here are the event details we have on file for you.</p>
    <table class="guest-summary" aria-label="Your event at a glance"><tbody>${row('Host',v.host_name)}${row('Date',date(v.event_date))}${row('Time',`${time(v.start_time)} - ${v.end_time ? time(v.end_time) : 'End time to confirm'} (${zone(v.timezone)})`)}${row('Location',v.venue)}${row('Guests',attendance)}</tbody></table>
    <section class="guest-section"><h3>Your menu &amp; drinks</h3><p class="guest-menu-name">${esc(v.menu)}</p><ul>${(document.menu_courses??[]).map(course=>`<li>${esc(course)}</li>`).join('')}</ul><p><strong>Drinks:</strong> ${esc(v.beverage)}</p>${document.beverage_notes?`<p><strong>Drink notes:</strong> ${esc(document.beverage_notes)}</p>`:''}${beverageNote?`<p class="guest-small">${esc(beverageNote)}</p>`:''}</section>
    <section class="guest-section"><h3>Your arrival &amp; event notes</h3><p>${esc(v.guest_notes ?? 'No additional arrival instructions supplied.')}</p></section>
    <section class="guest-section"><h3>Need to make a change?</h3><p>Please let us know as soon as possible if your guest count, timing, or plans change - including any last-minute updates. We will review your request and confirm what we can accommodate.</p></section>
    <div class="guest-closing"><p>We look forward to welcoming you and your guests.</p><p>Warmly,<br>The ${esc(restaurantName(prepared.profile))} team</p></div>
    ${draftReviewNotes(document)}<footer class="guest-footer"><strong>${reviewed?'Reviewed draft':'Draft · not reviewed'}</strong> · Guest copy · Events Made Easy<br>Fictional capstone example · ${esc(mode)}</footer></article>
    ${interactive?`<details class="guest-source-checks"><summary>Check the source details</summary>${rows.map(row=>`<button class="fact-source" data-field="${esc(row.field)}">${esc(row.field==='guest_count'?'Total attendance':row.label)}</button>`).join('')}<button class="fact-source" data-policy="true">Menu &amp; beverage details</button><p>Use Edit event details → Guest instructions to change the arrival and event notes. Download a new copy after saving changes.</p></details>`:''}`;
}

export function standaloneGuestSheet(document,prepared,reviewed,{fontCss=quoteFontCss}={}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Events Made Easy - Guest event details</title><style>@page{size:Letter;margin:14mm 16mm}html,body{margin:0;padding:0;background:#fff}${guestStyles.replace(quoteFontCss,fontCss)}</style></head><body>${renderGuestSheet(document,prepared,{reviewed})}</body></html>`;
}
