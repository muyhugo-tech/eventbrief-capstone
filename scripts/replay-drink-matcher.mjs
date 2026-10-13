// Offline replay of original saved model answers. No keys, transport or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { pastedInput } from '../lib/package-workspace.mjs';
import { renderDocument, standaloneDocument } from '../public/package-render.mjs';
import { checkLena } from './check-lena-event.mjs';
import { checksFor } from './check-new-event.mjs';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const specs={
  lena:{directory:'new-event-v2',check:checkLena,notes:'with soda and juice for everybody and no alcohol'},
  noah:{directory:'new-event-v1',check:checksFor,notes:'juice and soda for everyone, with no alcohol'}
};

export function checkReplayedCase(name,data) {
  const spec=specs[name];assert.ok(spec,'Choose a saved evaluation case');
  const checks=spec.check(data);
  assert.ok(Object.values(checks.checks).every(Boolean),JSON.stringify(checks));
  const exactNotes={};
  for(const id of ['quote','staff','guest']) {
    const doc=data.documents.find(doc=>doc.id===id);
    exactNotes[id]=doc.beverage_notes===spec.notes&&renderDocument(doc,data).includes(spec.notes)&&standaloneDocument(doc,data).includes(spec.notes);
    assert.ok(exactNotes[id],`${name} ${id}: preserve the actual drink instruction`);
  }
  return {...checks,beverage_option:data.record.fields.beverage.value,beverage_notes:data.record.fields.beverage.notes,exact_notes_in_preview_and_download:exactNotes};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const profile=await json('fixtures/package/restaurant-v2.json');
  const results=[];
  for(const [name,spec] of Object.entries(specs)) {
    const base=`evaluation/${spec.directory}`;
    const protocol=await json(`${base}/protocol.json`);
    const saved=await json(`${base}/results/2026-10-12.json`);
    const originalBytes=JSON.stringify(saved.original_output);
    assert.equal(sha(await readFile(new URL(`${base}/protocol.json`,root))),saved.protocol_sha256);
    const bundle={input:pastedInput(protocol.conversation),profile,original:saved.original_output};
    const historical=prepareEventPackage({...bundle,normalizationPolicy:saved.normalization_policy});
    const historicalCheck=spec.check(historical);
    if(name==='lena')assert.deepEqual(historicalCheck,saved.automated_checks);
    else {
      assert.deepEqual(historicalCheck.documents,saved.initial.documents);
      assert.equal(historicalCheck.ready_documents,saved.initial.ready_documents);
      assert.equal(historicalCheck.quote_total_cents,saved.initial.quote_total_cents);
    }
    const prepared=prepareEventPackage(bundle);
    assert.deepEqual(prepared.corrections,{});
    assert.equal(JSON.stringify(prepared.original_record),originalBytes);
    assert.equal(JSON.stringify(saved.original_output),originalBytes);
    results.push({case:name,original_policy:saved.normalization_policy,normalization_policy:prepared.normalization_policy,
      original_result_sha256:sha(await readFile(new URL(`${base}/results/2026-10-12.json`,root))),protocol_sha256:saved.protocol_sha256,
      original_ready_documents:historicalCheck.ready_documents,...checkReplayedCase(name,prepared),
      original_preserved:true,manual_corrections:0,new_ai_calls:0,added_ai_cost_usd:0});
  }
  console.log(JSON.stringify({replayed_at:new Date().toISOString(),
    code_sha256:Object.fromEntries(await Promise.all(['lib/package-normalization.mjs','lib/event-package.mjs','scripts/replay-drink-matcher.mjs'].map(async path=>[path,sha(await readFile(new URL(path,root)))]))),
    results,new_ai_calls:0,added_ai_cost_usd:0,
    limitation:'Saved-answer regression checks used to develop this fix, not new AI trials or an independent accuracy benchmark.'},null,2));
}
