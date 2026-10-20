import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedFetch } from '../lib/hosted/handler.mjs';
import { demoInput, demoText, demoReply, demoRecord } from '../lib/package-demo.mjs';
import { replyInput } from '../lib/package-workspace.mjs';
import { rehearsalExample } from '../public/restaurant-example.mjs';
import {evaluationCases} from '../lib/demo-evaluation.mjs';

const origin = 'https://eventbrief-test.example';
const env = {
  EVENTBRIEF_PUBLIC_ORIGIN: origin,
  EVENTBRIEF_REQUIRE_ACCESS_CODE: 'true',
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

test('public named tests save real checked outcomes across cold starts and share the existing AI cap', async () => {
  const sdk = memoryBlob(); let calls = 0;
  const config = {...env,EVENTBRIEF_REQUIRE_ACCESS_CODE:'false',VERCEL_GIT_COMMIT_SHA:'test-build'};
  const transport = async ({request}) => {
    calls++;
    const payload = JSON.parse(request.input[0].content);
    const entry = evaluationCases.find(c => JSON.stringify(c.input.messages) === JSON.stringify(payload.messages));
    assert.ok(entry,'Uses the named conversation');
    assert.ok(!Object.hasOwn(payload,'expected')); assert.ok(!Object.hasOwn(payload,'checks'));
    return {ok:true,status:200,body:JSON.stringify({status:'completed',model:request.model,
      usage:{input_tokens:100,output_tokens:100},
      output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(entry.original)}]}]})};
  };
  const request = async (body, headers = {}) => {
    const response = await createHostedFetch({env:config,sdk,packageTransport:transport})(new Request(`${origin}/api/package/tests`,
      body === undefined ? {} : {method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-EventBrief-Workspace':'demo',...headers},body:JSON.stringify(body)}));
    return {status:response.status,data:await response.json()};
  };
  const initial = await request();
  assert.equal(initial.status,200); assert.equal(initial.data.cases.length,5); assert.deepEqual(initial.data.history,[]);
  assert.ok(initial.data.cases.every(c => c.expected.length && c.conversation));
  assert.equal((await request({case_id:'all',mode:'replay'},{Origin:'https://unrelated.example'})).status,403);
  assert.equal((await request({case_id:'all',mode:'live'})).status,400);
  assert.equal((await request({case_id:'birthday',mode:'replay',passed:true})).status,400);
  const replay = await request({case_id:'all',mode:'replay'});
  assert.equal(replay.status,200); assert.equal(replay.data.saved,true); assert.equal(replay.data.report.passed,5);
  assert.equal(replay.data.live.remaining,20); assert.equal(calls,0);
  const saved = await request();
  assert.equal(saved.data.history[0].id,replay.data.report.id);
  assert.equal(saved.data.history[0].build_revision,'test-build');
  for (let i = 0; i < 20; i++) {
    const live = await request({case_id:'count-change',mode:'live'});
    assert.equal(live.data.report.passed,1,JSON.stringify(live.data.report));
    assert.equal(live.data.report.results[0].source.kind,'fresh_ai');
    assert.equal(live.data.live.remaining,19-i);
  }
  assert.equal(calls,20);
  const exhausted = await request({case_id:'count-change',mode:'live'});
  assert.equal(exhausted.data.report.errors,1); assert.equal(exhausted.data.report.passed,0);
  assert.equal(calls,20);
  assert.equal((await request({case_id:'all',mode:'replay'})).data.report.passed,5);
  const refreshed = await request();
  assert.equal(refreshed.data.live.remaining,0); assert.equal(refreshed.data.history.length,10);
  assert.ok(refreshed.data.history.some(r => r.errors === 1),'Errors stay in the saved history');
});

test('a test saving failure returns its downloadable report without repeating the paid call', async () => {
  const sdk = memoryBlob(), put = sdk.put; let calls = 0;
  sdk.put = async (path,...args) => {
    if (path.includes('/evaluation-runs/')) throw new Error('storage detail');
    return put(path,...args);
  };
  const handle = createHostedFetch({env:{...env,EVENTBRIEF_REQUIRE_ACCESS_CODE:'false'},sdk,
    packageTransport:async ({request}) => {
      calls++;
      return {ok:true,status:200,body:JSON.stringify({status:'completed',model:request.model,
        usage:{input_tokens:100,output_tokens:100},
        output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(evaluationCases[0].original)}]}]})};
    }});
  const response = await handle(new Request(`${origin}/api/package/tests`,{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json','X-EventBrief-Workspace':'demo'},body:JSON.stringify({case_id:'birthday',mode:'live'})}));
  const data = await response.json();
  assert.equal(response.status,503); assert.equal(data.saved,false); assert.equal(data.report.passed,1); assert.equal(calls,1);
  assert.doesNotMatch(data.error,/storage detail/);
});

function setup({ duringTransport, quotePdfRenderer, inspectRequest } = {}) {
  const sdk = memoryBlob(); let calls = 0;
  const config = {...env};
  const packageTransport = async ({ request, key }) => {
    calls++;
    if (inspectRequest) inspectRequest(request);
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

test('public demo opens existing synthetic events and real AI with no code, cookies or budget reset', async () => {
  const system = setup(), earlier = system.visitor();
  await earlier.request('/api/hosted/unlock', {code: env.EVENTBRIEF_ACCESS_CODE});
  await earlier.request('/api/package/messages', {text: demoText});
  const before = await earlier.request('/api/package/analyze', {scenario_id: demoInput.id});
  assert.equal(before.status, 200);
  assert.equal(before.data.remaining, 19);
  // Public is the default. Previously configured credentials are unnecessary.
  delete system.config.EVENTBRIEF_REQUIRE_ACCESS_CODE;
  delete system.config.EVENTBRIEF_ACCESS_CODE;
  delete system.config.EVENTBRIEF_SESSION_SECRET;
  const evaluator = system.visitor();
  const session = await evaluator.request('/api/hosted/session');
  assert.equal(session.status, 200);
  assert.equal(session.data.workspace, 'demo');
  assert.equal(session.data.unlocked, true);
  assert.equal(session.data.access_required, false);
  assert.deepEqual(session.headers.getSetCookie(), []);
  assert.equal((await evaluator.request('/api/hosted/unlock', {code:'anything'})).status, 404);
  assert.equal((await evaluator.request('/api/hosted/lock', {})).status, 404);
  const listing = await evaluator.request('/api/package/scenarios');
  assert.equal(listing.data.events.length, 1);
  assert.equal(listing.data.live.remaining, 19);
  assert.equal(listing.data.live.ready, true);
  assert.equal((await evaluator.request(`/api/package/attempts/${before.data.extraction.run_id}`)).status, 200);
  assert.equal((await evaluator.request('/api/package/demo', {})).status, 200);
  const next = await evaluator.request('/api/package/analyze', {scenario_id: demoInput.id});
  assert.equal(next.status, 200, next.data.error);
  assert.equal(next.data.remaining, 18);
  assert.equal(system.calls(), 2);
  const secondBrowser = system.visitor();
  await secondBrowser.request('/api/hosted/session');
  assert.equal((await secondBrowser.request('/api/package/scenarios')).data.live.remaining, 18);
  assert.equal((await secondBrowser.request('/api/package/settings')).data.editable, true);
  assert.equal((await secondBrowser.request('/api/package/messages', {text:'Host: stale page'}, {headers:{'X-EventBrief-Workspace':'private'}})).status, 409);
  assert.equal((await secondBrowser.request('/api/package/analyze', {scenario_id: demoInput.id}, {headers:{Origin:'https://untrusted.example'}})).status, 403);
  assert.equal(system.calls(), 2);
});

test('anonymous visitors share a hard twenty-call limit; exhausted demos still reopen saved results', async () => {
  const system = setup();
  delete system.config.EVENTBRIEF_REQUIRE_ACCESS_CODE;
  const browsers = [system.visitor(), system.visitor()];
  for (const browser of browsers) await browser.request('/api/hosted/session');
  await browsers[0].request('/api/package/messages', {text:demoText});
  let last;
  for (let index = 0; index < 20; index++) {
    last = await browsers[index % 2].request('/api/package/analyze', {scenario_id: demoInput.id});
    assert.equal(last.status, 200, last.data.error);
    assert.equal(last.data.remaining, 19-index);
  }
  const fresh = system.visitor();
  await fresh.request('/api/hosted/session');
  const blocked = await fresh.request('/api/package/analyze', {scenario_id: demoInput.id});
  assert.equal(blocked.status, 429);
  assert.equal(blocked.data.remaining, 0);
  assert.equal(system.calls(), 20);
  const saved = await fresh.request('/api/package/review/load', {scenario_id:demoInput.id,run_id:last.data.extraction.run_id});
  assert.equal(saved.status, 200);
  const reopened = await fresh.request('/api/package/prepare', {scenario_id:demoInput.id,run_id:last.data.extraction.run_id,corrections:{}});
  assert.equal(reopened.status, 200);
  assert.equal(reopened.data.documents.length, 5);
  assert.equal(system.calls(), 20);
});

test('private settings are shared, isolate the public sample, preserve receipts and budget, and invalidate only affected reviews', async () => {
  const requests=[];
  const system=setup({inspectRequest:request=>requests.push(request),quotePdfRenderer:async()=>Buffer.from('%PDF-fake')}), owner=system.visitor(), other=system.visitor(), visitor=system.visitor();
  for(const browser of [owner,other]) await browser.request('/api/hosted/unlock',{code:env.EVENTBRIEF_ACCESS_CODE});
  const initial=(await owner.request('/api/package/settings')).data;
  assert.equal(initial.revision,0); assert.equal(initial.editable,true);
  const settings=rehearsalExample(initial.settings);
  assert.equal((await visitor.request('/api/package/settings',{settings,revision:0,reason:'Public write'})).status,403);
  assert.equal((await owner.request('/api/package/settings',{settings,revision:0,reason:'Cross-site write'},{headers:{Origin:'https://bad.example'}})).status,403);
  await owner.request('/api/package/messages',{text:demoText});
  const reply=await owner.request('/api/package/reply',{scenario_id:demoInput.id,text:demoReply,role:'host'});
  const before=(await owner.request('/api/package/analyze',{scenario_id:reply.data.input.id})).data;
  const identity={scenario_id:reply.data.input.id,run_id:before.extraction.run_id};
  const marks=Object.fromEntries(before.documents.map(doc=>[doc.id,{decision:'reviewed',revision:doc.revision,reviewed_at:new Date().toISOString()}]));
  assert.equal((await owner.request('/api/package/review',{...identity,corrections:{},reviews:marks,sequence:0})).status,200);
  const receiptBefore=(await owner.request(`/api/package/attempts/${identity.run_id}`)).data;
  const allowanceBefore=(await owner.request('/api/package/scenarios')).data.live;
  const saved=await owner.request('/api/package/settings',{settings,revision:0,reason:'Fictional rehearsal setup'});
  assert.equal(saved.status,200,saved.data.error); assert.equal(saved.data.revision,1);
  assert.deepEqual((await other.request('/api/package/settings')).data.settings,settings);
  assert.equal((await other.request('/api/package/settings',{settings:initial.settings,revision:0,reason:'Stale tab'})).status,409);
  const publicSettings=(await visitor.request('/api/package/settings')).data;
  assert.equal(publicSettings.revision,0); assert.equal(publicSettings.editable,false);
  assert.deepEqual(publicSettings.settings,initial.settings);
  const unchanged=await other.request('/api/package/review/load',identity);
  assert.equal(unchanged.status,200,unchanged.data.error);
  assert.deepEqual(unchanged.data.saved.reviews,marks);
  assert.equal(unchanged.data.data.restaurant_settings.revision,1);
  const changedSettings=structuredClone(settings); changedSettings.menus['Menu 2'].prices_cents.guest_13_plus_count+=100;
  assert.equal((await other.request('/api/package/settings',{settings:changedSettings,revision:1,reason:'Fictional price change'})).status,200);
  const changed=await owner.request('/api/package/review/load',identity);
  assert.equal(changed.status,200,changed.data.error);
  assert.deepEqual(Object.keys(changed.data.saved.reviews),['calendar','kitchen','guest']);
  assert.deepEqual(changed.data.data.original_record,before.original_record);
  assert.equal((await owner.request('/api/package/quote/pdf',{...identity,sequence:1,revision:before.documents.find(d=>d.id==='quote').revision})).status,409);
  assert.equal((await owner.request('/api/package/review',{...identity,sequence:1,corrections:{},reviews:marks})).status,400);
  const valid=await owner.request('/api/package/quote/pdf',{...identity,sequence:1,revision:changed.data.data.documents.find(d=>d.id==='quote').revision});
  assert.equal(valid.status,200);
  assert.deepEqual((await owner.request(`/api/package/attempts/${identity.run_id}`)).data,receiptBefore);
  assert.deepEqual((await owner.request('/api/package/scenarios')).data.live,allowanceBefore);
  assert.equal(system.calls(),1); // The only request was the fake provider before changing settings.
  // Changing operational settings must not change the frozen request envelope
  // or refill the global ledger. A later fake request uses the same vocabulary.
  const next=await other.request('/api/package/analyze',{scenario_id:reply.data.input.id});
  assert.equal(next.status,200,next.data.error);
  assert.deepEqual(requests[1],requests[0]);
  assert.equal(next.data.remaining,allowanceBefore.remaining-1);
});

test('confirmed correction unblocks, saves an auditable lesson, feeds the next request and can be disabled',async()=>{
  const requests=[];
  const system=setup({inspectRequest:request=>requests.push(request)}),owner=system.visitor(),other=system.visitor(),publicVisitor=system.visitor();
  for(const client of [owner,other])await client.request('/api/hosted/unlock',{code:env.EVENTBRIEF_ACCESS_CODE});
  await owner.request('/api/package/messages',{text:demoText});
  const before=(await owner.request('/api/package/prepare',{scenario_id:demoInput.id,corrections:{}})).data;
  assert.equal(readyIds(before).length,2);
  const identity={scenario_id:demoInput.id,run_id:null};
  const lesson='A promise to check allergies is unresolved until the host or coordinator supplies the answer.';
  const changed=await owner.request('/api/package/edit',{...identity,sequence:0,changes:{dietary:'No allergies or dietary restrictions'},reason:'Coordinator called the host and confirmed.',resolve:true,accept_custom:false,lesson});
  assert.equal(changed.status,200,changed.data.error);
  assert.equal(readyIds(changed.data.data).length,5);
  assert.deepEqual(changed.data.data.original_record,before.original_record);
  assert.equal(changed.data.saved.feedback[0].changes[0].before.value,null);
  assert.equal(changed.data.saved.feedback[0].changes[0].after.value,'No allergies or dietary restrictions');
  const loaded=(await other.request('/api/package/review/load',identity)).data;
  assert.deepEqual(loaded.saved.feedback,changed.data.saved.feedback);
  await other.request('/api/package/review',{...identity,sequence:1,corrections:loaded.saved.corrections,reviews:marksFor(loaded.data)});
  assert.equal((await owner.request('/api/package/review/load',identity)).data.saved.feedback.length,1);
  assert.equal(system.calls(),0);
  const publicSample=await publicVisitor.request('/api/package/demo',{});
  assert.equal((await publicVisitor.request('/api/package/review/load',identity)).data.saved,null);
  // A lesson from the public sample must not enter private requests.
  await publicVisitor.request('/api/package/edit',{scenario_id:publicSample.data.input.id,run_id:null,sequence:0,changes:{dietary:'No allergies or dietary restrictions'},reason:'Public sample only.',resolve:true,lesson:'Public-only lesson.'});
  const learned=await owner.request('/api/package/analyze',{scenario_id:demoInput.id});
  assert.equal(learned.status,200,learned.data.error);
  const context=JSON.parse(requests[0].input[0].content);
  assert.deepEqual(context.coordinator_lessons.examples,[{fields:['dietary'],lesson}]);
  assert.deepEqual(context.messages,demoInput.messages);
  assert.equal(JSON.stringify(context).includes('Coordinator called the host'),false);
  assert.equal((await owner.request('/api/package/scenarios')).data.live.remaining,19);
  const toggled=await other.request('/api/package/feedback',{...identity,sequence:2,feedback_id:'change-1',enabled:false});
  assert.equal(toggled.status,200,toggled.data.error);
  assert.equal(toggled.data.saved.feedback[0].lesson_enabled,false);
  assert.equal(Object.keys(toggled.data.saved.reviews).length,5);
  assert.equal((await owner.request('/api/package/feedback',{...identity,sequence:2,feedback_id:'change-1',enabled:true})).status,409);
  await owner.request('/api/package/analyze',{scenario_id:demoInput.id});
  assert.equal(JSON.parse(requests[1].input[0].content).coordinator_lessons,undefined);
});
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
