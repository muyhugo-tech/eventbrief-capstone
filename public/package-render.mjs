import { reusedInternalDocument } from './package-export.mjs';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const sourceButton = field => `<button class="fact-source" data-field="${escapeHtml(field)}">Source</button>`;

export function renderDocument(document, prepared, { interactive = true, reviewed = false } = {}) {
  const esc = escapeHtml;
  const header = `<div class="restaurant-name">${esc(prepared.profile.name)}</div>
    <h2 class="draft-title">${esc(document.title)}</h2>
    <p class="draft-meta">${esc(document.audience)} · all details fictional</p>
    <span class="draft-label${reviewed ? ' draft-reviewed' : ''}">${reviewed ? 'Reviewed draft' : 'Draft · not reviewed'}</span>
    <span class="draft-label">${esc(prepared.mode === 'authored_reference' ? 'Authored example · no AI call' : prepared.label)}</span>`;
  if (document.state === 'blocked') {
    return `<article class="event-draft">${header}<div class="blocked-draft"><h3>This draft is blocked</h3>
      <p>Resolve the following before preparing this document:</p><ul>${document.blockers.map(blocker => `<li>${esc(blocker.reason)}${interactive ? sourceButton(blocker.field) : ''}</li>`).join('')}</ul>
      <p>No completed draft or quote total has been produced.</p></div></article>`;
  }
  const facts = `<dl class="draft-facts">${document.rows.map(row => `<div class="draft-fact"><dt>${esc(row.label)}</dt><dd>${esc(row.value)}${interactive ? sourceButton(row.field) : ''}</dd></div>`).join('')}</dl>`;
  let content = facts;
  if (document.beverage_note) content += `<p class="draft-note">${esc(document.beverage_note)}</p>`;
  if (document.quote) {
    content += `<table class="quote-table"><caption>Fictional price calculation</caption><thead><tr><th scope="col">Item</th><th scope="col" class="numeric">Qty</th><th scope="col" class="numeric">Each</th><th scope="col" class="numeric">Amount</th></tr></thead>
      <tbody>${document.quote.lines.map(line => `<tr><td>${esc(line.description)}${interactive ? `<span class="calculation">${esc(line.calculation)}</span>` : ''}</td><td class="numeric">${line.quantity}</td><td class="numeric">${money(line.unit_cents)}</td><td class="numeric">${money(line.amount_cents)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row" colspan="3">Draft total · USD</th><td class="numeric">${money(document.quote.total_cents)}</td></tr></tfoot></table>
      <p class="draft-note">${esc(document.quote.note)}</p>`;
  }
  if (document.menu_courses.length) {
    content += `<h3 class="draft-section-title">${esc(prepared.record.fields.menu.value)} · from the fictional menu</h3><ul class="draft-list">${document.menu_courses.map(course => `<li>${esc(course)}</li>`).join('')}</ul>`;
  }
  content += `<p class="draft-note">Prepared from the selected fictional conversation and the ${esc(prepared.profile.version)} restaurant profile. ${interactive ? '<button class="fact-source" data-policy="true">View restaurant rules</button>' : ''} Review does not create a booking, send a message, or make a business commitment.</p>`;
  return `<article class="event-draft">${header}${content}</article>`;
}

export function standaloneDocument(document, prepared, reviewed) {
  const reused = reusedInternalDocument(document, prepared, reviewed);
  if (reused) return reused;
  // Audience-specific export contains only this document, without the full thread or internal record.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(prepared.profile.name)} — ${escapeHtml(document.title)} — fictional draft</title>
    <style>body{font:16px/1.6 Georgia,serif;color:#282332;margin:40px auto;padding:0 24px;max-width:780px}h2{font-size:28px}h3{font-size:20px}.restaurant-name{font-size:26px}.draft-meta,.draft-note{font:14px/1.6 Arial,sans-serif;color:#5d5367}.draft-label{display:inline-block;padding:5px 8px;margin:0 8px 10px 0;background:#fff1d5;font:13px Arial,sans-serif}.draft-fact{display:grid;grid-template-columns:1fr 2fr;gap:20px;border-bottom:1px solid #dcd9e2;padding:10px 0}dt{color:#5d5367}dd{margin:0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:10px 5px;text-align:left;border-bottom:1px solid #dcd9e2}.numeric{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}caption{text-align:left;font-weight:bold;margin:12px 0}tfoot{font-weight:bold}.blocked-draft{border:1px solid #dcd9e2;padding:18px}@media(max-width:500px){body{margin:20px auto;padding:0 16px}.draft-fact{grid-template-columns:1fr;gap:4px}}@media print{body{margin:0;max-width:none}h2,h3{break-after:avoid}tr,.draft-fact{break-inside:avoid}}</style>
    </head><body>${renderDocument(document, prepared, { interactive: false, reviewed })}</body></html>`;
}
