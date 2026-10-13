// EventBrief's existing CRM shell is the visual reference. Yannis conversation
// review contributes the source → interpreted facts → affected outputs pattern.
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const disabled = busy => busy ? ' disabled' : '';
const stages = {pending:'Needs preparation',blocked:'Needs details',prepared:'Ready to review',reviewed:'All drafts reviewed'};

export function inboxThreads(events, scenarios) {
  return events.map(event => {
    const input = scenarios.find(input => input.id === event.current_scenario_id);
    const summary = event.summary;
    const state = event.pending_update || !summary ? 'pending' : summary.ready_count < 5 ? 'blocked' : summary.reviewed_count === 5 ? 'reviewed' : 'prepared';
    return {id:event.current_scenario_id,event_id:event.event_id,input,revision:event.revision??1,state,pending_update:Boolean(event.pending_update),
      title:summary?.host_name ? `${summary.host_name}’s event` : input?.title?.replace(/^Pasted event:\s*/, '') || event.title,
      preview:input?.messages.at(-1)?.body.replace(/\s+/g,' ').slice(0,150) ?? '',
      source:input?.source_kind === 'pasted' ? 'Pasted conversation' : 'Written example'};
  }).filter(thread => thread.input).sort((a,b) => Number(b.state==='pending')-Number(a.state==='pending') || a.title.localeCompare(b.title));
}

export function renderInboxThreads(threads, {selectedId=null,search='',filter='all',busy=false}={}) {
  const query = search.trim().toLowerCase();
  const shown = threads.filter(thread => (filter === 'all' || thread.state === filter || filter === 'prepared' && thread.state === 'reviewed') &&
    `${thread.title} ${thread.input.messages.map(message=>message.body).join(' ')}`.toLowerCase().includes(query));
  return `<p class="inbox-count" role="status">${shown.length} of ${threads.length} conversations</p>` + (shown.length ?
    `<ul class="inbox-thread-list">${shown.map(thread => `<li><button class="inbox-thread" data-inbox-thread="${html(thread.id)}" aria-current="${thread.id===selectedId}"${disabled(busy)}><span class="inbox-thread-top"><strong>${html(thread.title)}</strong><span class="inbox-thread-version">v${thread.revision}</span></span><span class="inbox-thread-preview">${html(thread.preview)}</span><span class="inbox-thread-state ${thread.state}">${stages[thread.state]}</span><span class="inbox-thread-source">${thread.source} · ${thread.input.messages.length-1} ${thread.input.messages.length===2?'reply':'replies'}</span></button></li>`).join('')}</ul>` :
    `<div class="inbox-empty"><h3>${threads.length?'No matches':'Your inbox is empty'}</h3><p>${threads.length?'Try another name, message, or filter.':'Add a conversation to see its messages here. Then prepare its event details and drafts.'}</p></div>`);
}

function sourceMessages(input, highlight) {
  return input.messages.map((message,index) => {
    const active = highlight?.message_id === message.id && typeof highlight.quote==='string' && message.body.includes(highlight.quote);
    let body = html(message.body);
    if(active)body = body.replace(html(highlight.quote),()=>`<mark>${html(highlight.quote)}</mark>`);
    const title = message.role==='conversation' ? 'Original pasted conversation' : ['host','customer'].includes(message.role) ? 'Event host' : 'Restaurant';
    return `<article id="inbox-message-${html(message.id)}" class="inbox-message${active?' selected-source':''}" tabindex="-1"><header><strong>${title}</strong><span>${index===0?'Original source':`Source ${index+1}`}</span></header>${message.subject?`<p class="inbox-message-subject">${html(message.subject)}</p>`:''}${message.sender?`<p class="inbox-message-meta">From: ${html(message.sender)}</p>`:''}<p class="inbox-message-body">${body}</p></article>`;
  }).join('');
}

function detailField(field, definition, data, busy) {
  const detail = data.record.fields[field], corrected = detail.provenance==='coordinator_correction';
  const original = data.original_record.fields[field];
  const evidence = corrected ? original.evidence : detail.evidence;
  const status = {unknown:'Missing',conflicting:'Conflicting',requested:'Requested',stated:'Stated',agreed:'Agreed'}[detail.status] ?? detail.status;
  const affected = data.documents.filter(doc => doc.dependencies.includes(field));
  return `<details class="inbox-field"${field==='event_date'?' open':''}><summary><span>${html(definition.label)}</span><strong>${html(detail.value??status)}</strong></summary><div class="inbox-field-detail"><span class="inbox-origin${corrected?' corrected':''}">${corrected?'Coordinator change':detail.preparation?.kind==='restaurant_default'?'From restaurant settings':detail.preparation?.kind==='guest_total_basis'?'From total attendance · pricing needs confirmation':detail.preparation?.kind==='guests_from_total'?'Calculated from attendance':detail.preparation?.kind==='calculated_total'?'Calculated from guest counts':`From conversation · ${html(status)}`}</span>${detail.preparation?`<p>${html(detail.preparation.description)}</p><p class="inbox-original">Original value: ${html(original.value??'Not supplied')}</p>`:''}${detail.notes?`<p><strong>Drink notes:</strong> ${html(detail.notes)}</p>`:''}${corrected?`<p>${html(detail.reason)}</p><p class="inbox-original">Original value: ${html(original.value??'Not supplied')}</p>`:''}${evidence.length?evidence.map((citation,index)=>`<button class="inbox-citation" data-inbox-source="${html(field)}" data-citation-index="${index}"${disabled(busy)}><span>${corrected?'See original source':'See source'}</span><q>${html(citation.quote)}</q></button>`).join(''):`<p class="inbox-muted">${corrected?'No original quotation was supplied.':'No source quotation was supplied. This detail needs checking.'}</p>`}${affected.length?`<p class="inbox-used-label">Used or checked by</p><div class="inbox-asset-links">${affected.map(doc=>`<button class="text-button" data-open-event="${html(data.scenario_id)}" data-open-document="${doc.id}"${disabled(busy)}>${html(doc.title)}</button>`).join('')}</div>`:'<p class="inbox-muted">Kept in the event record.</p>'}</div></details>`;
}

export function renderInboxDetail(thread, {data=null,reviews={},definitions={},busy=false,loading=false,error='',highlight=null,canPrepare=false,canReply=false}={}) {
  if(!thread)return '<div class="inbox-empty inbox-select"><h3>Choose a conversation</h3><p>See the original messages, the details taken from them, and their drafts.</p></div>';
  // A pending source never inherits the preceding version's facts or ready assets.
  const prepared = data?.scenario_id===thread.id && !data.version?.superseded && !thread.pending_update ? data : null;
  const documents = prepared?.documents??[];
  const ready = documents.filter(doc=>doc.state==='ready_for_review').length;
  const fields = prepared ? Object.values(prepared.record.fields).filter(detail=>detail.value!==null).length : 0;
  const outputs = `<section class="inbox-outputs" aria-labelledby="inbox-outputs-heading"><div class="inbox-section-heading"><h4 id="inbox-outputs-heading">Assets from this conversation</h4><span>${prepared?'Same saved event record':'No current drafts yet'}</span></div>${prepared?`<div class="inbox-output-list">${documents.map(doc=>`<button data-open-event="${html(thread.id)}" data-open-document="${doc.id}"${disabled(busy)}><strong>${html(doc.title)}</strong><span>${doc.state==='blocked'?'Needs details':reviews[doc.id]?.revision===doc.revision?'Reviewed':'Ready to review'}</span></button>`).join('')}</div><p class="inbox-muted">${prepared.mode==='authored_reference'?'These sample details were written in advance.':'AI extracted the details from these messages.'} Drafts use the event details and fictional restaurant rules. Open each draft to check it.</p>`:'<p class="inbox-muted">Calendar entry · Guest quote · Kitchen sheet · Staff event plan · Guest event plan</p>'}</section>`;
  return `<header class="inbox-detail-heading"><div><p class="inbox-eyebrow">${thread.source} · version ${thread.revision}</p><h3>${html(thread.title)}</h3></div><button class="small-button" data-open-event="${html(thread.id)}"${disabled(busy)}>Open event</button></header>
    <ol class="inbox-flow" aria-label="From source to drafts"><li><span>1</span><div><strong>Messages</strong><small>${thread.input.messages.length} saved ${thread.input.messages.length===1?'source block':'source blocks'}</small></div></li><li><span>2</span><div><strong>Event details</strong><small>${prepared?`${fields} details supplied`:loading?'Opening saved details…':'Not prepared yet'}</small></div></li><li><span>3</span><div><strong>Five drafts</strong><small>${prepared?`${ready} ready · ${5-ready} need details`:'Waiting for preparation'}</small></div></li></ol>
    ${error?`<p class="error" role="alert">${html(error)} <button class="text-button" data-inbox-thread="${html(thread.id)}"${disabled(busy)}>Try again</button></p>`:''}
    ${!prepared&&!loading&&!error?`<div class="inbox-pending"><strong>Messages saved. The drafts need preparation.</strong><p>Prepare these messages to get event details and all five drafts. Earlier versions stay in the event history.</p><button class="button primary" data-inbox-prepare="${html(thread.id)}"${disabled(busy||!canPrepare)}>Prepare five drafts</button><span class="inbox-muted">${canPrepare?'Uses one AI preparation.':'Real AI requires private access and an available preparation.'}</span></div>`:''}
    ${outputs}
    <div class="inbox-reading-grid"><section class="inbox-source-column" aria-labelledby="inbox-source-heading"><div class="inbox-section-heading"><h4 id="inbox-source-heading">Source conversation</h4><span>Original text</span></div>${sourceMessages(thread.input,highlight)}${canReply?`<button class="small-button" data-inbox-add-reply="${html(thread.id)}"${disabled(busy)}>Add a reply</button>`:''}</section>
    <section class="inbox-details-column" aria-labelledby="inbox-facts-heading"><div class="inbox-section-heading"><h4 id="inbox-facts-heading">Event details</h4><span>${prepared?.mode==='authored_reference'?'Written example':prepared?'AI extraction + review':'Awaiting preparation'}</span></div><p class="inbox-muted">Open a detail to see its source and the drafts that use it. Coordinator changes are shown separately.</p>${prepared?Object.entries(definitions).map(([field,definition])=>detailField(field,definition,prepared,busy)).join(''):`<p class="inbox-empty">${loading?'Opening the saved result…':'Details will appear after these messages are prepared.'}</p>`}</section></div>
    `;
}
