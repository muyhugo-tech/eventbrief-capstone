import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../server.mjs';
import { prepareEventPackage, fingerprint } from '../lib/event-package.mjs';
import { normalizePackageRecord, AS_EXTRACTED } from '../lib/package-normalization.mjs';
import { applyPackageCorrections } from '../lib/package-contract.mjs';
import { eventEditCorrections } from '../lib/package-edits.mjs';
import { pastedInput, createPackageWorkspace } from '../lib/package-workspace.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { renderDocument, standaloneDocument } from '../public/package-render.mjs';
import { renderInboxDetail } from '../public/workspace-inbox.mjs';
import { FIELD_DEFINITIONS } from '../lib/package-contract.mjs';

const json = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const protocol = await json('../evaluation/lesson-comparison-v1/protocol.json');
const saved = await json('../evaluation/lesson-comparison-v1/results/2026-10-12.json');
const profile = packageFixtures.get('patio-complete').profile;
const input = pastedInput(protocol.conversation);
const bundle = {input, profile, original: saved.attempts[0].original_output};
const doc = (data, id) => data.documents.find(item => item.id === id);

test('both saved AI answers replay to five drafts and $1300 without changing their originals', () => {
  for (const attempt of saved.attempts) {
    const bytes = JSON.stringify(attempt.original_output);
    const data = prepareEventPackage({...bundle, original: attempt.original_output});
    assert.ok(data.documents.every(item => item.state === 'ready_for_review'));
    assert.equal(doc(data, 'quote').quote.total_cents, 130000);
    assert.equal(data.record.fields.guest_count.value, 19);
    assert.equal(data.record.fields.setup.value, 'One long table');
    assert.equal(data.record.fields.beverage.value, 'Beer and wine service');
    assert.match(data.record.fields.beverage.notes, /juice and soda/);
    assert.match(data.record.fields.beverage.notes, /21 or older/);
    assert.equal(JSON.stringify(data.original_record), bytes);
    assert.equal(JSON.stringify(attempt.original_output), bytes);
    const old = prepareEventPackage({...bundle, original: attempt.original_output, normalizationPolicy: AS_EXTRACTED});
    assert.equal(old.documents.filter(item => item.state === 'ready_for_review').length, 1);
    assert.equal(doc(old, 'quote').quote, null);
  }
});

test('calculated totals preserve certainty, evidence and explicit corrections', () => {
  const original = structuredClone(bundle.original);
  original.fields.child_count.status = 'stated';
  const data = prepareEventPackage({...bundle, original});
  assert.equal(data.record.fields.guest_count.status, 'stated');
  assert.equal(data.record.fields.guest_count.preparation.kind, 'calculated_total');
  assert.ok(data.record.fields.guest_count.evidence.length);
  for (const changes of [
    record => {record.fields.child_count = {value:null,status:'unknown',evidence:[]};},
    record => {record.fields.child_count.status = 'requested';},
    record => {record.open_questions.push({field:'child_count',question:'Any other children?',evidence:record.fields.child_count.evidence});},
    record => {record.pending_changes.push({field:'guest_13_plus_count',value:20,evidence:record.fields.guest_13_plus_count.evidence});},
    record => {record.fields.guest_count = {value:null,status:'conflicting',evidence:record.fields.child_count.evidence};}
  ]) {
    const record = structuredClone(bundle.original); changes(record);
    assert.equal(normalizePackageRecord(record, profile).fields.guest_count.value, null);
  }
  const corrections = {guest_count:{value:null,status:'unknown',reason:'Still checking the final total.'}};
  assert.equal(prepareEventPackage({...bundle,corrections}).record.fields.guest_count.value, null);
  const inconsistent = structuredClone(bundle.original);
  inconsistent.fields.guest_count = {...inconsistent.fields.child_count,value:20};
  assert.ok(prepareEventPackage({...bundle,original:inconsistent}).issues.some(issue=>issue.rule==='categories'));
  const large = structuredClone(bundle.original); large.fields.guest_13_plus_count.value = 50;
  assert.ok(prepareEventPackage({...bundle,original:large}).issues.some(issue=>issue.rule.endsWith('.capacity')));
});

test('matching tolerates only equivalent labels and included beverage clauses', () => {
  for (const text of [' beer AND wine SERVICE ; soft drinks for children. No spirits or cocktails.', 'Beer and wine service, with non-alcoholic drinks for the children']) {
    const record = structuredClone(bundle.original); record.fields.beverage.value = text;
    assert.equal(normalizePackageRecord(record,profile).fields.beverage.value, 'Beer and wine service');
  }
  for (const text of ['Beer and wine service with premium champagne', 'Beer and wine service; unlimited drinks', 'Beer and wine service, free drinks for children', 'Beer and wine service; no spirits or cocktails except tequila', 'Beer and wine service; beer and wine only for guests confirmed to be 18 or older', 'Beer and wine service; nonalcoholic service instead', 'Not beer and wine service', 'Beer and wine service; <script>bad</script>']) {
    const record = structuredClone(bundle.original); record.fields.beverage.value = text;
    assert.equal(normalizePackageRecord(record,profile).fields.beverage.value, text);
    assert.equal(doc(prepareEventPackage({...bundle,original:record}), 'quote').state, 'blocked');
  }
  for (const text of ['ONE   LONG TABLE', ' one long table ']) {
    const record = structuredClone(bundle.original); record.fields.setup.value = text;
    assert.equal(normalizePackageRecord(record,profile).fields.setup.value, 'One long table');
  }
  const record = structuredClone(bundle.original); record.fields.setup.value = 'One long table with extra seating';
  assert.equal(normalizePackageRecord(record,profile).fields.setup.value, record.fields.setup.value);
});

test('drink notes appear in relevant previews and downloads, with original facts traceable in Inbox', () => {
  const data = prepareEventPackage(bundle);
  for (const id of ['quote','staff','guest']) {
    assert.match(renderDocument(doc(data,id),data), /juice and soda/);
    assert.match(standaloneDocument(doc(data,id),data), /21 or older/);
  }
  for (const id of ['quote','guest']) assert.doesNotMatch(standaloneDocument(doc(data,id),data), /Jordan will lead setup/);
  const inbox = renderInboxDetail({id:input.id,input}, {data,definitions:FIELD_DEFINITIONS});
  assert.match(inbox,/Calculated from guest counts/);
  assert.match(inbox,/The total was not supplied by the AI/);
  assert.match(inbox,/Drink notes:/);
  const altered = structuredClone(data);
  doc(altered,'guest').beverage_notes = '<script>unsafe</script>';
  assert.doesNotMatch(renderDocument(doc(altered,'guest'),altered), /<script>unsafe/);
  assert.match(renderDocument(doc(altered,'guest'),altered), /&lt;script&gt;/);
});

test('coordinator can edit notes independently, preserve them on other edits and trigger fresh review', () => {
  const before = prepareEventPackage(bundle);
  const changes = {beverage:'Beer and wine service', beverage_notes:'Soft drinks for children. No spirits or cocktails.'};
  const corrections = eventEditCorrections(bundle.original,{},changes,'Confirmed included drinks.',{resolve:true,currentRecord:before.record});
  const after = prepareEventPackage({...bundle,corrections});
  assert.equal(doc(after,'quote').quote.total_cents,130000);
  for (const id of ['quote','staff','guest']) assert.notEqual(doc(before,id).revision,doc(after,id).revision);
  for (const id of ['calendar','kitchen']) assert.equal(doc(before,id).revision,doc(after,id).revision);
  const edit = eventEditCorrections(bundle.original,corrections,{guest_notes:'Meet at the patio.'},'Updated arrival.');
  assert.equal(prepareEventPackage({...bundle,corrections:edit}).record.fields.beverage.notes,changes.beverage_notes);
  const unsupported = {...corrections,beverage:{...corrections.beverage,notes:'Unlimited premium cocktails'}};
  assert.equal(doc(prepareEventPackage({...bundle,corrections:unsupported}),'quote').state,'blocked');
  assert.throws(()=>applyPackageCorrections(bundle.original,{menu:{value:'Menu 2',status:'agreed',reason:'Test',notes:'not drinks'}}));
  assert.throws(()=>eventEditCorrections(bundle.original,{}, {beverage_notes:'notes'},'Test'));
  const clear = eventEditCorrections(bundle.original,corrections,{beverage:'Beer and wine service',beverage_notes:''},'Removed after checking.',{resolve:true,currentRecord:after.record});
  assert.equal(prepareEventPackage({...bundle,corrections:clear}).record.fields.beverage.notes,'');
});

test('already canonical records retain every review revision', () => {
  const fixture = packageFixtures.get('patio-complete');
  const old = prepareEventPackage({...fixture,normalizationPolicy:AS_EXTRACTED});
  const current = prepareEventPackage(fixture);
  assert.deepEqual(current.record,old.record);
  assert.deepEqual(current.documents.map(d=>d.revision),old.documents.map(d=>d.revision));
});

test('saved beverage edits reload, keep unaffected reviews and export current notes without a provider', async t => {
  const directory = await mkdtemp(join(tmpdir(),'eventbrief-drink-notes-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const workspace = await createPackageWorkspace(directory,profile);
  await workspace.save(protocol.conversation);
  const run_id = '11111111-1111-4111-8111-111111111111';
  const extraction = {run_id,mode:'simulated'};
  const receipt = {status:'succeeded',scenario_id:input.id,input_hash:fingerprint(input),profile_hash:fingerprint(profile),parsed_output:bundle.original,...extraction};
  await workspace.rememberResult(input,extraction);
  const before = prepareEventPackage({...bundle,extraction});
  await workspace.saveReview(before,Object.fromEntries(before.documents.map(doc=>[doc.id,{decision:'reviewed',revision:doc.revision,reviewed_at:new Date().toISOString()}])),0);
  let rendered = '', calls = 0;
  const options = {hostedOrigin:'https://drink-test.example',packageStore:{read:async()=>receipt},packageTransport:async()=>{calls++;throw Error('No AI allowed');},quotePdfRenderer:async html=>{rendered=html;return Buffer.from('%PDF-TEST');}};
  let handler = createHandler({...options,packageWorkspace:workspace});
  async function post(path,data) {
    const req = {url:path,method:'POST',headers:{host:'drink-test.example',origin:'https://drink-test.example','content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
    let result;
    await handler(req,{writeHead(status,headers){result={status,headers};},end(body){result.body=body;}});
    if(result.headers['Content-Type'].startsWith('application/json'))result.json=JSON.parse(result.body);
    return result;
  }
  const identity = {scenario_id:input.id,run_id};
  const edited = await post('/api/package/edit',{...identity,sequence:1,changes:{beverage:'Beer and wine service',beverage_notes:'Soft drinks for children. No spirits or cocktails.'},reason:'Checked the included drinks.',resolve:true,lesson:'Keep included drink notes separate from the priced option.'});
  assert.equal(edited.status,200,JSON.stringify(edited.json));
  assert.deepEqual(edited.json.saved.feedback[0].fields,['beverage']);
  assert.deepEqual(Object.keys(edited.json.saved.reviews).sort(),['calendar','kitchen']);
  assert.deepEqual(edited.json.changed_documents.map(doc=>doc.id),['quote','staff','guest']);
  const reopened = await createPackageWorkspace(directory,profile);
  handler = createHandler({...options,packageWorkspace:reopened});
  const loaded = await post('/api/package/review/load',identity);
  assert.equal(loaded.status,200,JSON.stringify(loaded.json));
  assert.equal(loaded.json.data.record.fields.beverage.notes,'Soft drinks for children. No spirits or cocktails.');
  assert.equal((await reopened.lessons())[0].fields[0],'beverage');
  for(const id of ['quote','staff','guest']) {
    const result = await post(`/api/package/${id}/pdf`,{...identity,sequence:2,revision:doc(loaded.json.data,id).revision});
    assert.equal(result.status,200,JSON.stringify(result.json));
    assert.match(rendered,/Soft drinks for children/);
  }
  const stale = await post('/api/package/edit',{...identity,sequence:1,changes:{beverage:'Nonalcoholic service',beverage_notes:''},reason:'Old browser'});
  assert.equal(stale.status,409);
  assert.equal(calls,0);
});
