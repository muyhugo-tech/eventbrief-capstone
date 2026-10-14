import { restaurantName, approvedDocumentRows, reusedInternalDocument, draftReviewNotes } from './package-export.mjs';
import { renderGuestQuote, standaloneGuestQuote } from './quote-document.mjs';
import { renderKitchenSheet, standaloneKitchenSheet } from './kitchen-document.mjs';
import { renderStaffSheet, standaloneStaffSheet } from './staff-document.mjs';
import { renderGuestSheet, standaloneGuestSheet } from './guest-document.mjs';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const sourceButton = field => `<button class="fact-source" data-field="${escapeHtml(field)}">Source</button>`;
const overviewFields = ['host_name', 'event_date', 'start_time', 'end_time', 'timezone', 'venue', 'guest_13_plus_count', 'child_count', 'guest_count'];

function displayValue(row) {
  if (row.field === 'event_date' && /^\d{4}-\d{2}-\d{2}$/.test(row.value)) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${row.value}T12:00:00Z`));
  }
  if (['start_time', 'end_time'].includes(row.field) && /^\d{2}:\d{2}$/.test(row.value)) {
    const [hour, minute] = row.value.split(':').map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  }
  return row.value;
}

export function renderDocument(document, prepared, { interactive = true, reviewed = false } = {}) {
  const esc = escapeHtml;
  const rows = approvedDocumentRows(document);
  reviewed = reviewed && document.state === 'ready_for_review';
  const header = `<div class="restaurant-name">${esc(restaurantName(prepared.profile))}</div>
    <h2 class="draft-title">${esc(document.title)}</h2>
    <p class="draft-meta">${esc(document.audience)} · all details fictional</p>
    <span class="draft-label${reviewed ? ' draft-reviewed' : ''}">${reviewed ? 'Reviewed draft' : 'Draft · not reviewed'}</span>
    <span class="draft-label">${esc(prepared.mode === 'authored_reference' ? 'Authored example · no AI call' : prepared.label)}</span>`;
  if (document.state !== 'ready_for_review') {
    return `<article class="event-draft">${header}<div class="blocked-draft"><h3>This draft is blocked</h3>
      <p>Correct the detail below, add a note, and save. The drafts will be checked again.</p><ul>${(document.blockers ?? []).map(blocker => `<li>${esc(blocker.reason)}${interactive ? `${sourceButton(blocker.field)} <button class="fact-source" data-fix="${esc(blocker.field)}">Fix this detail</button>` : ''}</li>`).join('')}</ul>
      <p>No completed draft or quote total has been produced.</p></div></article>`;
  }
  if(document.id==='quote')return renderGuestQuote(document,prepared,{reviewed,interactive});
  if(document.id==='kitchen')return renderKitchenSheet(document,prepared,{reviewed,interactive});
  if(document.id==='staff')return renderStaffSheet(document,prepared,{reviewed,interactive});
  if(document.id==='guest')return renderGuestSheet(document,prepared,{reviewed,interactive});
  const facts = (fields, className = 'draft-facts') => {
    const selected = fields.map(field => rows.find(row => row.field === field)).filter(Boolean);
    return selected.length ? `<dl class="${className}">${selected.map(row => `<div class="draft-fact"><dt>${esc(row.field === 'guest_count' ? 'Total attendance' : row.label)}</dt><dd>${esc(displayValue(row))}${interactive ? sourceButton(row.field) : ''}</dd></div>`).join('')}</dl>` : '';
  };
  const section = (title, content) => content ? `<section class="asset-section"><h3 class="draft-section-title">${title}</h3>${content}</section>` : '';
  let content = section('Event details', facts(overviewFields));
  content += draftReviewNotes(document);
  content += `<footer class="asset-review-footer"><p class="draft-note">Prepared from the selected fictional conversation and the ${esc(prepared.profile.version)} restaurant profile. ${interactive ? '<button class="fact-source" data-policy="true">View restaurant rules</button>' : ''} Review does not create a booking, send a message, or make a business commitment.</p></footer>`;
  return `<article class="event-draft asset-${esc(document.id)}">${header}${content}</article>`;
}

export function standaloneDocument(document, prepared, reviewed) {
  if(document.id==='quote'&&document.state==='ready_for_review')return standaloneGuestQuote(document,prepared,reviewed);
  if(document.id==='kitchen'&&document.state==='ready_for_review')return standaloneKitchenSheet(document,prepared,reviewed);
  if(document.id==='staff'&&document.state==='ready_for_review')return standaloneStaffSheet(document,prepared,reviewed);
  if(document.id==='guest'&&document.state==='ready_for_review')return standaloneGuestSheet(document,prepared,reviewed);
  const reused = reusedInternalDocument(document, prepared, reviewed);
  if (reused) return reused;
  // Each export receives only its audience-approved rows, never the full thread.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(restaurantName(prepared.profile))} — ${escapeHtml(document.title)} — fictional draft</title>
    <style>@page{size:Letter;margin:16mm}*{box-sizing:border-box}body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#26372e;margin:36px auto;padding:0 28px;max-width:800px;background:#fff}.restaurant-name{font:28px Georgia,serif;border-bottom:2px solid #395844;padding-bottom:15px}.draft-title{font:30px/1.2 Georgia,serif;margin:25px 0 8px}.draft-meta,.draft-note{font-size:12px;line-height:1.55;color:#58655d}.draft-meta{margin:0 0 16px}.draft-label{display:inline-block;padding:4px 7px;margin:0 7px 8px 0;border:1px solid #d7ddd9;border-radius:3px;font-size:11px}.draft-reviewed{background:#edf5ed}.draft-section-title{font-size:15px;margin:23px 0 8px;break-after:avoid}.draft-facts{margin:0}.draft-fact{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,2fr);gap:16px;border-bottom:1px solid #e0e5e1;padding:7px 0}dt{color:#58655d}dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}.asset-total{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:23px 0 5px;padding:17px;background:#edf3ee;border:1px solid #cdd9cf;border-radius:4px}.asset-total strong{font-size:28px;font-weight:600}.asset-total span{font-size:12px}.draft-list{padding-left:22px;margin:10px 0}.draft-list li{padding:3px 0;overflow-wrap:anywhere}.quote-table{width:100%;border-collapse:collapse;font-size:12px}.quote-table th,.quote-table td{padding:9px 5px;text-align:left;border-bottom:1px solid #dcdedb}.quote-table td:first-child{overflow-wrap:anywhere}.quote-table .numeric{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.quote-table caption{text-align:left;font-weight:bold;margin:14px 0 4px}.quote-table tfoot{font-weight:bold}.asset-review-footer{border-top:1px solid #dcdedb;margin-top:24px;padding-top:8px}.blocked-draft{border:1px solid #dcdedb;padding:18px;margin-top:20px}@media(max-width:500px){body{margin:20px auto;padding:0 16px}.draft-fact{grid-template-columns:1fr;gap:3px}.asset-total strong{font-size:24px}.quote-table{font-size:11px}.quote-table th,.quote-table td{padding:8px 3px}}@media print{body{margin:0;padding:0;max-width:none;font-size:11pt}.draft-note,.draft-meta{font-size:9pt}.quote-table{font-size:9pt}.draft-title{font-size:23pt}h2,h3{break-after:avoid}tr,.draft-fact,.asset-total,.asset-review-footer{break-inside:avoid}thead{display:table-header-group}tfoot{display:table-row-group}p,li{orphans:3;widows:3}.draft-label,.asset-total{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    </head><body>${renderDocument(document, prepared, { interactive: false, reviewed })}</body></html>`;
}
