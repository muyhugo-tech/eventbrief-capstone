import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server.mjs';
import {createPackageWorkspace} from '../lib/package-workspace.mjs';
import {packageFixtures} from '../lib/package-fixtures.mjs';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {guestPdfHtml} from '../lib/quote-pdf.mjs';
import {renderDocument} from '../public/package-render.mjs';
const fixture=packageFixtures.get('patio-complete');
const identity={scenario_id:fixture.input.id,run_id:null};
const guest=data=>data.documents.find(doc=>doc.id==='guest');

async function setup(t,renderer) {
  const dir=await mkdtemp(join(tmpdir(),'eventbrief-guest-pdf-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const workspace=await createPackageWorkspace(dir,fixture.profile);
  const handler=createHandler({packageWorkspace:workspace,quotePdfRenderer:renderer,hostedOrigin:'https://guest-test.example'});
  return async(path,data,origin='https://guest-test.example')=>{
    const req={url:path,method:'POST',headers:{host:'guest-test.example',origin,'content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
    let result;
    await handler(req,{writeHead(status,headers){result={status,headers};},end(body){result.body=body;}});
    if(result.headers['Content-Type'].startsWith('application/json'))result.json=JSON.parse(result.body);
    return result;
  };
}

test('guest PDF is welcoming, factual and audience-filtered even with extra internal fields',async()=>{
  const prepared=prepareEventPackage(fixture),doc=guest(prepared);
  doc.rows.push({field:'staff_notes',value:'PRIVATE_STAFF_SENTINEL'},{field:'dietary',value:'PRIVATE_DIETARY_SENTINEL'},{field:'source_messages',value:'PRIVATE_SOURCE_SENTINEL'});
  doc.staff_pricing=prepared.documents.find(doc=>doc.id==='quote').quote;
  const html=await guestPdfHtml(doc,prepared,false);
  for(const text of ['Dear Alex Morgan,','Thank you for choosing Sergio&#39;s Restaurant Venue','Your event details','6:00 PM - 9:00 PM (Pacific Time)','Garden Patio','Garden salad','Arrive at the garden entrance','last-minute updates','confirm what we can accommodate','The Sergio&#39;s Restaurant Venue team','Draft · not reviewed'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/PRIVATE_|Riley will lead|No allergies or dietary restrictions|\$2,280|One demo beverage-package price|confirmed booking|confirmed event details|data-field=/i);
  assert.match(html,/data:font\/woff2;base64/);
  assert.doesNotMatch(html,/url\('\/quote-fonts/);
  assert.match(renderDocument(doc,prepared),/data-field="guest_notes"/);
  assert.doesNotMatch(renderDocument(doc,prepared),/data-field="staff_notes"|data-field="dietary"/);
});

test('guest names and arrival notes are escaped and retain line breaks',async()=>{
  const correction=value=>({value,status:'stated',reason:'Synthetic text safety check'});
  const prepared=prepareEventPackage({...fixture,corrections:{host_name:correction('Élodie <script> & family'),guest_notes:correction('Use the garden entrance.\nAsk for <Jamie> & the host.')}});
  const html=await guestPdfHtml(guest(prepared),prepared,true);
  assert.match(html,/Dear Élodie &lt;script&gt; &amp; family,/);
  assert.match(html,/Use the garden entrance\.\nAsk for &lt;Jamie&gt; &amp; the host\./);
  assert.match(html,/Reviewed draft/);assert.doesNotMatch(html,/<script|<Jamie>/);
});

test('saved changes update the guest PDF and invalidate its review without affecting source messages',async t=>{
  let rendered;
  const call=await setup(t,async html=>{rendered=html;return Buffer.from('%PDF-1.7\nfixture');});
  const original=prepareEventPackage(fixture),doc=guest(original);
  await call('/api/package/review',{...identity,sequence:0,corrections:{},reviews:{guest:{decision:'reviewed',revision:doc.revision,reviewed_at:new Date().toISOString()}}});
  assert.equal((await call('/api/package/guest/pdf',{...identity,sequence:1,revision:doc.revision})).status,200);
  assert.match(rendered,/Reviewed draft/);
  const edit=await call('/api/package/edit',{...identity,sequence:1,changes:{guest_13_plus_count:18,child_count:2,start_time:'18:30',end_time:'21:30',guest_notes:'Meet your host at the patio entrance.'},reason:'Host confirmed the changes.'});
  assert.equal(edit.status,200);assert.equal(edit.json.saved.reviews.guest,undefined);
  assert.equal((await call('/api/package/guest/pdf',{...identity,sequence:1,revision:doc.revision})).status,409);
  const pdf=await call('/api/package/guest/pdf',{...identity,sequence:2,revision:guest(edit.json.data).revision});
  assert.equal(pdf.status,200);assert.equal(pdf.headers['Content-Type'],'application/pdf');
  assert.match(pdf.headers['Content-Disposition'],/eventbrief-2027-11-14-alex-morgan-guest-event-plan\.pdf/);
  assert.match(rendered,/18 Guests · 2 Children \(0–12\)/);assert.match(rendered,/6:30 PM - 9:30 PM/);assert.match(rendered,/Meet your host at the patio entrance/);
  assert.doesNotMatch(rendered,/Reviewed draft|Arrive at the garden entrance/);
  assert.deepEqual((await call('/api/package/review/load',identity)).json.data.input,original.input);
  const before=guest(edit.json.data).revision;
  const staffEdit=await call('/api/package/edit',{...identity,sequence:2,changes:{staff_notes:'Internal handover changed.'},reason:'Internal change only.'});
  assert.equal(guest(staffEdit.json.data).revision,before);
  assert.equal(staffEdit.json.data.profile_revision,original.profile_revision);
});

test('guest export rejects missing host-raised allergy details, forged HTML, stale revisions and foreign origins',async t=>{
  let renders=0;const call=await setup(t,async()=>{renders++;return Buffer.from('pdf');});
  const doc=guest(prepareEventPackage(fixture)),body={...identity,sequence:0,revision:doc.revision};
  assert.equal((await call('/api/package/guest/pdf',{...body,html:'untrusted'})).status,400);
  assert.equal((await call('/api/package/guest/pdf',body,'https://untrusted.example')).status,403);
  assert.equal((await call('/api/package/guest/pdf',{...body,revision:'stale'})).status,409);
  const awaiting=packageFixtures.get('patio-awaiting-dietary'),blocked=guest(prepareEventPackage(awaiting));
  assert.equal((await call('/api/package/guest/pdf',{scenario_id:awaiting.input.id,run_id:null,sequence:0,revision:blocked.revision})).status,409);
  assert.equal(renders,0);
});
