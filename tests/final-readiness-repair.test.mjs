import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareEventPackage,fingerprint} from '../lib/event-package.mjs';
import {GUEST_DIETARY_V1,hostRaisedDietary} from '../lib/guest-dietary-policy.mjs';
import {SUPPORTED_DETAILS_V4} from '../lib/package-normalization.mjs';
import {pastedInput,createPackageWorkspace} from '../lib/package-workspace.mjs';
import {eventEditCorrections} from '../lib/package-edits.mjs';
import {createHandler} from '../server.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
import {finalProtocol,checkFinalReadiness} from '../scripts/check-final-readiness.mjs';
const saved=JSON.parse(await readFile(new URL('../evaluation/final-readiness-v1/results/2026-10-13.json',import.meta.url),'utf8'));
const bundle=id=>({input:pastedInput(finalProtocol.cases.find(c=>c.id===id).conversation),original:structuredClone(saved.cases.find(c=>c.id===id).original_output),profile:structuredClone(saved.profile)});
const doc=(data,id)=>data.documents.find(d=>d.id===id);
const priya=()=>bundle('priya-explicit-end'),jordan=()=>bundle('jordan-unresolved-allergy');

test('frozen first attempts stay reproducible; saved answers pass all fifteen workflow checks',()=>{
  for(const c of finalProtocol.cases){
    const source=bundle(c.id),old=saved.cases.find(x=>x.id===c.id);
    const before=prepareEventPackage({...source,normalizationPolicy:old.normalization_policy,readinessPolicy:old.readiness_policy,workflowPolicy:old.workflow_policy});
    assert.deepEqual(checkFinalReadiness(before,c),old.automated_checks);
    const after=prepareEventPackage(source),score=checkFinalReadiness(after,c);
    assert.ok(Object.values(score.draft_checks).every(Boolean),c.id);
    assert.ok(Object.entries(score.checks).filter(([key])=>key!=='source_counts').every(([,v])=>v),c.id);
    assert.equal(score.checks.source_counts,c.id!=='diego-count-default','Raw omission must not be rewritten as successful extraction');
    assert.deepEqual(after.original_record,source.original);assert.deepEqual(after.corrections,{});
    assert.equal(doc(after,'calendar').revision,doc(before,'calendar').revision);
  }
});

test('included drink instructions need no punctuation; exact notes and pricing survive',()=>{
  const source=priya();
  const cases=[
    ['Beer and wine service only for guests confirmed to be 21 or older; juice and soda for the children; no spirits or cocktails.','Beer and wine service','only for guests confirmed to be 21 or older; juice and soda for the children; no spirits or cocktails.',130000],
    ['Beer and wine service with juice and soda for the children, and no spirits or cocktails.','Beer and wine service','with juice and soda for the children, and no spirits or cocktails.',130000],
    ['Nonalcoholic service with juice and soda for everyone, and no alcohol.','Nonalcoholic service','with juice and soda for everyone, and no alcohol.',110800]
  ];
  for(const [value,option,notes,cents]of cases){
    const original=structuredClone(source.original);original.fields.beverage.value=value;
    const data=prepareEventPackage({...source,original});
    assert.equal(data.record.fields.beverage.value,option);
    assert.equal(data.record.fields.beverage.notes,notes);
    assert.deepEqual(data.record.fields.beverage.evidence,original.fields.beverage.evidence);
    assert.equal(doc(data,'quote').quote.total_cents,cents);
    for(const id of ['quote','staff','guest'])assert.ok(standaloneDocument(doc(data,id),data,false).includes(notes));
  }
});

test('drink matching still rejects additions, price changes, exceptions and uncertain arrangements',()=>{
  const source=priya();
  for(const value of [
    'Nonalcoholic service with juice and soda for everyone, and add champagne',
    'Nonalcoholic service with juice and soda for everyone, and no alcohol except beer',
    'Nonalcoholic service with juice and soda for everyone, and $2 extra per person',
    'Nonalcoholic service with unlimited refills',
    'Nonalcoholic service premium with juice and soda for everyone',
    'Nonalcoholic services with juice and soda for everyone',
    'Maybe Nonalcoholic service with juice and soda for everyone',
    'Beer and wine service only for guests confirmed to be 18 or older',
    'Beer and wine service only for guests confirmed to be 21 or older except younger relatives',
    'Beer and wine service with no alcohol',
    'Beer and wine service with juice and soda for everyone',
    'Beer and wine service with juice and soda for the children and premium champagne'
  ]){
    const original=structuredClone(source.original);original.fields.beverage.value=value;
    const data=prepareEventPackage({...source,original});
    assert.equal(doc(data,'quote').state,'blocked',value);assert.equal(data.record.fields.beverage.value,value);
  }
  for(const status of ['requested','stated']){
    const original=structuredClone(source.original);original.fields.beverage.status=status;
    const data=prepareEventPackage({...source,original});
    assert.equal(data.record.fields.beverage.status,status);
    for(const id of ['staff','guest'])assert.equal(doc(data,id).state,'blocked');
    if(status==='requested')assert.equal(doc(data,'quote').state,'blocked');
  }
  const original=structuredClone(source.original);
  original.open_questions.push({field:'beverage',question:'Are the drinks confirmed?',evidence:original.fields.beverage.evidence});
  assert.equal(doc(prepareEventPackage({...source,original}),'quote').state,'blocked');
});

test('bare event purposes remain visible without promising a custom service',()=>{
  const source=priya();
  for(const value of ['Anniversary celebration','Birthday dinner','Retirement party','Graduation','Family gathering']){
    const original=structuredClone(source.original);original.fields.special.value=value;
    const data=prepareEventPackage({...source,original});
    assert.equal(doc(data,'staff').state,'ready_for_review');
    assert.equal(data.record.fields.special.value,value);
    assert.equal(data.record.fields.special.preparation.kind,'event_purpose');
    const html=standaloneDocument(doc(data,'staff'),data,false);
    assert.ok(html.includes('Event purpose'));assert.ok(html.includes(value));
  }
  for(const value of ['Anniversary celebration with a custom cake','Birthday dinner; arrange fireworks','Anniversary decorations','Custom anniversary celebration','Anniversary celebration — complimentary champagne']){
    const original=structuredClone(source.original);original.fields.special.value=value;
    const data=prepareEventPackage({...source,original});
    assert.ok(doc(data,'staff').blockers.some(b=>b.field==='special'),value);
    assert.equal(data.record.fields.special.value,value);
  }
  const original=structuredClone(source.original);
  original.open_questions.push({field:'special',question:'Can we arrange a celebration?',evidence:original.fields.special.evidence});
  assert.equal(doc(prepareEventPackage({...source,original}),'staff').state,'blocked');
  original.open_questions=[];original.fields.special.status='requested';
  assert.equal(doc(prepareEventPackage({...source,original}),'staff').state,'blocked');
});

test('first-name host mentions create the allergy dependency even with valid drinks',()=>{
  const source=jordan();source.original.fields.beverage.value='Nonalcoholic service';
  const before=prepareEventPackage({...source,normalizationPolicy:SUPPORTED_DETAILS_V4,readinessPolicy:GUEST_DIETARY_V1});
  assert.equal(doc(before,'guest').state,'ready_for_review');
  const after=prepareEventPackage(source);
  for(const id of ['kitchen','staff','guest']){
    assert.equal(doc(after,id).state,'blocked');assert.ok(doc(after,id).blockers.every(b=>b.field==='dietary'));
  }
  for(const id of ['calendar','quote','kitchen','staff'])assert.equal(doc(after,id).revision,doc(before,id).revision);
  assert.notEqual(doc(after,'guest').revision,doc(before,'guest').revision);
  const renamed=prepareEventPackage({...source,corrections:{host_name:{value:'Different display name',status:'stated',reason:'Display name correction.'}}});
  assert.ok(doc(renamed,'guest').blockers.some(b=>b.field==='dietary'));
});

test('speaker handling separates host, other people, restaurant, quotes and ambiguous first names',()=>{
  const original={fields:{host_name:{value:'Jordan Wells'}}};
  const raised=text=>hostRaisedDietary(pastedInput(text),original);
  for(const text of [
    "Jordan: Hi, I'm Jordan Wells.\nJordan: I still need the allergy details.",
    'Jordan Wells: One guest has a food allergy.',
    'Jordan: I will ask.\nThe food allergy details will follow.',
    'Jordan:\nPlease book the Garden Patio on May 14, 2027 from 18:00 to 21:00. I will send the allergy details.',
    'Jordan:\nDietary requirements: I will send the details tomorrow.',
    'Host — Jordan Wells: Allergy details will follow.',
    "Jordan: I'm Jordan Wells.\nJordan Roberts: Good evening.\nJordan: I need to confirm an allergy."
  ])assert.equal(raised(text),true,text);
  for(const text of [
    'Jordan: Everything is confirmed.\nCoordinator: Any allergies?',
    'Jordan: Everything is confirmed.\nCoordinator — Jordan: Any allergies?',
    'Jordan: Everything is confirmed.\nTaylor: Ask about allergies.',
    'Jordan: Everything is confirmed.\nJordan Roberts: My guest has an allergy.',
    'Jordan: Everything is confirmed.\n> Host: Missing allergy details.',
    'Jordan: Everything is confirmed.\nINTERNAL STAFF NOTE: Ask about allergies.',
    'Jordan Wells: Dinner.\nJordan Roberts: Dinner.\nJordan: I need allergy details.'
  ])assert.equal(raised(text),false,text);
});

test('an explained dietary correction resolves all three plans without altering the saved source',()=>{
  const source=jordan(),before=prepareEventPackage(source);
  const corrections=eventEditCorrections(source.original,{}, {dietary:'No allergies or dietary restrictions'},'Host confirmed the previously outstanding details.',{resolve:true,currentRecord:before.record});
  const after=prepareEventPackage({...source,corrections});
  assert.ok(after.documents.every(d=>d.state==='ready_for_review'));
  assert.deepEqual(after.original_record,source.original);
  assert.equal(doc(after,'quote').quote.total_cents,172000);
  for(const id of ['calendar','quote'])assert.equal(doc(after,id).revision,doc(before,id).revision);
});

test('hosted routes reopen the saved answer, reject stale allergy approval and prevent its PDF without AI',async()=>{
  const source=jordan();source.original.fields.beverage.value='Nonalcoholic service';
  const workspace=await createPackageWorkspace(await mkdtemp(join(tmpdir(),'eventbrief-host-alias-')),source.profile);
  await workspace.save(finalProtocol.cases.find(c=>c.id==='jordan-unresolved-allergy').conversation);
  const run_id='22222222-2222-4222-8222-222222222222',extraction={run_id,mode:'simulated'};
  const receipt={status:'succeeded',scenario_id:source.input.id,input_hash:fingerprint(source.input),profile_hash:fingerprint(source.profile),parsed_output:source.original,...extraction};
  await workspace.rememberResult(source.input,extraction);
  const old=prepareEventPackage({...source,extraction,normalizationPolicy:SUPPORTED_DETAILS_V4,readinessPolicy:GUEST_DIETARY_V1});
  await workspace.saveReview(old,Object.fromEntries(old.documents.filter(d=>d.state==='ready_for_review').map(d=>[d.id,{decision:'reviewed',revision:d.revision,reviewed_at:new Date().toISOString()}])),0);
  let calls=0,renders=0;
  const handler=createHandler({hostedOrigin:'https://alias-test.example',packageWorkspace:workspace,packageStore:{read:async()=>receipt},packageTransport:async()=>{calls++;throw Error('AI forbidden');},quotePdfRenderer:async()=>{renders++;return Buffer.from('%PDF-TEST');}});
  async function post(path,data){
    let result;
    const req={url:path,method:'POST',headers:{host:'alias-test.example',origin:'https://alias-test.example','content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
    await handler(req,{writeHead(status,headers){result={status,headers};},end(body){result.body=body;}});
    if(result.headers['Content-Type'].startsWith('application/json'))result.json=JSON.parse(result.body);
    return result;
  }
  const identity={scenario_id:source.input.id,run_id};
  const loaded=await post('/api/package/review/load',identity);assert.equal(loaded.status,200);
  assert.deepEqual(Object.keys(loaded.json.saved.reviews).sort(),['calendar','quote']);
  assert.ok(doc(loaded.json.data,'guest').blockers.every(b=>b.field==='dietary'));
  const blocked=await post('/api/package/guest/pdf',{...identity,sequence:loaded.json.saved.sequence,revision:doc(loaded.json.data,'guest').revision});
  assert.equal(blocked.status,409);assert.equal(renders,0);
  const quote=await post('/api/package/quote/pdf',{...identity,sequence:loaded.json.saved.sequence,revision:doc(loaded.json.data,'quote').revision});
  assert.equal(quote.status,200);assert.equal(renders,1);assert.equal(calls,0);
});
