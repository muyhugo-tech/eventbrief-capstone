import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareEventPackage, fingerprint } from '../lib/event-package.mjs';
import { normalizePackageRecord, APP_NORMALIZATION, SUPPORTED_DETAILS_V1, SUPPORTED_DETAILS_V2 } from '../lib/package-normalization.mjs';
import { eventEditCorrections } from '../lib/package-edits.mjs';
import { pastedInput, createPackageWorkspace } from '../lib/package-workspace.mjs';
import { renderDocument, standaloneDocument } from '../public/package-render.mjs';
import { createHandler } from '../server.mjs';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const protocol = await json('../evaluation/new-event-v1/protocol.json');
const saved = await json('../evaluation/new-event-v1/results/2026-10-12.json');
const profile = await json('../fixtures/package/restaurant-v2.json');
const input = pastedInput(protocol.conversation);
const bundle = { input, profile, original: saved.original_output };
const notes = 'juice and soda for everyone, with no alcohol';
const doc = (data, id) => data.documents.find(item => item.id === id);

test('Noah original answer produces five drafts with the exact drink notes and unchanged price', () => {
  const original = structuredClone(bundle.original);
  const current = prepareEventPackage(bundle);
  assert.equal(current.normalization_policy, APP_NORMALIZATION);
  assert.ok(current.documents.every(d => d.state === 'ready_for_review'));
  assert.equal(doc(current, 'quote').quote.total_cents, 177600);
  assert.equal(current.record.fields.beverage.value, 'Nonalcoholic service');
  assert.equal(current.record.fields.beverage.notes, notes);
  assert.equal(current.record.fields.beverage.status, original.fields.beverage.status);
  assert.deepEqual(current.record.fields.beverage.evidence, original.fields.beverage.evidence);
  assert.deepEqual(bundle.original, original);
  assert.deepEqual(current.original_record, original);
  const previous = prepareEventPackage({...bundle, normalizationPolicy: SUPPORTED_DETAILS_V2});
  assert.deepEqual(current.documents, previous.documents, 'Already-supported drafts keep their revisions');
  for (const id of ['quote', 'staff', 'guest']) {
    assert.equal(doc(current, id).beverage_notes, notes);
    assert.ok(renderDocument(doc(current, id), current).includes(notes));
    assert.ok(standaloneDocument(doc(current, id), current).includes(notes));
  }
  const old = prepareEventPackage({...bundle, normalizationPolicy: SUPPORTED_DETAILS_V1});
  assert.deepEqual(old.documents.map(({id,state,blockers}) => ({id,state,blockers})), saved.initial.documents);
  assert.equal(doc(old, 'quote').quote, null);
});

test('ordinary nonalcoholic notes match only the supported package and preserve exact wording', () => {
  for (const text of ['Juice and soda for everybody. No alcohol.', 'soft drinks for all guests', 'soda and juice for guests and children; with no alcohol', 'non-alcoholic drinks for everyone, no alcohol']) {
    const original = structuredClone(bundle.original);
    original.fields.beverage.value = `Nonalcoholic service; ${text}`;
    const data = prepareEventPackage({...bundle, original});
    assert.equal(data.record.fields.beverage.value, 'Nonalcoholic service');
    assert.equal(data.record.fields.beverage.notes, text);
    assert.equal(doc(data, 'quote').quote.total_cents, 177600);
  }
  for (const text of [
    'Nonalcoholic service; juice and soda for everyone, with no alcohol except champagne',
    'Nonalcoholic service; juice and soda for everyone, free refills',
    'Nonalcoholic service; juice and soda for everyone, $2 per person',
    'Nonalcoholic service; premium mocktails for everyone',
    'Nonalcoholic service; juice and soda for everyone, add beer',
    'Nonalcoholic service; juice and soda for everyone, <script>bad</script>',
    'Beer and wine service; juice and soda for everyone, with no alcohol',
    'Juice and soda for everyone, with no alcohol'
  ]) {
    const original = structuredClone(bundle.original); original.fields.beverage.value = text;
    const data = prepareEventPackage({...bundle, original});
    assert.equal(data.record.fields.beverage.value, text);
    assert.equal(doc(data, 'quote').state, 'blocked');
  }
  const corrections = {beverage: {value:'Nonalcoholic service',status:'agreed',notes:'juice and soda for everyone, except beer for Noah',reason:'Check requested exception.'}};
  assert.equal(doc(prepareEventPackage({...bundle,corrections}), 'quote').state, 'blocked');
});

test('matching leaves requests, conflicts, open questions and deliberate coordinator clearing intact', () => {
  for (const status of ['requested', 'conflicting']) {
    const record = structuredClone(bundle.original); record.fields.beverage.status = status;
    if (status === 'conflicting') record.fields.beverage.value = null;
    assert.deepEqual(normalizePackageRecord(record,profile).fields.beverage,record.fields.beverage);
    assert.equal(doc(prepareEventPackage({...bundle,original:record}), 'guest').state, 'blocked');
  }
  const original = structuredClone(bundle.original);
  original.open_questions.push({field:'beverage',question:'Is the drink choice accepted?',evidence:original.fields.beverage.evidence});
  assert.equal(doc(prepareEventPackage({...bundle,original}), 'quote').state, 'blocked');
  const recovered = prepareEventPackage({...bundle, corrections:saved.recovery.corrections});
  assert.equal(recovered.record.fields.beverage.notes, '');
  const corrections = eventEditCorrections(bundle.original, saved.recovery.corrections,
    {beverage:'Nonalcoholic service',beverage_notes:notes}, 'Restored the drink instructions from the original conversation.',
    {resolve:true,currentRecord:recovered.record});
  const restored = prepareEventPackage({...bundle,corrections});
  for (const id of ['quote','staff','guest']) assert.notEqual(doc(restored,id).revision, doc(recovered,id).revision);
  for (const id of ['calendar','kitchen']) assert.equal(doc(restored,id).revision, doc(recovered,id).revision);
});

test('Noah saved receipt loads and exports current notes without invoking a provider', async t => {
  const directory = await mkdtemp(join(tmpdir(),'eventbrief-noah-replay-'));
  t.after(() => rm(directory,{recursive:true,force:true}));
  const workspace = await createPackageWorkspace(directory,profile);
  await workspace.save(protocol.conversation);
  const run_id = '22222222-2222-4222-8222-222222222222';
  const extraction = {run_id,mode:'simulated'};
  const receipt = {status:'succeeded',scenario_id:input.id,input_hash:fingerprint(input),profile_hash:fingerprint(profile),parsed_output:bundle.original,...extraction};
  await workspace.rememberResult(input,extraction);
  const old = prepareEventPackage({...bundle,extraction,normalizationPolicy:SUPPORTED_DETAILS_V1});
  await workspace.saveReview(old,{},0);
  let calls = 0, rendered = '';
  const handler = createHandler({hostedOrigin:'https://noah-test.example',packageWorkspace:workspace,
    packageStore:{read:async()=>receipt},packageTransport:async()=>{calls++;throw Error('No AI allowed');},
    quotePdfRenderer:async html=>{rendered=html;return Buffer.from('%PDF-TEST');}});
  async function post(path,data) {
    const req = {url:path,method:'POST',headers:{host:'noah-test.example',origin:'https://noah-test.example','content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
    let result;
    await handler(req,{writeHead(status,headers){result={status,headers};},end(body){result.body=body;}});
    if(result.headers['Content-Type'].startsWith('application/json'))result.json=JSON.parse(result.body);
    return result;
  }
  const identity = {scenario_id:input.id,run_id};
  const loaded = await post('/api/package/review/load',identity);
  assert.equal(loaded.status,200);
  assert.ok(loaded.json.data.documents.every(d=>d.state==='ready_for_review'));
  assert.equal(loaded.json.data.record.fields.beverage.notes,notes);
  for (const id of ['quote','staff','guest']) {
    const response=await post(`/api/package/${id}/pdf`,{...identity,sequence:loaded.json.saved.sequence,revision:doc(loaded.json.data,id).revision});
    assert.equal(response.status,200);
    assert.ok(rendered.includes(notes));
  }
  assert.equal(calls,0);
});
