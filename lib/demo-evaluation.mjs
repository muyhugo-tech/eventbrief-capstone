import * as nativeFs from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DOCUMENTS, fingerprint, prepareEventPackage} from './event-package.mjs';
import {renderDocument} from '../public/package-render.mjs';
import {demoExamples} from '../public/demo-examples.mjs';

// Original, uncorrected model answers. Expectations are never sent to the model.
const {cases} = JSON.parse(await nativeFs.readFile(new URL('../evaluation/public-demo-v1/cases.json', import.meta.url), 'utf8'));
export const evaluationCases = cases;
export const evaluationVersion = 'public-demo-v2';
export const evaluationCatalog = demoExamples.map(({id, title, text, checks}) => ({
  id, title, conversation: text, expected: id === 'allergy'
    ? [checks[0], 'Calendar and quote are ready. Kitchen, staff and guest plans are blocked specifically for the unanswered allergy.',
      'A correct allergy block is a passing test; do not invent an allergy answer.']
    : checks
}));
const fieldsFor = entry => ({
  guest_13_plus_count: entry.expected.guests, child_count: entry.expected.children,
  guest_count: entry.expected.guests + entry.expected.children, event_date: entry.expected.date,
  start_time: entry.expected.start, end_time: entry.expected.end,
  timezone: 'America/Los_Angeles', venue: 'Garden Patio', menu: 'Menu 2',
  beverage: entry.id === 'date-change' ? 'Beer and wine service' : 'Nonalcoholic service'
});
const fieldNames = {guest_13_plus_count:'Guests', child_count:'Children (0–12)', guest_count:'Total people',
  event_date:'Event date', start_time:'Start time', end_time:'End time', timezone:'Time zone',
  venue:'Location', menu:'Menu', beverage:'Drinks'};
const stateName = state => state === 'ready_for_review' ? 'Ready for review' : state === 'blocked' ? 'Blocked' : 'Missing';

// Score current application output, not a stored pass flag. Failures remain failures.
export function scoreEvaluation(entry, data) {
  const checks = [];
  const check = (name, expected, actual) => checks.push({
    name, expected, actual: actual ?? null, passed: JSON.stringify(expected) === JSON.stringify(actual)
  });
  const expected = fieldsFor(entry);
  for (const [field, value] of Object.entries(expected)) check(fieldNames[field], value, data.record?.fields[field]?.value);
  check('Five distinct drafts', DOCUMENTS.map(d => d.id), data.documents?.map(d => d.id));
  for (const {id, title} of DOCUMENTS) {
    const doc = data.documents?.find(d => d.id === id), ready = entry.expected.ready.includes(id);
    check(`${title} — decision`, ready ? 'Ready for review' : 'Blocked', stateName(doc?.state));
    if (ready) {
      const required = ['event_date', 'start_time', 'end_time', 'timezone', 'venue',
        ...(id === 'calendar' ? [] : ['guest_count', 'guest_13_plus_count', 'child_count', 'menu']),
        ...(['quote','staff','guest'].includes(id) ? ['beverage'] : [])];
      check(`${title} — correct details`,
        Object.fromEntries(required.map(field => [fieldNames[field], expected[field]])),
        Object.fromEntries(required.map(field => [fieldNames[field], doc?.rows?.find(r => r.field === field)?.value ?? null])));
    } else {
      check(`${title} — asks for the missing allergy`, true,
        Boolean(doc?.blockers?.length && doc.blockers.every(blocker => blocker.field === 'dietary')));
    }
    if (entry.id === 'drinks' && ['quote','staff','guest'].includes(id)) {
      const html = doc ? renderDocument(doc, data, {interactive:false}) : '';
      check(`${title} — juice and soda kept`, true, /juice and soda/i.test(html));
      check(`${title} — no beer or wine kept`, true, /no beer or wine/i.test(html));
    }
  }
  return {
    case_id: entry.id, title: entry.title,
    status: checks.every(c => c.passed) ? 'passed' : 'failed',
    passed_checks: checks.filter(c => c.passed).length, total_checks: checks.length, checks,
    drafts: DOCUMENTS.map(({id,title}) => ({id, title, state:stateName(data.documents?.find(d => d.id === id)?.state)}))
  };
}

export async function runEvaluation({caseId, mode, runLive, revision = 'local'}) {
  if (!['replay','live'].includes(mode) || !cases.some(c => c.id === caseId) && caseId !== 'all' ||
      mode === 'live' && caseId === 'all') throw new Error('Choose one named AI test or replay the five saved answers.');
  const selected = caseId === 'all' ? cases : cases.filter(c => c.id === caseId);
  const report = {schema_version:evaluationVersion, id:randomUUID(), started_at:new Date().toISOString(),
    mode, build_revision:revision, fixture_hash:fingerprint(cases), results:[]};
  for (const entry of selected) {
    try {
      const source = mode === 'live' ? await runLive(entry) : {
        output:entry.original, source:{kind:'saved_real_ai', captured_on:'2026-10-19', model:'gpt-6.1-sol'}
      };
      // Fixed synthetic profile and no coordinator corrections keep runs comparable.
      const data = prepareEventPackage({...entry, original:source.output, corrections:{}});
      report.results.push({...scoreEvaluation(entry, data), source:source.source});
    } catch (error) {
      // Do not expose provider bodies, credentials or raw storage errors in the public report.
      report.results.push({case_id:entry.id, title:entry.title, status:'error', passed_checks:0, total_checks:0, checks:[],
        error:error.evaluationMessage ?? 'The test could not finish. No passing result was recorded. Try a free replay, or check the AI allowance.'});
    }
  }
  report.finished_at = new Date().toISOString();
  report.passed = report.results.filter(r => r.status === 'passed').length;
  report.failed = report.results.filter(r => r.status === 'failed').length;
  report.errors = report.results.filter(r => r.status === 'error').length;
  return report;
}

export function createEvaluationStore(directory, {fs = nativeFs} = {}) {
  return {
    async save(report) {
      await fs.mkdir(directory, {recursive:true});
      const name = `${report.started_at.replace(/[:.]/g,'-')}_${report.id}.json`;
      const file = await fs.open(join(directory,name), 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(report)+'\n'); await file.sync(); }
      finally { await file.close(); }
    },
    async history() {
      let names;
      try { names = await fs.readdir(directory); }
      catch (error) { if (error.code === 'ENOENT') return []; throw error; }
      const safe = /^\d{4}-\d{2}-\d{2}T[\d-]+Z_[a-f0-9-]{36}\.json$/;
      return Promise.all(names.filter(name => safe.test(name)).sort().reverse().slice(0,10)
        .map(async name => JSON.parse(await fs.readFile(join(directory,name),'utf8'))));
    }
  };
}
