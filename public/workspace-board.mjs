// Reference lock: the user's CRM screenshot owns the white column layout,
// outlined stage markers, count pills, compact cards and horizontal scrolling.
// Yannis EventsIndex contributes event-to-detail navigation and missing-date copy.
// The stages describe saved draft readiness; they never imply a confirmed booking.
const html = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const STAGES = [
  { id: 'messages', title: 'Messages', hint: 'Prepare the latest messages' },
  { id: 'needs-details', title: 'Needs details', hint: 'Fill in what is missing' },
  { id: 'ready', title: 'Ready to review', hint: 'All five drafts are ready' },
  { id: 'reviewing', title: 'In review', hint: 'Check the remaining drafts' },
  { id: 'reviewed', title: 'Reviewed', hint: 'All five drafts checked' },
];
const ASSETS = {
  quote: { title: 'Guest quotes', singular: 'Guest quote', short: 'Quote', description: 'Check the menu, guest count and price before sharing.' },
  kitchen: { title: 'Kitchen sheets', singular: 'Kitchen sheet', short: 'Kitchen', description: 'Check the food, counts and allergy notes for the kitchen.' },
  staff: { title: 'Staff event plans', singular: 'Staff event plan', short: 'Staff', description: 'Check the timing, setup and service details for the team.' },
  guest: { title: 'Guest event plans', singular: 'Guest event plan', short: 'Guest', description: 'Check the plan your event host will receive.' },
};
const ICONS = {
  date: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  venue: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  guests: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5.2"/>',
  quote: '<path d="m3 12 9-9h7a2 2 0 0 1 2 2v7l-9 9L3 12Z"/><circle cx="16" cy="8" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.arrow}</svg>`;
const count = value => Number.isInteger(value) && value >= 0 ? Math.min(value, 5) : 0;
const disabled = busy => busy ? ' disabled' : '';
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function eventStage(item = {}) {
  if (item.pending_update || !Number.isInteger(item.ready_count)) return 'messages';
  if (count(item.ready_count) < 5) return 'needs-details';
  if (count(item.reviewed_count) === 5) return 'reviewed';
  if (count(item.reviewed_count) > 0) return 'reviewing';
  return 'ready';
}

function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return 'Date needed';
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Date needed';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function title(item) { return item.title || 'Untitled event'; }
function assetState(item, documentId) {
  if (item.pending_update) return { id: 'missing', label: 'New messages', action: 'Prepare drafts' };
  const document = item.documents?.find(document => document.id === documentId);
  if (!document) return { id: 'missing', label: 'Not prepared', action: 'Prepare drafts' };
  if (document.state === 'blocked') return { id: 'blocked', label: 'Needs details', action: 'Add details' };
  if (document.state !== 'ready_for_review') return { id: 'missing', label: 'Not prepared', action: 'Prepare drafts' };
  return document.reviewed
    ? { id: 'reviewed', label: 'Reviewed', action: 'Open draft' }
    : { id: 'ready', label: 'Ready to review', action: 'Review draft' };
}

function quoteLabel(item) {
  const state = assetState(item, 'quote').id;
  return (state === 'ready' || state === 'reviewed') && Number.isSafeInteger(item.quote_total_cents) && item.quote_total_cents >= 0
    ? money(item.quote_total_cents) : null;
}

function guestsLabel(item) {
  const guests = Number.isInteger(item.guest_count) && item.guest_count >= 0 ? `${item.guest_count} Guests` : 'Guest count needed';
  const children = Number.isInteger(item.child_count) && item.child_count >= 0 ? ` · ${item.child_count} Children (0–12)` : '';
  return guests + children;
}

function card(item, busy) {
  const eventId = html(item.id);
  const draftTotal = quoteLabel(item);
  const stage = eventStage(item);
  const progress = stage === 'messages' ? (item.pending_update ? 'New messages to prepare' : 'Messages saved')
    : `${count(item.reviewed_count)} of 5 reviewed${stage === 'needs-details' ? ` · ${5 - count(item.ready_count)} need details` : ''}`;
  return `<article class="wb-card">
    <button type="button" class="wb-card-title" data-open-event="${eventId}"${disabled(busy)}><span>${html(title(item))}</span>${icon('arrow')}</button>
    <dl class="wb-card-facts">
      <div><dt>${icon('venue')}<span class="wb-visually-hidden">Venue</span></dt><dd>${html(item.venue || 'Venue needed')}</dd></div>
      <div><dt>${icon('date')}<span class="wb-visually-hidden">Event date</span></dt><dd>${html(dateLabel(item.event_date))}</dd></div>
      <div><dt>${icon('guests')}<span class="wb-visually-hidden">Guest count</span></dt><dd>${html(guestsLabel(item))}</dd></div>
      ${draftTotal ? `<div class="wb-card-value"><dt>${icon('quote')}<span class="wb-visually-hidden">Draft quote</span></dt><dd>${html(draftTotal)} <span>draft quote</span></dd></div>` : ''}
    </dl>
    <p class="wb-card-progress">${html(progress)}</p>
    <div class="wb-card-assets" aria-label="Drafts for ${html(title(item))}">${Object.entries(ASSETS).map(([id, asset]) => {
      const state = assetState(item, id);
      return `<button type="button" class="wb-asset-link wb-status-${state.id}" data-open-event="${eventId}" data-open-document="${id}" aria-label="${html(asset.singular)} for ${html(title(item))}: ${state.label}" title="${state.label}"${disabled(busy)}><span class="wb-status-dot" aria-hidden="true"></span>${asset.short}</button>`;
    }).join('')}</div>
    <p class="wb-card-source">${html(item.source || 'Saved event')}${Number.isInteger(item.revision) && item.revision > 1 ? ` · Version ${item.revision}` : ''}</p>
  </article>`;
}

export function renderBoard(items = [], { busy = false } = {}) {
  const events = Array.isArray(items) ? items : [];
  const empty = events.length === 0 ? `<div class="wb-empty"><h2>Your events start here</h2><p>Paste an event conversation. Prepare the five drafts, then check each one.</p><button type="button" class="button primary" data-create-event${disabled(busy)}>${icon('plus')} New event</button></div>` : '';
  return `${empty}<div class="wb-board" role="region" aria-label="Events by review progress" tabindex="0">${STAGES.map(stage => {
    const column = events.filter(item => eventStage(item) === stage.id);
    return `<section class="wb-column wb-stage-${stage.id}" aria-labelledby="wb-heading-${stage.id}">
      <header class="wb-column-heading"><span class="wb-stage-marker" aria-hidden="true"></span><h2 id="wb-heading-${stage.id}">${stage.title}</h2><span class="wb-count" aria-label="${column.length} events">${column.length}</span>${stage.id === 'messages' ? `<button type="button" class="wb-add" data-create-event aria-label="Add an event"${disabled(busy)}>${icon('plus')}</button>` : ''}</header>
      <p class="wb-column-hint">${stage.hint}</p>
      <div class="wb-column-cards">${column.length ? column.map(item => card(item, busy)).join('') : '<p class="wb-empty-column">No events here</p>'}</div>
      <footer class="wb-column-footer">${column.length} ${column.length === 1 ? 'event' : 'events'}</footer>
    </section>`;
  }).join('')}</div>`;
}

export function renderAssetLibrary(items = [], documentId, { busy = false } = {}) {
  const asset = ASSETS[documentId];
  if (!asset) throw new TypeError('Choose quote, kitchen, staff, or guest.');
  const events = Array.isArray(items) ? items : [];
  if (!events.length) return `<div class="wb-empty"><h2>No ${asset.title.toLowerCase()} yet</h2><p>Start with an event conversation. Your ${asset.singular.toLowerCase()} will appear here.</p><button type="button" class="button primary" data-create-event${disabled(busy)}>${icon('plus')} New event</button></div>`;
  return `<div class="wb-library"><p class="wb-library-intro">${asset.description}</p><div class="wb-asset-list" role="list" aria-label="${asset.title}">${events.map(item => {
    const state = assetState(item, documentId);
    const draftTotal = documentId === 'quote' ? quoteLabel(item) : null;
    return `<article class="wb-asset-row" role="listitem"><div class="wb-asset-main"><h2>${html(title(item))}</h2><p>${html(dateLabel(item.event_date))} · ${html(item.venue || 'Venue needed')}</p><p class="wb-asset-source">${html(item.source || 'Saved event')}</p></div>
      <div class="wb-asset-state"><span class="wb-state-label wb-status-${state.id}"><span class="wb-status-dot" aria-hidden="true"></span>${state.label}</span>${draftTotal ? `<span class="wb-asset-amount">${html(draftTotal)} <small>draft total</small></span>` : ''}</div>
      <button type="button" class="button secondary wb-open-asset" data-open-event="${html(item.id)}" data-open-document="${documentId}" aria-label="${state.action}: ${html(asset.singular)} for ${html(title(item))}"${disabled(busy)}>${state.action}${icon('arrow')}</button>
    </article>`;
  }).join('')}</div></div>`;
}
