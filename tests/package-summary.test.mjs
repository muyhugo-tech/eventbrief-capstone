import test from 'node:test';
import assert from 'node:assert/strict';
import { packageFixtures } from '../lib/package-fixtures.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { packageSummary } from '../lib/package-summary.mjs';

const bundle = packageFixtures.get('patio-complete');
const correction = value => ({value,status:'agreed',reason:'Fictional coordinator check.'});
test('workspace summary uses corrected dates and counts, never source or internal notes', () => {
  const prepared=prepareEventPackage({...bundle,corrections:{event_date:correction('2027-12-03'),host_name:correction('Jordan Example')}});
  const summary=packageSummary(prepared);
  assert.equal(summary.event_date,'2027-12-03');assert.equal(summary.host_name,'Jordan Example');
  assert.equal(summary.documents.length,5);assert.equal(summary.ready_count,5);
  assert.equal(summary.quote_total_cents,prepared.documents.find(doc=>doc.id==='quote').quote.total_cents);
  for(const privateKey of ['input','original_record','staff_notes','dietary','corrections','evidence']) assert.ok(!Object.hasOwn(summary,privateKey));
});
test('presentation corrections invalidate reviews for documents that display them', () => {
  const before=prepareEventPackage(bundle);
  const after=prepareEventPackage({...bundle,corrections:{event_date:correction('2027-12-03')}});
  const reviews=Object.fromEntries(before.documents.map(doc=>[doc.id,{revision:doc.revision}]));
  assert.equal(packageSummary(before,reviews).reviewed_count,5);
  assert.equal(packageSummary(after,reviews).reviewed_count,0);
  assert.ok(after.documents.find(doc=>doc.id==='quote').rows.some(row=>row.field==='event_date'&&row.value==='2027-12-03'));
});
test('blocked quotes have no amount and optional schedule does not become a new readiness gate', () => {
  const blocked=prepareEventPackage({...bundle,corrections:{menu:{value:null,status:'unknown',reason:'Menu needs confirming.'}}});
  assert.equal(packageSummary(blocked).quote_total_cents,null);
  const noDate=prepareEventPackage({...bundle,corrections:{event_date:{value:null,status:'unknown',reason:'Date needs confirming.'}}});
  const quote=noDate.documents.find(doc=>doc.id==='quote');
  assert.equal(quote.state,'ready_for_review');assert.ok(!quote.rows.some(row=>row.field==='event_date'));
});
