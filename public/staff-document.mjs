import { approvedDocumentRows, draftReviewNotes } from './package-export.mjs';
import { quoteFontCss } from './quote-document.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)) : value;
const time = value => { if(!/^\d{2}:\d{2}$/.test(value))return value; const [h,m]=value.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`; };

// Reference: the owner's staff execution sheet. Reuses EventBrief's current
// document/PDF infrastructure with an internal-only table and service layout.
export const staffStyles = `${quoteFontCss}
.staff-paper,.staff-paper *{box-sizing:border-box}
.staff-paper{font:13px/1.5 'Quote Body',Arial,sans-serif;color:#111;background:#fff;text-align:left;max-width:816px;margin:0 auto;padding:38px 40px;border:1px solid #ddd}
.staff-paper .staff-restaurant{font-size:23px;font-weight:600;line-height:1.3;letter-spacing:.4px;text-align:center;text-transform:uppercase;margin:0 0 21px}
.staff-paper .staff-title{font:600 18px/1.3 'Quote Body',Arial,sans-serif;text-transform:uppercase;letter-spacing:.3px;margin:0 0 18px;color:#111}
.staff-paper table{width:100%;border-collapse:collapse;table-layout:fixed;font:inherit;color:#111}
.staff-paper table th,.staff-paper table td{border:1px solid #b0b0b0;padding:5px 8px;vertical-align:top;text-align:left;font:inherit;overflow-wrap:anywhere;white-space:pre-wrap}
.staff-paper table th{width:25%;font-weight:600;color:#111}
.staff-paper .staff-summary tr:first-child,.staff-paper .staff-timeline tr:first-child{background:#dedede;font-weight:600}
.staff-paper .staff-summary tr:first-child td{font-weight:600}
.staff-paper .staff-timeline th{width:22%;font-variant-numeric:tabular-nums}
.staff-paper .staff-section{margin:21px 0 0}
.staff-paper .staff-section h3{font:italic 600 15px/1.35 'Quote Body',Arial,sans-serif;letter-spacing:.3px;text-transform:uppercase;margin:0 0 7px;color:#111;break-after:avoid}
.staff-paper ul{padding-left:18px;margin:0}
.staff-paper li{padding:1px 0;white-space:pre-wrap;overflow-wrap:anywhere}
.staff-paper p{margin:0;max-width:none;font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}
.staff-paper .staff-pricing-line{display:block}
.staff-paper .staff-total{display:block;font-weight:600;margin-top:2px}
.staff-paper .staff-small{font-size:10px;line-height:1.5;color:#444;margin-top:5px}
.staff-paper .staff-instructions{border-left:3px solid #aaa;padding-left:10px}
.staff-paper .staff-footer{border-top:1px solid #bbb;margin-top:18px;padding-top:8px;font-size:10px;line-height:1.5;color:#444;overflow-wrap:anywhere}
.staff-source-checks{max-width:816px;margin:17px auto 0;font-size:12px;line-height:1.8}
.staff-source-checks summary{cursor:pointer}
.staff-source-checks .fact-source{margin:4px 4px 0 0}
@media screen and (max-width:700px){.staff-paper{padding:24px 15px;font-size:12px}.staff-paper .staff-restaurant{font-size:20px}.staff-paper .staff-title{font-size:16px}.staff-paper table th{width:33%}.staff-paper .staff-timeline th{width:28%}.staff-paper table th,.staff-paper table td{padding:5px 6px}.staff-paper .staff-section h3{font-size:13px}}
@media print{.staff-paper{max-width:none;border:0;padding:0;margin:0;font-size:9pt;line-height:1.4}.staff-paper .staff-restaurant{font-size:17pt;margin-bottom:14pt}.staff-paper .staff-title{font-size:13pt;margin-bottom:12pt}.staff-paper table th,.staff-paper table td{padding:3.5pt 6pt}.staff-paper .staff-section{margin-top:13pt}.staff-paper .staff-section h3{font-size:10.5pt;margin-bottom:5pt}.staff-paper .staff-small,.staff-paper .staff-footer{font-size:7.5pt}.staff-paper .staff-section p{orphans:3;widows:3}.staff-paper .staff-restaurant,.staff-paper .staff-title{break-after:avoid}.staff-paper tr,.staff-paper li,.staff-paper .staff-footer{break-inside:avoid}.staff-paper tr{-webkit-print-color-adjust:exact;print-color-adjust:exact}.staff-source-checks{display:none}}
`;

function pricingSummary(pricing) {
  if(!pricing)return 'Needs confirmation - open the guest quote to check missing pricing details.';
  const groups=[['guest_13_plus_count','Guests'],['child_count','Children (0–12)']];
  const prices=groups.map(([field,label])=>{
    const lines=pricing.lines.filter(line=>line.source_fields.includes(field));
    if(!lines.length)return '';
    return `<span class="staff-pricing-line">${esc(label)}: ${lines.map(line=>`${money(line.unit_cents)} ${line.source_fields.includes('menu')?'menu':'drinks'}`).join(' + ')} per person</span>`;
  }).join('');
  return `${prices}<span class="staff-total">${esc(pricing.total_label ?? 'Estimated total')}: ${money(pricing.total_cents)}</span><span class="staff-small">${esc(pricing.beverages_excluded ? pricing.note : 'Fictional prices; all demo charges included.')}</span>`;
}

export function renderStaffSheet(document,prepared,{reviewed=false,interactive=false}={}) {
  if(document.id!=='staff'||document.state!=='ready_for_review')throw new Error('A ready staff sheet is required.');
  const rows=approvedDocumentRows(document),v=Object.fromEntries(rows.map(row=>[row.field,row.value]));
  const row=(label,value)=>`<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`;
  const bullet=(label,value)=>value==null?'':`<li>${label?`<strong>${esc(label)}:</strong> `:''}${esc(value)}</li>`;
  const attendance=[v.guest_13_plus_count==null?null:String(v.guest_13_plus_count),v.child_count==null?null:`Children (0–12): ${v.child_count}`,`Total attendance: ${v.guest_count}`].filter(Boolean).join(' · ');
  const mode=prepared.mode==='authored_reference'?'Authored example - no AI call':prepared.label;
  return `<article class="staff-paper" aria-label="Staff execution sheet preview"><header><div class="staff-restaurant">${esc(prepared.profile.name)}</div><h2 class="staff-title">Execution sheet - staff-facing</h2></header>
    <table class="staff-summary" aria-label="Event details for staff"><tbody>${row('Event',`${v.host_name}'s event`)}${row('Date',date(v.event_date))}${row('Time',`${time(v.start_time)} - ${v.end_time ? time(v.end_time) : 'End time to confirm'} (${v.timezone})`)}${row('Location',v.venue)}${row('Guests',attendance)}${row('Menu',v.menu)}${row('Coordinator (CC)','Confirm assignment; see team instructions.')}<tr><th scope="row">Pricing</th><td>${pricingSummary(document.staff_pricing)}</td></tr></tbody></table>
    <section class="staff-section"><h3>Service flow &amp; timeline</h3><table class="staff-timeline" aria-label="Event schedule"><tbody>${row(time(v.start_time),'Event starts')}${v.end_time ? row(time(v.end_time),'Event ends') : ''}</tbody></table><p class="staff-small">Course serving times are not supplied separately. Confirm them with the kitchen; check team instructions below for any saved service notes.</p></section>
    <section class="staff-section"><h3>Food &amp; beverage notes</h3><ul>${bullet('Menu',(document.menu_courses??[]).join('; '))}${bullet('Beverages',v.beverage)}${bullet('Drink notes',document.beverage_notes)}${bullet('',document.beverage_note)}${bullet('Allergies & dietary needs',v.dietary ?? 'Not supplied — confirm before food service.')}</ul></section>
    <section class="staff-section"><h3>Setup / floor plan</h3><ul>${bullet('Table setup',v.setup)}${bullet('AV / equipment',v.av)}${bullet('Special requirements',v.special)}</ul></section>
    <section class="staff-section"><h3>Team instructions</h3><p class="staff-instructions">${esc(v.staff_notes ?? 'No additional staff notes supplied.')}</p></section>
    ${draftReviewNotes(document)}<footer class="staff-footer"><strong>${reviewed?'Reviewed draft':'Draft - not reviewed'}</strong> · Internal staff copy · EventBrief<br>Fictional capstone example · ${esc(mode)} · ${esc(prepared.profile.version)}</footer></article>
    ${interactive?`<details class="staff-source-checks"><summary>Check the source details</summary>${rows.map(row=>`<button class="fact-source" data-field="${esc(row.field)}">${esc(row.field==='guest_count'?'Total attendance':row.label)}</button>`).join('')}<button class="fact-source" data-policy="true">Pricing rules</button><p>Use Edit event details → Internal staff notes to add confirmed coordinator or service instructions. Notes appear exactly as saved; check any written times when the schedule changes.</p></details>`:''}`;
}

export function standaloneStaffSheet(document,prepared,reviewed,{fontCss=quoteFontCss}={}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EventBrief - Staff execution sheet</title><style>@page{size:Letter;margin:14mm 16mm}html,body{margin:0;padding:0;background:#fff}${staffStyles.replace(quoteFontCss,fontCss)}</style></head><body>${renderStaffSheet(document,prepared,{reviewed})}</body></html>`;
}
