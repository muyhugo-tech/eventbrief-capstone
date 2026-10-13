import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packageFixtures} from '../lib/package-fixtures.mjs';
import {prepareEventPackage, fingerprint} from '../lib/event-package.mjs';
import {settingsFromProfile, validateSettings, applyRestaurantSettings, createRestaurantSettingsStore} from '../lib/restaurant-settings.mjs';
import {rehearsalExample} from '../public/restaurant-example.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {renderGuestQuote} from '../public/quote-document.mjs';
import {renderStaffSheet} from '../public/staff-document.mjs';

const fixture = packageFixtures.get('patio-complete'), baseline = fixture.profile;
const initial = () => settingsFromProfile(baseline);
const example = () => rehearsalExample(initial());
const prepared = settings => prepareEventPackage({...fixture, profile:applyRestaurantSettings(baseline,settings),baselineProfile:baseline});

test('settings persist across store instances and reject concurrent edits without overwriting', async () => {
  const directory = await mkdtemp(join(tmpdir(),'eventbrief-settings-'));
  const first = await createRestaurantSettingsStore(directory,baseline), second = await createRestaurantSettingsStore(directory,baseline);
  assert.equal((await first.load()).revision,0);
  const results = await Promise.allSettled([first.save(example(),0,'Fictional rehearsal settings'),second.save(example(),0,'Another browser')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/browser|changed/);
  const saved = await second.load();
  assert.equal(saved.revision,1); assert.equal(saved.settings.venues['Garden Patio'].capacity,60);
  assert.equal((await first.save(saved.settings,1,'No changes')).revision,1);
  await assert.rejects(first.save(initial(),0,'Stale save'),/changed in another browser/);
  assert.equal((await second.load()).revision,1);
});

test('settings cannot change prompt/readiness, introduce ambiguous drink aliases or invalid prices', () => {
  const bad = change => {const value = example();change(value);assert.throws(()=>validateSettings(value,baseline));};
  bad(v=>v.readiness={}); bad(v=>v.venues['Garden Patio'].capacity=0);
  bad(v=>v.menus['Menu 3'].prices_cents.child_count=null);
  bad(v=>v.menus['Menu 3'].prices_cents.child_count=2.5);
  bad(v=>v.menus['Menu 3'].prices_cents.child_count=1000001);
  bad(v=>v.menus['Menu 3'].beverages=['Unsaved drink']);
  bad(v=>v.beverages['À la carte + cash bar'].prices_cents.child_count=600);
  bad(v=>v.beverages['À la carte + cash bar'].aliases.push('Nonalcoholic service'));
  bad(v=>v.menus['menu 2']=structuredClone(v.menus['Menu 2']));
  bad(v=>Object.defineProperty(v.venues,'__proto__',{value:{capacity:40,setups:['x']},enumerable:true}));
  assert.deepEqual(applyRestaurantSettings(baseline,initial()),baseline);
});

test('adding unrelated settings preserves all existing document reviews; a menu price changes only quote and staff', () => {
  const before=prepareEventPackage(fixture), after=prepared(example());
  assert.deepEqual(after.documents.map(d=>d.revision),before.documents.map(d=>d.revision));
  assert.notEqual(after.profile_revision,before.profile_revision);
  const settings=example(); settings.menus['Menu 2'].prices_cents.guest_13_plus_count+=100;
  const priceChange=prepared(settings);
  assert.deepEqual(priceChange.documents.filter((doc,i)=>doc.revision!==before.documents[i].revision).map(d=>d.id),['quote','staff']);
  assert.equal(priceChange.documents.find(d=>d.id==='quote').quote.total_cents-before.documents.find(d=>d.id==='quote').quote.total_cents,fixture.original.fields.guest_13_plus_count.value*100);
  const capacity=example(); capacity.venues['Garden Patio'].capacity=2;
  assert.ok(prepared(capacity).documents.every(doc=>doc.state==='blocked'));
});

const protocol=JSON.parse(await readFile(new URL('../evaluation/new-event-v3/protocol.json',import.meta.url),'utf8'));
const saved=JSON.parse(await readFile(new URL('../evaluation/new-event-v3/results/2026-10-12.json',import.meta.url),'utf8'));
const alex = {input:pastedInput(protocol.conversation),original:saved.original_output};
test('Alex replay accepts configured Menu 3, capacity and exact cash-bar wording without inventing ten unknown fields', () => {
  const data=prepareEventPackage({workflowPolicy:'strict-drafts-v1',...alex,baselineProfile:baseline,profile:applyRestaurantSettings(baseline,example())});
  assert.equal(data.record.fields.guest_count.value,46);
  assert.equal(data.record.fields.beverage.value,'À la carte + cash bar');
  assert.equal(data.record.fields.beverage.notes,alex.original.fields.beverage.value);
  assert.deepEqual(data.original_record,alex.original);
  assert.deepEqual(data.corrections,{});
  assert.deepEqual(data.issues,[]);
  assert.ok(data.documents.every(doc=>doc.state==='blocked'));
  for (const field of protocol.expected.unknown_fields) assert.deepEqual(data.record.fields[field],alex.original.fields[field]);
  assert.ok(!data.documents.find(d=>d.id==='guest').blockers.some(b=>b.field==='dietary'));
});

test('extra drink promises remain blocked; separate drinks never appear as free in quote or staff sheet', () => {
  const settings=example(), profile=applyRestaurantSettings(baseline,settings);
  const corrections={menu:{value:'Menu 3',status:'agreed',reason:'Fictional coordinator example'},
    beverage:{value:alex.original.fields.beverage.value,status:'agreed',reason:'Fictional coordinator example'}};
  const data=prepareEventPackage({...fixture,profile,baselineProfile:baseline,corrections});
  const quote=data.documents.find(d=>d.id==='quote'), staff=data.documents.find(d=>d.id==='staff');
  assert.ok(data.documents.every(doc=>doc.state==='ready_for_review'));
  assert.equal(quote.quote.beverages_excluded,true);
  assert.equal(quote.quote.lines.length,1); // This saved fixture has zero children.
  assert.ok(quote.quote.lines.every(line=>line.rule.startsWith('menus.')));
  assert.equal(quote.quote.total_cents,fixture.original.fields.guest_13_plus_count.value*6400+fixture.original.fields.child_count.value*2400);
  const html=renderGuestQuote(quote,data)+renderStaffSheet(staff,data);
  assert.match(html,/Food estimate/); assert.match(html,/Drinks are billed separately/);
  assert.doesNotMatch(html,/cash bar.*?\$0\.00|all demo charges included/);
  corrections.beverage.value+=' Include champagne for free.';
  const unsupported=prepareEventPackage({...fixture,profile,corrections});
  assert.ok(unsupported.issues.some(issue=>issue.rule==='beverages'));
  assert.equal(unsupported.documents.find(doc=>doc.id==='quote').state,'blocked');
});
