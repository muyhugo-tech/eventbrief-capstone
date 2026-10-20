import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluationCases, runEvaluation, scoreEvaluation} from '../lib/demo-evaluation.mjs';
import {prepareEventPackage} from '../lib/event-package.mjs';

test('runnable replay evaluates all five actual draft packages without a model call', async () => {
  const report = await runEvaluation({caseId:'all',mode:'replay',runLive:() => assert.fail('Replay must not call AI')});
  assert.equal(report.passed,5); assert.equal(report.failed,0); assert.equal(report.errors,0);
  assert.equal(report.results.reduce((sum,r) => sum+r.total_checks,0),111);
  assert.equal(report.results[3].drafts.filter(d => d.state === 'Blocked').length,3);
});

test('checker fails a stale count, missing draft, wrong allergy decision and lost drink details', () => {
  for (const [id,mutate,name] of [
    ['count-change', d => {d.record.fields.guest_13_plus_count.value = 24;}, 'Guests'],
    ['birthday', d => {d.documents.pop();}, 'Five distinct drafts'],
    ['allergy', d => {d.documents.find(d => d.id === 'guest').state = 'ready_for_review';}, 'Guest event plan — decision'],
    ['allergy', d => {d.documents.find(d => d.id === 'staff').blockers = [{field:'menu'}];}, 'Staff event plan — asks for the missing allergy'],
    ['drinks', d => {d.documents.find(d => d.id === 'quote').rows.find(r => r.field === 'beverage').value = 'Beer and wine service';}, 'Guest quote — correct details']
  ]) {
    const entry = evaluationCases.find(c => c.id === id), data = prepareEventPackage(entry);
    mutate(data);
    const scored = scoreEvaluation(entry,data);
    assert.equal(scored.status,'failed',name);
    assert.equal(scored.checks.find(c => c.name === name).passed,false,name);
  }
});

test('live evaluation uses the new answer, never silently falls back to the passing saved answer', async () => {
  const report = await runEvaluation({caseId:'birthday',mode:'live',runLive:async () => {throw new Error('private provider detail');}});
  assert.equal(report.passed,0); assert.equal(report.errors,1);
  assert.equal(report.results[0].checks.length,0);
  assert.doesNotMatch(JSON.stringify(report),/private provider detail/);
});

test('invalid tests and bulk paid requests are rejected before provider execution', async () => {
  for (const args of [{caseId:'unknown',mode:'live'},{caseId:'all',mode:'live'},{caseId:'birthday',mode:'unknown'}]) {
    await assert.rejects(runEvaluation({...args,runLive:() => assert.fail('Unexpected model call')}));
  }
});
