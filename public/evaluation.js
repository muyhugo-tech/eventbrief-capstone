import {demoExamples} from './demo-examples.mjs';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const display = value => value === null || value === undefined ? 'Missing' : typeof value === 'boolean' ? (value ? 'Yes' : 'No')
  : typeof value === 'object' ? Object.entries(value).map(([key,val]) => `${key}: ${val ?? 'Missing'}`).join('\n') : String(value);
const modeName = report => report.mode === 'live' ? 'New AI answer' : 'Saved AI answer replay';
let cases = demoExamples.map(c => ({...c, expected:c.checks, conversation:c.text}));
let history = [], report = null, live = {}, workspace = null, busy = false, loaded = false;
let results = new Map();

function render() {
  $('#run-all-tests').disabled = busy || !loaded;
  $('#refresh-tests').disabled = busy;
  $('#download-report').disabled = !report;
  $('#evaluation-budget').textContent = !loaded ? 'Checking the shared AI allowance…' : !live.ready ? 'Live AI is unavailable. Free replay tests still work.'
    : `${live.remaining} new AI ${live.remaining === 1 ? 'call remains' : 'calls remain'} for all visitors. At zero, new AI tests stop; free replays still work.`;
  $('#evaluation-cases').innerHTML = cases.map(entry => {
    const result = results.get(entry.id);
    const label = result ? ({passed:'PASS',failed:'FAIL',error:'ERROR'})[result.status] : 'NOT RUN';
    return `<article class="evaluation-case" id="test-${escape(entry.id)}">
      <div class="evaluation-case-heading"><h3>${escape(entry.title)}</h3><span class="evaluation-status ${escape(result?.status ?? '')}">${label}</span></div>
      <h4>Expected result</h4><ul>${entry.expected.map(text => `<li>${escape(text)}</li>`).join('')}</ul>
      <div class="evaluation-actions"><button class="button secondary" data-agent-case="${escape(entry.id)}" ${busy || !loaded ? 'disabled' : ''}>Try this case in the agent</button><button class="button secondary" data-run="${escape(entry.id)}" ${busy || !loaded ? 'disabled' : ''}>Run test — free replay</button>
      <button class="text-button" data-live="${escape(entry.id)}" ${busy || !loaded || !live.ready || live.remaining < 1 || live.paused || live.in_flight ? 'disabled' : ''}>Run new AI test — 1 call</button></div>
      <details class="evaluation-conversation"><summary>Read the test conversation</summary><pre>${escape(entry.conversation)}</pre></details>
      ${result ? `<div class="evaluation-result"><h4>Actual result</h4>${result.error ? `<p class="error">${escape(result.error)}</p>` : `
      <p>${result.passed_checks} of ${result.total_checks} checks passed. ${report?.mode === 'live' ? 'Fresh AI answer, checked automatically.' : 'Saved AI answer, processed and checked again.'}</p>
      <ul class="evaluation-drafts">${result.drafts.map(d => `<li><strong>${escape(d.title)}:</strong> ${escape(d.state)}</li>`).join('')}</ul>
      <details ${result.status === 'failed' ? 'open' : ''}><summary>See expected vs actual — ${result.total_checks} checks</summary>
      <div class="evaluation-table-wrap"><table><thead><tr><th scope="col">Check</th><th scope="col">Expected</th><th scope="col">Actual</th><th scope="col">Result</th></tr></thead><tbody>
      ${result.checks.map(c => `<tr class="${c.passed ? '' : 'check-failed'}"><th scope="row">${escape(c.name)}</th><td>${escape(display(c.expected))}</td><td>${escape(display(c.actual))}</td><td>${c.passed ? 'PASS' : 'FAIL'}</td></tr>`).join('')}</tbody></table></div></details>`}</div>` : ''}
    </article>`;
  }).join('');
  if (report) {
    $('#report-heading').textContent = `${report.passed} passed · ${report.failed} failed · ${report.errors} errors`;
    $('#report-description').textContent = `${modeName(report)} · ${report.results.length} ${report.results.length === 1 ? 'case' : 'cases'} · ${new Date(report.finished_at).toLocaleString()}. A blocked allergy draft is the expected decision.`;
  }
  $('#evaluation-history').innerHTML = history.length ? `<ol>${history.map(item => `<li><button class="text-button" data-report="${escape(item.id)}">${escape(new Date(item.finished_at).toLocaleString())} — ${escape(modeName(item))}: ${item.passed} passed, ${item.failed} failed, ${item.errors} errors</button></li>`).join('')}</ol>` : '<p>No saved runs yet.</p>';
}
function selectReport(value) { report = value; results = new Map(value.results.map(r => [r.case_id,r])); render(); }
function notice(text, error = false) { $('#evaluation-notice').textContent = text; $('#evaluation-notice').className = error ? 'error' : 'notice'; }
async function load() {
  busy = true; render();
  try {
    const response = await fetch('/api/package/tests', {cache:'no-store'});
    if (!response.ok) throw new Error('Saved tests could not load. Click Refresh saved results to try again.');
    const data = await response.json();
    cases = data.cases; history = data.history; live = data.live; workspace = data.workspace; loaded = true;
    if (history.length) selectReport(history[0]);
    notice(history.length ? 'Saved results loaded. Run a test to create a new checked result.' : 'Ready. Choose Run all 5 tests to start.');
  } catch (error) { notice(error.message, true); }
  finally { busy = false; render(); }
}
async function run(caseId, mode) {
  if (busy || !loaded) return;
  busy = true; render();
  notice(mode === 'live' ? 'The AI is reading the conversation. Then we will check and save its answer. This can take a minute.'
    : 'Running the saved AI answers through the current app and checking the expected results…');
  try {
    const response = await fetch('/api/package/tests', {method:'POST', headers:{'Content-Type':'application/json',
      ...(workspace ? {'X-EventBrief-Workspace':workspace} : {})}, body:JSON.stringify({case_id:caseId,mode})});
    const data = await response.json();
    if (data.report) selectReport(data.report); // Keep downloadable evidence even if saving failed.
    if (!response.ok || !data.saved) throw new Error(data.error || 'The test result could not be saved.');
    live = data.live; history = [data.report,...history].slice(0,10);
    window.dispatchEvent(new CustomEvent('eventbrief:allowance',{detail:live}));
    notice(`Saved: ${data.report.passed} passed, ${data.report.failed} failed, ${data.report.errors} errors. Open “See expected vs actual” under a test to inspect each check.`, Boolean(data.report.failed || data.report.errors));
  } catch (error) { notice(error.message || 'The request did not finish. Refresh saved results before trying another paid call.',true); }
  finally { busy = false; render(); }
}
$('#run-all-tests').addEventListener('click', () => run('all','replay'));
$('#refresh-tests').addEventListener('click', load);
$('#evaluation-cases').addEventListener('click', event => {
  const agentCase = event.target.closest('[data-agent-case]');
  if (agentCase) window.dispatchEvent(new CustomEvent('eventbrief:open-case',{detail:{id:agentCase.dataset.agentCase}}));
  const replay = event.target.closest('[data-run]'), fresh = event.target.closest('[data-live]');
  if (replay) run(replay.dataset.run,'replay');
  if (fresh) run(fresh.dataset.live,'live');
});
window.addEventListener('eventbrief:allowance', event => {live = event.detail; render();});
$('#evaluation-history').addEventListener('click', event => {
  const target = event.target.closest('[data-report]');
  if (target) { selectReport(history.find(r => r.id === target.dataset.report)); notice('Showing a saved test run. No AI call was made.'); }
});
$('#download-report').addEventListener('click', () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `events-made-easy-tests-${report.id}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
render();
load();
