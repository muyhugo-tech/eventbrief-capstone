import { approvedDocumentRows, draftReviewNotes } from './package-export.mjs';
import { quoteFontCss } from './quote-document.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)) : value;
const time = value => { if (!/^\d{2}:\d{2}$/.test(value)) return value; const [h,m]=value.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`; };

// The owner's prep-sheet photo governs this paper: centered title, compact
// facts and gray table headings with roomy, empty handwritten checkoff cells.
// The existing kitchen builder supplies the plain, high-contrast print approach.
export const kitchenStyles = `${quoteFontCss}
.kitchen-paper,.kitchen-paper *{box-sizing:border-box}
.kitchen-paper{font:14px/1.5 'Quote Body',Arial,sans-serif;color:#111;background:#fff;text-align:left;max-width:816px;margin:0 auto;padding:40px 42px;border:1px solid #ddd}
.kitchen-paper .kitchen-heading{text-align:center;margin-bottom:23px}
.kitchen-paper .kitchen-restaurant{font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:.6px}
.kitchen-paper .kitchen-title{font:600 24px/1.2 'Quote Body',Arial,sans-serif;letter-spacing:.6px;text-transform:uppercase;margin:4px 0 0;color:#111}
.kitchen-paper .kitchen-meta{margin:0 0 19px}
.kitchen-paper .kitchen-meta div{display:flex;gap:6px;align-items:baseline;min-width:0}
.kitchen-paper dt{font-weight:600;flex-shrink:0;color:#111}
.kitchen-paper dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
.kitchen-paper p{max-width:none;white-space:pre-wrap;overflow-wrap:anywhere;margin:0;font:inherit}
.kitchen-paper .kitchen-dietary{border:2px solid #333;padding:9px 12px;margin:14px 0 20px}
.kitchen-paper .kitchen-dietary h3{font:600 12px/1.4 'Quote Body',Arial,sans-serif;margin:0 0 4px;color:#111}
.kitchen-paper .kitchen-section{margin:18px 0}
.kitchen-paper .kitchen-table{width:100%;border-collapse:collapse;table-layout:fixed;font:inherit;color:#111}
.kitchen-paper .kitchen-table th,.kitchen-paper .kitchen-table td{border:1px solid #929292;padding:8px 10px;text-align:left;vertical-align:middle;overflow-wrap:anywhere;font:inherit;color:#111}
.kitchen-paper .kitchen-table th{background:#dedede;font-weight:600}
.kitchen-paper .kitchen-table th:first-child{text-transform:uppercase;letter-spacing:.4px}
.kitchen-paper .kitchen-table .kitchen-item{width:45%}
.kitchen-paper .kitchen-table .kitchen-qty{width:29%}
.kitchen-paper .kitchen-table .kitchen-check{width:13%;font-size:10px;text-align:center;padding:8px 3px}
.kitchen-paper .kitchen-table td{height:42px}
.kitchen-paper .kitchen-table .kitchen-qty-value{font-weight:600;font-variant-numeric:tabular-nums}
.kitchen-paper .kitchen-qty-note{display:block;font-size:10px;line-height:1.4;color:#444;margin-top:2px}
.kitchen-paper .kitchen-basis{font-size:10px;line-height:1.5;color:#333;margin-top:18px}
.kitchen-paper .kitchen-notes{margin-top:18px}
.kitchen-paper .kitchen-notes strong{font-size:12px}
.kitchen-paper .kitchen-write-line{height:24px;border-bottom:1px solid #bbb}
.kitchen-paper .kitchen-footer{border-top:1px solid #bbb;margin-top:20px;padding-top:9px;font-size:10px;line-height:1.5;color:#444;overflow-wrap:anywhere}
.kitchen-source-checks{max-width:816px;margin:17px auto 0;font-size:12px;line-height:1.8}
.kitchen-source-checks summary{cursor:pointer}
.kitchen-source-checks .fact-source{margin:4px 4px 0 0}
@media screen and (max-width:700px){.kitchen-paper{padding:24px 16px;font-size:12px}.kitchen-paper .kitchen-title{font-size:21px}.kitchen-paper .kitchen-restaurant{font-size:17px}.kitchen-paper .kitchen-table th,.kitchen-paper .kitchen-table td{padding:7px 5px}.kitchen-paper .kitchen-table .kitchen-item{width:39%}.kitchen-paper .kitchen-table .kitchen-qty{width:31%}.kitchen-paper .kitchen-table .kitchen-check{width:15%;font-size:9px;padding:7px 2px}.kitchen-paper .kitchen-meta div{flex-wrap:wrap;gap:0 5px}}
@media print{.kitchen-paper{max-width:none;border:0;padding:0;margin:0;font-size:10pt;line-height:1.45}.kitchen-paper .kitchen-heading{margin-bottom:18pt}.kitchen-paper .kitchen-restaurant{font-size:15pt}.kitchen-paper .kitchen-title{font-size:18pt}.kitchen-paper .kitchen-section{margin:13pt 0}.kitchen-paper .kitchen-table th,.kitchen-paper .kitchen-table td{padding:6pt 7pt}.kitchen-paper .kitchen-table td{height:31pt}.kitchen-paper .kitchen-table .kitchen-check{font-size:8pt}.kitchen-paper .kitchen-qty-note,.kitchen-paper .kitchen-basis,.kitchen-paper .kitchen-footer{font-size:8pt}.kitchen-paper .kitchen-table thead{display:table-header-group}.kitchen-paper .kitchen-heading,.kitchen-paper .kitchen-meta div,.kitchen-paper .kitchen-dietary,.kitchen-paper tr,.kitchen-paper .kitchen-basis,.kitchen-paper .kitchen-notes,.kitchen-paper .kitchen-footer{break-inside:avoid}.kitchen-paper th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.kitchen-source-checks{display:none}}
`;

export function renderKitchenSheet(document, prepared, {reviewed=false,interactive=false}={}) {
  if(document.id!=='kitchen'||document.state!=='ready_for_review'||!document.kitchen_plan)throw new Error('A ready kitchen sheet is required.');
  const rows=approvedDocumentRows(document),values=Object.fromEntries(rows.map(row=>[row.field,row.value])),plan=document.kitchen_plan;
  const fact=(label,value)=>value==null?'':`<div><dt>${esc(label)}:</dt><dd>${esc(value)}</dd></div>`;
  const tables=plan.sections.map(section=>`<section class="kitchen-section"><table class="kitchen-table" aria-label="${esc(section.title)} prep checklist"><thead><tr><th scope="col" class="kitchen-item">${esc(section.title)}</th><th scope="col" class="kitchen-qty">Qty</th><th scope="col" class="kitchen-check">Prepped</th><th scope="col" class="kitchen-check">Checked</th></tr></thead><tbody>${section.lines.map(line=>`<tr><td>${esc(line.name)}</td><td><span class="kitchen-qty-value">${line.quantity==null?'Confirm':`${esc(line.quantity)} ${esc(line.unit)}${line.quantity===1?'':'s'}`}</span>${line.covers==null?'':`<span class="kitchen-qty-note">For ${esc(line.covers)} people</span>`}</td><td aria-label="Prepped: leave blank until completed"></td><td aria-label="Checked: leave blank until completed"></td></tr>`).join('')}</tbody></table></section>`).join('');
  const mode=prepared.mode==='authored_reference'?'Authored example - no AI call':prepared.label;
  return `<article class="kitchen-paper"><header class="kitchen-heading"><div class="kitchen-restaurant">${esc(prepared.profile.name)}</div><h2 class="kitchen-title">Kitchen prep sheet</h2></header>
    <dl class="kitchen-meta">${fact('Event',`${values.host_name} - event`)}${fact('Date',date(values.event_date))}${fact('Event time',`${[time(values.start_time),time(values.end_time)].filter(Boolean).join(' - ')} (${values.timezone})`)}${fact('Location',values.venue)}${fact('Guests',values.guest_13_plus_count)}${fact('Children (0–12)',values.child_count)}${fact('Total attendance',values.guest_count)}${fact('Service',plan.service)}${fact('Menu',values.menu)}</dl>
    <section class="kitchen-dietary"><h3>Allergies &amp; dietary needs</h3><p>${esc(values.dietary ?? 'Not supplied — confirm before food service.')}</p></section>
    ${tables}<p class="kitchen-basis">${esc(plan.basis)}</p>
    <section class="kitchen-notes"><strong>Kitchen notes / changes</strong><div class="kitchen-write-line"></div></section>
    ${draftReviewNotes(document)}<footer class="kitchen-footer"><strong>${reviewed?'Reviewed draft':'Draft - not reviewed'}</strong> · EventBrief · Fictional capstone example<br>${esc(mode)} · ${esc(plan.version)}<br>Event time is not a course serve time. Confirm service timing with the event team.</footer></article>
    ${interactive?`<details class="kitchen-source-checks"><summary>Check the source details</summary>${rows.map(row=>`<button class="fact-source" data-field="${esc(row.field)}">${esc(row.field==='guest_count'?'Total attendance':row.label)}</button>`).join('')}<p>Prep quantities use the fictional guide printed on the sheet. They do not come from the host's messages.</p></details>`:''}`;
}

export function standaloneKitchenSheet(document,prepared,reviewed,{fontCss=quoteFontCss}={}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EventBrief - Kitchen prep sheet</title><style>@page{size:Letter;margin:14mm 16mm}html,body{margin:0;padding:0;background:#fff}${kitchenStyles.replace(quoteFontCss,fontCss)}</style></head><body>${renderKitchenSheet(document,prepared,{reviewed})}</body></html>`;
}
