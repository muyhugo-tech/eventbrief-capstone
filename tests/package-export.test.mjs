import test from 'node:test';
import assert from 'node:assert/strict';
import { venueInstant, assetFilename } from '../public/package-export.mjs';
import { renderDocument, standaloneDocument } from '../public/package-render.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';

test('reused builders retain approved times in winter and summer without inventing an event type',()=>{
  assert.equal(venueInstant('2027-12-12','18:00','America/Los_Angeles'),'2027-12-13T02:00:00.000Z');
  assert.equal(venueInstant('2027-07-12','18:00','America/Los_Angeles'),'2027-07-13T01:00:00.000Z');
  const prepared=prepareEventPackage([...packageFixtures.values()][0]);
  const staff=standaloneDocument(prepared.documents.find(d=>d.id==='staff'),prepared,true);
  assert.match(staff,/Reviewed draft/);assert.match(staff,/6:00 PM/);
  assert.doesNotMatch(staff,/Private party|YANNI|Scripps Ranch|undefined/);
  const kitchen=standaloneDocument(prepared.documents.find(d=>d.id==='kitchen'),prepared,true);
  assert.match(kitchen,/Total attendance/);assert.match(kitchen,/No allergies or dietary restrictions/);
  assert.doesNotMatch(kitchen,/Riley will lead|riley@|\$2,280/);
});

const complete=packageFixtures.get('patio-complete');
const correction=(value,status='stated')=>({value,status,reason:'Synthetic asset export test.'});
const asset=(prepared,id)=>prepared.documents.find(document=>document.id===id);

test('four usable assets retain supplied schedule, place, attendance and distinct audience sections',()=>{
  const prepared=prepareEventPackage({...complete,corrections:{guest_13_plus_count:correction(18),child_count:correction(12)}});
  const expected={quote:/Itemized estimate/,kitchen:/Allergies &amp; dietary needs/,staff:/Setup \/ floor plan/,guest:/Your arrival &amp; event notes/};
  for(const id of ['quote','kitchen','staff','guest']) {
    const html=standaloneDocument(asset(prepared,id),prepared,true);
    assert.match(html,expected[id],id);
    assert.match(html,/Garden Patio/i,id);
    assert.match(html,/November.*14.*2027|NOVEMBER.*14.*2027/i,id);
    assert.match(html,/Children \(0–12\)/,id);
    assert.match(html,/Guests/,id);
    assert.match(html,/Reviewed draft/,id);
    assert.match(html,/@page\{size:Letter/,id);
    assert.doesNotMatch(html,/<script\b|<iframe\b|<link\b|<img\b|data-field=|data-policy=/i,id);
  }
  const kitchen=standaloneDocument(asset(prepared,'kitchen'),prepared,true);
  assert.match(kitchen,/Fictional prep guide/);assert.match(kitchen,/30 portions/);
  assert.doesNotMatch(kitchen,/Riley will lead|Arrive at the garden entrance|\$1,704/);
  const staff=standaloneDocument(asset(prepared,'staff'),prepared,true);
  assert.match(staff,/Riley will lead the event handover/);
  assert.match(staff,/Event schedule/);
  assert.doesNotMatch(staff,/Occasion|Event type|<h2>Contact<\/h2>|undefined/);
  const guest=standaloneDocument(asset(prepared,'guest'),prepared,true);
  assert.match(guest,/Arrive at the garden entrance/);
  assert.doesNotMatch(guest,/Riley will lead|No allergies or dietary restrictions|\$\d/);
});

test('quote export uses the calculated cents exactly and does not invent taxes or extra fees',()=>{
  const prepared=prepareEventPackage({...complete,corrections:{guest_13_plus_count:correction(18),child_count:correction(12)}});
  const quote=asset(prepared,'quote');
  // 18 × ($58 + $18) + 12 × ($22 + $6) = $1,704.
  assert.equal(quote.quote.total_cents,170400);
  assert.equal(quote.quote.lines.reduce((sum,line)=>sum+line.amount_cents,0),170400);
  const html=standaloneDocument(quote,prepared,false);
  for(const amount of ['$1,044.00','$264.00','$324.00','$72.00','$1,704.00']) assert.ok(html.includes(amount));
  assert.match(html,/No additional tax or service fee is calculated/);
  assert.doesNotMatch(html,/food.*beverage minimum|binding contract|confirmed booking/i);
});

test('audience boundaries also reject accidental extra rows and quote objects',()=>{
  const prepared=prepareEventPackage(complete);
  const guest=structuredClone(asset(prepared,'guest'));
  guest.rows.push({field:'staff_notes',label:'Internal notes',value:'PRIVATE_STAFF_SENTINEL'},
    {field:'dietary',label:'Dietary',value:'PRIVATE_DIETARY_SENTINEL'},
    {field:'source_messages',label:'Messages',value:'PRIVATE_SOURCE_SENTINEL'});
  guest.quote=asset(prepared,'quote').quote;
  const html=standaloneDocument(guest,prepared,false);
  assert.doesNotMatch(html,/PRIVATE_|\$2,280/);
  const kitchen=structuredClone(asset(prepared,'kitchen'));
  kitchen.rows.push({field:'staff_notes',label:'Internal notes',value:'PRIVATE_STAFF_SENTINEL'});
  assert.doesNotMatch(standaloneDocument(kitchen,prepared,false),/PRIVATE_STAFF_SENTINEL/);
});

test('blocked exports only show blockers, never a completed asset or price',()=>{
  const prepared=prepareEventPackage(packageFixtures.get('patio-awaiting-dietary'));
  for(const id of ['kitchen','staff','guest']) {
    const document=asset(prepared,id);
    document.quote={total_cents:99900,lines:[],note:'Do not leak this stale total'};
    const html=standaloneDocument(document,prepared,true);
    assert.match(html,/This draft is blocked/);
    assert.match(html,/Dietary requirements: not supplied/);
    assert.doesNotMatch(html,/Reviewed draft|\$999|Do not leak|No allergies or dietary restrictions|Garden salad/);
  }
});

test('all four previews and downloads escape text; source buttons exist only in the review UI',()=>{
  const prepared=prepareEventPackage({...complete,corrections:{host_name:correction('Alex <img src=x onerror="oops"> & $&')}});
  for(const id of ['quote','kitchen','staff','guest']) {
    const document=asset(prepared,id);
    const html=standaloneDocument(document,prepared,false);
    assert.doesNotMatch(html,/<img\b|<script\b/);
    assert.match(html,/&lt;IMG SRC=X ONERROR=&quot;OOPS&quot;&gt;|&lt;img src=x onerror=&quot;oops&quot;&gt;/);
    assert.ok(html.includes('$&') || html.includes('$&amp;'));
    assert.doesNotMatch(html,/data-field=/);
    assert.match(renderDocument(document,prepared),/data-field="host_name"/);
    assert.doesNotMatch(renderDocument(document,prepared,{interactive:false}),/data-field=|<button/);
  }
});

test('download names are readable, stable, safe file names and never expose source text',()=>{
  const prepared=prepareEventPackage(complete);
  assert.equal(assetFilename(asset(prepared,'quote'),prepared),'eventbrief-2027-11-14-alex-morgan-guest-quote.html');
  const document=structuredClone(asset(prepared,'guest'));
  document.rows.find(row=>row.field==='host_name').value='../../Élodie <script> : \\ $&';
  const name=assetFilename(document,prepared,'pdf');
  assert.equal(name,'eventbrief-2027-11-14-elodie-script-guest-event-plan.pdf');
  assert.doesNotMatch(name,/[<>:"/\\|?*]/);
  assert.ok(assetFilename(document,prepared,'../../bad').endsWith('.html'));
});
