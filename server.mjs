import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { referenceOutput, validateOutput } from './lib/contract.mjs';
import { analyze } from './lib/provider.mjs';
import { packageFixtures } from './lib/package-fixtures.mjs';
import { prepareEventPackage, fingerprint } from './lib/event-package.mjs';
import { buildPackageRequest, capturePackageAttempt, responsesTransport } from './lib/package-provider.mjs';
import { createAttemptStore } from './lib/attempt-store.mjs';
import { createPackageAllowance, PackageAllowanceError } from './lib/package-allowance.mjs';
import { createPackageUpdateStore, updatedBundle } from './lib/package-updates.mjs';
import { combinePackageAllowances } from './lib/package-app-allowances.mjs';
import { createPackageWorkspace, pastedPrompt, SourceConflictError } from './lib/package-workspace.mjs';
import { createFlexiblePackageAllowance } from './lib/package-flexible-allowance.mjs';
import { createExtensionPackageAllowance } from './lib/package-extension-allowance.mjs';
import { demoText, demoReply, demoRecord } from './lib/package-demo.mjs';
import { packageSummary } from './lib/package-summary.mjs';
import { eventEditCorrections } from './lib/package-edits.mjs';

const root = new URL('./', import.meta.url);
const fixtures = new Map();
for (const file of (await readdir(new URL('fixtures/inputs/', root))).filter(f => f.endsWith('.json')).sort()) {
  const input = JSON.parse(await readFile(new URL(`fixtures/inputs/${file}`, root), 'utf8'));
  const expected = JSON.parse(await readFile(new URL(`fixtures/expected/${file}`, root), 'utf8'));
  const output = validateOutput(referenceOutput(expected), input);
  fixtures.set(input.id, { input, output });
}
const prompt = await readFile(new URL('prompts/extract-v0.txt', root), 'utf8');
const packagePrompt = await readFile(new URL('prompts/extract-package-v3.txt', root), 'utf8');
const assets = new Map([['/', ['public/index.html', 'text/html; charset=utf-8']], ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']], ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']]]);
assets.set('/package', ['public/package.html', 'text/html; charset=utf-8']);
assets.set('/package.js', ['public/package.js', 'text/javascript; charset=utf-8']);
assets.set('/package.css', ['public/package.css', 'text/css; charset=utf-8']);
assets.set('/package-render.mjs', ['public/package-render.mjs', 'text/javascript; charset=utf-8']);
assets.set('/package-export.mjs', ['public/package-export.mjs', 'text/javascript; charset=utf-8']);
for (const name of ['workspace-board', 'workspace-calendar']) {
  assets.set(`/${name}.mjs`, [`public/${name}.mjs`, 'text/javascript; charset=utf-8']);
  assets.set(`/${name}.css`, [`public/${name}.css`, 'text/css; charset=utf-8']);
}
assets.set('/lib/reused-yannis/templates/kitchen.mjs', ['lib/reused-yannis/templates/kitchen.mjs', 'text/javascript; charset=utf-8']);
assets.set('/lib/reused-yannis/templates/event.mjs', ['lib/reused-yannis/templates/event.mjs', 'text/javascript; charset=utf-8']);
assets.set('/package-contract.mjs', ['lib/package-contract.mjs', 'text/javascript; charset=utf-8']);

export function createHandler({ key = '', enabled = false, model = 'gpt-6.1-sol', maxCalls = 3, provider = analyze,
  packageTransport = responsesTransport, packageStore = createAttemptStore(fileURLToPath(new URL('out/model-attempts/package-v1/', root))),
  packageRunMode = 'live', packageAllowance = null, packageMaxOutputTokens = 10000, packageUpdates = null, packageWorkspace = null,
  hostedOrigin = null, hosted = null } = {}) {
  if (!['live', 'simulated'].includes(packageRunMode)) throw new Error('Invalid package provider mode.');
  if (packageAllowance && packageStore !== packageAllowance.store) throw new Error('The spending allowance must use its own attempt store.');
  let calls = 0;
  let busy = false;
  const configured = enabled && Boolean(key) && Number.isInteger(maxCalls) && maxCalls > 0;
  const bundles = new Map(packageFixtures);
  if (packageUpdates) bundles.set(packageUpdates.bundle.input.id, packageUpdates.bundle);
  const updateState = async () => ({ ...(packageUpdates ? await packageUpdates.status() : {}), ...(packageWorkspace ? await packageWorkspace.status() : {}) });
  const isSuperseded = (id, state) => Boolean(id.startsWith('pasted-') ? state?.source_versions?.[id]?.superseded : state?.active_scenario_id && state.active_scenario_id !== id);
  const available = (id, state) => id.startsWith('pasted-') || packageFixtures.has(id) || state?.active_scenario_id === id;
  const getBundle = async id => {
    const bundle = bundles.get(id) ?? (packageWorkspace ? await packageWorkspace.get(id) : null);
    const authored = bundle && demoRecord(bundle.input);
    return authored ? { ...bundle, original: authored } : bundle;
  };
  const sourceVersion = (id, state) => {
    const version = state?.source_versions?.[id];
    return version ? { ...version, label: version.superseded ? 'Earlier version · superseded' : `Latest messages · version ${version.revision}` }
      : { event_id: 'birthday-dinner', current_scenario_id: state?.active_scenario_id ?? id, revision: id === state?.active_scenario_id ? 2 : 1,
        superseded: isSuperseded(id, state), can_add_reply: false, label: isSuperseded(id, state) ? 'Earlier version · superseded' : state?.active_scenario_id ? 'Latest messages' : 'Original messages' };
  };
  const withVersion = (data, state) => ({ ...data, version: { ...sourceVersion(data.scenario_id, state), pending_update: false } });
  const packageLive = async scenarioId => {
    const allowance = packageAllowance ? await packageAllowance.status(scenarioId) : {};
    return { ready: configured, model, mode: packageRunMode, ...allowance,
      remaining: Math.max(0, Math.min(maxCalls - calls, allowance.remaining ?? maxCalls)) };
  };
  const packageListing = async () => {
    const state = await updateState();
    const history = [...new Map([...(packageWorkspace ? await packageWorkspace.history() : []), ...(packageAllowance?.history ? await packageAllowance.history() : [])].map(entry=>[entry.run_id,entry])).values()].sort((a,b)=>(b.saved_at??'').localeCompare(a.saved_at??''));
    const pasted = packageWorkspace ? await packageWorkspace.list() : [];
    const sourceVersions = Object.fromEntries(Object.entries(state.source_versions ?? {}).map(([id, version]) => {
      const input = pasted.find(bundle => bundle.input.id === id)?.input;
      const offline = input ? Boolean(demoRecord(input)) : false;
      return [id, { ...version, reference_available: offline, pending_update: !offline && !history.some(entry => entry.scenario_id === id && entry.status === 'succeeded') }];
    }));
    const eventSummaries = await Promise.all((state.events ?? []).map(async event => {
      const current = pasted.find(bundle => bundle.input.id === event.current_scenario_id);
      const entry = history.find(item => item.status === 'succeeded' && item.scenario_id === event.current_scenario_id)
        ?? history.find(item => item.status === 'succeeded' && event.scenario_ids.includes(item.scenario_id));
      const authored = current && demoRecord(current.input);
      let original = authored, summary = null;
      if (entry) {
        const receipt = await packageStore.read(entry.run_id), source = pasted.find(bundle => bundle.input.id === entry.scenario_id);
        if (receipt.status !== 'succeeded' || receipt.scenario_id !== entry.scenario_id || !source || receipt.input_hash !== fingerprint(source.input)) throw new Error('The saved result does not match its source messages.');
        original = receipt.parsed_output;
        if (entry.scenario_id === event.current_scenario_id) {
          const saved = await packageWorkspace.loadReview(entry.scenario_id,entry.run_id);
          const prepared = prepareEventPackage({...current,original,corrections:saved?.corrections??{},extraction:{run_id:entry.run_id,mode:receipt.mode}});
          summary = packageSummary(prepared, saved?.reviews);
        }
      }
      if (!summary && authored) {
        const saved = await packageWorkspace.loadReview(current.input.id,null), prepared = prepareEventPackage({...current,original:authored,corrections:saved?.corrections??{}});
        summary = packageSummary(prepared, saved?.reviews);
      }
      const host = summary?.host_name ?? original?.fields.host_name?.value;
      return { ...event, title: host ? `${host} · ${summary?.event_date??'Date needed'}` : event.title,
        pending_update: sourceVersions[event.current_scenario_id]?.pending_update ?? true,
        summary };
    }));
    return { mode: 'authored_reference', ...(hosted ? {hosted} : {}), workspace: Boolean(packageWorkspace), scenarios: [...bundles.values(), ...pasted].filter(({input}) => available(input.id,state)).map(({input}) => input),
      live: await packageLive(state?.active_scenario_id), updates: state,
      events: eventSummaries, source_versions: sourceVersions,
      demo: { available: Boolean(packageWorkspace), reply: demoReply, label: 'Guided example · authored results · no AI call' },
      history: history.map(entry => ({...entry, event_id: sourceVersion(entry.scenario_id, state).event_id, superseded: isSuperseded(entry.scenario_id, state)})) };
  };
  return async (req, res) => {
    const port = res.socket?.localPort;
    const hosts = hostedOrigin ? [new URL(hostedOrigin).host] : [`127.0.0.1:${port}`, `localhost:${port}`];
    const origins = hostedOrigin ? [hostedOrigin] : hosts.map(host => `http://${host}`);
    const send = (status, data, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
    };
    if (!hosts.includes(req.headers.host)) return send(403, { error: 'This demo accepts localhost requests only.' });
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    const liveReady = configured;
    try {
      if (req.method === 'GET' && assets.has(pathname)) {
        const [file, type] = assets.get(pathname);
        return send(200, await readFile(new URL(file, root)), type);
      }
      if (req.method === 'GET' && pathname === '/api/package/scenarios') {
        return send(200, await packageListing());
      }
      if (req.method === 'POST' && ['/api/package/messages','/api/package/reply','/api/package/demo','/api/package/review','/api/package/review/load','/api/package/edit'].includes(pathname)) {
        if (!origins.includes(req.headers.origin) || req.headers['sec-fetch-site']==='cross-site') return send(403,{error:'Open the app locally first.'});
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'JSON is required.'});
        if (!packageWorkspace) return send(503,{error:'Saved conversations are not available.'});
        const chunks=[];let byteLength=0;for await(const chunk of req){chunks.push(chunk);byteLength+=chunk.length;if(byteLength>65536)return send(413,{error:'These messages or corrections are too long.'});}
        const body=Buffer.concat(chunks).toString('utf8');
        try {
          const data=JSON.parse(body);
          if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid request.');
          if(pathname==='/api/package/demo') {
            if(Object.keys(data).length) throw new Error('This example needs no extra settings.');
            const saved=await packageWorkspace.save(demoText), state=await updateState();
            const current=await getBundle(state.source_versions[saved.input.id].current_scenario_id);
            return send(200,{input:current.input,version:sourceVersion(current.input.id,state),example_reply:demoReply,reference_available:Boolean(current.original)});
          }
          if(pathname==='/api/package/messages') {
            if(Object.keys(data).join()!=='text')throw new Error('Send only the event messages.');
            const saved=await packageWorkspace.save(data.text);
            return send(200,{input:saved.input,version:sourceVersion(saved.input.id,await updateState())});
          }
          if(pathname==='/api/package/reply') {
            if(!['scenario_id|text','role|scenario_id|text'].includes(Object.keys(data).sort().join('|')) || typeof data.scenario_id!=='string') throw new Error('Choose an event and paste only its new reply.');
            if(busy) return send(409,{error:'Wait for the current preparation to finish before adding a reply.'});
            busy=true;
            try {
              const saved=await packageWorkspace.appendReply(data.scenario_id,data.text,data.role??'host');
              const state=await updateState(),referenceAvailable=Boolean(demoRecord(saved.input));
              return send(200,{input:saved.input,version:{...sourceVersion(saved.input.id,state),pending_update:!referenceAvailable},reference_available:referenceAvailable});
            } finally {busy=false;}
          }
          const loading=pathname.endsWith('/load');
          const editing=pathname==='/api/package/edit';
          const keys=loading?'run_id|scenario_id':editing?'changes|reason|run_id|scenario_id|sequence':'corrections|reviews|run_id|scenario_id|sequence';
          if(Object.keys(data).sort().join('|')!==keys || typeof data.scenario_id!=='string' || (data.run_id!==null && typeof data.run_id!=='string'))throw new Error('Invalid saved review request.');
          const bundle=await getBundle(data.scenario_id);if(!bundle)throw new Error('Saved conversation not found.');
          const state=await updateState();if(!available(data.scenario_id,state))throw new Error('Choose available messages.');
          const saved=loading||editing?await packageWorkspace.loadReview(data.scenario_id,data.run_id):null;
          if(loading&&!saved)return send(200,{saved:null});
          let original=bundle.original,extraction=null;
          if(data.run_id) {
            const receipt=await packageStore.read(data.run_id);
            if(receipt.status!=='succeeded'||receipt.scenario_id!==data.scenario_id||receipt.input_hash!==fingerprint(bundle.input)||receipt.profile_hash!==fingerprint(bundle.profile))throw new Error('The saved result does not match these messages and restaurant rules.');
            original=receipt.parsed_output;extraction={run_id:receipt.run_id,mode:receipt.mode,meta:receipt.meta,receipt_saved:true};
          }
          if(!original)throw new Error('Prepare these messages with AI first.');
          if(editing) {
            if(isSuperseded(data.scenario_id,state))throw new SourceConflictError('New messages have arrived. Open the latest event before editing.');
            if(!Number.isSafeInteger(data.sequence)||data.sequence!==(saved?.sequence??0))throw new SourceConflictError('This event changed in another browser. Cancel this edit, open the event again, and try your change on the latest details.');
            const before=prepareEventPackage({...bundle,original,extraction,corrections:saved?.corrections??{}});
            const corrections=eventEditCorrections(original,before.corrections,data.changes,data.reason);
            const prepared=prepareEventPackage({...bundle,original,extraction,corrections});
            const finalState=await updateState();
            if(isSuperseded(data.scenario_id,finalState))throw new SourceConflictError('New messages have arrived. Open the latest event before editing.');
            const changed=prepared.documents.filter(doc=>before.documents.find(old=>old.id===doc.id)?.revision!==doc.revision).map(doc=>({id:doc.id,title:doc.title,state:doc.state}));
            const reviews=Object.fromEntries(Object.entries(saved?.reviews??{}).filter(([id,review])=>prepared.documents.some(doc=>doc.id===id&&doc.revision===review.revision&&doc.state==='ready_for_review')));
            const result=await packageWorkspace.saveReview(prepared,reviews,data.sequence);
            return send(200,{saved:result,data:withVersion(prepared,finalState),changed_documents:changed});
          }
          const prepared=prepareEventPackage({...bundle,original,extraction,corrections:loading?saved.corrections:data.corrections});
          const finalState=await updateState();
          if(loading) {
            if(saved.source_revision!==prepared.source_revision||saved.profile_revision!==prepared.profile_revision)throw new Error('The source or restaurant rules changed. A fresh review is needed.');
            const reviews=Object.fromEntries(Object.entries(saved.reviews).filter(([id,review])=>prepared.documents.some(doc=>doc.id===id&&doc.revision===review.revision&&doc.state==='ready_for_review')));
            return send(200,{saved:{...saved,reviews},data:withVersion(prepared,finalState)});
          }
          if(isSuperseded(data.scenario_id,finalState))return send(409,{error:'Review the latest messages instead.'});
          return send(200,{saved:await packageWorkspace.saveReview(prepared,data.reviews,data.sequence)});
        } catch(error){return send(error instanceof SourceConflictError?409:400,{error:error.message});}
      }
      if (req.method === 'GET' && pathname.startsWith('/api/package/attempts/')) {
        try { return send(200, await packageStore.read(pathname.slice('/api/package/attempts/'.length))); }
        catch { return send(404, { error: 'Attempt receipt not found or unreadable.' }); }
      }
      if (req.method === 'POST' && pathname === '/api/package/update') {
        if (!origins.includes(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, {error:'Open the demo locally before adding messages.'});
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, {error:'JSON is required.'});
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body)>2048) return send(413,{error:'Request too large.'}); }
        let data;
        try {data=JSON.parse(body);} catch {return send(400,{error:'Invalid JSON request.'});}
        if (!packageUpdates || !data || Array.isArray(data) || Object.keys(data).join()!=='scenario_id' || data.scenario_id!=='patio-complete') return send(400,{error:'Choose the complete birthday dinner to add its demo update.'});
        if (busy) return send(429,{error:'Wait for the current preparation to finish.'});
        busy = true;
        try {
          if (packageAllowance?.activateUpdate) await packageAllowance.activateUpdate();
          else await packageUpdates.activate();
          return send(200,await packageListing());
        } catch (error) {return send(409,{error:error.message});}
        finally {busy=false;}
      }
      if (req.method === 'POST' && pathname === '/api/package/analyze') {
        if (!origins.includes(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Open the demo locally before requesting analysis.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 2048) return send(413, { error: 'Request too large.' });
        }
        let data;
        try { data = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
        if (!data || Array.isArray(data) || Object.keys(data).join() !== 'scenario_id' || typeof data.scenario_id!=='string') return send(400, { error: 'Choose a saved fictional conversation.' });
        const bundle=await getBundle(data.scenario_id);
        if(!bundle)return send(400,{error:'Choose a saved fictional conversation.'});
        const sourceState = await updateState();
        if (isSuperseded(data.scenario_id, sourceState) || !available(data.scenario_id,sourceState)) return send(409,{error:'New messages need a new preparation. Choose the latest messages.'});
        if (!liveReady) return send(503, { error: 'Live AI is not configured. The authored example remains available.' });
        if (busy || calls >= maxCalls) return send(429, { error: busy ? 'An analysis is already running.' : 'The server-session call limit has been reached.' });
        const allowanceState = await packageLive(data.scenario_id);
        if (allowanceState.paused || allowanceState.in_flight || allowanceState.remaining < 1) return send(429, {
          error: allowanceState.paused ? 'AI is paused while the last request is checked. Saved drafts are still available.' : allowanceState.in_flight ? 'An AI request is already running.' : 'The AI test limit has been reached. You can still review or download your drafts.', ...allowanceState });
        // Recheck after the asynchronous allowance read, before taking the slot.
        if (busy || calls >= maxCalls) return send(429, { error: busy ? 'An AI request is already running.' : 'The AI test limit has been reached.' });
        busy = true;
        calls++;
        try {
          const { input, profile } = bundle;
          const extractionPrompt=input.source_kind==='pasted'?pastedPrompt(packagePrompt):packagePrompt;
          const execute = async () => {
            if (isSuperseded(data.scenario_id, await updateState())) throw new PackageAllowanceError('New messages need a new preparation. Choose the latest messages.');
            return capturePackageAttempt({ input, profile, prompt: extractionPrompt, model, key, store: packageStore,
              transport: packageTransport, mode: packageRunMode, maxOutputTokens: packageMaxOutputTokens });
          };
          let result;
          try {
            result = packageAllowance ? await packageAllowance.run({ request: buildPackageRequest(input, profile, extractionPrompt, model, { maxOutputTokens: packageMaxOutputTokens }), execute }) : await execute();
          } catch (error) {
            calls--;
            if (error instanceof PackageAllowanceError) return send(429, { error: error.message, ...(await packageLive(data.scenario_id)) });
            throw error;
          }
          if (!result.dispatched) calls--;
          const live = await packageLive(data.scenario_id);
          if (!result.ok) return send(result.dispatched ? 502 : 503, { ...result, remaining: live.remaining, paused: live.paused, in_flight: live.in_flight });
          const extraction = { run_id: result.run_id, meta: result.meta, mode: result.mode, receipt_saved: result.receipt_saved };
          if(packageWorkspace) await packageWorkspace.rememberResult(input,extraction);
          return send(200, { ...withVersion(prepareEventPackage({ input, profile, original: result.output, extraction }), await updateState()), remaining: live.remaining, paused: live.paused });
        } finally { busy = false; }
      }
      if (req.method === 'POST' && pathname === '/api/package/prepare') {
        if (!origins.includes(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
          return send(403, { error: 'Open the package demo locally before preparing it.' });
        }
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 65536) return send(413, { error: 'Package corrections are too large.' });
        }
        try {
          const data = JSON.parse(body);
          if (!data || Array.isArray(data) || !['corrections|scenario_id', 'corrections|run_id|scenario_id'].includes(Object.keys(data).sort().join('|')) || typeof data.scenario_id!=='string') {
            return send(400, { error: 'Choose a bundled event and send only coordinator corrections.' });
          }
          const fixture = await getBundle(data.scenario_id);
          if(!fixture)return send(400,{error:'Choose a saved conversation.'});
          const sourceState = await updateState();
          if (!available(data.scenario_id,sourceState)) return send(409,{error:'Add the demo update before preparing its messages.'});
          if (isSuperseded(data.scenario_id,sourceState) && (!data.corrections || typeof data.corrections!=='object' || Object.keys(data.corrections).length)) return send(409,{error:'This is an earlier version. Correct the latest messages instead.'});
          if (Object.hasOwn(data, 'run_id')) {
            const receipt = await packageStore.read(data.run_id);
            if (receipt.status !== 'succeeded' || !['live', 'simulated'].includes(receipt.mode) || receipt.scenario_id !== data.scenario_id || receipt.input_hash !== fingerprint(fixture.input) || receipt.profile_hash !== fingerprint(fixture.profile)) return send(409, { error: 'This attempt cannot be used with the current source and restaurant rules.' });
            const finalSourceState = await updateState();
            if (isSuperseded(data.scenario_id,finalSourceState) && Object.keys(data.corrections ?? {}).length) return send(409,{error:'New messages arrived while opening this result. Correct the latest version instead.'});
            return send(200, withVersion(prepareEventPackage({ input: fixture.input, profile: fixture.profile, original: receipt.parsed_output, corrections: data.corrections,
              extraction: { run_id: receipt.run_id, mode: receipt.mode, meta: receipt.meta, receipt_saved: true } }),finalSourceState));
          }
          if(!fixture.original)return send(400,{error:'Pasted messages need an AI result. Click Prepare five drafts first.'});
          return send(200, withVersion(prepareEventPackage({ ...fixture, corrections: data.corrections }),sourceState));
        } catch (error) {
          return send(400, { error: error.message });
        }
      }
      if (req.method === 'GET' && pathname === '/api/scenarios') return send(200, { scenarios: [...fixtures.values()].map(({ input }) => input), live: { ready: liveReady && !packageAllowance, model, remaining: packageAllowance ? 0 : Math.max(0, maxCalls - calls) } });
      if (req.method === 'GET' && pathname.startsWith('/api/reference/')) {
        const fixture = fixtures.get(pathname.slice('/api/reference/'.length));
        if (!fixture) return send(404, { error: 'Scenario not found.' });
        const hash = createHash('sha256').update(JSON.stringify(fixture)).digest('hex').slice(0, 16);
        return send(200, { run_id: `reference-${hash}`, mode: 'reference', output: fixture.output, meta: { label: 'Authored reference example. No AI call.' } });
      }
      if (req.method === 'POST' && pathname === '/api/analyze') {
        const validOrigins = origins;
        if (!validOrigins.includes(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Open the demo locally before requesting analysis.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 2048) return send(413, { error: 'Request too large.' });
        }
        let data;
        try { data = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
        if (!data || Array.isArray(data) || Object.keys(data).join() !== 'scenario_id' || !fixtures.has(data.scenario_id)) return send(400, { error: 'Choose one of the synthetic scenarios.' });
        if (!liveReady || packageAllowance) return send(503, { error: 'AI is available in the event-package workspace. These examples remain free to review.' });
        if (busy || calls >= maxCalls) return send(429, { error: busy ? 'An analysis is already running. Wait for it to finish.' : 'The server-session call limit has been reached.' });
        busy = true;
        calls++; // Count before dispatch, including failed or uncertain attempts.
        try {
          const result = await provider({ input: fixtures.get(data.scenario_id).input, prompt, model, key });
          validateOutput(result.output, fixtures.get(data.scenario_id).input);
          return send(200, { run_id: randomUUID(), mode: 'live', ...result, remaining: maxCalls - calls });
        } catch (error) {
          return send(502, { error: error.message, remaining: maxCalls - calls });
        } finally { busy = false; }
      }
      return send(404, { error: 'Not found.' });
    } catch {
      return send(500, { error: 'The demo could not complete this request.' });
    }
  };
}

export function createApp(options) { return createServer(createHandler(options)); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Only this project's explicitly named file; never search the parent workspace.
  try { process.loadEnvFile(fileURLToPath(new URL('.env.local', root))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const port = Number(process.env.PORT ?? 3135);
  const key = process.env.EVENTBRIEF_OPENAI_API_KEY ?? '';
  const enabled = process.env.EVENTBRIEF_LIVE_ENABLED === 'true';
  const model = process.env.EVENTBRIEF_MODEL || 'gpt-6.1-sol';
  const maxCalls = Number(process.env.EVENTBRIEF_MAX_LIVE_CALLS ?? 8);
  const maxOutputTokens = 7500;
  const allowance = enabled && key ? await createPackageAllowance({ directory: fileURLToPath(new URL('out/app-live/package-app-v1/', root)),
    requests: [...packageFixtures.values()].map(({input,profile}) => buildPackageRequest(input,profile,packagePrompt,model,{maxOutputTokens})),
    budgetCents: Number(process.env.EVENTBRIEF_APP_BUDGET_CENTS ?? 100), maxAttempts: maxCalls }) : null;
  const packageUpdates = await createPackageUpdateStore({directory:fileURLToPath(new URL('out/package-history/birthday-dinner/',root))});
  const previousAllowance = allowance ? combinePackageAllowances({primary:allowance,updateDirectory:fileURLToPath(new URL('out/app-live/package-updates-v1/',root)),
    updateRequest:buildPackageRequest(updatedBundle.input,updatedBundle.profile,packagePrompt,model,{maxOutputTokens}),
    updateScenarioId:updatedBundle.input.id,updateStore:packageUpdates}) : null;
  const packageWorkspace=await createPackageWorkspace(fileURLToPath(new URL('out/package-workspace/',root)),updatedBundle.profile);
  let appAllowance=previousAllowance ? await createFlexiblePackageAllowance({previous:previousAllowance,directory:fileURLToPath(new URL('out/app-live/package-pasted-v1/',root)),template:buildPackageRequest(updatedBundle.input,updatedBundle.profile,packagePrompt,model,{maxOutputTokens}),extraTemplates:[buildPackageRequest(updatedBundle.input,updatedBundle.profile,pastedPrompt(packagePrompt),model,{maxOutputTokens})]}) : null;
  const extensionCents = Number(process.env.EVENTBRIEF_EXTENSION_BUDGET_CENTS ?? 0);
  const extensionCalls = Number(process.env.EVENTBRIEF_EXTENSION_MAX_CALLS ?? 30);
  if (appAllowance && extensionCents > 0) appAllowance = await createExtensionPackageAllowance({ previous: appAllowance,
    directory: fileURLToPath(new URL('out/app-live/package-additional-v1/',root)), lockDirectory: previousAllowance.directory,
    budgetCents: extensionCents, maxAttempts: extensionCalls,
    templates: [packagePrompt,pastedPrompt(packagePrompt)].map(text=>buildPackageRequest(updatedBundle.input,updatedBundle.profile,text,model,{maxOutputTokens})) });
  const app = createApp({ key, enabled, model, maxCalls: maxCalls + (extensionCents > 0 ? extensionCalls : 0), packageAllowance: appAllowance, packageMaxOutputTokens: maxOutputTokens,packageUpdates,packageWorkspace,
    ...(appAllowance ? { packageStore: appAllowance.store } : {}) });
  app.listen(port, '127.0.0.1', () => console.log(`EventBrief: http://127.0.0.1:${port}`));
}
