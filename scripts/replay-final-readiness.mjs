// Current application replay of saved model answers. No key, provider or network.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareEventPackage,fingerprint} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {finalProtocol,checkFinalReadiness} from './check-final-readiness.mjs';
const root=new URL('../',import.meta.url);
export function checkRepairedWorkflow(data,testCase){
  const result=checkFinalReadiness(data,testCase);
  // Keep the raw extraction check visible. A software replay cannot repair
  // an omission in the original model output, and must never pretend it did.
  const workflowPass=Object.entries(result.checks).filter(([key])=>key!=='source_counts').every(([,v])=>v)&&Object.values(result.draft_checks).every(Boolean);
  return {...result,workflow_pass:workflowPass,raw_count_check_pass:result.checks.source_counts};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const bytes=await readFile(new URL('evaluation/final-readiness-v1/results/2026-10-13.json',root));
  const saved=JSON.parse(bytes),cases=[];
  for(const testCase of finalProtocol.cases){
    const original=saved.cases.find(c=>c.id===testCase.id);
    const bundle={input:pastedInput(testCase.conversation),original:original.original_output,profile:saved.profile};
    const historical=prepareEventPackage({...bundle,readinessPolicy:original.readiness_policy,normalizationPolicy:original.normalization_policy,workflowPolicy:original.workflow_policy});
    assert.deepEqual(checkFinalReadiness(historical,testCase),original.automated_checks);
    const data=prepareEventPackage(bundle),checks=checkRepairedWorkflow(data,testCase);
    assert.equal(checks.workflow_pass,true,testCase.id);
    assert.deepEqual(data.original_record,original.original_output);assert.deepEqual(data.corrections,{});
    cases.push({id:testCase.id,original_output_sha256:fingerprint(original.original_output),original_ready_documents:original.automated_checks.ready_documents,
      readiness_policy:data.readiness_policy,normalization_policy:data.normalization_policy,workflow_policy:data.workflow_policy,
      beverage_option:data.record.fields.beverage.value,beverage_notes:data.record.fields.beverage.notes,guest_dietary_dependency:data.documents.find(d=>d.id==='guest').dependencies.includes('dietary'),
      original_unchanged:true,manual_corrections:0,new_ai_calls:0,checks});
  }
  const result={type:'Saved-answer application repair; not a new AI test',original_result_sha256:createHash('sha256').update(bytes).digest('hex'),
    cases,summary:{workflow_outcomes_passed:cases.filter(c=>c.checks.workflow_pass).length,cases:3,document_checks_passed:cases.flatMap(c=>Object.values(c.checks.draft_checks)).filter(Boolean).length,document_checks:15,strict_saved_answer_checks_passed:cases.filter(c=>c.checks.all_pass).length,new_ai_calls:0,added_ai_cost_usd:0},
    limitations:['Diego raw Guests field is still omitted in the saved AI answer; the existing derived count remains correct.','Jordan intentionally has only two ready assets until the host allergy detail is resolved.','These are known saved cases used to develop the repair. Unseen-event accuracy remains unproven.']};
  if(process.argv.includes('--record'))await writeFile(new URL('evaluation/final-readiness-v1/results/repair-2026-10-13.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result,null,2));
}
