// Predeclared saved-result checks. No provider, network or API key.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareEventPackage} from '../lib/event-package.mjs';
import {pastedInput} from '../lib/package-workspace.mjs';
import {standaloneDocument} from '../public/package-render.mjs';
import {calendarFile} from '../public/workspace-calendar.mjs';
const root = new URL('../', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const protocol = await read('evaluation/new-event-v4/protocol.json');

export function checkSofiaEvent(data) {
  const f = data.record.fields, raw = data.original_record.fields, e = protocol.expected;
  const docs = Object.fromEntries(data.documents.map(d => [d.id,d]));
  const ready = id => docs[id].state === 'ready_for_review';
  const html = id => ready(id) ? standaloneDocument(docs[id], data, false) : '';
  const matches = (id, fields) => fields.every(field => docs[id].rows.some(r => r.field === field && r.value === e[field]));
  const drinks = id => /juice/i.test(html(id)) && /soda/i.test(html(id)) && /no alcohol/i.test(html(id));
  let ics = '';
  try { ics = calendarFile(docs.calendar, data).replace(/\r\n /g, ''); } catch { /* Score failure instead of aborting. */ }
  const schedule = ['event_date','start_time','end_time','timezone','venue'];
  const counts = ['guest_count','guest_13_plus_count','child_count'];
  const checks = {
    latest_counts:counts.every(k => f[k].value === e[k]),
    source_counts:counts.every(k => raw[k].value === e[k]),
    accepted_arrangements:e.agreed_fields.every(k => f[k].status === 'agreed'),
    known_details:['host_name',...schedule,'menu','beverage'].every(k => f[k].value === e[k]),
    raw_unknowns:e.raw_unknown_fields.every(k => raw[k].value === null && raw[k].status === 'unknown' && raw[k].evidence.length === 0),
    optional_stays_unknown:e.raw_unknown_fields.filter(k => !['end_time','timezone'].includes(k)).every(k => f[k].value === null && f[k].status === 'unknown'),
    labelled_end_default:f.end_time.preparation?.kind === 'default_duration' && f.end_time.preparation.hours === 4 && f.end_time.evidence.length === 0 && data.documents.every(d => (d.notices ?? []).some(n => n.includes('4 hours after'))),
    restaurant_timezone:f.timezone.preparation?.kind === 'restaurant_default',
    no_open_items:data.record.pending_changes.length === 0 && data.record.open_questions.length === 0,
    no_corrections:Object.keys(data.corrections).length === 0,
    no_obsolete_count:data.documents.every(d => !/\b28\s+(?:guests|people)\b/i.test(html(d.id)))
  };
  const quantities = docs.kitchen.kitchen_plan?.sections.flatMap(s => s.lines).map(l => l.quantity);
  const draftChecks = {
    calendar:ready('calendar') && matches('calendar',schedule) && ics.includes('DTSTART:'+e.calendar_start_utc) && ics.includes('DTEND:'+e.calendar_end_utc) && ics.includes('STATUS:TENTATIVE') && ics.includes('4 hours after'),
    quote:ready('quote') && matches('quote',counts) && docs.quote.quote?.total_cents === e.quote_total_cents && drinks('quote'),
    kitchen:ready('kitchen') && matches('kitchen',counts) && docs.kitchen.kitchen_plan?.calculated === true && JSON.stringify(quantities) === JSON.stringify(e.kitchen_quantities),
    staff:ready('staff') && matches('staff',[...schedule,...counts]) && drinks('staff'),
    guest:ready('guest') && matches('guest',[...schedule,...counts]) && drinks('guest') && /Thank you for choosing/.test(html('guest'))
  };
  return {checks, draft_checks:draftChecks, all_pass:Object.values(checks).every(Boolean) && Object.values(draftChecks).every(Boolean),
    ready_documents:data.documents.filter(d => d.state === 'ready_for_review').length,
    quote_total_cents:docs.quote.quote?.total_cents ?? null,
    documents:data.documents.map(({id,state,blockers}) => ({id,state,blockers}))};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const saved = await read('evaluation/new-event-v4/results/2026-10-13.json');
  const hash = createHash('sha256').update(await readFile(new URL('evaluation/new-event-v4/protocol.json', root))).digest('hex');
  assert.equal(hash, saved.protocol_sha256);
  assert.ok(Date.parse(saved.predeclared_at) < Date.parse(saved.tested_at));
  const data = prepareEventPackage({input:pastedInput(protocol.conversation), original:saved.original_output, profile:saved.profile,
    workflowPolicy:saved.workflow_policy, normalizationPolicy:saved.normalization_policy});
  const result = checkSofiaEvent(data);
  assert.deepEqual(result, saved.automated_checks);
  console.log(JSON.stringify({reproduced:true, ...result, new_ai_calls:0}, null, 2));
}
