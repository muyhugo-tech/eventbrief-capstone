import { approvedDocumentRows, draftReviewNotes } from './package-export.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export const quoteFonts = [
  {family:'Quote Display',package:'playfair-display',weight:400},
  {family:'Quote Body',package:'montserrat',weight:400},
  {family:'Quote Body',package:'montserrat',weight:600}
].map(font=>({...font,file:`${font.package}-latin-${font.weight}-normal.woff2`}));
export const quoteFontCss = quoteFonts.map(font=>`@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};font-display:swap;src:url('/quote-fonts/${font.file}') format('woff2')}`).join('\n');

// Adapted from the owner's Yannis lib/quotes/document.ts: document hierarchy,
// two-column facts, total band and itemized rows. EventBrief supplies every value.
export const quoteStyles = `${quoteFontCss}
@page{size:Letter;margin:16mm 17mm}
.quote-paper,.quote-paper *{box-sizing:border-box}
.quote-paper{color:#203a32;background:#fff;font:12.67px/1.5 'Quote Body',Arial,sans-serif;max-width:816px;margin:0 auto;padding:48px 52px;border:1px solid #e0e6e2;text-align:left}
.quote-paper .quote-header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #698b76;padding-bottom:16px;margin-bottom:19px}
.quote-paper .quote-brand{font:34px/1.2 'Quote Display',Georgia,serif;letter-spacing:-.5px}
.quote-paper .quote-kicker{font:10.67px/1.6 'Quote Body',Arial,sans-serif;letter-spacing:1.35px;text-transform:uppercase;color:#5b7066}
.quote-paper .quote-preparer{text-align:right}
.quote-paper .quote-title{font:31px/1.2 'Quote Display',Georgia,serif;letter-spacing:0;margin:8px 0 10px;color:#203a32}
.quote-paper p{font:inherit;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;max-width:none}
.quote-paper .quote-details{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 26px;background:#f3f6f4;padding:13px;margin:16px 0}
.quote-paper .quote-details div{min-width:0;overflow-wrap:anywhere}
.quote-paper .quote-details dt{font-size:10.67px;letter-spacing:.85px;text-transform:uppercase;font-weight:600;color:#5b7066;margin-bottom:3px}
.quote-paper .quote-details dd{margin:0;white-space:pre-wrap}
.quote-paper .quote-total{background:#203a32;color:white;padding:14px 19px;margin:17px 0 8px;break-inside:avoid}
.quote-paper .quote-total .quote-kicker{color:#cfdfd5}
.quote-paper .quote-amount{font:38px/1.3 'Quote Display',Georgia,serif}
.quote-paper .quote-breakdown{width:100%;border-collapse:collapse;margin:0 0 15px;font:inherit}
.quote-paper .quote-breakdown caption{text-align:left;font-size:10px;color:#5b7066;padding:3px 0 5px}
.quote-paper .quote-breakdown td,.quote-paper .quote-breakdown th{border-bottom:1px solid #dce4df;padding:7px 0;text-align:left;vertical-align:top;font:inherit}
.quote-paper .quote-breakdown td:first-child{overflow-wrap:anywhere}
.quote-paper .quote-breakdown td:last-child{text-align:right;white-space:nowrap;padding-left:15px;font-variant-numeric:tabular-nums}
.quote-paper .quote-breakdown tfoot th,.quote-paper .quote-breakdown tfoot td{font-weight:600}
.quote-paper .quote-terms{font-size:10.67px;line-height:1.65;color:#5b7066;margin:14px 0;break-inside:avoid}
.quote-paper .quote-footer{border-top:1px solid #dce4df;margin-top:17px;padding-top:10px;font-size:10px;line-height:1.6;color:#5b7066;break-inside:avoid}
.quote-paper .quote-footer strong{font-weight:600;color:#203a32}
.quote-paper tr{break-inside:avoid}.quote-paper h2{break-after:avoid}
.quote-source-tools{display:flex;flex-wrap:wrap;gap:8px 13px;align-items:center;margin:16px auto 0;max-width:816px;font-size:12px;color:#66706d}
#document-preview:has(.quote-paper){background:#f2f4f3;padding:20px;border-radius:5px}
@media(max-width:700px){.quote-paper{padding:25px 21px}.quote-paper .quote-header{flex-wrap:wrap;gap:10px}.quote-paper .quote-preparer{text-align:left}.quote-paper .quote-brand{font-size:28px}.quote-paper .quote-title{font-size:27px}.quote-paper .quote-details{gap:12px 14px;padding:12px}.quote-paper .quote-amount{font-size:32px}#document-preview:has(.quote-paper){padding:8px}}
@media print{.quote-paper{border:0;margin:0;padding:0;max-width:none}.quote-paper .quote-header{flex-wrap:nowrap}.quote-paper .quote-preparer{text-align:right}.quote-paper .quote-brand{font-size:34px}.quote-paper .quote-title{font-size:31px}.quote-paper .quote-amount{font-size:38px}.quote-paper .quote-details{padding:13px;gap:8px 26px}.quote-paper .quote-total,.quote-paper .quote-details{-webkit-print-color-adjust:exact;print-color-adjust:exact}.quote-source-tools{display:none!important}#document-preview:has(.quote-paper){padding:0;background:white}}
@media print{
  .quote-paper .quote-header{padding-bottom:12px;margin-bottom:14px}
  .quote-paper .quote-title{margin:6px 0 8px}
  .quote-paper .quote-details{margin:12px 0}
  .quote-paper .quote-total{margin-top:12px;padding:11px 16px}
  .quote-paper .quote-breakdown{margin-bottom:10px}
  .quote-paper .quote-breakdown td,.quote-paper .quote-breakdown th{padding:5px 0}
  .quote-paper .quote-terms{margin:10px 0}
  .quote-paper .quote-closing{break-inside:avoid}
  .quote-paper .quote-closing h3{font-size:12.67px;line-height:1.4;margin:10px 0 6px}
  .quote-paper .quote-closing p{margin:5px 0}
  .quote-paper .quote-footer{margin-top:12px;padding-top:8px}
}
`;

export function renderGuestQuote(document, prepared, {reviewed=false,interactive=false}={}) {
  if(document.id!=='quote'||document.state!=='ready_for_review'||!document.quote)throw new Error('This quote needs details before it can be downloaded.');
  const rows=approvedDocumentRows(document), values=Object.fromEntries(rows.map(row=>[row.field,row.value]));
  const date=values.event_date?new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${values.event_date}T12:00:00Z`)):'To be confirmed';
  const time=value=>{if(!value)return 'To be confirmed';const [h,m]=value.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;};
  const fact=(label,value)=>`<div><dt>${label}</dt><dd>${esc(value??'To be confirmed')}</dd></div>`;
  const mode=prepared.mode==='authored_reference'?'Authored example - no AI call':prepared.mode==='simulated'?'Test provider - no AI call':'Prepared from AI-extracted event details';
  return `<article class="quote-paper" aria-label="Guest quote preview">
    <header class="quote-header"><div><div class="quote-brand">EventBrief</div><div class="quote-kicker">${esc(prepared.profile.name)} · Event estimate</div></div><div class="quote-kicker quote-preparer">Private events<br>Prepared for your review</div></header>
    <div class="quote-kicker">Your event estimate</div><h2 class="quote-title">A gathering at ${esc(prepared.profile.name)}</h2><p>Prepared for ${esc(values.host_name)}.</p>
    <dl class="quote-details">${fact('Date',date)}${fact('Guests',`${values.guest_13_plus_count} guests · ${values.child_count == null ? 'Children (0–12): not specified' : `${values.child_count} children (0–12)`}`)}${fact('Time',[time(values.start_time),time(values.end_time)].join(' - ')+(values.timezone?`\n${values.timezone}`:''))}${fact('Location',values.venue)}${fact('Menu',values.menu)}${fact('Beverages',values.beverage)}</dl>
    <div class="quote-total"><div class="quote-kicker">${esc(document.quote.total_label ?? 'Estimated total')} · USD</div><div class="quote-amount">${money(document.quote.total_cents)}</div></div>
    <table class="quote-breakdown"><caption>Itemized estimate · fictional prices</caption><tbody>${document.quote.lines.map(line=>`<tr><td>${esc(line.description)} · ${line.quantity} × ${money(line.unit_cents)}</td><td>${money(line.amount_cents)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">${esc(document.quote.total_label ?? 'Estimated total')}</th><td>${money(document.quote.total_cents)}</td></tr></tfoot></table>
    <div class="quote-terms"><p>${esc(document.quote.note)}</p>${document.beverage_notes?`<p><strong>Drink notes:</strong> ${esc(document.beverage_notes)}</p>`:''}${document.beverage_note?`<p>${esc(document.beverage_note)}</p>`:''}<p>This estimate is for review. It does not reserve the venue or confirm a booking.</p></div>
    <div class="quote-closing">${draftReviewNotes(document)}<footer class="quote-footer"><strong>${reviewed?'Reviewed draft':'Draft · not reviewed'}</strong> · Fictional capstone example<br>${mode}. Prepared with ${esc(prepared.profile.version)} restaurant rules.<br>EventBrief · ${esc(prepared.profile.name)}</footer></div>
  </article>${interactive?`<nav class="quote-source-tools" aria-label="Check quote sources"><span>Check source details:</span>${rows.map(row=>`<button class="fact-source" data-field="${esc(row.field)}">${esc(row.label)}</button>`).join('')}<button class="fact-source" data-policy="true">Pricing rules</button></nav>`:''}`;
}

export function standaloneGuestQuote(document,prepared,reviewed,{fontCss=quoteFontCss}={}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EventBrief - Guest quote</title><style>${quoteStyles.replace(quoteFontCss,fontCss)}body{margin:0;background:white}</style></head><body>${renderGuestQuote(document,prepared,{reviewed})}</body></html>`;
}
