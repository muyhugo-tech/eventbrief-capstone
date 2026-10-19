import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {renderDocument} from '../public/package-render.mjs';
import {demoExamples} from '../public/demo-examples.mjs';
const {cases}=JSON.parse(await readFile(new URL('../evaluation/public-demo-v1/cases.json',import.meta.url),'utf8'));

for(const entry of cases)test(`public example ${entry.id}: saved real answer produces the expected five draft states`,()=>{
  const original=JSON.stringify(entry.original);
  assert.equal(entry.input.messages[0].body,demoExamples.find(example=>example.id===entry.id).text);
  const data=prepareEventPackage(entry), e=entry.expected;
  const expected={guest_13_plus_count:e.guests,child_count:e.children,guest_count:e.guests+e.children,event_date:e.date,start_time:e.start,end_time:e.end};
  for(const [field,value]of Object.entries(expected))assert.equal(data.record.fields[field].value,value,field);
  assert.equal(data.documents.length,5);
  assert.deepEqual(data.documents.filter(doc=>doc.state==='ready_for_review').map(doc=>doc.id),e.ready);
  for(const doc of data.documents){
    for(const row of doc.rows)if(Object.hasOwn(expected,row.field))assert.equal(row.value,expected[row.field],doc.id+':'+row.field);
    if(entry.id==='drinks'&&['quote','staff','guest'].includes(doc.id)){
      const rendered=renderDocument(doc,data,{interactive:false});
      assert.match(rendered,/juice and soda/);assert.match(rendered,/no beer or wine/i);
    }
  }
  assert.equal(JSON.stringify(entry.original),original);
  assert.equal(JSON.stringify(data.original_record),original);
});

test('nonalcoholic exclusions preserve notes and prices without approving alcoholic additions or contradictions',()=>{
  const entry=cases.find(c=>c.id==='drinks');
  const ready=prepareEventPackage(entry);
  assert.equal(ready.record.fields.beverage.value,'Nonalcoholic service');
  assert.equal(ready.documents.find(doc=>doc.id==='quote').quote.total_cents,140800);
  for(const value of [
    'Nonalcoholic service with juice and soda; no beer or wine except champagne.',
    'Nonalcoholic service with juice and soda and cocktails.',
    'Nonalcoholic service with premium juice at $10 per person.',
    'Beer and wine service with juice and soda; no beer or wine.'
  ]){
    const original=structuredClone(entry.original);original.fields.beverage.value=value;
    const data=prepareEventPackage({...entry,original});
    assert.equal(data.documents.find(doc=>doc.id==='quote').state,'blocked',value);
  }
});
