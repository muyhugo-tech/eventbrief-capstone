import test from 'node:test';
import assert from 'node:assert/strict';
import { venueInstant } from '../public/package-export.mjs';
import { standaloneDocument } from '../public/package-render.mjs';
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
  assert.match(kitchen,/TOTAL ATTENDANCE/);assert.match(kitchen,/No allergies or dietary restrictions/);
  assert.doesNotMatch(kitchen,/Riley will lead|riley@|\$2,280/);
});
