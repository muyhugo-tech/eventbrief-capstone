import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server.mjs';
import {createPackageWorkspace} from '../lib/package-workspace.mjs';
import {packageFixtures} from '../lib/package-fixtures.mjs';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {quotePdfHtml} from '../lib/quote-pdf.mjs';
import {renderGuestQuote} from '../public/quote-document.mjs';
const fixture=packageFixtures.get('patio-complete');
const identity={scenario_id:fixture.input.id,run_id:null};

async function setup(t,renderer) {
  const dir=await mkdtemp(join(tmpdir(),'eventbrief-quote-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const workspace=await createPackageWorkspace(dir,fixture.profile);
  const handler=createHandler({packageWorkspace:workspace,quotePdfRenderer:renderer,hostedOrigin:'https://quote-test.example'});
  return async(path,data,origin='https://quote-test.example')=>{
    const req={url:path,method:'POST',headers:{host:'quote-test.example',origin,'content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
    let result;
    await handler(req,{writeHead(status,headers){result={status,headers};},end(body){result.body=body;}});
    if(result.headers['Content-Type'].startsWith('application/json'))result.json=JSON.parse(result.body);
    return result;
  };
}
const quote=data=>data.documents.find(doc=>doc.id==='quote');

test('quote paper and embedded-font PDF HTML contain only current guest-facing details',async()=>{
  const data=prepareEventPackage({...fixture,corrections:{host_name:{value:'Élodie <script> & $&',status:'stated',reason:'Test'}}});
  const document=quote(data);
  document.rows.push({field:'staff_notes',value:'PRIVATE_STAFF_SENTINEL',label:'Staff'});
  const html=await quotePdfHtml(document,data,true);
  assert.match(html,/data:font\/woff2;base64,/);assert.doesNotMatch(html,/url\('\/quote-fonts/);
  assert.match(html,/Élodie &lt;script&gt; &amp; \$&amp;/);assert.match(html,/Reviewed draft/);
  assert.match(html,/\$2,280\.00/);assert.match(html,/30 guests · 0 children/);
  assert.doesNotMatch(html,/PRIVATE_STAFF|Riley will lead|yannisbarandgrill|Scripps|<script|data-field=/i);
  assert.match(renderGuestQuote(document,data,{interactive:true}),/data-field="host_name"/);
});

test('PDF endpoint derives prices and review state from saved data and returns a named PDF',async t=>{
  let rendered;
  const call=await setup(t,async html=>{rendered=html;return Buffer.from('%PDF-1.7\nfixture');});
  const original=prepareEventPackage(fixture),doc=quote(original);
  await call('/api/package/review',{...identity,sequence:0,corrections:{},reviews:{quote:{decision:'reviewed',revision:doc.revision,reviewed_at:new Date().toISOString()}}});
  const pdf=await call('/api/package/quote/pdf',{...identity,sequence:1,revision:doc.revision});
  assert.equal(pdf.status,200);assert.equal(pdf.headers['Content-Type'],'application/pdf');
  assert.match(pdf.headers['Content-Disposition'],/eventbrief-2027-11-14-alex-morgan-guest-quote\.pdf/);
  assert.match(rendered,/Reviewed draft/);assert.match(rendered,/\$2,280\.00/);
  assert.equal(pdf.body.toString(),'%PDF-1.7\nfixture');
  const edited=await call('/api/package/edit',{...identity,sequence:1,changes:{guest_13_plus_count:18,child_count:12},reason:'Synthetic edit'});
  assert.equal(edited.status,200);
  assert.equal((await call('/api/package/quote/pdf',{...identity,sequence:1,revision:doc.revision})).status,409);
  const updated=await call('/api/package/quote/pdf',{...identity,sequence:2,revision:quote(edited.json.data).revision});
  assert.equal(updated.status,200);assert.match(rendered,/\$1,704\.00/);assert.match(rendered,/Draft · not reviewed/);
  assert.doesNotMatch(rendered,/\$2,280\.00/);
});

test('blocked, forged and cross-origin PDF requests never reach the renderer',async t=>{
  let calls=0;const call=await setup(t,async()=>{calls++;return Buffer.from('pdf');});
  const document=quote(prepareEventPackage(fixture));
  assert.equal((await call('/api/package/quote/pdf',{...identity,sequence:0,revision:document.revision,html:'untrusted'})).status,400);
  assert.equal((await call('/api/package/quote/pdf',{...identity,sequence:0,revision:document.revision},'https://untrusted.example')).status,403);
  const corrections={menu:{value:null,status:'unknown',reason:'Menu undecided'}};
  assert.equal((await call('/api/package/review',{...identity,sequence:0,corrections,reviews:{}})).status,200);
  assert.equal((await call('/api/package/quote/pdf',{...identity,sequence:1,revision:document.revision})).status,409);
  assert.equal(calls,0);
});

test('a concurrent edit discards the rendered PDF and renderer failures preserve the saved quote',async t=>{
  let call,editDuringRender=true;
  call=await setup(t,async()=>{
    if(!editDuringRender)throw new Error('Renderer unavailable');
    await call('/api/package/edit',{...identity,sequence:0,changes:{host_name:'Changed during export'},reason:'Synthetic concurrency check'});
    return Buffer.from('%PDF-1.7\nold version');
  });
  const document=quote(prepareEventPackage(fixture));
  assert.equal((await call('/api/package/quote/pdf',{...identity,sequence:0,revision:document.revision})).status,409);
  editDuringRender=false;
  const saved=(await call('/api/package/review/load',identity)).json;
  assert.equal((await call('/api/package/quote/pdf',{...identity,sequence:saved.saved.sequence,revision:quote(saved.data).revision})).status,503);
  assert.deepEqual((await call('/api/package/review/load',identity)).json,saved);
});
