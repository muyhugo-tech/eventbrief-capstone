import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { pastedInput } from '../lib/package-workspace.mjs';
import { SUPPORTED_DETAILS_V2 } from '../lib/package-normalization.mjs';
import { checkLena } from '../scripts/check-lena-event.mjs';
import { standaloneDocument } from '../public/package-render.mjs';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const protocol = await json('../evaluation/new-event-v2/protocol.json');
const saved = await json('../evaluation/new-event-v2/results/2026-10-12.json');
const profile = await json('../fixtures/package/restaurant-v2.json');
const bundle = { input:pastedInput(protocol.conversation), profile, original:saved.original_output };
const doc = (data,id) => data.documents.find(item=>item.id===id);

test('Lena saved answer passes all five frozen draft checks without a correction', () => {
  const original = structuredClone(bundle.original);
  const before = prepareEventPackage({...bundle,normalizationPolicy:SUPPORTED_DETAILS_V2});
  assert.deepEqual(checkLena(before),saved.automated_checks);
  const after = prepareEventPackage(bundle);
  assert.ok(Object.values(checkLena(after).checks).every(Boolean));
  assert.equal(doc(after,'quote').quote.total_cents,142000);
  assert.deepEqual(after.corrections,{});
  assert.deepEqual(after.original_record,original);
  assert.deepEqual(bundle.original,original);
  assert.equal(after.record.fields.beverage.notes,'with soda and juice for everybody and no alcohol');
  assert.equal(after.record.fields.beverage.status,original.fields.beverage.status);
  assert.deepEqual(after.record.fields.beverage.evidence,original.fields.beverage.evidence);
  for(const id of ['quote','staff','guest']) {
    assert.equal(doc(after,id).beverage_notes,after.record.fields.beverage.notes);
    assert.ok(standaloneDocument(doc(after,id),after).includes(after.record.fields.beverage.notes));
  }
  assert.equal(doc(before,'calendar').revision,doc(after,'calendar').revision);
});

test('supported combined instructions preserve drink names, audiences and original notes', () => {
  for(const notes of [
    'with soda and juice for everybody and no alcohol',
    'no alcohol and juice and soda for all guests and children',
    'soft drinks for everyone and with no alcohol',
    'Soda and juice for guests and children AND no alcohol.',
    'juice and soda for everyone, with no alcohol',
    'no alcohol; soda and juice for everybody'
  ]) {
    const original=structuredClone(bundle.original);
    original.fields.beverage.value=`Nonalcoholic service; ${notes}`;
    const data=prepareEventPackage({...bundle,original});
    assert.equal(data.record.fields.beverage.value,'Nonalcoholic service',notes);
    assert.equal(data.record.fields.beverage.notes,notes);
    assert.equal(doc(data,'quote').quote.total_cents,142000);
  }
});

test('joining clauses does not hide unsupported extras, exceptions or contradictory packages', () => {
  for(const value of [
    'Nonalcoholic service; soda and juice for everybody and no alcohol except champagne',
    'Nonalcoholic service; soda and juice for everybody and no alcohol and add beer',
    'Nonalcoholic service; soda and juice for everybody and no alcohol and $2 per person',
    'Nonalcoholic service; no alcohol and free refills and soda for everyone',
    'Nonalcoholic service; no alcohol and premium mocktails for everyone',
    'Nonalcoholic service; soda and juice for everybody and no alcohol and',
    'Nonalcoholic service; and no alcohol',
    'Beer and wine service; soda and juice for everybody and no alcohol',
    'Soda and juice for everybody and no alcohol'
  ]) {
    const original=structuredClone(bundle.original);original.fields.beverage.value=value;
    const data=prepareEventPackage({...bundle,original});
    assert.equal(data.record.fields.beverage.value,value);
    assert.equal(doc(data,'quote').state,'blocked',value);
  }
  const corrections={beverage:{value:'Nonalcoholic service',status:'agreed',notes:'soda for everyone and no alcohol except beer',reason:'Still checking the requested exception.'}};
  assert.equal(doc(prepareEventPackage({...bundle,corrections}),'quote').state,'blocked');
});

test('new matching cannot resolve uncertain drinks or overwrite explicit coordinator choices', () => {
  for(const status of ['requested','conflicting','unknown']) {
    const original=structuredClone(bundle.original);original.fields.beverage.status=status;
    if(status!=='requested')original.fields.beverage.value=null;
    if(status==='unknown')original.fields.beverage.evidence=[];
    assert.equal(doc(prepareEventPackage({...bundle,original}),'quote').state,'blocked');
  }
  const original=structuredClone(bundle.original);
  original.open_questions.push({field:'beverage',question:'Are drinks confirmed?',evidence:original.fields.beverage.evidence});
  assert.equal(doc(prepareEventPackage({...bundle,original}),'quote').state,'blocked');
  const corrections={beverage:{value:'Nonalcoholic service',status:'agreed',notes:'',reason:'Coordinator explicitly cleared these notes.'}};
  assert.equal(prepareEventPackage({...bundle,corrections}).record.fields.beverage.notes,'');
});
