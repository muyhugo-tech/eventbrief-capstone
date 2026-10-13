import { FIELD_DEFINITIONS, PACKAGE_STATUSES } from '/package-contract.mjs';
import { escapeHtml as esc, renderDocument, standaloneDocument } from '/package-render.mjs';
import { assetFilename } from '/package-export.mjs';
import { renderBoard, renderAssetLibrary } from '/workspace-board.mjs';
import { renderCalendar, calendarMonth, shiftMonth, calendarFile } from '/workspace-calendar.mjs';
import { inboxThreads, renderInboxThreads, renderInboxDetail } from '/workspace-inbox.mjs';
import { restaurantSettingsPanel } from '/restaurant-settings.mjs';

const $ = selector => document.querySelector(selector);
const sessions = new Map();
let scenarios = [];
let currentId = null;
let currentMode = 'reference';
let live = { ready: false, remaining: 0, mode: 'live' };
let updates = null;
let history = [];
let selectedDocument = 'calendar';
let busy = false;
let workspace = false;
let events = [];
let sourceVersions = {};
let demo = null;
let overview = false;
let hosted = null;
let accessBusy = false;
let workspaceView = 'events';
let eventLayout = 'board';
let calendarViewMonth = null;
let accessInitialized = false;
let eventEdit = null;
let restaurantSettingsRevision = 0;
let inboxId = null;
let inboxData = null;
let inboxReviews = {};
let inboxError = '';
let inboxLoading = false;
let inboxHighlight = null;
let inboxComposeTarget = null;
const editGroups = [
  ['attendance', 'Guests and children', ['guest_13_plus_count', 'child_count']],
  ['event_date', 'Event date', ['event_date']],
  ['times', 'Event times', ['start_time', 'end_time']],
  ...['host_name', 'venue', 'menu', 'beverage', 'dietary', 'setup', 'av', 'special', 'guest_notes', 'staff_notes', 'timezone', 'booking_status'].map(field => [field, FIELD_DEFINITIONS[field].label, [field]])
];
const viewNames = {inbox:'Inbox',events:'Events',calendar:'Calendar',quote:'Guest quotes',kitchen:'Kitchen sheets',staff:'Staff event plans',guest:'Guest event plans',settings:'Restaurant settings'};
const settingsPanel = restaurantSettingsPanel($('#restaurant-settings'), {request, lock:setBusy, changed:async()=>{sessions.clear(); openSession(); inboxData=null; await refreshListing();}});
// Retain existing public/local browser drafts; private selections and unsent
// text have separate keys and are never restored into the public sample.
const browserKey = suffix => `eventbrief.package.${hosted?.workspace === 'private' ? 'private.' : ''}${suffix}`;
const storageMessage = () => hosted?.workspace === 'private' ? 'Saved in your private workspace. Open Events to see changes from another browser.' : hosted ? 'Saved in this browser’s public sample area. Private events are separate.' : 'Progress saved on this computer.';
const isPasted = () => currentId === 'new' || currentId?.startsWith('pasted-');
const post = (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function rememberSelection() {
  try { localStorage.setItem(browserKey('selection'), JSON.stringify({id:currentId, mode:currentMode, document:selectedDocument, view:overview?workspaceView:'event', layout:eventLayout, inbox_id:inboxId, run_id:session()?.data?.extraction?.run_id??null})); }
  catch { $('#save-status').textContent = hosted ? 'Your place could not be saved in this browser. Your completed reviews are still saved.' : 'Your place could not be saved in this browser. Completed reviews still save on this computer.'; }
}
const session = () => sessions.get(`${currentMode}:${currentId}`);
function openSession() {
  const key = `${currentMode}:${currentId}`;
  if (!sessions.has(key)) sessions.set(key, { data: null, corrections: {}, reviews: {}, feedback: [], attempt: null, sequence: 0 });
}
const currentInput = () => scenarios.find(input => input.id === currentId);
const versionFor = (id = currentId) => sourceVersions[id] ?? (id === currentId ? session()?.data?.version : null);
const referenceAvailable = (id = currentId) => Boolean(sourceVersions[id]?.reference_available || (!id?.startsWith('pasted-') && id !== 'new'));
const isEarlier = () => Boolean(sourceVersions[currentId]?.superseded || (!isPasted() && updates?.active_scenario_id && currentId !== updates.active_scenario_id) || session()?.data?.version?.superseded);
const canAnalyze = () => (!hosted || hosted.unlocked) && live.ready && live.remaining > 0 && !live.paused && !live.in_flight;
const isGuidedReply = () => Boolean(sourceVersions[currentId]?.reference_available && versionFor()?.revision === 1 && $('#reply-role').value === 'host' && $('#reply-text').value.trim() === demo?.reply);
function renderReplyCost() {
  const guided = isGuidedReply();
  const guidedStart = sourceVersions[currentId]?.reference_available && versionFor()?.revision === 1 && !$('#reply-text').value.trim();
  $('#reply-help').textContent = guided ? 'Written sample results · no AI call.' : guidedStart ? `The sample reply is free. ${canAnalyze() ? 'A different reply uses one AI preparation.' : 'A different reply can be saved for later.'}` : canAnalyze() ? 'Updating these drafts uses one AI preparation.' : 'Your reply will be saved. AI preparation is currently unavailable.';
  $('#submit-reply').textContent = busy ? 'Updating drafts…' : guided || canAnalyze() ? 'Update drafts' : 'Save reply';
}
function applyListing(data) {
  restaurantSettingsRevision = data.restaurant_settings_revision ?? 0;
  scenarios = data.scenarios; live = data.live; updates = data.updates; history = data.history ?? []; workspace = data.workspace;
  events = data.events ?? []; sourceVersions = data.source_versions ?? {}; demo = data.demo ?? null;
  hosted = data.hosted ?? null;
  $('#package-scenario').innerHTML = (workspace ? '<option value="new">New event · paste messages</option>' : '') + scenarios.map(input => `<option value="${esc(input.id)}">${esc(input.title)}${sourceVersions[input.id]?.superseded ? ' · earlier version' : ''}</option>`).join('');
  $('#package-scenario').value = currentId;
  renderAccess();
  renderEvents();
  renderInboxList();
}
async function refreshListing() { applyListing(await request('/api/package/scenarios')); }
function renderAccess() {
  $('#hosted-access').hidden = !hosted;
  $('#workspace-access-settings').hidden = !hosted;
  if (!hosted) return;
  if(!accessInitialized) {$('#workspace-access-settings').open=!hosted.unlocked;accessInitialized=true;}
  $('.demo-badge').textContent = hosted.unlocked ? 'Private workspace' : 'Public sample';
  $('.rail-intro span').textContent = hosted.unlocked ? 'Shared private workspace' : 'This browser’s samples';
  $('.storage-note').textContent = `${storageMessage()} Nothing is sent or booked.`;
  $('footer span').textContent = 'Capstone prototype · all data fictional';
  $('#hosted-unlock-form').hidden = hosted.unlocked;
  $('#hosted-lock-button').hidden = !hosted.unlocked;
  $('#hosted-lock-button').disabled = busy || accessBusy;
  $('#hosted-access-code').disabled = busy || accessBusy;
  $('#hosted-unlock-button').disabled = busy || accessBusy;
  $('#hosted-unlock-button').textContent = accessBusy ? 'Checking…' : 'Open private workspace';
  $('#hosted-try-demo').disabled = busy || accessBusy || !demo?.available;
  $('#hosted-try-demo').textContent = hosted.unlocked ? 'Open public sample' : 'Try a sample';
  $('#hosted-access-status').textContent = accessBusy ? 'Please wait…' : hosted.unlocked ? `Your private workspace is open. Events and reviews are shared across browsers.${hosted.ai_configured ? '' : ' AI is currently unavailable.'}` : 'Private events are locked. The public sample is ready to try.';
  $('#package-mode option[value="live"]').disabled = !live.ready || !hosted.unlocked;
}
function accessError(message) {
  $('#hosted-access-error').textContent = message;
  $('#hosted-access-error').hidden = !message;
  $('#hosted-access-code').setAttribute('aria-invalid', String(Boolean(message)));
}
async function changeAccess(unlock) {
  if (busy || accessBusy || !hosted) return;
  const code = $('#hosted-access-code').value;
  if (unlock && !code.trim()) { accessError('Enter your access code.'); $('#hosted-access-code').focus(); return; }
  accessBusy = true; accessError(''); setBusy(true);
  $('#prepare').textContent = 'Please wait…';
  $('#hosted-access-code').value = '';
  try {
    await post(unlock ? '/api/hosted/unlock' : '/api/hosted/lock', unlock ? {code} : {});
    // A full reload discards rendered documents, sessions and edits from the
    // previous scope before loading the other workspace's saved selection.
    window.location.reload();
  } catch (error) {
    accessError(error.message || 'Could not change AI access. Please try again.');
  } finally {
    accessBusy = false; setBusy(false);
    if (hosted.unlocked) $('#hosted-lock-button').focus();
    else $('#hosted-access-code').focus();
  }
}
$('#hosted-unlock-form').addEventListener('submit', event => { event.preventDefault(); changeAccess(true); });
$('#hosted-lock-button').addEventListener('click', () => changeAccess(false));
function renderHistory() {
  const eventId = versionFor()?.event_id;
  const entries = eventId ? history.filter(entry => entry.event_id === eventId || sourceVersions[entry.scenario_id]?.event_id === eventId) : history.filter(entry => entry.scenario_id === currentId);
  const savedSources = new Set(entries.filter(entry => entry.status === 'succeeded').map(entry => entry.scenario_id));
  const authored = Object.entries(sourceVersions).filter(([id, version]) => version.event_id === eventId && version.reference_available && !savedSources.has(id));
  $('#history-panel').hidden = !entries.length && !authored.length;
  $('#package-history').innerHTML = entries.map(entry => `<li><span>Version ${sourceVersions[entry.scenario_id]?.revision ?? 1} · ${entry.superseded || sourceVersions[entry.scenario_id]?.superseded ? 'Earlier version' : 'Saved result'} · ${esc(new Date(entry.saved_at).toLocaleString())}</span> ${entry.status === 'succeeded' ? `<button class="text-button" data-saved-run="${esc(entry.run_id)}" data-scenario="${esc(entry.scenario_id)}">Open saved drafts</button>` : '<span>Preparation did not complete.</span>'}</li>`).join('') + authored.map(([id, version]) => `<li><span>Version ${version.revision} · ${version.superseded ? 'Earlier version' : 'Current version'} · written example</span> <button class="text-button" data-open-event="${esc(id)}">Open example drafts</button></li>`).join('');
}
const statusText = status => ({ unknown: 'Missing', conflicting: 'Conflicting', stated: 'Stated', requested: 'Requested', agreed: 'Agreed' })[status];

// Ported from Yanni's lib/events/index-view.ts: count the actual filtered records.
const countLabel = (shown, total) => `Showing ${shown} of ${total}`;
function eventRows() {
  if (workspace) return events;
  return scenarios.filter(input => !sourceVersions[input.id]?.superseded).map(input => ({event_id: input.id, current_scenario_id: input.id, title: input.title, revision: 1, scenario_ids: [input.id]}));
}
function eventDisplay(item) {
  const id = item.current_scenario_id;
  const captured = sessions.get(`live:${id}`) ?? sessions.get(`reference:${id}`);
  const fields = captured?.data?.record.fields;
  const saved = history.some(entry => entry.scenario_id === id && entry.status === 'succeeded');
  const blocked = captured?.data?.documents.filter(doc => doc.state === 'blocked').length;
  const reviewed = captured?.data?.documents.filter(doc => captured.reviews[doc.id]?.revision === doc.revision).length;
  const summary = item.summary ?? {};
  const blockedCount = blocked ?? (typeof summary.ready_count === 'number' ? 5 - summary.ready_count : null);
  const reviewedCount = reviewed ?? summary.reviewed_count;
  return {
    title: fields?.host_name?.value ? `${fields.host_name.value} · event` : item.title,
    note: fields ? [fields.event_date?.value, fields.venue?.value].filter(Boolean).join(' · ') : [summary.event_date, summary.guest_count ? `${summary.guest_count} people` : null].filter(Boolean).join(' · ') || 'Saved conversation',
    state: item.pending_update ? 'Update needed' : blockedCount ? `Needs details · ${blockedCount} blocked` : reviewedCount === 5 ? 'All drafts reviewed' : typeof reviewedCount === 'number' ? `${reviewedCount} of 5 reviewed` : saved ? 'Drafts saved' : sourceVersions[id]?.reference_available ? 'Example ready' : 'Ready to prepare',
    tone: item.pending_update || blockedCount ? 'waiting' : saved || captured?.data || typeof summary.ready_count === 'number' ? 'ready' : '',
    source: sourceVersions[id]?.reference_available ? 'Written example' : saved ? 'AI + human review' : 'Pasted messages'
  };
}
function renderEvents() {
  const rows = eventRows();
  const needle = $('#event-search').value.trim().toLowerCase();
  const filtered = rows.filter(item => `${item.title} ${eventDisplay(item).title}`.toLowerCase().includes(needle));
  $('#rail-event-count').textContent = rows.length;
  $('#events-count').textContent = countLabel(filtered.length, rows.length);
  $('#events-empty').hidden = filtered.length > 0;
  $('#events-empty').textContent = rows.length ? 'No events match. Try a different name.' : 'No saved events yet. Click New event to start.';
  $('#event-rows').innerHTML = filtered.map(item => {
    const display = eventDisplay(item);
    return `<tr><td><button class="event-open" data-open-event="${esc(item.current_scenario_id)}"${busy ? ' disabled' : ''}>${esc(display.title)}</button><p class="event-row-note">${esc(display.note)}</p></td><td data-label="Progress"><span class="event-state ${display.tone}">${esc(display.state)}</span></td><td data-label="Version">${item.revision ?? 1}</td><td data-label="Source">${esc(display.source)}</td></tr>`;
  }).join('');
  $('#recent-events').innerHTML = rows.slice(-7).reverse().map(item => {
    const display = eventDisplay(item);
    return `<button class="recent-event" data-open-event="${esc(item.current_scenario_id)}" aria-current="${item.scenario_ids?.includes(currentId) ?? item.current_scenario_id === currentId}"${busy ? ' disabled' : ''}><strong>${esc(display.title)}</strong><span>${esc(display.state)}</span></button>`;
  }).join('');
  const items = workspaceItems();
  $('#event-board').innerHTML = renderBoard(items.filter(item => item.title.toLowerCase().includes(needle)), {busy});
  $('#event-board').hidden = eventLayout !== 'board';
  $('#events-table-wrap').hidden = eventLayout !== 'list';
  for (const button of document.querySelectorAll('[data-event-layout]')) button.setAttribute('aria-pressed', String(button.dataset.eventLayout === eventLayout));
  if (!calendarViewMonth && overview && workspaceView==='calendar') calendarViewMonth = calendarMonth(items);
  $('#calendar-content').innerHTML = renderCalendar(items, {month:calendarViewMonth??calendarMonth(items),busy});
  if (['quote','kitchen','staff','guest'].includes(workspaceView)) {
    const search = $('#asset-search').value.trim().toLowerCase();
    $('#asset-library').innerHTML = renderAssetLibrary(items.filter(item => item.title.toLowerCase().includes(search)),workspaceView,{busy});
  }
}
function workspaceItems() {
  return eventRows().map(item => {
    const id = item.current_scenario_id;
    const captured = sessions.get(`live:${id}`) ?? sessions.get(`reference:${id}`);
    const data = !item.pending_update ? captured?.data : null;
    const summary = item.summary ?? {};
    const value = field => data?.record.fields[field]?.value ?? summary[field] ?? null;
    const documents = data ? data.documents.map(doc => ({id:doc.id,title:doc.title,state:doc.state,reviewed:doc.state==='ready_for_review'&&captured.reviews[doc.id]?.revision===doc.revision})) : summary.documents ?? [];
    return {id,event_id:item.event_id,title:value('host_name') ? `${value('host_name')}’s event` : item.title,
      event_date:value('event_date'),start_time:value('start_time'),end_time:value('end_time'),timezone:value('timezone'),venue:value('venue'),
      guest_count:value('guest_13_plus_count'),child_count:value('child_count'),total_count:value('guest_count'),
      ready_count:data?documents.filter(doc=>doc.state==='ready_for_review').length:summary.ready_count,
      reviewed_count:data?documents.filter(doc=>doc.reviewed).length:summary.reviewed_count,
      documents,quote_total_cents:data?data.documents.find(doc=>doc.id==='quote')?.quote?.total_cents??null:summary.quote_total_cents,
      pending_update:item.pending_update,source:eventDisplay(item).source,revision:item.revision??1};
  });
}
function showOverview(value, view = 'events') {
  overview = value;
  if (value) workspaceView = view;
  $('#events-overview').hidden = !value || workspaceView !== 'events';
  $('#calendar-overview').hidden = !value || workspaceView !== 'calendar';
  $('#assets-overview').hidden = !value || ['events','calendar'].includes(workspaceView);
  $('#event-workbench').hidden = value;
  $('#inbox-overview').hidden = !value || workspaceView !== 'inbox';
  $('#restaurant-settings').hidden = !value || workspaceView !== 'settings';
  if(['inbox','settings'].includes(workspaceView)) $('#assets-overview').hidden = true;
  $('#page-title').textContent = value ? viewNames[workspaceView] : currentId === 'new' ? 'New event' : 'Event workspace';
  $('#assets-heading').textContent = viewNames[workspaceView];
  $('#assets-help').textContent = {quote:'Open a quote. Check the price and details, then download or print it.',kitchen:'Open a kitchen sheet. Check the menu, numbers and dietary details.',staff:'Open a staff plan. Check the schedule, setup and team instructions.',guest:'Open a guest plan. Check what the host and their guests need to know.'}[workspaceView] ?? '';
  for (const button of document.querySelectorAll('.workspace-nav button')) {
    const active = button.id==='show-events' ? !value || workspaceView==='events' : button.dataset.workspace===workspaceView && value;
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  renderEvents();
  rememberSelection();
}
async function chooseScenario(id, preferredRun = null) {
  if (busy) return;
  closeInboxCompose();
  closeEventEdit();
  currentId = id;
  const saved = history.find(entry => entry.scenario_id === id && entry.status === 'succeeded' && (!preferredRun || entry.run_id === preferredRun));
  currentMode = saved ? 'live' : referenceAvailable(id) ? 'reference' : 'live';
  $('#package-mode').value = currentMode;
  $('#package-scenario').value = currentId;
  $('#reply-form').hidden = true; $('#show-reply').setAttribute('aria-expanded', 'false');
  openSession(); showOverview(false);
  announce(''); announce('', true); $('#save-status').textContent = ''; renderPackage(); setBusy(true);
  try {
    if (currentId !== 'new' && (currentMode === 'reference' || saved)) await openSaved(currentMode === 'live' ? saved.run_id : null);
    restoreReplyDraft(); rememberSelection(); renderPackage();
  } catch (error) { announce(error.message, true); }
  finally { setBusy(false); }
}

function announce(message, error = false) {
  const target = $(error ? '#package-error' : '#package-notice');
  target.textContent = message;
  target.hidden = !message;
}

async function request(path, options) {
  const headers = new Headers(options?.headers);
  if (hosted && path.startsWith('/api/package/')) headers.set('X-EventBrief-Workspace', hosted.workspace);
  const response = await fetch(path, {...options, headers});
  const result = await response.json();
  if (result.code === 'WORKSPACE_CHANGED') window.location.reload();
  if (!response.ok) { const error = new Error(result.error || 'The package could not be prepared.'); error.details = result; throw error; }
  return result;
}

function setBusy(value) {
  busy = value;
  $('#prepare').disabled = value || (isEarlier() && currentMode === 'live') || (currentMode === 'live' && !canAnalyze());
  $('#prepare').textContent = value ? 'Preparing five drafts…' : versionFor()?.pending_update ? 'Prepare updated drafts' : 'Prepare five drafts';
  $('#prepare').hidden = Boolean(session()?.data);
  $('#package-scenario').disabled = value;
  $('#package-mode').disabled = value;
  $('#package-mode').closest('label').hidden = isPasted() || sourceVersions[currentId]?.reference_available;
  $('#event-messages').disabled = value;
  for (const control of document.querySelectorAll('#inbox-overview button, #inbox-overview input, #inbox-overview select, #inbox-overview textarea, #event-inbox-source')) control.disabled = value;
  for (const control of document.querySelectorAll('#restaurant-settings button, #restaurant-settings input, #restaurant-settings select, #restaurant-settings textarea')) control.disabled = value || Boolean(hosted && !hosted.unlocked && !control.matches('[data-section],[data-reload]'));
  $('#paste-example').disabled = value;
  $('#download-attempt').disabled = value;
  $('#add-update').disabled = value || !updates?.available || currentId !== 'patio-complete' || !session()?.data;
  for (const button of document.querySelectorAll('#recent-events button, #event-rows button, #event-board button, #calendar-content button, #asset-library button, [data-workspace], [data-event-layout], #new-event, #header-new-event, #show-events, #try-demo, #show-reply, #submit-reply, #cancel-reply, #fill-demo-reply, #open-current')) button.disabled = value;
  $('#reply-role').disabled = value;
  for (const control of document.querySelectorAll('[data-calendar-month]')) control.disabled = value;
  $('#reply-text').disabled = value;
  renderReplyCost();
  for (const button of document.querySelectorAll('#package-history button')) button.disabled = value;
  $('#package-result').setAttribute('aria-busy', String(value));
  $('#inbox-detail').setAttribute('aria-busy', String(value));
  for (const button of document.querySelectorAll('#package-result button, #package-fields button')) button.disabled = value;
  for (const control of document.querySelectorAll('#event-edit-form input, #event-edit-form select, #event-edit-form textarea')) control.disabled = value;
  $('#save-event-edit').textContent = value && eventEdit ? 'Saving changes…' : 'Save changes';
  if (!value && session()?.data) renderSelected();
  if (isEarlier()) for (const button of document.querySelectorAll('#package-fields [data-edit], #package-fields [data-undo]')) button.disabled = true;
  renderAccess();
  renderInboxList();
  if(overview && workspaceView==='inbox') renderInboxContent();
}

function renderMessages(highlight = null) {
  const input = currentInput();
  if(!input) { $('#package-message-count').textContent='';$('#source-summary').textContent='';$('#package-messages').textContent='Paste messages above to get started.';return; }
  if(input.source_kind==='pasted') {
    $('#package-message-count').textContent = `${input.messages.length} saved ${input.messages.length === 1 ? 'message block' : 'message blocks'}`;
    $('#source-summary').textContent = input.messages.length > 1 ? `Original conversation + ${input.messages.length - 1} ${input.messages.length === 2 ? 'reply' : 'replies'}` : 'Pasted messages';
    $('#package-messages').innerHTML = input.messages.map((message, index) => {
      const active = message.id === highlight?.message_id;
      const body = active ? esc(message.body).replace(esc(highlight.quote), `<mark>${esc(highlight.quote)}</mark>`) : esc(message.body);
      return `<article class="message${active ? ' active-source' : ''}" id="pkg-message-${esc(message.id)}" tabindex="-1"><h3>${index === 0 ? 'Original event messages' : message.role === 'customer' || message.role === 'host' ? 'Reply from host' : 'Reply from restaurant'}</h3><p class="message-body">${body}</p></article>`;
    }).join('');
    return;
  }
  $('#package-message-count').textContent = `${input.messages.length} messages`;
  $('#source-summary').textContent = `${input.messages.length} messages${session()?.data ? ` · ${Object.keys(FIELD_DEFINITIONS).length} fields` : ''}`;
  $('#package-messages').innerHTML = input.messages.map((message, index) => {
    let body = esc(message.body);
    const active = message.id === highlight?.message_id;
    if (active) body = body.replace(esc(highlight.quote), `<mark>${esc(highlight.quote)}</mark>`);
    return `<article class="message${active ? ' active-source' : ''}" id="pkg-message-${esc(message.id)}" tabindex="-1">
      <div class="message-heading"><span class="message-number">${index + 1}</span><span class="sender">${message.role === 'customer' ? 'Host' : 'Coordinator'}</span><time datetime="${esc(message.sent_at)}">${new Date(message.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</time></div>
      <p class="source-email">From: ${esc(message.sender)}<br>To: ${esc(message.recipient)}<br>${esc(message.subject)}</p><p class="message-body">${body}</p></article>`;
  }).join('');
}

function evidenceHtml(detail) {
  if (detail.provenance === 'coordinator_correction') return `<p class="correction-note">Coordinator correction: ${esc(detail.reason)}<br>No source quotation is inherited by this correction.</p>`;
  if (!detail.evidence.length) return '<p class="empty">This information is not supplied in the selected snapshot.</p>';
  return `<div class="evidence-list">${detail.evidence.map(citation => `<button class="evidence" data-message="${esc(citation.message_id)}" data-quote="${esc(citation.quote)}"><span class="source-tag">${esc(citation.message_id.toUpperCase())}</span><span class="quote">“${esc(citation.quote)}”</span></button>`).join('')}</div>`;
}

function renderFields() {
  const data = session().data;
  $('#package-fields').innerHTML = Object.entries(FIELD_DEFINITIONS).map(([field, definition]) => {
    const detail = data.record.fields[field];
    const corrected = Object.hasOwn(data.corrections, field);
    return `<details class="field-entry" id="pkg-field-${field}"><summary><span>${esc(definition.label)}</span><strong>${esc(detail.value ?? statusText(detail.status))}</strong></summary>
      <span class="status ${esc(detail.status)}">${statusText(detail.status)}</span>${detail.preparation?`<p class="correction-note">${esc(detail.preparation.description)}</p>`:''}${detail.notes?`<p><strong>Drink notes:</strong> ${esc(detail.notes)}</p>`:''}${evidenceHtml(detail)}
      ${corrected || detail.preparation ? `<details><summary>Original ${data.mode === 'authored_reference' ? 'authored' : 'extracted'} value</summary><p class="correction-note">${esc(data.original_record.fields[field].value ?? 'Missing')}</p>${evidenceHtml(data.original_record.fields[field])}</details>` : ''}
      <div class="item-actions"><button class="text-button" data-edit="${field}">Correct ${esc(definition.label.toLowerCase())}</button>${corrected ? `<button class="text-button" data-undo="${field}">Undo correction</button>` : ''}</div><div id="pkg-edit-${field}"></div></details>`;
  }).join('');
}

function renderPolicy() {
  const profile = session().data.profile;
  $('#policy-panel').hidden = false;
  $('#policy-content').innerHTML = `<h2>${esc(profile.name)} · ${esc(profile.version)}</h2><p>These are deliberately small fictional rules for this example. Explicit dietary, AV, or special requests still need confirmation. Missing optional notes do not stop draft preparation.</p>
    <p>Service: ${esc(profile.opening_time)}–${esc(profile.closing_time)}, ${esc(profile.timezone)}. Same-day events only. These rules do not establish availability.</p>
    <ul>${Object.entries(profile.venues).map(([name, venue]) => `<li>${esc(name)}: capacity ${venue.capacity}; setups: ${venue.setups.map(esc).join(', ')}.</li>`).join('')}</ul>
    <h3>Fictional prices per guest · USD</h3><ul>${[...Object.entries(profile.menus), ...Object.entries(profile.beverages)].map(([name, option]) => `<li>${esc(name)}: ${option.billing === 'pay_separately' ? 'Drinks paid separately; excluded from the food estimate' : Object.entries(option.prices_cents).map(([field, cents]) => `${esc(profile.categories[field].label)} $${(cents / 100).toFixed(2)}`).join('; ')}.</li>`).join('')}</ul>
    <p>${esc(profile.quote_note)}</p><h3>Document fields and checks</h3><p>The fields below feed each document. Blank optional details stay unconfirmed. The restaurant timezone is used when the conversation gives none. Calendar export still needs an end time.</p><p>The guest event plan needs allergy and dietary details only when the host brings them up. If those details are still missing or unresolved, the guest plan stays blocked.</p><ul>${session().data.documents.map(doc => `<li><strong>${esc(doc.title)}:</strong> ${doc.dependencies.map(field => esc(FIELD_DEFINITIONS[field].label)).join(', ')}. ${profile.readiness[doc.id].agreed.length ? `Agreement required for ${profile.readiness[doc.id].agreed.map(field => esc(FIELD_DEFINITIONS[field].label)).join(', ')}.` : 'Specified pricing inputs are enough for a draft; a confirmed booking is not required.'}</li>`).join('')}</ul>`;
}

function isReviewed(doc) {
  return session().reviews[doc.id]?.revision === doc.revision;
}

function renderSelected() {
  const data = session().data;
  const selected = data.documents.find(doc => doc.id === selectedDocument) ?? data.documents[0];
  selectedDocument = selected.id;
  $('#document-list').innerHTML = data.documents.map(doc => `<button class="document-choice" data-document="${doc.id}" aria-current="${doc.id === selected.id}"><strong>${esc(doc.title)}</strong><span class="${doc.state === 'blocked' ? 'blocked-label' : 'ready-label'}">${isEarlier() ? 'Superseded draft' : doc.state === 'blocked' ? `Blocked · ${doc.blockers.length} ${doc.blockers.length === 1 ? 'issue' : 'issues'}` : isReviewed(doc) ? 'Reviewed draft' : 'Ready for review'}</span></button>`).join('');
  $('#document-preview').innerHTML = renderDocument(selected, data, { reviewed: isReviewed(selected) });
  $('#review-document').disabled = busy || isEarlier() || selected.state === 'blocked';
  $('#review-document').textContent = isReviewed(selected) ? 'Undo draft review' : 'Mark this draft reviewed';
  $('#download-document').disabled = busy || isEarlier() || selected.state === 'blocked';
  $('#print-document').disabled = busy || isEarlier() || selected.state === 'blocked';
  $('#download-document').textContent = isEarlier() ? 'Earlier draft · download off' : selected.id==='calendar' ? 'Download calendar file (.ics)' : isReviewed(selected) ? 'Download reviewed draft' : 'Download unreviewed draft';
  if(!isEarlier()&&['quote','kitchen','staff','guest'].includes(selected.id))$('#download-document').textContent='Download PDF';
  $('#print-document').textContent={quote:'Print quote',kitchen:'Print kitchen sheet',staff:'Print staff sheet',guest:'Print guest sheet'}[selected.id]??'Print / Save PDF';
  const ready = data.documents.filter(doc => doc.state === 'ready_for_review').length;
  const reviewed = data.documents.filter(isReviewed).length;
  $('#package-summary').textContent = isEarlier() ? `Earlier version · ${data.record.fields.guest_count.value ?? 'Unknown'} people · saved for comparison` : `${ready} of 5 drafts ready for review · ${5 - ready} blocked · ${data.record.fields.guest_count.value ?? 'Unknown'} people`;
  $('#review-progress').textContent = isEarlier() ? 'Read only' : `${reviewed} / 5 reviewed`;
  const fields = data.record.fields;
  $('#edit-event').disabled = busy || isEarlier() || !workspace;
  $('#event-facts').innerHTML = [['Date', fields.event_date?.value], ['Guests', fields.guest_13_plus_count?.value], ['Children (0–12)', fields.child_count?.value], ['Venue', fields.venue?.value]].filter(([, value]) => value !== null && value !== undefined).map(([label, value]) => `<span>${esc(label)} <strong>${esc(value)}</strong></span>`).join('');
  renderEvents();
  renderFeedback();
}

function renderFeedback() {
  const entries=session()?.feedback??[];
  $('#feedback-panel').hidden=!entries.length;
  $('#feedback-history').innerHTML=[...entries].reverse().map(entry=>`<article class="feedback-entry"><p><strong>Coordinator change</strong> · ${esc(new Date(entry.saved_at).toLocaleString())}</p><p>${esc(entry.reason||'Event details updated.')}</p><ul>${entry.changes.map(change=>`<li><strong>${esc(FIELD_DEFINITIONS[change.field].label)}:</strong> ${esc(change.before.value??'Missing')} → ${esc(change.after.value??'Missing')}${change.field==='beverage'&&(change.before.notes??'')!==(change.after.notes??'')?`<br>Drink notes: ${esc(change.before.notes||'None')} → ${esc(change.after.notes||'None')}`:''}${change.after.resolved?' · Confirmed by coordinator':''}${change.after.accept_custom?' · Custom arrangement checked':''}</li>`).join('')}</ul>${entry.lesson?`<p><strong>${entry.lesson_enabled?'Remember for future drafts':'Lesson turned off'}:</strong> ${esc(entry.lesson)}</p><button type="button" class="text-button" data-lesson-id="${esc(entry.id)}" data-enabled="${!entry.lesson_enabled}" ${busy||isEarlier()?'disabled':''}>${entry.lesson_enabled?'Stop using this lesson':'Use this lesson again'}</button>`:''}</article>`).join('');
}

function renderPackage() {
  const data = session().data;
  const version = versionFor();
  $('#paste-panel').hidden = currentId !== 'new';
  $('#event-inbox-source').hidden = currentId === 'new' || !eventRows().some(event => event.current_scenario_id === currentId || event.scenario_ids?.includes(currentId));
  $('#package-result').hidden = !data;
  $('#package-empty').hidden = Boolean(data);
  $('#policy-panel').hidden = !data;
  $('#update-controls').hidden = !updates?.available || currentId !== 'patio-complete';
  $('#version-note').hidden = !isEarlier();
  $('#version-note').textContent = 'Earlier version. New messages have arrived. Open the latest version to review or download drafts.';
  $('#pending-reply-panel').hidden = !isEarlier();
  $('#export-panel').hidden = !data;
  $('#reply-panel').hidden = !data || !version?.can_add_reply || isEarlier();
  renderReplyCost();
  $('#fill-demo-reply').hidden = !sourceVersions[currentId]?.reference_available || !demo?.reply || version?.revision !== 1;
  $('#try-demo').hidden = Boolean(hosted) || !demo?.available;
  $('#demo-help').hidden = Boolean(hosted) || !demo?.available;
  $('#page-title').textContent = overview ? viewNames[workspaceView] : currentId === 'new' ? 'New event' : 'Event workspace';
  $('#workbench-help').textContent = currentId === 'new' ? 'Paste a conversation. Get five drafts. Check the details.' : `One event. One shared record. Five drafts.${version?.revision ? ` Version ${version.revision}.` : ''}`;
  renderHistory();
  $('#package-mode-label').textContent = data?.label ?? (currentMode === 'reference' ? 'Authored demo · no AI call' : live.mode === 'simulated' ? 'Simulated provider · no AI call' : 'AI extraction · not yet run');
  $('#package-live-status').textContent = currentMode === 'reference' ? 'Written example · no AI call. Your review progress is saved.' : hosted && !hosted.ai_configured ? 'Real AI is not connected yet. Click Try a sample above.'
    : hosted && !hosted.unlocked ? 'Enter your access code above to prepare drafts with AI. Or click Try a sample.'
    : !live.ready ? hosted ? 'AI is unavailable. You can still try the sample above.' : 'AI is not connected. Try the free guided example below.'
    : live.in_flight ? 'AI is preparing a package. Refresh this page after it finishes.'
    : live.paused ? 'AI is paused while the last request is checked. You can still review the saved drafts.'
    : live.remaining < 1 ? 'The AI test limit has been reached. You can still review or download your drafts.'
    : `${live.mode === 'simulated' ? 'Test provider' : 'AI'} is ready · ${live.remaining} ${live.remaining === 1 ? 'preparation' : 'preparations'} left. Saved drafts are free to reopen.`;
  const attempt = session().attempt;
  $('#attempt-panel').hidden = !attempt;
  if (attempt) $('#attempt-summary').textContent = attempt.summary;
  $('#download-attempt').hidden = !attempt?.run_id;
  $('#package-issues').hidden = !data?.unresolved?.length;
  if (data) {
    $('#package-heading').textContent = `${data.record.fields.host_name.value ?? 'Host not supplied'}${isEarlier() ? ' · earlier version' : '’s event'}`;
    renderSelected(); renderFields(); renderPolicy();
    $('#package-issues').innerHTML = data.unresolved?.length ? `<h3>Details to settle</h3><p>Add a reply, or confirm the correct details in Edit event details.</p><ul>${data.unresolved.map(item => `<li><strong>${item.kind === 'pending_change' ? 'Pending request' : 'Open question'}</strong> · ${esc(item.reason)}${evidenceHtml(item)}</li>`).join('')}</ul>` : '';
  } else $('#package-fields').innerHTML = '<p class="empty">Prepare the package to inspect its record.</p>';
  renderMessages();
}

async function prepare(corrections = session().corrections, notice = null, newAnalysis = false) {
  if (busy || (isEarlier() && currentMode === 'live')) return;
  if(currentId==='new' && !$('#event-messages').value.trim()) { announce('');announce('Paste the event messages first.',true);$('#event-messages').focus();return; }
  let sentForAnalysis=false;
  setBusy(true); announce(currentMode === 'live' && newAnalysis ? 'AI is reading the messages. This usually takes about 30 seconds.' : currentMode === 'live' ? 'Updating the saved drafts…' : ''); announce('', true);
  try {
    if(currentId==='new') {
      const result=await post('/api/package/messages',{text:$('#event-messages').value});
      currentId=result.input.id;currentMode='live';openSession();await refreshListing();rememberSelection();
      const saved=history.find(entry=>entry.scenario_id===currentId&&entry.status==='succeeded');
      if(saved) { await openSaved(saved.run_id); renderPackage(); announce('These messages already have saved drafts. Your progress is open; no new AI call was made.');return; }
    }
    const analyze = currentMode === 'live' && newAnalysis;
    const body = analyze ? { scenario_id: currentId } : { scenario_id: currentId, corrections,
      ...(currentMode === 'live' ? { run_id: session().data?.extraction?.run_id } : {}) };
    if (currentMode === 'live' && !analyze && !body.run_id) throw new Error('Prepare an extraction before correcting its record.');
    sentForAnalysis=analyze;
    const data = await request(analyze ? '/api/package/analyze' : '/api/package/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (typeof data.remaining === 'number') live.remaining = data.remaining;
    if (typeof data.paused === 'boolean') live.paused = data.paused;
    if (analyze) session().attempt = { run_id: data.extraction.run_id, summary: `${live.mode === 'simulated' ? 'Test result' : 'AI result'} saved · ${Math.round(data.extraction.meta.latency_ms / 1000)} seconds. Check the details before marking each draft reviewed.` };
    const previousReviews = session().reviews;
    session().reviews = Object.fromEntries(Object.entries(previousReviews).filter(([id, review]) => data.documents.some(doc => doc.id === id && doc.revision === review.revision && doc.state !== 'blocked')));
    session().data = data;
    session().corrections = data.corrections;
    if(analyze) session().sequence=0;
    if(workspace && !isEarlier()) { try {await saveProgress();}catch(error){announce(error.message,true);} }
    rememberSelection();
    if (analyze) { try { await refreshListing(); } catch { /* The captured result remains available; export rechecks the head. */ } }
    renderPackage();
    const ready = data.documents.filter(doc => doc.state === 'ready_for_review').length;
    announce(notice ?? (isEarlier() ? `Earlier drafts opened for comparison.${data.mode === 'authored_reference' ? ' No AI call was made.' : ''}` : data.mode === 'authored_reference' ? 'The saved example is ready to review. No AI call was made.' : ready === 5 ? 'All five drafts are ready for your review.' : `${ready} of five drafts are ready. Check the blocked drafts to see what is missing.`));
  } catch (error) {
    if (typeof error.details?.remaining === 'number') live.remaining = error.details.remaining;
    if (typeof error.details?.paused === 'boolean') live.paused = error.details.paused;
    if (typeof error.details?.in_flight === 'boolean') live.in_flight = error.details.in_flight;
    try { await refreshListing(); } catch { /* Keep the prior captured result labeled. */ }
    if (currentMode === 'live' && newAnalysis && sentForAnalysis) {
      session().attempt = { run_id: error.details?.run_id ?? null, summary: `Latest extraction failed. ${error.details?.receipt_saved ? 'Its response or error record was saved.' : error.details?.run_id ? 'Only the pre-dispatch attempt record is confirmed saved.' : 'No saved attempt is available.'} ${session().data ? 'The previous successful extraction is still displayed.' : 'No package was produced.'}` };
      renderPackage();
    }
    announce('');announce(error.message, true);
  }
  finally { setBusy(false); }
}

async function saveProgress() {
  const s=session();if(!workspace||!s?.data||isEarlier())return;
  $('#save-status').textContent='Saving your progress…';
  try {
    const result=await post('/api/package/review',{scenario_id:currentId,run_id:s.data.extraction?.run_id??null,corrections:s.corrections,reviews:s.reviews,sequence:s.sequence});
    s.sequence=result.saved.sequence;s.feedback=result.saved.feedback??[];$('#save-status').textContent=storageMessage();
  } catch(error) {$('#save-status').textContent='Progress was not saved. Keep this page open and download the review package.';throw error;}
}
async function openSaved(runId=null) {
  const saved=workspace?await post('/api/package/review/load',{scenario_id:currentId,run_id:runId}):{saved:null};
  const s=session();
  if(saved.saved) {
    s.data=saved.data;s.corrections=saved.saved.corrections;s.reviews=saved.saved.reviews;s.sequence=saved.saved.sequence;s.feedback=saved.saved.feedback??[];
    $('#save-status').textContent='Your saved corrections and review marks are back.';
  } else {
    s.data=await post('/api/package/prepare',{scenario_id:currentId,corrections:{},...(runId?{run_id:runId}:{})});
    s.corrections={};s.reviews={};s.feedback=[];s.sequence=0;$('#save-status').textContent='';
  }
  s.attempt=runId?{run_id:runId,summary:'Saved AI result. Opening it makes no new AI call.'}:null;
  rememberSelection();
}

function saveMessageDraft() {
  $('#paste-count').textContent=`${$('#event-messages').value.length.toLocaleString()} / 8,000 characters`;
  try {localStorage.setItem(browserKey('message-draft'),$('#event-messages').value);}
  catch {$('#save-status').textContent='The text in this box could not be saved in this browser. Keep a copy before refreshing.';}
}

function replyDraftKey(id = currentId) { return browserKey(`reply:${id}`); }
function restoreReplyDraft() {
  try {
    const raw = localStorage.getItem(replyDraftKey());
    let draft = {text: raw ?? '', role: 'host'};
    if (raw) { try { const parsed = JSON.parse(raw); if (typeof parsed.text === 'string') draft = parsed; } catch { /* Earlier drafts stored only text. */ } }
    $('#reply-text').value = draft.text;
    $('#reply-role').value = draft.role === 'coordinator' ? 'coordinator' : 'host';
  } catch { $('#reply-text').value = ''; $('#reply-role').value = 'host'; }
  renderReplyCost();
}
function saveReplyDraft() {
  renderReplyCost();
  try { localStorage.setItem(replyDraftKey(), JSON.stringify({text: $('#reply-text').value, role: $('#reply-role').value})); }
  catch { $('#save-status').textContent = 'Keep a copy of this reply before refreshing; this browser could not save the text.'; }
}
$('#reply-text').addEventListener('input', saveReplyDraft);
$('#reply-role').addEventListener('change', saveReplyDraft);
$('#show-reply').addEventListener('click', () => {
  $('#reply-form').hidden = false; $('#show-reply').setAttribute('aria-expanded', 'true'); restoreReplyDraft(); $('#reply-text').focus();
});
$('#cancel-reply').addEventListener('click', () => { $('#reply-form').hidden = true; $('#show-reply').setAttribute('aria-expanded', 'false'); $('#show-reply').focus(); });
$('#fill-demo-reply').addEventListener('click', () => { $('#reply-text').value = demo.reply; $('#reply-role').value = 'host'; $('#reply-text').dispatchEvent(new Event('input')); $('#reply-text').focus(); });
$('#reply-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || isEarlier() || !versionFor()?.can_add_reply) return;
  const text = $('#reply-text').value.trim();
  if (!text) { announce('Paste the new reply first.', true); $('#reply-text').focus(); return; }
  const previousId = currentId;
  closeEventEdit();
  setBusy(true); announce('Saving the new reply…'); announce('', true);
  let saved = false;
  try {
    const result = await post('/api/package/reply', {scenario_id: previousId, text, role: $('#reply-role').value});
    currentId = result.input.id; currentMode = result.reference_available ? 'reference' : 'live'; openSession();
    saved = true;
    try { localStorage.removeItem(replyDraftKey(previousId)); } catch { /* The server has the reply. */ }
    $('#reply-text').value = ''; $('#reply-form').hidden = true; $('#show-reply').setAttribute('aria-expanded', 'false');
    $('#package-mode').value = currentMode; rememberSelection(); await refreshListing(); renderPackage();
  } catch (error) { announce(error.message, true); }
  finally { setBusy(false); }
  if (saved && (referenceAvailable() || canAnalyze())) await prepare(undefined, 'Reply added. Check the updated drafts and review them again.', true);
  else if (saved) announce('Your reply is saved as a new version. AI preparation is unavailable; earlier drafts remain in the version history.');
});
function renderInboxList() {
  const threads=inboxThreads(eventRows(),scenarios);
  $('#rail-inbox-count').textContent=threads.length;
  $('#inbox-threads').innerHTML=renderInboxThreads(threads,{selectedId:inboxId,search:$('#inbox-search').value,filter:$('#inbox-filter').value,busy});
}
function renderInboxContent() {
  const thread=inboxThreads(eventRows(),scenarios).find(thread=>thread.id===inboxId);
  $('#inbox-detail').innerHTML=renderInboxDetail(thread,{data:inboxData,reviews:inboxReviews,definitions:FIELD_DEFINITIONS,busy,loading:inboxLoading,error:inboxError,highlight:inboxHighlight,canPrepare:canAnalyze(),canReply:Boolean(sourceVersions[inboxId]?.can_add_reply)});
}
async function loadInbox(id) {
  const threads=inboxThreads(eventRows(),scenarios);
  const latest=eventRows().find(event=>event.scenario_ids?.includes(id))?.current_scenario_id;
  const thread=threads.find(thread=>thread.id===(latest??id))??threads[0];
  inboxId=thread?.id??null;inboxData=null;inboxReviews={};inboxError='';inboxHighlight=null;inboxLoading=Boolean(thread);
  renderInboxList();renderInboxContent();
  try {
    if(!thread)return;
    const entry=history.find(entry=>entry.scenario_id===thread.id&&entry.status==='succeeded');
    if(entry||referenceAvailable(thread.id)) {
      const runId=entry?.run_id??null;
      const result=workspace?await post('/api/package/review/load',{scenario_id:thread.id,run_id:runId}):{saved:null};
      inboxData=result.saved?result.data:await post('/api/package/prepare',{scenario_id:thread.id,corrections:{},...(runId?{run_id:runId}:{})});
      inboxReviews=result.saved?.reviews??{};
      if(inboxData.version?.superseded) {inboxData=null;inboxError='New messages arrived. Refresh the inbox to open the latest source.';}
    }
  } catch(error) {inboxError=`Could not open the saved details. ${error.message}`;}
  finally {inboxLoading=false;renderInboxContent();rememberSelection();}
}
function closeInboxCompose() { $('#inbox-compose').hidden=true;inboxComposeTarget=null; }
function openInboxCompose(target=null) {
  inboxComposeTarget=target;
  const thread=inboxThreads(eventRows(),scenarios).find(thread=>thread.id===target);
  $('#inbox-compose-heading').textContent=target?`Add a reply · ${thread?.title??'this event'}`:'Add a conversation';
  $('#inbox-compose-help').textContent=target?'Paste only the new reply. Earlier messages stay saved. This does not call AI.':'Paste fictional event messages, oldest first. Saving them does not call AI.';
  $('#inbox-reply-role-label').hidden=!target;
  $('#inbox-reply-role').value='host';
  $('#inbox-text').value='';$('#inbox-text').maxLength=target?2000:8000;
  $('#inbox-save').textContent=target?'Save reply':'Save to inbox';
  $('#inbox-compose-error').hidden=true;$('#inbox-compose').hidden=false;$('#inbox-text').focus();
}
$('#inbox-add').addEventListener('click',()=>openInboxCompose());
$('#inbox-cancel').addEventListener('click',()=>{closeInboxCompose();$('#inbox-add').focus();});
$('#inbox-refresh').addEventListener('click',()=>openWorkspace('inbox'));
$('#inbox-search').addEventListener('input',renderInboxList);
$('#inbox-filter').addEventListener('change',renderInboxList);
$('#inbox-compose').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const text=$('#inbox-text').value.trim(),target=inboxComposeTarget;
  if(!text)return;
  setBusy(true);$('#inbox-compose-error').hidden=true;$('#inbox-notice').hidden=true;
  let saved=false;
  try {
    const result=await post(target?'/api/package/reply':'/api/package/messages',target?{scenario_id:target,text,role:$('#inbox-reply-role').value}:{text});
    saved=true;closeInboxCompose();$('#inbox-text').value='';
    await refreshListing();await loadInbox(result.input.id);
    $('#inbox-notice').textContent=target?'Reply saved. The latest source is below. No AI call was made.':'Conversation saved to the inbox. No AI call was made.';
    $('#inbox-notice').hidden=false;
  } catch(error) {
    if(saved){$('#inbox-notice').textContent='Messages saved. Refresh the inbox to reopen them.';$('#inbox-notice').hidden=false;}
    else{$('#inbox-compose-error').textContent=error.message;$('#inbox-compose-error').hidden=false;}
  } finally {setBusy(false);}
});
$('#inbox-overview').addEventListener('click',async event=>{
  if(busy)return;
  const thread=event.target.closest('[data-inbox-thread]');
  if(thread){setBusy(true);try{await loadInbox(thread.dataset.inboxThread);}finally{setBusy(false);}return;}
  const source=event.target.closest('[data-inbox-source]');
  if(source&&inboxData){
    const field=source.dataset.inboxSource,detail=inboxData.record.fields[field];
    const evidence=detail.provenance==='coordinator_correction'?inboxData.original_record.fields[field].evidence:detail.evidence;
    const citation=evidence[Number(source.dataset.citationIndex)];
    if(citation){inboxHighlight=citation;renderInboxContent();const message=document.getElementById(`inbox-message-${citation.message_id}`);message?.focus({preventScroll:true});message?.scrollIntoView({block:'center',behavior:'instant'});}
    return;
  }
  const reply=event.target.closest('[data-inbox-add-reply]');
  if(reply){openInboxCompose(reply.dataset.inboxAddReply);return;}
  const prepareButton=event.target.closest('[data-inbox-prepare]');
  if(prepareButton){
    const id=prepareButton.dataset.inboxPrepare;
    setBusy(true);try{await refreshListing();}catch{inboxError='Could not check the latest messages. Refresh before preparing.';setBusy(false);return;}setBusy(false);
    await chooseScenario(id);
    if(!session()?.data&&canAnalyze()&&!isEarlier())await prepare(undefined,null,true);
  }
});

async function openWorkspace(view) {
  if (busy) return;
  closeEventEdit();
  setBusy(true);
  $('#workspace-error').hidden = true;
  try {
    await refreshListing();
    sessions.clear(); openSession();
    showOverview(true, view);
    if(view==='inbox') await loadInbox(inboxId);
    if(view==='settings') await settingsPanel.load();
  } catch (error) { $('#workspace-error').textContent = error.message; $('#workspace-error').hidden = false; }
  finally { setBusy(false); }
}
$('#show-events').addEventListener('click', () => openWorkspace('events'));
$('#event-inbox-source').addEventListener('click', () => { inboxId=versionFor()?.current_scenario_id??currentId; openWorkspace('inbox'); });
$('#new-event').addEventListener('click', () => chooseScenario('new'));
$('#header-new-event').addEventListener('click', () => chooseScenario('new'));
$('#event-search').addEventListener('input', renderEvents);
$('#asset-search').addEventListener('input', renderEvents);
$('#open-current').addEventListener('click', () => chooseScenario(versionFor()?.current_scenario_id ?? updates?.active_scenario_id));
document.addEventListener('click', async event => {
  if (busy) return;
  const nav = event.target.closest('[data-workspace]');
  if(nav) { await openWorkspace(nav.dataset.workspace); return; }
  const layout = event.target.closest('[data-event-layout]');
  if(layout) { eventLayout=layout.dataset.eventLayout;renderEvents();rememberSelection();return; }
  const month = event.target.closest('[data-calendar-shift]');
  if(month) { calendarViewMonth=shiftMonth(calendarViewMonth,Number(month.dataset.calendarShift));renderEvents();return; }
  if(event.target.closest('[data-calendar-today]')) { calendarViewMonth=calendarMonth([]);renderEvents();return; }
  if(event.target.closest('[data-create-event]')) { await chooseScenario('new');return; }
  const button = event.target.closest('[data-open-event]');
  if (button) {
    if(button.dataset.openDocument) selectedDocument=button.dataset.openDocument;
    await chooseScenario(button.dataset.openEvent);
    if(button.dataset.openDocument && session()?.data) $('.document-pane').scrollIntoView({block:'start',behavior:'instant'});
  }
});
document.addEventListener('change', event => {
  if(busy)return;
  if(event.target.matches('[data-calendar-month]') && /^\d{4}-\d{2}$/.test(event.target.value)) {calendarViewMonth=event.target.value;renderEvents();}
});
async function tryDemo() {
  if (busy) return;
  closeEventEdit();
  closeInboxCompose();
  setBusy(true); announce('Opening the guided example…'); announce('', true);
  try {
    if (hosted?.unlocked) {
      await post('/api/hosted/lock', {});
      window.location.assign('/?sample=1');
      return;
    }
    const result = await post('/api/package/demo', {});
    currentId = result.input.id; currentMode = result.reference_available ? 'reference' : 'live'; openSession();
    await refreshListing(); $('#package-mode').value = currentMode;
    const existing = history.find(entry => entry.scenario_id === currentId && entry.status === 'succeeded');
    if (result.reference_available || existing) await openSaved(result.reference_available ? null : existing.run_id);
    restoreReplyDraft(); showOverview(false); renderPackage(); rememberSelection();
    announce(!result.reference_available ? 'This example already has a custom reply. Its messages are saved. AI is needed to prepare a new result; no AI call was made.' : versionFor()?.revision === 1 ? 'Free guided example. The host has not supplied allergy details yet. Open a blocked draft, then add the host’s reply.' : 'Your completed guided example is open. Review the five drafts. No AI call was made.');
  } catch (error) { announce(error.message, true); }
  finally { setBusy(false); }
}
$('#try-demo').addEventListener('click', tryDemo);
$('#hosted-try-demo').addEventListener('click', tryDemo);
$('#event-messages').addEventListener('input',saveMessageDraft);
$('#paste-example').addEventListener('click',()=>{
  const input=scenarios.find(input=>input.id==='patio-complete');
  $('#event-messages').value=input.messages.map(message=>`${message.role==='customer'?'Host':'Restaurant'} (${message.sent_at}):\n${message.body}`).join('\n\n');
  saveMessageDraft();$('#event-messages').focus();
});

function focusField(field) {
  const entry = document.getElementById(`pkg-field-${field}`);
  if (!entry) return;
  $('#record-panel').open = true;
  entry.open = true;
  entry.querySelector('summary').focus();
  entry.scrollIntoView({ block: 'center', behavior: 'instant' });
}

function editField(field) {
  closeEventEdit();
  const definition = FIELD_DEFINITIONS[field];
  const detail = session().data.record.fields[field];
  const type = definition.type === 'integer' ? 'number' : definition.type;
  $(`#pkg-edit-${field}`).innerHTML = `<form class="edit-form" data-correct="${field}"><label>Correct ${esc(definition.label.toLowerCase())}<input name="value" type="${type}" value="${esc(detail.value ?? '')}" ${type === 'number' ? `min="${definition.minimum}" max="10000" step="1"` : ''}></label>
    ${field==='beverage'?`<label>Drink notes<textarea name="notes" maxlength="1000">${esc(detail.notes??'')}</textarea></label>`:''}
    <label>Status in the conversation<select name="status">${PACKAGE_STATUSES.map(status => `<option value="${status}"${detail.status === status ? ' selected' : ''}>${statusText(status)}</option>`).join('')}</select></label>
    <label>Reason for correction<textarea name="reason" required maxlength="1000"></textarea></label>
    <p>Missing or conflicting values are left blank. This correction replaces the extracted value, not the original message. Affected drafts must be reviewed again.</p>
    <div class="item-actions"><button type="submit" class="small-button">Save and rebuild drafts</button><button type="button" class="text-button" data-cancel="${field}">Cancel</button></div></form>`;
  focusField(field);
  $(`#pkg-edit-${field} input`).focus();
}

function closeEventEdit() {
  eventEdit = null;
  $('#event-edit-form').hidden = true;
  $('#edit-event').setAttribute('aria-expanded', 'false');
}
function editAttendanceTotal() {
  const total = $('#event-edit-total');
  if (!total) return;
  const values = ['guest_13_plus_count', 'child_count'].map(field => $(`#event-edit-${field}`).value);
  total.textContent = values.every(value => /^\d+$/.test(value)) ? `${Number(values[0]) + Number(values[1])} people in total. The quote updates when you save.` : 'Enter both counts. Use 0 if there are none.';
}
function renderEventEditInputs() {
  const fields = editGroups.find(([key]) => key === $('#event-edit-detail').value)[2];
  const profile = session().data.profile;
  const options = {venue:Object.keys(profile.venues), menu:Object.keys(profile.menus), beverage:Object.keys(profile.beverages), setup:[...new Set(Object.values(profile.venues).flatMap(venue => venue.setups))]};
  $('#event-edit-inputs').innerHTML = fields.map(field => {
    const definition = FIELD_DEFINITIONS[field], value = eventEdit.fields[field].value ?? '';
    const id = `event-edit-${field}`, type = definition.type === 'integer' ? 'number' : definition.type;
    let control;
    if (options[field]) {
      const choices = [...new Set([...options[field], ...(value ? [value] : [])])];
      control = `<input id="${id}" name="${field}" list="${id}-choices" value="${esc(value)}" maxlength="1000"><datalist id="${id}-choices">${choices.map(option => `<option value="${esc(option)}"></option>`).join('')}</datalist><span class="live-note">Choose a suggested option or type the correct detail.${['menu','beverage'].includes(field)?' A quote needs an option with a saved price.':''}</span>`;
    } else if (['dietary', 'special', 'guest_notes', 'staff_notes', 'av'].includes(field)) {
      control = `<textarea id="${id}" name="${field}" rows="3" maxlength="1000">${esc(value)}</textarea>`;
    } else control = `<input id="${id}" name="${field}" type="${type}" value="${esc(value)}" ${type === 'number' ? 'min="0" max="10000" step="1" required' : type === 'text' ? 'maxlength="1000"' : ''}>`;
    return `<label for="${id}">${esc(field==='beverage'?'Drink option':definition.label)}${control}</label>${field==='beverage'?`<label for="event-edit-beverage-notes">Drink notes<textarea id="event-edit-beverage-notes" name="beverage_notes" rows="3" maxlength="1000">${esc(eventEdit.fields.beverage.notes??'')}</textarea></label><p class="live-note">Put the details here. For example, with Nonalcoholic service: juice and soda for everyone, with no alcohol. Extra drinks need a saved price.</p>`:''}`;
  }).join('') + (fields.includes('child_count') ? '<p id="event-edit-total" class="event-edit-total" aria-live="polite"></p>' : fields.includes('start_time') ? '<p class="event-edit-total">The schedule updates in each draft. Check any arrival or staff notes that mention the old time, too.</p>' : '');
  $('#event-edit-error').hidden = true;
  const custom=fields.every(field=>['dietary','setup','av','special'].includes(field));
  $('#event-custom-label').hidden=!custom;
  $('#event-edit-custom').checked=custom&&fields.every(field=>eventEdit.fields[field].accept_custom);
  editAttendanceTotal();
}
async function openEventEdit(field=null) {
  if (eventEdit) { $('#event-edit-detail').focus(); return; }
  if (!workspace || !await checkLatest()) return;
  const s = session();
  eventEdit = {scenario_id:currentId, run_id:s.data.extraction?.run_id??null, sequence:s.sequence, fields:structuredClone(s.data.record.fields)};
  $('#event-edit-note').value = '';
  $('#event-remember').checked=false;$('#event-lesson').value='';$('#event-lesson').required=false;$('#event-lesson-fields').hidden=true;
  $('#event-edit-detail').innerHTML = editGroups.map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join('');
  if(field)$('#event-edit-detail').value=editGroups.find(([, , fields])=>fields.includes(field)||field==='guest_count'&&fields.includes('child_count'))?.[0]??'attendance';
  renderEventEditInputs();
  $('#event-edit-form').hidden = false;
  $('#edit-event').setAttribute('aria-expanded', 'true');
  $('#event-edit-detail').focus();
}
$('#edit-event').addEventListener('click',()=>openEventEdit());
$('#event-remember').addEventListener('change',()=>{const on=$('#event-remember').checked;$('#event-lesson-fields').hidden=!on;$('#event-lesson').required=on;if(on)$('#event-lesson').focus();});
$('#event-edit-detail').addEventListener('change', renderEventEditInputs);
$('#event-edit-inputs').addEventListener('input', editAttendanceTotal);
$('#cancel-event-edit').addEventListener('click', () => { closeEventEdit(); $('#edit-event').focus(); });
$('#event-edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !eventEdit || isEarlier()) return;
  const changes = {};
  for (const control of $('#event-edit-inputs').querySelectorAll('[name]')) {
    const raw = control.value.trim();
    changes[control.name] = control.name==='beverage_notes' ? raw : raw === '' ? null : FIELD_DEFINITIONS[control.name].type === 'integer' ? Number(raw) : raw;
  }
  const {scenario_id,run_id,sequence} = eventEdit;
  setBusy(true); $('#event-edit-error').hidden = true; announce(''); announce('', true);
  try {
    const result = await post('/api/package/edit', {scenario_id,run_id,sequence,changes,reason:$('#event-edit-note').value.trim(),resolve:true,accept_custom:$('#event-edit-custom').checked,lesson:$('#event-remember').checked?$('#event-lesson').value.trim():''});
    const s = session();
    s.data = result.data; s.corrections = result.saved.corrections; s.reviews = result.saved.reviews; s.sequence = result.saved.sequence; s.feedback=result.saved.feedback??[];
    closeEventEdit(); rememberSelection(); renderPackage();
    $('#save-status').textContent = storageMessage();
    const changed = result.changed_documents;
    const blocked = changed.some(doc => doc.state === 'blocked');
    announce(changed.length ? `Changes saved. Updated: ${changed.map(doc => doc.title.toLowerCase()).join(', ')}. ${blocked ? 'Some drafts need details. Open them to see what is missing.' : 'Check these drafts again.'}` : 'Saved. These details were already up to date.');
    try { await refreshListing(); } catch { /* The save succeeded; sidebar views refresh when opened. */ }
  } catch (error) {
    $('#event-edit-error').textContent = `${error.message} Your entries are still here.`;
    $('#event-edit-error').hidden = false;
  } finally { setBusy(false); if (!eventEdit) $('#edit-event').focus(); }
});

$('#feedback-history').addEventListener('click',async event=>{
  const button=event.target.closest('[data-lesson-id]');if(!button||busy||isEarlier()||!await checkLatest())return;
  setBusy(true);
  try {const s=session();const result=await post('/api/package/feedback',{scenario_id:currentId,run_id:s.data.extraction?.run_id??null,sequence:s.sequence,feedback_id:button.dataset.lessonId,enabled:button.dataset.enabled==='true'});s.sequence=result.saved.sequence;s.feedback=result.saved.feedback??[];announce('Lesson preference saved. No AI call was made.');}
  catch(error){announce(error.message,true);}finally{setBusy(false);renderFeedback();}
});

$('#prepare').addEventListener('click', () => prepare(undefined, null, true));
$('#add-update').addEventListener('click', async () => {
  if (busy || !updates?.available || currentId !== 'patio-complete' || !session()?.data) return;
  closeEventEdit();
  setBusy(true); announce('Adding the demo messages…'); announce('',true);
  try {
    applyListing(await request('/api/package/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario_id:currentId})}));
    currentId = updates.active_scenario_id; $('#package-scenario').value=currentId; openSession();
    renderPackage(); announce('New messages added. Click Prepare five drafts. Earlier drafts stay in the saved results.');
  } catch (error) { announce(error.message,true); }
  finally {setBusy(false); if(!isEarlier() && !$('#prepare').disabled) $('#prepare').focus();}
});
$('#package-history').addEventListener('click', async event => {
  const button=event.target.closest('[data-saved-run]');if(!button||busy)return;
  closeEventEdit();
  setBusy(true); announce('',true);
  try {
    await refreshListing();currentId=button.dataset.scenario;currentMode='live';$('#package-mode').value=currentMode;$('#package-scenario').value=currentId;openSession();
    await openSaved(button.dataset.savedRun);
    session().attempt={run_id:button.dataset.savedRun,summary:'Saved AI result. Opening it makes no new AI call.'};
    renderPackage();announce(isEarlier()?'Earlier drafts opened for comparison. Use the latest messages for review and download.':'Your saved AI drafts are open. No new AI call was made.');
  } catch(error){announce(error.message,true);renderPackage();}
  finally{setBusy(false);}
});
async function checkLatest({allowEarlier = false} = {}) {
  if(busy||!session()?.data)return false;
  setBusy(true);
  try {
    await refreshListing();renderPackage();
    if(isEarlier() && !allowEarlier){announce('New messages have arrived. Choose the latest messages before reviewing or downloading.');return false;}
    if (workspace && session()?.data) {
      const s = session(), runId = s.data.extraction?.run_id ?? null;
      if ((s.data.restaurant_settings?.revision ?? 0) !== restaurantSettingsRevision) {
        await openSaved(runId); renderPackage();
        announce('Restaurant settings changed. Check the updated draft before reviewing or downloading.'); return false;
      }
      const loaded = await post('/api/package/review/load', {scenario_id: currentId, run_id: runId});
      if ((loaded.saved?.sequence ?? 0) !== s.sequence ||
          JSON.stringify(loaded.saved?.corrections ?? {}) !== JSON.stringify(s.corrections) ||
          JSON.stringify(loaded.saved?.reviews ?? {}) !== JSON.stringify(s.reviews)) {
        await openSaved(runId);
        renderPackage();
        announce('The saved review changed. The latest draft is now open. Check it before reviewing or downloading.');
        return false;
      }
    }
    return true;
  } catch(error){announce('The latest messages could not be checked. Try again before reviewing or downloading.',true);return false;}
  finally{setBusy(false);}
}
$('#package-scenario').addEventListener('change', async event => {
  await chooseScenario(event.target.value);
});
$('#package-mode').addEventListener('change', async event => {
  closeEventEdit();
  currentMode = event.target.value;
  openSession(); announce(''); announce('', true); setBusy(true);
  try {const saved=history.find(entry=>entry.scenario_id===currentId&&entry.status==='succeeded');if(currentMode==='reference'||saved)await openSaved(currentMode==='live'?saved.run_id:null);rememberSelection();renderPackage();}
  catch(error){announce(error.message,true);}finally{setBusy(false);}
});
$('#package-issues').addEventListener('click', event => {
  const button = event.target.closest('[data-message]');
  if (!button) return;
  $('#record-panel').open = true;
  renderMessages({ message_id: button.dataset.message, quote: button.dataset.quote });
  const source = document.getElementById(`pkg-message-${button.dataset.message}`);
  source.focus({ preventScroll: true }); source.scrollIntoView({ block: 'center', behavior: 'instant' });
});
$('#document-list').addEventListener('click', event => {
  const button = event.target.closest('[data-document]');
  if (!button || busy) return;
  selectedDocument = button.dataset.document;
  rememberSelection();
  renderSelected();
  $(`[data-document="${selectedDocument}"]`).focus();
});
$('#document-preview').addEventListener('click', event => {
  const fix=event.target.closest('[data-fix]');if(fix&&!busy&&!isEarlier()){openEventEdit(fix.dataset.fix);return;}
  const source = event.target.closest('[data-field]');
  if (source) focusField(source.dataset.field);
  if (event.target.closest('[data-policy]')) {
    $('#policy-panel').open = true;
    $('#policy-panel > summary').focus();
    $('#policy-panel').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
});
$('#package-fields').addEventListener('click', async event => {
  if (busy) return;
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.message) {
    renderMessages({ message_id: button.dataset.message, quote: button.dataset.quote });
    const source = document.getElementById(`pkg-message-${button.dataset.message}`);
    source.focus({ preventScroll: true }); source.scrollIntoView({ block: 'center', behavior: 'instant' });
  } else if (button.dataset.edit) {if(await checkLatest()) editField(button.dataset.edit);}
  else if (button.dataset.cancel) $(`#pkg-edit-${button.dataset.cancel}`).replaceChildren();
  else if (button.dataset.undo) {
    if(isEarlier())return;
    const corrections = structuredClone(session().corrections);
    delete corrections[button.dataset.undo];
    await prepare(corrections, 'Correction removed. Affected drafts were rebuilt and need fresh review.');
    focusField(button.dataset.undo);
  }
});
$('#package-fields').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || isEarlier()) return;
  const field = event.target.dataset.correct;
  if (!field) return;
  const form = new FormData(event.target);
  const status = String(form.get('status'));
  const raw = String(form.get('value')).trim();
  const value = ['unknown', 'conflicting'].includes(status) ? null : FIELD_DEFINITIONS[field].type === 'integer' ? (raw === '' ? null : Number(raw)) : raw;
  const correction = { value, status, reason: String(form.get('reason')).trim() };
  if(field==='beverage')correction.notes=String(form.get('notes')??'').trim();
  await prepare({ ...session().corrections, [field]: correction }, 'Correction saved separately. Affected drafts were rebuilt and need fresh review.');
  focusField(field);
});
$('#review-document').addEventListener('click', async () => {
  if(!await checkLatest())return;
  const doc = session().data.documents.find(item => item.id === selectedDocument);
  if (busy || doc.state !== 'ready_for_review') return;
  const previousReviews = structuredClone(session().reviews);
  if (isReviewed(doc)) delete session().reviews[doc.id];
  else session().reviews[doc.id] = { decision: 'reviewed', revision: doc.revision, reviewed_at: new Date().toISOString() };
  setBusy(true);
  try {await saveProgress();}catch(error){session().reviews = previousReviews;announce(error.message,true);}
  finally{renderPackage();setBusy(false);}
});

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#download-document').addEventListener('click', async () => {
  if(!await checkLatest())return;
  const data = session().data;
  const doc = data.documents.find(item => item.id === selectedDocument);
  if (busy || doc.state !== 'ready_for_review') return;
  try {
    if(doc.id==='calendar') {
      download(calendarFile(doc,data,{reviewed:isReviewed(doc),eventId:versionFor()?.event_id??currentId}),assetFilename(doc,data,'ics'),'text/calendar;charset=utf-8');
      announce('Calendar file downloaded. Open it in your calendar app if you want to add this draft. Nothing was booked or sent.');
    } else if(['quote','kitchen','staff','guest'].includes(doc.id)) {
      const label={quote:'Quote',kitchen:'Kitchen sheet',staff:'Staff sheet',guest:'Guest sheet'}[doc.id];
      setBusy(true);announce(`Creating your ${label.toLowerCase()} PDF…`);$('#download-document').textContent='Creating PDF…';
      try {
        const headers={'Content-Type':'application/json',...(hosted?{'X-EventBrief-Workspace':hosted.workspace}:{})};
        const response=await fetch(`/api/package/${doc.id}/pdf`,{method:'POST',headers,body:JSON.stringify({scenario_id:currentId,run_id:data.extraction?.run_id??null,sequence:session().sequence,revision:doc.revision})});
        if(!response.ok){const result=await response.json();if(result.code==='WORKSPACE_CHANGED')window.location.reload();throw new Error(result.error||'The PDF could not be created. Please try again.');}
        if(!response.headers.get('content-type')?.startsWith('application/pdf'))throw new Error('The PDF could not be created. Please try again.');
        download(await response.blob(),assetFilename(doc,data,'pdf'),'application/pdf');
        announce(`${label} PDF downloaded. It includes the review status shown in the preview.`);
      } finally {setBusy(false);}
    } else {
      download(standaloneDocument(doc, data, isReviewed(doc)), assetFilename(doc,data), 'text/html');
      announce('Draft downloaded. Open the file to present it or print it. Its review status is included.');
    }
  } catch(error) {announce(error.message,true);}
});
$('#print-document').addEventListener('click', async () => {
  if(!await checkLatest())return;
  const doc=session().data.documents.find(item=>item.id===selectedDocument);
  if(busy || doc.state!=='ready_for_review')return;
  announce('In the print window, choose your printer or Save as PDF.');
  document.body.classList.add('printing-draft');
  try { window.print(); } finally { document.body.classList.remove('printing-draft'); }
});
$('#download-package').addEventListener('click', async () => {
  if (busy || !session().data) return;
  if (!await checkLatest({allowEarlier: true})) return;
  setBusy(true);
  try {
    await refreshListing();
    const result = { ...session().data, version:{...session().data.version,...versionFor(),superseded:isEarlier()},document_reviews: session().reviews,coordinator_feedback:session().feedback??[], exported_at: new Date().toISOString(), audience: 'Internal review package; includes original sources and staff-only details.' };
    download(JSON.stringify(result, null, 2) + '\n', `${currentId}-review-package.json`, 'application/json');
    announce('The internal review package was downloaded with original sources, separate corrections, and document review decisions.');
  } catch(error){announce('The current version could not be checked. Try downloading again.',true);}
  finally{renderPackage();setBusy(false);}
});
$('#download-attempt').addEventListener('click', async () => {
  if (busy || !session().attempt?.run_id) return;
  try {
    const receipt = await request(`/api/package/attempts/${session().attempt.run_id}`);
    download(JSON.stringify(receipt, null, 2) + '\n', `${receipt.run_id}-attempt.json`, 'application/json');
    announce('The saved attempt record was downloaded. It contains original output or failure details, without coordinator corrections.');
  } catch (error) { announce(error.message, true); }
});

async function init() {
  setBusy(true);
  try {
    const data = await request('/api/package/scenarios');
    applyListing(data);
    let selection=null;
    try { selection=JSON.parse(localStorage.getItem(browserKey('selection'))); $('#event-messages').value=localStorage.getItem(browserKey('message-draft'))??''; }
    catch {$('#save-status').textContent='Your last place could not be restored. Saved reviews are still available.';}
    $('#paste-count').textContent=`${$('#event-messages').value.length.toLocaleString()} / 8,000 characters`;
    currentId = selection && (selection.id==='new'||scenarios.some(input=>input.id===selection.id)) ? selection.id : workspace || hosted ? 'new' : updates?.active_scenario_id ?? scenarios[0].id;
    currentMode = sourceVersions[currentId]?.reference_available ? 'reference' : isPasted() ? 'live' : selection?.mode==='reference' ? 'reference' : live.ready ? 'live' : 'reference';
    selectedDocument=['calendar','quote','kitchen','staff','guest'].includes(selection?.document)?selection.document:'calendar';
    inboxId=selection?.inbox_id??null;
    eventLayout=selection?.layout==='list'?'list':'board';
    const saved=history.find(entry=>entry.scenario_id===currentId&&entry.status==='succeeded'&&entry.run_id===selection?.run_id) ?? history.find(entry=>entry.scenario_id===currentId&&entry.status==='succeeded') ?? (live.last_successful?.scenario_id===currentId?live.last_successful:null);
    $('#package-mode').value = currentMode;
    openSession();
    $('#package-mode option[value="live"]').disabled = !live.ready || Boolean(hosted && !hosted.unlocked);
    $('#package-mode option[value="live"]').textContent = live.mode === 'simulated' ? 'Test provider (no AI call)' : 'Real AI';
    $('#package-scenario').value = currentId;
    if (currentId!=='new' && (currentMode==='reference'||saved)) {
      try {
        await openSaved(currentMode==='live'?saved.run_id:null);
        announce('Your saved drafts are open. No new AI call was made.');
      } catch(error) {
        announce(`The saved result could not be opened. ${error.message}`, true);
      }
    }
    if(currentId!=='new' && updates?.active_scenario_id && !session().data) announce('Messages are saved. Click Prepare five drafts. Earlier AI results are available below.');
    restoreReplyDraft(); renderPackage();
    setBusy(false);
    if (selection?.view && Object.hasOwn(viewNames,selection.view)) { showOverview(true,selection.view); if(selection.view==='inbox') { setBusy(true);try{await loadInbox(inboxId);}finally{setBusy(false);} } }
    else if ((hosted?.unlocked && currentId === 'new') || (!selection && eventRows().length)) showOverview(true);
    if (selection?.view === 'settings') { setBusy(true); try {await settingsPanel.load();} finally {setBusy(false);} }
    if (hosted && !hosted.unlocked && new URLSearchParams(window.location.search).get('sample') === '1') {
      window.history.replaceState(null, '', window.location.pathname);
      await tryDemo();
    }
  } catch {
    setBusy(false);
    announce('Could not load the event workspace. Please reload this page.', true);
  }
}
init();
