import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server.mjs';
import {createPackageWorkspace} from '../lib/package-workspace.mjs';
import {packageFixtures} from '../lib/package-fixtures.mjs';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {staffPdfHtml} from '../lib/quote-pdf.mjs';
import {renderDocument,standaloneDocument} from '../public/package-render.mjs';
const fixture=packageFixtures.get('patio-complete');
const identity={scenario_id:fixture.input.id,run_id:null};
const staff=data=>data.documents.find(doc=>doc.id==='staff');

async function setup(t,renderer) {
  const dir=await mkdtemp(join(tmpdir(),'eventbrief-staff-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const workspace=await createPackageWorkspace(dir,fixture.profile);
  const handler=createHandler({packageWorkspace:workspace,quotePdfRenderer:renderer,hostedOrigin:'https://staff-test.example'});
  return async(path,data,origin='https://staff-test.example')=>{
    const req={url:path,method:'POST',headers:{host:'staff-test.example',origin,'content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
    let result;
    await handler(req,{writeHead(status,headers){result={status,headers};},end(body){result.body=body;}});
    if(result.headers['Content-Type'].startsWith('application/json'))result.json=JSON.parse(result.body);
    return result;
  };
}

test('staff sheet retains internal details, reuses quote prices and never infers coordinator or serving times',async()=>{
  const prepared=prepareEventPackage(fixture),doc=staff(prepared);
  assert.deepEqual(doc.staff_pricing,prepared.documents.find(doc=>doc.id==='quote').quote);
  const html=await staffPdfHtml(doc,prepared,true);
  for(const text of ['Execution sheet - staff-facing','Service flow &amp; timeline','Food &amp; beverage notes','Setup / floor plan','Team instructions','Riley will lead the event handover.','No allergies or dietary restrictions','$58.00 menu + $18.00 drinks per person','$2,280.00','6:00 PM','9:00 PM'])assert.ok(html.includes(text),text);
  assert.match(html,/Confirm assignment; see team instructions/);
  assert.match(html,/Course serving times are not supplied separately/);
  assert.doesNotMatch(html,/Hugo|cash and carry|23%|2:15 PM|2:45 PM|YANNI|Arrive at the garden entrance/);
  assert.match(html,/data:font\/woff2;base64/);assert.doesNotMatch(html,/url\('\/quote-fonts/);
  assert.match(html,/Reviewed draft/);assert.doesNotMatch(html,/data-field=/);
  assert.match(renderDocument(doc,prepared),/data-field="staff_notes"/);
  for(const kind of ['guest','kitchen']) {
    const other=structuredClone(prepared.documents.find(doc=>doc.id===kind));other.staff_pricing=doc.staff_pricing;
    assert.doesNotMatch(standaloneDocument(other,prepared,false),/Riley will lead|\$2,280/);
  }
});

test('unconfirmed pricing stays absent and staff-only text is escaped without rewriting instructions',async()=>{
  const correction=(value,status='stated')=>({value,status,reason:'Synthetic test'});
  const prepared=prepareEventPackage({...fixture,corrections:{guest_13_plus_count:correction(null,'unknown'),staff_notes:correction('Coordinator: Jamie <script> & team\n18:15 - serve starters only after the host confirms.')}});
  const doc=staff(prepared);assert.equal(doc.state,'ready_for_review');assert.equal(doc.staff_pricing,null);
  doc.rows.push({field:'source_messages',value:'PRIVATE_THREAD_SENTINEL'});
  const html=await staffPdfHtml(doc,prepared,false);
  assert.match(html,/Needs confirmation - open the guest quote/);
  assert.match(html,/Jamie &lt;script&gt; &amp; team\n18:15 - serve starters only after the host confirms\./);
  assert.doesNotMatch(html,/<script|PRIVATE_THREAD|\$2,280/);
  const before=prepareEventPackage(fixture);
  assert.equal(prepared.profile_revision,before.profile_revision);
  assert.notEqual(doc.revision,staff(before).revision);
});

test('saved staff edits update PDF schedule, instructions and prices and clear the old review',async t=>{
  let rendered;
  const call=await setup(t,async html=>{rendered=html;return Buffer.from('%PDF-1.7\nfixture');});
  const original=prepareEventPackage(fixture),doc=staff(original);
  await call('/api/package/review',{...identity,sequence:0,corrections:{},reviews:{staff:{decision:'reviewed',revision:doc.revision,reviewed_at:new Date().toISOString()}}});
  const first=await call('/api/package/staff/pdf',{...identity,sequence:1,revision:doc.revision});
  assert.equal(first.status,200);assert.equal(first.headers['Content-Type'],'application/pdf');
  assert.match(first.headers['Content-Disposition'],/eventbrief-2027-11-14-alex-morgan-staff-event-plan\.pdf/);
  assert.match(rendered,/Reviewed draft/);
  const edit=await call('/api/package/edit',{...identity,sequence:1,changes:{guest_13_plus_count:18,child_count:2,start_time:'18:30',end_time:'21:30',staff_notes:'Coordinator: Jamie. Confirm dessert timing with the host.'},reason:'Confirmed synthetic changes'});
  assert.equal(edit.status,200);assert.equal(edit.json.saved.reviews.staff,undefined);
  assert.equal((await call('/api/package/staff/pdf',{...identity,sequence:1,revision:doc.revision})).status,409);
  const updated=await call('/api/package/staff/pdf',{...identity,sequence:2,revision:staff(edit.json.data).revision});
  assert.equal(updated.status,200);assert.match(rendered,/6:30 PM/);assert.match(rendered,/9:30 PM/);
  assert.match(rendered,/Coordinator: Jamie/);assert.match(rendered,/\$1,424\.00/);assert.match(rendered,/\$22\.00 menu \+ \$6\.00 drinks/);
  assert.doesNotMatch(rendered,/Riley will lead|\$2,280|Reviewed draft/);
  assert.deepEqual((await call('/api/package/review/load',identity)).json.data.input,original.input);
});

test('missing allergy or staff notes, forged HTML, stale revisions and cross-origin staff exports are rejected',async t=>{
  let renders=0;const call=await setup(t,async()=>{renders++;return Buffer.from('pdf');});
  const doc=staff(prepareEventPackage(fixture)),body={...identity,sequence:0,revision:doc.revision};
  assert.equal((await call('/api/package/staff/pdf',{...body,html:'untrusted'})).status,400);
  assert.equal((await call('/api/package/staff/pdf',body,'https://untrusted.example')).status,403);
  assert.equal((await call('/api/package/staff/pdf',{...body,revision:'stale'})).status,409);
  for(const [i,field] of ['dietary','staff_notes'].entries()) {
    await call('/api/package/review',{...identity,sequence:i,reviews:{},corrections:{[field]:{value:null,status:'unknown',reason:'Missing test detail'}}});
    assert.equal((await call('/api/package/staff/pdf',{...body,sequence:i+1})).status,409);
  }
  assert.equal(renders,0);
});

test('a change during staff PDF rendering discards old output and a renderer failure preserves the saved record',async t=>{
  let call,change=true;
  call=await setup(t,async()=>{
    if(!change)throw new Error('Renderer unavailable');
    await call('/api/package/edit',{...identity,sequence:0,changes:{staff_notes:'New handover instruction.'},reason:'Synthetic concurrent edit'});
    return Buffer.from('%PDF-1.7\nstale');
  });
  assert.equal((await call('/api/package/staff/pdf',{...identity,sequence:0,revision:staff(prepareEventPackage(fixture)).revision})).status,409);
  change=false;
  const saved=(await call('/api/package/review/load',identity)).json;
  assert.equal((await call('/api/package/staff/pdf',{...identity,sequence:1,revision:staff(saved.data).revision})).status,503);
  assert.deepEqual((await call('/api/package/review/load',identity)).json,saved);
});
