import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedFetch } from '../lib/hosted/handler.mjs';
import { demoInput, demoText, demoReply, demoRecord } from '../lib/package-demo.mjs';
import { replyInput } from '../lib/package-workspace.mjs';

const origin = 'https://eventbrief-test.example';
const env = {
  EVENTBRIEF_PUBLIC_ORIGIN: origin,
  EVENTBRIEF_ACCESS_CODE: 'fictional-access-code-for-local-tests',
  EVENTBRIEF_SESSION_SECRET: 'fictional-session-secret-for-local-tests-only',
  EVENTBRIEF_LIVE_ENABLED: 'true',
  EVENTBRIEF_OPENAI_API_KEY: 'fake-local-provider-key'
};

function memoryBlob() {
  const files = new Map();
  class BlobError extends Error {}
  return {
    files, BlobError,
    async put(path, body, options) {
      assert.equal(options.access, 'private');
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.addRandomSuffix, false);
      if (files.has(path)) throw new BlobError('Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.');
      files.set(path, Buffer.from(body));
      return { pathname: path };
    },
    async get(path, options) {
      assert.equal(options.access, 'private'); assert.equal(options.useCache, false);
      const value = files.get(path);
      return value === undefined ? null : { statusCode: 200, blob: { pathname: path, size: value.length }, stream: new Blob([value]).stream() };
    },
    async list({ prefix, cursor }) {
      const names = [...files.keys()].filter(name => name.startsWith(prefix)).sort();
      const offset = Number(cursor ?? 0), next = offset + 3;
      return { blobs: names.slice(offset, next).map(pathname => ({ pathname })), hasMore: next < names.length, cursor: String(next) };
    }
  };
}

function setup({ duringTransport, quotePdfRenderer } = {}) {
  const sdk = memoryBlob(); let calls = 0;
  const config = {...env};
  const packageTransport = async ({ request, key }) => {
    calls++;
    if (duringTransport) await duringTransport();
    assert.equal(key, env.EVENTBRIEF_OPENAI_API_KEY);
    const { messages } = JSON.parse(request.input[0].content);
    const input = messages.length === 1 ? demoInput : replyInput(demoInput, demoReply);
    assert.deepEqual(messages, input.messages);
    return { ok: true, status: 200, body: JSON.stringify({ status: 'completed', model: request.model,
      usage: { input_tokens: 100, output_tokens: 100 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(demoRecord(input)) }] }] }) };
  };
  function visitor() {
    const jar = new Map();
    let scope = 'public';
    return {
      async request(path, body, options = {}) {
        const method = options.method ?? (body === undefined ? 'GET' : 'POST');
        const headers = new Headers({ ...(method === 'POST' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...options.headers });
        if (path.includes('package/') && !headers.has('X-EventBrief-Workspace')) headers.set('X-EventBrief-Workspace', scope);
        headers.set('Cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
        // A fresh handler on every request exercises cold-start persistence.
        const response = await createHostedFetch({ env: config, sdk, packageTransport, quotePdfRenderer })(new Request(origin + path, {
          method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
        }));
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(';')[0], index = pair.indexOf('=');
          const name = pair.slice(0, index), value = pair.slice(index + 1);
          if (cookie.includes('Max-Age=0')) jar.delete(name); else jar.set(name, value);
        }
        const data = response.headers.get('Content-Type')==='application/pdf'?Buffer.from(await response.arrayBuffer()):await response.json();
        if (response.ok) scope = data.hosted?.workspace ?? data.workspace ?? scope;
        return { status: response.status, data, headers: response.headers };
      }
    };
  }
  return { sdk, visitor, config, calls: () => calls };
}

const readyIds = data => data.documents.filter(doc => doc.state === 'ready_for_review').map(doc => doc.id);
for(const kind of ['quote','kitchen','staff','guest'])test(`hosted ${kind} download returns PDF bytes within the selected workspace without an AI call`,async()=>{
  let renders=0;
  const system=setup({quotePdfRenderer:async()=>{renders++;return Buffer.from('%PDF-1.7\nsynthetic test');}});
  const visitor=system.visitor(),owner=system.visitor();
  const source=await visitor.request('/api/package/demo',{});
  const reply=await visitor.request('/api/package/reply',{scenario_id:source.data.input.id,text:demoReply,role:'host'});
  const prepared=await visitor.request('/api/package/prepare',{scenario_id:reply.data.input.id,corrections:{}});
  const body={scenario_id:reply.data.input.id,run_id:null,sequence:0,revision:prepared.data.documents.find(doc=>doc.id===kind).revision};
  const route=`/api/package/${kind}/pdf`;
  const pdf=await visitor.request(route,body);
  assert.equal(pdf.status,200);assert.equal(pdf.data.toString(),'%PDF-1.7\nsynthetic test');
  assert.match(pdf.headers.get('Content-Disposition'),/attachment; filename="eventbrief-.*\.pdf"/);
  await owner.request('/api/hosted/unlock',{code:env.EVENTBRIEF_ACCESS_CODE});
  assert.equal((await owner.request(route,body)).status,400);
  assert.equal((await owner.request(route,body,{headers:{'X-EventBrief-Workspace':'public'}})).status,409);
  assert.equal((await visitor.request(route,body,{headers:{Origin:'https://untrusted.example'}})).status,403);
  await visitor.request('/api/package/reply',{scenario_id:body.scenario_id,text:'We may need a different date.',role:'host'});
  assert.equal((await visitor.request(route,body)).status,409);
  assert.equal(renders,1);assert.equal(system.calls(),0);
});
const marksFor = data => Object.fromEntries(data.documents.filter(doc => doc.state === 'ready_for_review').map(doc => [doc.id, {
  decision: 'reviewed', revision: doc.revision, reviewed_at: new Date().toISOString()
}]));

test('hosted public sample saves review progress across cold starts and reaches five drafts after the host reply', async () => {
  const system = setup(), client = system.visitor();
  const started = await client.request('/api/package/demo', {});
  assert.equal(started.status, 200); assert.equal(started.data.input.id, demoInput.id);
  assert.equal(started.data.input.messages[0].body, demoText);
  const first = await client.request('/api/package/prepare', { scenario_id: started.data.input.id, corrections: {} });
  assert.equal(first.status, 200); assert.deepEqual(readyIds(first.data), ['calendar', 'quote']);
  const identity = { scenario_id: started.data.input.id, run_id: null };
  const reviews = marksFor(first.data);
  const saved = await client.request('/api/package/review', { ...identity, corrections: {}, reviews, sequence: 0 });
  assert.equal(saved.status, 200); assert.equal(saved.data.saved.sequence, 1);
  const reopened = await client.request('/api/package/review/load', identity);
  assert.equal(reopened.status, 200); assert.deepEqual(reopened.data.saved.reviews, reviews);
  const listing = await client.request('/api/package/scenarios');
  assert.equal(listing.status, 200); assert.equal(listing.data.events.length, 1);
  assert.equal(listing.data.events[0].summary.reviewed_count, 2);
  assert.equal(listing.data.hosted.unlocked, false);
  assert.match(listing.data.demo.label, /authored results/);
  const reply = await client.request('/api/package/reply', { scenario_id: identity.scenario_id, text: demoReply, role: 'host' });
  assert.equal(reply.status, 200); assert.equal(reply.data.reference_available, true);
  assert.equal(reply.data.input.messages.length, 2);
  assert.deepEqual(reply.data.input.messages[0], started.data.input.messages[0]);
  const updatedIdentity = { scenario_id: reply.data.input.id, run_id: null };
  const updated = await client.request('/api/package/prepare', { scenario_id: updatedIdentity.scenario_id, corrections: {} });
  assert.equal(updated.status, 200); assert.equal(readyIds(updated.data).length, 5);
  assert.ok(updated.data.documents.every(doc => doc.revision !== first.data.documents.find(previous => previous.id === doc.id).revision));
  const freshReview = await client.request('/api/package/review/load', updatedIdentity);
  assert.equal(freshReview.status, 200); assert.equal(freshReview.data.saved, null);
  assert.equal(system.calls(), 0);
});

test('hosted access code gates shared private sources and receipts; locking restores the separate public workspace', async () => {
  const system = setup(), owner = system.visitor(), stranger = system.visitor();
  const sample = await owner.request('/api/package/demo', {}), scenarioId = sample.data.input.id;
  const locked = await owner.request('/api/package/analyze', { scenario_id: scenarioId });
  assert.equal(locked.status, 401); assert.equal(system.calls(), 0);
  const wrong = await owner.request('/api/hosted/unlock', { code: 'wrong-code' });
  assert.equal(wrong.status, 401); assert.equal(system.calls(), 0);
  const unlocked = await owner.request('/api/hosted/unlock', { code: env.EVENTBRIEF_ACCESS_CODE });
  assert.equal(unlocked.status, 200); assert.equal(unlocked.data.unlocked, true);
  assert.equal((await owner.request('/api/package/scenarios')).data.events.length, 0);
  assert.equal((await owner.request('/api/package/messages', {text: demoText})).status, 200);
  const analyzed = await owner.request('/api/package/analyze', { scenario_id: scenarioId });
  assert.equal(analyzed.status, 200, JSON.stringify(analyzed.data)); assert.equal(system.calls(), 1);
  assert.equal(analyzed.data.extraction.mode, 'live');
  assert.deepEqual(readyIds(analyzed.data), ['calendar', 'quote']);
  const runId = analyzed.data.extraction.run_id;
  const receipt = await owner.request(`/api/package/attempts/${runId}`);
  assert.equal(receipt.status, 200); assert.equal(receipt.data.status, 'succeeded');
  const identity = { scenario_id: scenarioId, run_id: runId };
  const reviews = marksFor(analyzed.data);
  assert.equal((await owner.request('/api/package/review', { ...identity, corrections: {}, reviews, sequence: 0 })).status, 200);
  const strangersListing = await stranger.request('/api/package/scenarios');
  assert.equal(strangersListing.status, 200); assert.deepEqual(strangersListing.data.events, []);
  assert.deepEqual(strangersListing.data.history, []);
  assert.ok(!strangersListing.data.scenarios.some(source => source.id === scenarioId));
  assert.equal((await stranger.request(`/api/package/attempts/${runId}`)).status, 404);
  assert.equal((await stranger.request('/api/package/prepare', { scenario_id: scenarioId, run_id: runId, corrections: {} })).status, 400);
  assert.equal((await stranger.request('/api/package/review/load', identity)).status, 400);
  assert.equal((await stranger.request('/api/package/analyze', { scenario_id: scenarioId })).status, 401);
  assert.equal((await owner.request('/api/hosted/lock', {})).data.unlocked, false);
  const session = await owner.request('/api/hosted/session'); assert.equal(session.data.unlocked, false);
  const preserved = await owner.request('/api/package/scenarios');
  assert.equal(preserved.status, 200); assert.equal(preserved.data.events.length, 1);
  assert.equal(preserved.data.history.length, 0); assert.equal(preserved.data.events[0].summary.reviewed_count, 0);
  assert.equal((await owner.request(`/api/package/attempts/${runId}`)).status, 404);
  assert.equal((await owner.request('/api/hosted/unlock', {code: env.EVENTBRIEF_ACCESS_CODE})).status, 200);
  const reopened = await owner.request('/api/package/review/load', identity);
  assert.equal(reopened.status, 200); assert.deepEqual(reopened.data.saved.reviews, reviews);
  assert.equal((await owner.request('/api/package/scenarios')).data.history[0].run_id, runId);
  assert.equal(system.calls(), 1);
});

test('hosted handler rejects cross-site changes and non-allowlisted routes before touching saved data or the provider', async () => {
  const system = setup(), client = system.visitor();
  for (const headers of [{ Origin: 'https://unrelated.example' }, { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const result = await client.request('/api/package/demo', {}, { headers });
    assert.equal(result.status, 403);
  }
  for (const path of ['/api/analyze', '/api/package/update', '/api/package/attempts/../../secret', '/api?route=../secret']) {
    const result = await client.request(path, {});
    assert.equal(result.status, 404);
  }
  assert.equal(system.sdk.files.size, 0); assert.equal(system.calls(), 0);
  const routed = await client.request('/api/handler?route=package/demo', {});
  assert.equal(routed.status, 200); assert.equal(routed.data.input.id, demoInput.id);
  assert.equal(routed.headers.get('cache-control'), 'private, no-store');
  assert.equal(system.calls(), 0);
});

test('a reply from another request during AI preparation makes the completed original result superseded', async () => {
  let owner, appended;
  const system = setup({ duringTransport: async () => {
    appended = await owner.request('/api/package/reply', { scenario_id: demoInput.id, text: demoReply, role: 'host' });
    assert.equal(appended.status, 200);
  } });
  owner = system.visitor();
  assert.equal((await owner.request('/api/package/demo', {})).status, 200);
  assert.equal((await owner.request('/api/hosted/unlock', { code: env.EVENTBRIEF_ACCESS_CODE })).status, 200);
  assert.equal((await owner.request('/api/package/messages', {text: demoText})).status, 200);
  const original = await owner.request('/api/package/analyze', { scenario_id: demoInput.id });
  assert.equal(original.status, 200, JSON.stringify(original.data));
  assert.equal(system.calls(), 1);
  assert.equal(original.data.version.superseded, true);
  assert.equal(original.data.version.current_scenario_id, appended.data.input.id);
  const listing = await owner.request('/api/package/scenarios');
  assert.equal(listing.data.events[0].current_scenario_id, appended.data.input.id);
  assert.equal(listing.data.history[0].superseded, true);
  const staleReview = await owner.request('/api/package/review', {
    scenario_id: demoInput.id, run_id: original.data.extraction.run_id,
    corrections: {}, reviews: marksFor(original.data), sequence: 0
  });
  assert.equal(staleReview.status, 409);
  const current = await owner.request('/api/package/prepare', { scenario_id: appended.data.input.id, corrections: {} });
  assert.equal(current.status, 200); assert.equal(readyIds(current.data).length, 5);
  assert.equal(current.data.version.superseded, false);
});

test('two browsers with the code share messages, results and reviews while public samples stay isolated', async () => {
  const system = setup(), chrome = system.visitor(), inApp = system.visitor(), publicVisitor = system.visitor();
  await chrome.request('/api/package/demo', {});
  await inApp.request('/api/package/messages', {text: 'Host: Public browser sample only.'});
  for (const client of [chrome, inApp]) {
    const result = await client.request('/api/hosted/unlock', {code: env.EVENTBRIEF_ACCESS_CODE});
    assert.equal(result.data.workspace, 'private');
    assert.equal((await client.request('/api/package/scenarios')).data.events.length, 0);
  }
  assert.equal((await chrome.request('/api/package/demo', {})).status, 409);
  await chrome.request('/api/package/messages', {text: demoText});
  const changed = await chrome.request('/api/package/reply', {scenario_id: demoInput.id, text: demoReply, role: 'host'});
  const id = changed.data.input.id;
  const ai = await chrome.request('/api/package/analyze', {scenario_id: id});
  assert.equal(ai.status, 200); assert.equal(readyIds(ai.data).length, 5);
  const identity = {scenario_id: id, run_id: ai.data.extraction.run_id};
  const marks = marksFor(ai.data);
  const firstMark = {calendar: marks.calendar};
  await chrome.request('/api/package/review', {...identity, corrections: {}, reviews: firstMark, sequence: 0});
  const other = await inApp.request('/api/package/scenarios');
  assert.equal(other.data.events.length, 1);
  assert.equal(other.data.events[0].current_scenario_id, id);
  assert.equal(other.data.events[0].summary.reviewed_count, 1);
  assert.equal((await inApp.request(`/api/package/attempts/${identity.run_id}`)).status, 200);
  const loaded = await inApp.request('/api/package/review/load', identity);
  assert.deepEqual(loaded.data.saved.reviews, firstMark);
  const second = await inApp.request('/api/package/review', {...identity, corrections: {}, reviews: marks, sequence: 1});
  assert.equal(second.status, 200);
  const stale = await chrome.request('/api/package/review', {...identity, corrections: {}, reviews: {}, sequence: 1});
  assert.equal(stale.status, 409); assert.match(stale.data.error, /changed in another tab/);
  assert.equal(Object.keys((await chrome.request('/api/package/review/load', identity)).data.saved.reviews).length, 5);
  await publicVisitor.request('/api/package/demo', {});
  assert.equal((await publicVisitor.request('/api/package/scenarios')).data.events[0].revision, 1);
  assert.equal((await publicVisitor.request('/api/package/review/load', identity)).status, 400);
  assert.equal((await publicVisitor.request(`/api/package/attempts/${identity.run_id}`)).status, 404);
  await chrome.request('/api/hosted/lock', {});
  assert.equal((await chrome.request('/api/package/scenarios')).data.events[0].revision, 1);
  await inApp.request('/api/hosted/lock', {});
  assert.equal((await inApp.request('/api/package/scenarios')).data.events[0].title, 'Pasted event: Host: Public browser sample only.');
  await chrome.request('/api/hosted/unlock', {code: env.EVENTBRIEF_ACCESS_CODE});
  assert.equal((await chrome.request('/api/package/scenarios')).data.events[0].summary.reviewed_count, 5);
  assert.equal(system.calls(), 1);
});

test('stale workspace pages cannot write across a lock, unlock, or access-code rotation', async () => {
  const system = setup(), client = system.visitor();
  await client.request('/api/hosted/unlock', {code: env.EVENTBRIEF_ACCESS_CODE});
  await client.request('/api/package/messages', {text: demoText});
  for (const scope of ['public', '']) {
    const wrong = await client.request('/api/package/messages', {text: 'Host: Must never be saved.'}, {headers: {'X-EventBrief-Workspace': scope}});
    assert.equal(wrong.status, 409); assert.equal(wrong.data.code, 'WORKSPACE_CHANGED');
  }
  system.config.EVENTBRIEF_ACCESS_CODE = 'replacement-fictional-access-code-for-tests';
  const stale = await client.request('/api/package/messages', {text: 'Host: Must never reach the public sample.'});
  assert.equal(stale.status, 409);
  await client.request('/api/hosted/session');
  assert.equal((await client.request('/api/package/scenarios')).data.events.length, 0);
  await client.request('/api/hosted/unlock', {code: system.config.EVENTBRIEF_ACCESS_CODE});
  const recovered = await client.request('/api/package/scenarios');
  assert.equal(recovered.data.events.length, 1);
  assert.equal(recovered.data.events[0].event_id, demoInput.id);
  await client.request('/api/hosted/lock', {});
  const oldPrivate = await client.request('/api/package/review/load', {scenario_id: demoInput.id, run_id: null}, {headers: {'X-EventBrief-Workspace': 'private'}});
  assert.equal(oldPrivate.status, 409);
  assert.equal(system.calls(), 0);
});

test('shared asset summaries follow saved corrections and clear stale schedules after new messages', async () => {
  const system=setup(), first=system.visitor(), second=system.visitor();
  for(const client of [first,second]) await client.request('/api/hosted/unlock',{code:env.EVENTBRIEF_ACCESS_CODE});
  await first.request('/api/package/messages',{text:demoText});
  const reply=await first.request('/api/package/reply',{scenario_id:demoInput.id,text:demoReply,role:'host'});
  const id=reply.data.input.id;
  const corrections={event_date:{value:'2027-12-03',status:'agreed',reason:'Fictional schedule change for this test.'}};
  const prepared=await first.request('/api/package/prepare',{scenario_id:id,corrections});
  const marks=marksFor(prepared.data);
  await first.request('/api/package/review',{scenario_id:id,run_id:null,corrections,reviews:{quote:marks.quote},sequence:0});
  const listing=await second.request('/api/package/scenarios');
  const summary=listing.data.events[0].summary;
  assert.equal(summary.event_date,'2027-12-03');assert.equal(summary.ready_count,5);
  assert.equal(summary.documents.find(doc=>doc.id==='quote').reviewed,true);
  assert.equal(summary.quote_total_cents,228000);assert.equal(summary.guest_13_plus_count,30);
  assert.ok(!Object.hasOwn(summary,'staff_notes'));assert.ok(!Object.hasOwn(summary,'dietary'));
  await first.request('/api/package/reply',{scenario_id:id,text:'We may need a different date. I will confirm tomorrow.',role:'host'});
  const changed=await second.request('/api/package/scenarios');
  assert.equal(changed.data.events[0].pending_update,true);assert.equal(changed.data.events[0].summary,null);
  assert.equal(system.calls(),0);
});

test('one coordinator save updates shared assets, preserves unaffected reviews and rejects stale edits', async () => {
  const system=setup(), first=system.visitor(), second=system.visitor(), publicVisitor=system.visitor();
  for(const client of [first,second]) await client.request('/api/hosted/unlock',{code:env.EVENTBRIEF_ACCESS_CODE});
  await first.request('/api/package/messages',{text:demoText});
  const reply=await first.request('/api/package/reply',{scenario_id:demoInput.id,text:demoReply,role:'host'});
  const identity={scenario_id:reply.data.input.id,run_id:null};
  const before=(await first.request('/api/package/prepare',{scenario_id:identity.scenario_id,corrections:{}})).data;
  const allReviews=marksFor(before);
  await first.request('/api/package/review',{...identity,corrections:{},reviews:allReviews,sequence:0});
  const edited=await first.request('/api/package/edit',{...identity,sequence:1,changes:{guest_13_plus_count:18,child_count:2},reason:'Host confirmed the final numbers.'});
  assert.equal(edited.status,200,edited.data.error);
  assert.deepEqual(edited.data.changed_documents.map(doc=>doc.id),['quote','kitchen','staff','guest']);
  assert.deepEqual(edited.data.saved.reviews,{calendar:allReviews.calendar});
  assert.equal(edited.data.data.record.fields.guest_count.value,20);
  assert.equal(edited.data.data.documents.find(doc=>doc.id==='quote').quote.total_cents,142400);
  assert.deepEqual(edited.data.data.input,before.input);
  assert.deepEqual(edited.data.data.original_record,before.original_record);
  const loaded=await second.request('/api/package/review/load',identity);
  assert.deepEqual(loaded.data.data.record,edited.data.data.record);
  const summary=(await second.request('/api/package/scenarios')).data.events[0].summary;
  assert.equal(summary.guest_count,20);assert.equal(summary.guest_13_plus_count,18);assert.equal(summary.child_count,2);
  assert.equal(summary.quote_total_cents,142400);assert.equal(summary.reviewed_count,1);
  const stale=await second.request('/api/package/edit',{...identity,sequence:1,changes:{event_date:'2027-12-03'},reason:''});
  assert.equal(stale.status,409);
  const invalid=await first.request('/api/package/edit',{...identity,sequence:2,changes:{guest_13_plus_count:-1,child_count:2},reason:''});
  assert.equal(invalid.status,400);
  assert.equal((await first.request('/api/package/review/load',identity)).data.saved.sequence,2);
  const publicEdit=await publicVisitor.request('/api/package/edit',{...identity,sequence:2,changes:{host_name:'Public visitor'},reason:''});
  assert.equal(publicEdit.status,400);
  const wrongScope=await first.request('/api/package/edit',{...identity,sequence:2,changes:{host_name:'Wrong scope'},reason:''},{headers:{'X-EventBrief-Workspace':'public'}});
  assert.equal(wrongScope.status,409);
  const moved=await second.request('/api/package/edit',{...identity,sequence:2,changes:{event_date:'2027-12-03'},reason:'Host confirmed.'});
  assert.equal(moved.status,200,moved.data.error);
  assert.equal(moved.data.changed_documents.length,5);assert.deepEqual(moved.data.saved.reviews,{});
  for(const doc of moved.data.data.documents) assert.equal(doc.rows.find(row=>row.field==='event_date').value,'2027-12-03');
  assert.equal((await first.request('/api/package/scenarios')).data.events[0].summary.event_date,'2027-12-03');
  await first.request('/api/package/review',{...identity,sequence:3,corrections:moved.data.saved.corrections,reviews:marksFor(moved.data.data)});
  const staff=await first.request('/api/package/edit',{...identity,sequence:4,changes:{staff_notes:'Set up at 5:30 PM.'},reason:''});
  assert.equal(staff.status,200,staff.data.error);
  assert.deepEqual(staff.data.changed_documents.map(doc=>doc.id),['staff']);
  assert.deepEqual(Object.keys(staff.data.saved.reviews),['calendar','quote','kitchen','guest']);
  await first.request('/api/package/reply',{scenario_id:identity.scenario_id,text:'Can we change our date again?',role:'host'});
  assert.equal((await first.request('/api/package/edit',{...identity,sequence:5,changes:{host_name:'Earlier event'},reason:''})).status,409);
  assert.equal(system.calls(),0);
});

test('editing a saved AI result uses its receipt and needs no new provider request', async () => {
  const system=setup(), owner=system.visitor();
  await owner.request('/api/hosted/unlock',{code:env.EVENTBRIEF_ACCESS_CODE});
  await owner.request('/api/package/messages',{text:demoText});
  const reply=await owner.request('/api/package/reply',{scenario_id:demoInput.id,text:demoReply,role:'host'});
  const prepared=await owner.request('/api/package/analyze',{scenario_id:reply.data.input.id}); // In-memory fake provider only.
  assert.equal(system.calls(),1);
  const identity={scenario_id:reply.data.input.id,run_id:prepared.data.extraction.run_id};
  const edited=await owner.request('/api/package/edit',{...identity,sequence:0,changes:{start_time:'18:30',end_time:'21:30'},reason:''});
  assert.equal(edited.status,200,edited.data.error);
  assert.equal(edited.data.data.record.fields.start_time.value,'18:30');
  assert.equal(edited.data.data.extraction.run_id,identity.run_id);
  assert.deepEqual(edited.data.data.original_record,prepared.data.original_record);
  const receipt=await owner.request(`/api/package/attempts/${identity.run_id}`);
  assert.deepEqual(receipt.data.parsed_output,prepared.data.original_record);
  assert.equal((await owner.request('/api/package/scenarios')).data.events[0].summary.start_time,'18:30');
  assert.equal(system.calls(),1);
});
