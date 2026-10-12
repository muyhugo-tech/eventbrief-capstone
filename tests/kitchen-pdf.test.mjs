import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server.mjs';
import {createPackageWorkspace} from '../lib/package-workspace.mjs';
import {packageFixtures} from '../lib/package-fixtures.mjs';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {eventEditCorrections} from '../lib/package-edits.mjs';
import {kitchenPdfHtml} from '../lib/quote-pdf.mjs';
import {kitchenPrep} from '../lib/kitchen-prep.mjs';
import {standaloneKitchenSheet} from '../public/kitchen-document.mjs';
const fixture=packageFixtures.get('patio-complete');
const identity={scenario_id:fixture.input.id,run_id:null};
const kitchen=data=>data.documents.find(doc=>doc.id==='kitchen');
const quantities=doc=>doc.kitchen_plan.sections.flatMap(section=>section.lines.map(line=>line.quantity));

async function setup(t,renderer) {
  const dir=await mkdtemp(join(tmpdir(),'eventbrief-kitchen-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const workspace=await createPackageWorkspace(dir,fixture.profile);
  const handler=createHandler({packageWorkspace:workspace,quotePdfRenderer:renderer,hostedOrigin:'https://kitchen-test.example'});
  return async(path,data,origin='https://kitchen-test.example')=>{
    const req={url:path,method:'POST',headers:{host:'kitchen-test.example',origin,'content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
    let result;
    await handler(req,{writeHead(status,headers){result={status,headers};},end(body){result.body=body;}});
    if(result.headers['Content-Type'].startsWith('application/json'))result.json=JSON.parse(result.body);
    return result;
  };
}

test('prep rules include children, round full containers up, and never reuse rules for a different menu',()=>{
  for(const [guests,children,expected] of [[18,2,[2,2,2,20]],[29,2,[4,4,4,31]],[1,0,[1,1,1,1]],[0,2,[1,1,1,2]]]) {
    const corrections=eventEditCorrections(fixture.original,{}, {guest_13_plus_count:guests,child_count:children});
    const prepared=prepareEventPackage({...fixture,corrections}),doc=kitchen(prepared);
    assert.deepEqual(quantities(doc),expected);
    assert.match(doc.kitchen_plan.basis,/Fictional prep guide/);
    assert.equal(prepared.profile_revision,prepareEventPackage(fixture).profile_revision);
  }
  const profile=structuredClone(fixture.profile);profile.menus['Menu 2'].courses=['A different main dish'];
  const fallback=kitchenPrep(fixture.original,profile);
  assert.equal(fallback.calculated,false);assert.equal(fallback.sections[0].lines[0].quantity,null);
  assert.equal(fallback.sections[0].lines[0].name,'A different main dish');
});

test('kitchen preview and PDF show prep tables, dietary facts and review status without quote or staff-only data',async()=>{
  const prepared=prepareEventPackage({...fixture,corrections:{host_name:{value:'Élodie <script> & Friends',status:'stated',reason:'Synthetic test'}}});
  const doc=kitchen(prepared);doc.rows.push({field:'staff_notes',label:'Staff',value:'PRIVATE_STAFF_SENTINEL'});
  const html=await kitchenPdfHtml(doc,prepared,true);
  assert.match(html,/data:font\/woff2;base64/);assert.doesNotMatch(html,/url\('\/quote-fonts/);
  for(const text of ['Kitchen prep sheet','Prepped','Checked','Garden salad','Herb chicken','Roast squash','Apple crumble','3 bowls','30 portions','No allergies or dietary restrictions','Reviewed draft'])assert.ok(html.includes(text),text);
  assert.match(html,/Élodie &lt;script&gt; &amp; Friends/);
  assert.doesNotMatch(html,/PRIVATE_STAFF|Riley will lead|\$2,280|Beer and wine|<script|data-field=/i);
  const blocked=prepareEventPackage(packageFixtures.get('patio-awaiting-dietary'));
  assert.equal(kitchen(blocked).kitchen_plan,null);
  assert.throws(()=>standaloneKitchenSheet(kitchen(blocked),blocked,false),/ready kitchen sheet/);
});

test('kitchen PDF uses saved attendance and review state; a count edit changes quantities and clears review',async t=>{
  let rendered;
  const call=await setup(t,async html=>{rendered=html;return Buffer.from('%PDF-1.7\nfixture');});
  const original=prepareEventPackage(fixture),doc=kitchen(original);
  await call('/api/package/review',{...identity,sequence:0,corrections:{},reviews:{kitchen:{decision:'reviewed',revision:doc.revision,reviewed_at:new Date().toISOString()}}});
  const first=await call('/api/package/kitchen/pdf',{...identity,sequence:1,revision:doc.revision});
  assert.equal(first.status,200);assert.equal(first.headers['Content-Type'],'application/pdf');
  assert.match(first.headers['Content-Disposition'],/eventbrief-2027-11-14-alex-morgan-kitchen-sheet\.pdf/);
  assert.match(rendered,/Reviewed draft/);assert.match(rendered,/30 portions/);
  const edit=await call('/api/package/edit',{...identity,sequence:1,changes:{guest_13_plus_count:18,child_count:2},reason:'Synthetic count change'});
  assert.equal(edit.status,200);assert.equal(edit.json.saved.reviews.kitchen,undefined);
  assert.equal((await call('/api/package/kitchen/pdf',{...identity,sequence:1,revision:doc.revision})).status,409);
  const second=await call('/api/package/kitchen/pdf',{...identity,sequence:2,revision:kitchen(edit.json.data).revision});
  assert.equal(second.status,200);assert.match(rendered,/20 portions/);assert.match(rendered,/2 bowls/);
  assert.doesNotMatch(rendered,/30 portions|Reviewed draft/);assert.match(rendered,/Draft - not reviewed/);
  assert.deepEqual((await call('/api/package/review/load',identity)).json.data.input,original.input);
});

test('missing allergy information, foreign origins, forged quantities and stale revisions cannot export',async t=>{
  let renders=0;const call=await setup(t,async()=>{renders++;return Buffer.from('pdf');});
  const document=kitchen(prepareEventPackage(fixture));
  const body={...identity,sequence:0,revision:document.revision};
  assert.equal((await call('/api/package/kitchen/pdf',{...body,quantity:99})).status,400);
  assert.equal((await call('/api/package/kitchen/pdf',body,'https://untrusted.example')).status,403);
  assert.equal((await call('/api/package/kitchen/pdf',{...body,revision:'stale'})).status,409);
  await call('/api/package/review',{...identity,sequence:0,reviews:{},corrections:{dietary:{value:null,status:'unknown',reason:'Awaiting host'}}});
  assert.equal((await call('/api/package/kitchen/pdf',{...body,sequence:1})).status,409);
  assert.equal(renders,0);
});

test('changes during PDF creation discard the stale sheet; rendering errors do not alter saved data',async t=>{
  let call,change=true;
  call=await setup(t,async()=>{
    if(!change)throw new Error('Renderer unavailable');
    await call('/api/package/edit',{...identity,sequence:0,changes:{event_date:'2027-12-03'},reason:'Synthetic concurrent change'});
    return Buffer.from('%PDF-1.7\nstale');
  });
  const doc=kitchen(prepareEventPackage(fixture));
  assert.equal((await call('/api/package/kitchen/pdf',{...identity,sequence:0,revision:doc.revision})).status,409);
  change=false;
  const saved=(await call('/api/package/review/load',identity)).json;
  assert.equal((await call('/api/package/kitchen/pdf',{...identity,sequence:1,revision:kitchen(saved.data).revision})).status,503);
  assert.deepEqual((await call('/api/package/review/load',identity)).json,saved);
});
