const $ = selector => document.querySelector(selector);
const state = { scenarios: [], current: null, run: null, reviews: {}, busy: false, live: null, highlighted: null, storage: true };
const labels = { event_date: 'Event date', guest_count: 'Attendance', venue: 'Venue' };
const scenarioNames = ['New inquiry', 'Attendance correction', 'Unconfirmed date change'];
const scenarioNotes = ['A request with missing details', 'An accepted change in plans', 'Keep agreement and request apart'];
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateText = date => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
function display(field, value) { return value === null ? 'Not specified' : field === 'event_date' ? dateText(value) : field === 'guest_count' ? `${value} guests` : value; }
function announce(text, error = false) { const element = $(error ? '#error' : '#notice'); element.textContent = text; element.hidden = !text; }
async function request(url, options) { const response = await fetch(url, options); const data = await response.json(); if (!response.ok) { if (Number.isInteger(data.remaining)) state.live.remaining = data.remaining; throw new Error(data.error || 'Request failed.'); } return data; }
function storageKey() { return `eventbrief:v1:${state.current.id}`; }
function save() {
  try { localStorage.setItem(storageKey(), JSON.stringify({ run: state.run, reviews: state.reviews })); }
  catch { state.storage = false; $('#storage-note').textContent = 'Browser storage is unavailable. Export your review before leaving.'; }
}
function renderMessages() {
  $('#message-count').textContent = `${state.current.messages.length} ${state.current.messages.length === 1 ? 'message' : 'messages'}`;
  $('#messages').innerHTML = state.current.messages.map((m, i) => {
    let body = escape(m.body);
    const selected = state.highlighted?.message_id === m.id;
    if (selected) { const at = m.body.indexOf(state.highlighted.quote); if (at >= 0) body = `${escape(m.body.slice(0, at))}<mark>${escape(state.highlighted.quote)}</mark>${escape(m.body.slice(at + state.highlighted.quote.length))}`; }
    const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(m.sent_at));
    return `<article class="message${selected ? ' active-source' : ''}" id="message-${escape(m.id)}" tabindex="-1"><div class="message-heading"><span class="message-number">${i + 1}</span><span class="sender">${m.role === 'customer' ? 'Customer' : 'Coordinator'}</span><time datetime="${escape(m.sent_at)}">${date}</time></div><p class="message-body">${body}</p></article>`;
  }).join('');
}
function evidence(items) {
  return `<div class="evidence-list">${items.map((item, index) => `<button class="evidence" data-action="source" data-message="${escape(item.message_id)}" data-quote="${escape(item.quote)}" aria-label="View source ${escape(item.message_id)}: ${escape(item.quote)}"><span class="source-tag">${escape(item.message_id.toUpperCase())}</span><span class="quote">“${escape(item.quote)}”</span></button>`).join('')}</div>`;
}
function controls(key, field = null, wording = 'Accept detail') {
  const review = state.reviews[key];
  if (review) return `<div class="item-actions"><span class="decision ${review.decision}">${review.decision === 'accepted' ? 'Reviewed · accepted' : review.decision === 'corrected' ? 'Reviewed · corrected' : 'Reviewed · excluded'}</span><button class="text-button" data-action="undo" data-key="${key}">Undo</button></div>`;
  return `<div class="item-actions"><button class="small-button" data-action="accept" data-key="${key}">${wording}</button>${field ? `<button class="text-button" data-action="edit" data-field="${field}">Correct</button>` : `<button class="text-button" data-action="reject" data-key="${key}">Exclude</button>`}</div>`;
}
function reviewKeys() { return state.run ? [...Object.keys(state.run.output.fields).map(f => `field:${f}`), ...state.run.output.pending_changes.map((_, i) => `change:${i}`), ...state.run.output.open_questions.map((_, i) => `question:${i}`)] : []; }
function renderBrief() {
  if (!state.run) return;
  const out = state.run.output;
  let html = Object.entries(out.fields).map(([field, original]) => {
    const correction = state.reviews[`field:${field}`];
    const current = correction?.decision === 'corrected' ? correction : original;
    return `<section class="field-row" id="field-${field}"><div class="field-top"><h3>${labels[field]}</h3><span class="status ${escape(current.status)}">${current.status === 'unknown' ? 'Missing' : current.status === 'agreed' ? 'Agreed' : current.status === 'requested' ? 'Requested' : 'Stated'}</span></div><p class="field-value ${current.status === 'unknown' ? 'unknown' : ''}">${escape(display(field, current.value))}</p>${correction?.decision === 'corrected' ? `<p class="correction-note">Your correction: ${escape(correction.reason)}<br>Original: ${escape(display(field, original.value))} · ${escape(original.status)}</p>` : ''}${evidence(original.evidence)}${controls(`field:${field}`, field)}<div id="edit-${field}"></div></section>`;
  }).join('');
  html += '<h3 class="section-label">Requested changes</h3>';
  html += out.pending_changes.length ? out.pending_changes.map((change, i) => `<section class="pending-row"><h3>${labels[change.field]} · awaiting agreement</h3><p class="pending-value">${escape(display(change.field, change.value))}</p><p class="pending-hint">Keep this request separate from the current agreed details.</p>${evidence(change.evidence)}${controls(`change:${i}`, null, 'Keep request')}</section>`).join('') : '<p class="empty">No pending changes in this brief.</p>';
  html += '<h3 class="section-label">Open questions</h3>';
  html += out.open_questions.length ? out.open_questions.map((question, i) => `<section class="question-row"><p>${escape(question.question)}</p>${evidence(question.evidence)}${controls(`question:${i}`, null, 'Keep question')}</section>`).join('') : '<p class="empty">No unanswered questions identified.</p>';
  $('#brief').innerHTML = html;
  const keys = reviewKeys();
  const complete = keys.filter(key => state.reviews[key]).length;
  $('#review-progress').textContent = `${complete} of ${keys.length} reviewed`;
  $('#completion').hidden = complete !== keys.length;
  $('#export').disabled = state.busy || complete !== keys.length;
  $('#mode-label').textContent = state.run.mode === 'reference' ? 'Reference example' : 'Live AI result';
  $('#mode-description').textContent = state.run.mode === 'reference' ? 'Authored answers · no AI call' : `${state.run.meta.model} · ${(state.run.meta.latency_ms / 1000).toFixed(1)}s · verify before accepting`;
}
function renderLive() {
  $('#analyze').disabled = state.busy || !state.live?.ready || state.live.remaining < 1;
  $('#analyze').textContent = state.busy ? 'Analyzing conversation…' : 'Analyze with AI';
  $('#reference').disabled = state.busy;
  $('#scenario-select').disabled = state.busy;
  document.querySelectorAll('.scenario-button').forEach(button => { button.disabled = state.busy; });
  $('.brief-pane').setAttribute('aria-busy', String(state.busy));
  $('.brief-pane').classList.toggle('loading-pulse', state.busy);
  $('#live-note').textContent = !state.live?.ready ? 'Live AI is not configured. You can review the authored examples now; setup instructions are in the README.' : `Live model: ${state.live.model}. ${state.live.remaining} calls remain in this server session. Only fictional messages are sent.`;
  if (state.busy) $('#export').disabled = true;
}
async function choose(id) {
  if (state.busy) return;
  state.busy = true;
  state.current = state.scenarios.find(item => item.id === id);
  state.highlighted = null;
  state.run = null;
  state.reviews = {};
  $('#brief').innerHTML = '<p class="empty">Loading the reference example…</p>';
  $('#completion').hidden = true;
  $('#scenario-description').textContent = state.current.title;
  $('#scenario-select').value = id;
  document.querySelectorAll('.scenario-button').forEach(button => button.setAttribute('aria-current', String(button.dataset.id === id)));
  announce(''); announce('', true); renderMessages(); renderLive();
  try {
    const reference = await request(`/api/reference/${id}`);
    let saved;
    try { saved = JSON.parse(localStorage.getItem(storageKey())); } catch { saved = null; }
    // Restore only a matching reference version; live runs preserve their own original output.
    if (saved?.run?.output?.fields && saved?.reviews && (saved.run.mode === 'live' || saved.run.run_id === reference.run_id)) { state.run = saved.run; state.reviews = saved.reviews; }
    else state.run = reference;
    save(); renderBrief();
  } catch (error) { announce(error.message, true); }
  finally { state.busy = false; renderLive(); if (state.run) renderBrief(); }
}
function edit(field) {
  const current = state.run.output.fields[field];
  const container = $(`#edit-${field}`);
  container.innerHTML = `<form class="edit-form" data-field="${field}"><label>Correct ${labels[field].toLowerCase()}<input name="value" type="${field === 'guest_count' ? 'number' : field === 'event_date' ? 'date' : 'text'}" ${field === 'guest_count' ? 'min="1" max="100000" step="1"' : ''} value="${escape(current.value ?? '')}"></label><label>Status<select name="status">${['unknown', 'stated', 'requested', 'agreed'].map(s => `<option value="${s}" ${current.status === s ? 'selected' : ''}>${s === 'unknown' ? 'Missing' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></label><label>Reason for correction<textarea name="reason" required maxlength="500" placeholder="What did the brief get wrong?"></textarea></label><p>Saved as your correction. The original output and its sources remain in the export.</p><div class="item-actions"><button type="submit" class="small-button">Save correction</button><button type="button" class="text-button" data-action="cancel-edit" data-field="${field}">Cancel</button></div></form>`;
  container.querySelector('input').focus();
}
$('#brief').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || state.busy) return;
  const { action, key, field } = button.dataset;
  if (!action) return; // Let submit buttons reach the form's submit handler.
  if (action === 'source') {
    state.highlighted = { message_id: button.dataset.message, quote: button.dataset.quote };
    renderMessages();
    const source = document.getElementById(`message-${button.dataset.message}`);
    source.focus({ preventScroll: true }); source.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    return;
  }
  if (action === 'edit') return edit(field);
  if (action === 'cancel-edit') { $(`#edit-${field}`).replaceChildren(); return; }
  if (action === 'undo') delete state.reviews[key];
  else if (action === 'accept' || action === 'reject') state.reviews[key] = { decision: action === 'accept' ? 'accepted' : 'rejected', reviewed_at: new Date().toISOString() };
  save(); renderBrief();
  const nextControl = [...document.querySelectorAll('#brief button[data-key]')].find(item => item.dataset.key === key);
  nextControl?.focus();
});
$('#brief').addEventListener('submit', event => {
  event.preventDefault();
  if (state.busy) return;
  const form = event.target;
  const field = form.dataset.field;
  const fields = new FormData(form);
  const status = fields.get('status');
  const raw = String(fields.get('value')).trim();
  const reason = String(fields.get('reason')).trim();
  if (!reason || (status !== 'unknown' && !raw)) { announce('Add a corrected value and explain the correction, or choose Missing.', true); return; }
  const value = status === 'unknown' ? null : field === 'guest_count' ? Number(raw) : raw;
  if (field === 'guest_count' && value !== null && (!Number.isInteger(value) || value < 1 || value > 100000)) { announce('Attendance must be a positive whole number up to 100,000.', true); return; }
  state.reviews[`field:${field}`] = { decision: 'corrected', value, status, reason, reviewed_at: new Date().toISOString() };
  save(); renderBrief(); announce('', true); announce('Correction saved separately from the original output.');
});
$('#scenario-nav').addEventListener('click', event => { const button = event.target.closest('button'); if (button) choose(button.dataset.id); });
$('#scenario-select').addEventListener('change', event => choose(event.target.value));
$('#reference').addEventListener('click', async () => {
  if (Object.keys(state.reviews).length && !confirm('Load the reference example and clear this scenario’s current review? Export first if you want to keep it.')) return;
  try { state.run = await request(`/api/reference/${state.current.id}`); state.reviews = {}; save(); renderBrief(); announce('Loaded authored reference answers. No AI call was made.'); } catch (error) { announce(error.message, true); }
});
$('#analyze').addEventListener('click', async () => {
  if (state.busy || !state.live.ready || state.live.remaining < 1) return;
  if (Object.keys(state.reviews).length && !confirm('Create a new AI result and clear this scenario’s current review? Export first if you want to keep it.')) return;
  state.busy = true; renderLive(); announce(''); announce('', true);
  try {
    const result = await request('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario_id: state.current.id }) });
    state.run = result; state.reviews = {}; state.live.remaining = result.remaining; save(); renderBrief();
    announce('Analysis ready. Quotes match the messages; check whether each interpretation is correct.');
  } catch (error) { announce(error.message, true); }
  finally { state.busy = false; renderLive(); renderBrief(); }
});
$('#export').addEventListener('click', () => {
  if (!state.run || reviewKeys().some(key => !state.reviews[key])) return;
  const output = structuredClone(state.run.output);
  for (const [field, original] of Object.entries(output.fields)) {
    const review = state.reviews[`field:${field}`];
    if (review.decision === 'corrected') output.fields[field] = { value: review.value, status: review.status, evidence: [], provenance: 'reviewer_correction', reason: review.reason };
    else output.fields[field] = { ...original, provenance: state.run.mode === 'reference' ? 'authored_reference' : 'model_output' };
  }
  output.pending_changes = output.pending_changes.filter((_, index) => state.reviews[`change:${index}`].decision !== 'rejected');
  output.open_questions = output.open_questions.filter((_, index) => state.reviews[`question:${index}`].decision !== 'rejected');
  const result = { schema_version: 1, synthetic: true, scenario_id: state.current.id, exported_at: new Date().toISOString(), original: state.run, review_decisions: state.reviews, reviewed_brief: output, note: 'Reviewing a requested change does not confirm a booking. Reviewer corrections do not inherit model evidence.' };
  const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  link.href = url; link.download = `eventbrief-${state.current.id}-review.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Reviewed brief downloaded with original output and separate review decisions.');
});
async function init() {
  try {
    const data = await request('/api/scenarios'); state.scenarios = data.scenarios; state.live = data.live;
    $('#scenario-nav').innerHTML = data.scenarios.map((s, i) => `<button class="scenario-button" data-id="${escape(s.id)}"><strong>${scenarioNames[i] || escape(s.title)}</strong><span>${scenarioNotes[i] || ''}</span></button>`).join('');
    $('#scenario-select').innerHTML = data.scenarios.map((s, i) => `<option value="${escape(s.id)}">${scenarioNames[i] || escape(s.title)}</option>`).join('');
    await choose(data.scenarios.at(-1).id);
  } catch { announce('Could not load examples. Check that the local server is running, then reload.', true); }
}
init();
