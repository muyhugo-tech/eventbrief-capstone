import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {SUPPORTED_DETAILS_V3} from '../lib/package-normalization.mjs';
import {checkSofiaEvent} from '../scripts/check-sofia-event.mjs';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const saved = await read('../evaluation/new-event-v4/results/2026-10-13.json');
const protocol = await read('../evaluation/new-event-v4/protocol.json');
const bundle = {input:pastedInput(protocol.conversation), original:saved.original_output, profile:saved.profile};
const quote = data => data.documents.find(d => d.id === 'quote');

test('Sofia original failure reproduces; saved answer now produces all five without corrections', () => {
  const before = prepareEventPackage({...bundle, normalizationPolicy:SUPPORTED_DETAILS_V3});
  assert.deepEqual(checkSofiaEvent(before), saved.automated_checks);
  const after = prepareEventPackage(bundle);
  assert.equal(checkSofiaEvent(after).all_pass, true);
  assert.deepEqual(after.original_record, saved.original_output);
  assert.deepEqual(after.corrections, {});
  assert.equal(after.record.fields.beverage.notes, 'juice and soda for everyone, no alcohol.');
  assert.equal(after.documents[0].revision, before.documents[0].revision);
  for (const id of ['quote','kitchen','staff','guest']) assert.notEqual(after.documents.find(d => d.id === id).revision, before.documents.find(d => d.id === id).revision);
});

test('whole configured drink labels accept common note separators without changing notes', () => {
  for (const separator of [': ', ' — ', ' – ', ' - ', ', ', '; ', '. ', '\n']) {
    const original = structuredClone(bundle.original);
    original.fields.beverage.value = 'Nonalcoholic service' + separator + 'juice and soda for everyone, no alcohol.';
    const data = prepareEventPackage({...bundle, original});
    assert.equal(quote(data).quote?.total_cents, 210400, separator);
    assert.equal(data.record.fields.beverage.notes, 'juice and soda for everyone, no alcohol.');
    assert.deepEqual(data.record.fields.beverage.evidence, original.fields.beverage.evidence);
  }
  const profile = structuredClone(bundle.profile), original = structuredClone(bundle.original);
  const option = 'Soft drinks (standard): $6';
  profile.beverages[option] = profile.beverages['Nonalcoholic service'];
  profile.menus['Menu 2'].beverages.push(option);
  original.fields.beverage.value = option;
  assert.equal(quote(prepareEventPackage({...bundle, profile, original})).quote?.total_cents, 210400);
});

test('separators never hide custom prices, alcoholic exceptions, unknown prefixes or uncertainty', () => {
  for (const value of [
    'Nonalcoholic service: juice and soda for everyone, no alcohol except champagne',
    'Nonalcoholic service — juice and soda for everyone and add beer',
    'Nonalcoholic service - juice and soda for everyone; $2 extra per person',
    'Nonalcoholic service: no alcohol; unlimited refills',
    'Nonalcoholic service premium: juice and soda for everyone',
    'Maybe Nonalcoholic service: juice and soda for everyone',
    'Beer and wine service: juice and soda for everyone, no alcohol.'
  ]) {
    const original = structuredClone(bundle.original); original.fields.beverage.value = value;
    assert.equal(quote(prepareEventPackage({...bundle, original})).state, 'blocked', value);
  }
  const original = structuredClone(bundle.original); original.fields.beverage.status = 'requested';
  assert.equal(quote(prepareEventPackage({...bundle, original})).state, 'blocked');
  original.fields.beverage.status = 'agreed';
  original.open_questions.push({field:'beverage', question:'Please confirm drinks.', evidence:original.fields.beverage.evidence});
  assert.equal(quote(prepareEventPackage({...bundle, original})).state, 'blocked');
});
