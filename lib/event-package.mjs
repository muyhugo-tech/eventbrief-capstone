import { createHash } from 'node:crypto';
import { applyPackageCorrections, FIELD_DEFINITIONS, GUEST_CATEGORIES, validatePackageRecord } from './package-contract.mjs';
import { GUEST_DIETARY_POLICY, PROFILE_READINESS_POLICY, hostRaisedDietary } from './guest-dietary-policy.mjs';
import { kitchenPrep } from './kitchen-prep.mjs';
import { DRAFT_WORKFLOW, DRAFT_WORKFLOW_V1, LEGACY_WORKFLOW, applyDraftWorkflow, optionalDraftField, draftNotices } from './draft-workflow.mjs';
import { APP_NORMALIZATION, AS_EXTRACTED, SUPPORTED_DETAILS_V1, SUPPORTED_DETAILS_V2, SUPPORTED_DETAILS_V3, normalizePackageRecord, supportedBeverageNotes, configuredBeverageNotes } from './package-normalization.mjs';

export const DOCUMENTS = [
  { id: 'calendar', title: 'Calendar entry', audience: 'Coordinator draft' },
  { id: 'quote', title: 'Guest quote', audience: 'Guest-facing draft' },
  { id: 'kitchen', title: 'Kitchen sheet', audience: 'Internal · kitchen' },
  { id: 'staff', title: 'Staff event plan', audience: 'Internal · event team' },
  { id: 'guest', title: 'Guest event plan', audience: 'Guest-facing draft' }
];
// Presentation fields are audience-specific. They do not add readiness gates,
// but changes to any displayed detail must invalidate that document's review.
const PRESENTATION_FIELDS = {
  calendar: [],
  quote: ['event_date', 'start_time', 'end_time', 'timezone', 'venue'],
  kitchen: ['end_time', 'venue', 'guest_13_plus_count', 'child_count'],
  staff: ['guest_13_plus_count', 'child_count'],
  guest: ['guest_13_plus_count', 'child_count']
};
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const hasValue = detail => detail.value !== null && detail.status !== 'conflicting';

export function validateRestaurant(profile) {
  if (profile.schema_version !== 'eventbrief.restaurant.v2' || profile.synthetic !== true || profile.currency !== 'USD') {
    throw new Error('Use a versioned fictional USD restaurant profile.');
  }
  if (!profile.id || !profile.version || !profile.name) throw new Error('Restaurant identity is required.');
  if (Object.keys(profile.categories ?? {}).sort().join('|') !== [...GUEST_CATEGORIES].sort().join('|')) throw new Error('Use Guests and Children (0–12) categories.');
  for (const key of ['opening_time', 'closing_time']) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(profile[key])) throw new Error('Invalid restaurant operating hours.');
  }
  if (minutes(profile.opening_time) >= minutes(profile.closing_time)) throw new Error('This demo supports same-day service only.');
  if (profile.timezone !== 'America/Los_Angeles') throw new Error('This fictional profile uses America/Los_Angeles.');
  for (const venue of Object.values(profile.venues)) {
    if (!Number.isInteger(venue.capacity) || venue.capacity < 1 || !Array.isArray(venue.setups)) throw new Error('Invalid venue policy.');
  }
  for (const choices of [profile.menus, profile.beverages]) {
    for (const option of Object.values(choices)) {
      if (option.billing && !['per_person', 'pay_separately'].includes(option.billing)) throw new Error('Unknown drink billing rule.');
      for (const field of GUEST_CATEGORIES) {
        const price = option.prices_cents[field];
        if (!Number.isSafeInteger(price) || price < 0) throw new Error('Prices must be nonnegative integer cents.');
        if (option.billing === 'pay_separately' && price !== 0) throw new Error('Separate drink charges must not also have a package price.');
      }
    }
  }
  for (const { id } of DOCUMENTS) {
    const rule = profile.readiness[id];
    if (!rule || !Array.isArray(rule.required) || !Array.isArray(rule.agreed)) throw new Error(`Missing readiness rule: ${id}`);
    if (rule.required.some(field => !Object.hasOwn(FIELD_DEFINITIONS, field))) throw new Error('Unknown readiness field.');
    if (rule.agreed.some(field => !rule.required.includes(field))) throw new Error('Agreed fields must also be required.');
  }
  return profile;
}

function policyIssues(record, profile, normalizationPolicy) {
  const fields = record.fields;
  const value = name => fields[name].value;
  const present = name => hasValue(fields[name]);
  const issues = [];
  const add = (affected, reason, rule) => issues.push({ fields: affected, reason, rule });
  if (present('timezone') && value('timezone') !== profile.timezone) {
    add(['timezone'], `Use the restaurant timezone: ${profile.timezone}.`, 'timezone');
  }
  if (present('start_time') && (minutes(value('start_time')) < minutes(profile.opening_time) || minutes(value('start_time')) >= minutes(profile.closing_time))) {
    add(['start_time'], `Start time is outside fictional service hours (${profile.opening_time}–${profile.closing_time}).`, 'opening_time');
  }
  if (present('end_time') && (minutes(value('end_time')) > minutes(profile.closing_time) || minutes(value('end_time')) <= minutes(profile.opening_time))) {
    add(['end_time'], `End time is outside fictional service hours (${profile.opening_time}–${profile.closing_time}).`, 'closing_time');
  }
  if (present('start_time') && present('end_time') && minutes(value('end_time')) <= minutes(value('start_time'))) {
    add(['start_time', 'end_time'], 'End time must follow the start time on the same day.', 'same_day_service');
  }
  const venue = Object.hasOwn(profile.venues, value('venue')) ? profile.venues[value('venue')] : null;
  if (present('venue') && !venue) add(['venue'], 'This venue is not defined in the fictional restaurant profile.', 'venues');
  if (venue && present('guest_count') && value('guest_count') > venue.capacity) {
    add(['venue', 'guest_count'], `${value('venue')} has a fictional capacity of ${venue.capacity}; ${value('guest_count')} guests exceeds it.`, `venues.${value('venue')}.capacity`);
  }
  if (venue && present('setup') && !venue.setups.includes(value('setup')) && !fields.setup.accept_custom) {
    add(['setup'], 'This setup is not supported for the selected venue in the demo profile.', `venues.${value('venue')}.setups`);
  }
  const categoryFields = GUEST_CATEGORIES;
  if (present('guest_count') && categoryFields.every(present)) {
    const categoryTotal = categoryFields.reduce((sum, field) => sum + value(field), 0);
    if (categoryTotal !== value('guest_count')) {
      add(['guest_count', ...categoryFields], `Pricing categories total ${categoryTotal}, but attendance is ${value('guest_count')}. Reconcile the counts.`, 'categories');
    }
  }
  for (const [field, key] of [['menu', 'menus'], ['beverage', 'beverages']]) {
    if (present(field) && !Object.hasOwn(profile[key], value(field))) add([field], `The selected ${field} is not in the fictional restaurant profile.`, key);
  }
  if (fields.beverage.notes && !supportedBeverageNotes(value('beverage'), fields.beverage.notes, normalizationPolicy) && !([APP_NORMALIZATION, SUPPORTED_DETAILS_V3].includes(normalizationPolicy) && configuredBeverageNotes(value('beverage'), fields.beverage.notes, profile))) {
    add(['beverage'], 'Drink notes include an arrangement without a saved price. Confirm a supported drink option and its included notes.', 'beverage_notes');
  }
  const menu = Object.hasOwn(profile.menus, value('menu')) ? profile.menus[value('menu')] : null;
  if (menu && present('beverage') && !menu.beverages.includes(value('beverage'))) {
    add(['menu', 'beverage'], 'This menu and beverage combination is not supported by the demo profile.', `menus.${value('menu')}.beverages`);
  }
  for (const [field, key] of [['dietary', 'supported_dietary'], ['av', 'supported_av'], ['special', 'supported_special']]) {
    if (present(field) && !profile[key].includes(value(field)) && !fields[field].accept_custom) {
      add([field], `${FIELD_DEFINITIONS[field].label} needs coordinator review: this request is outside the supported demo options.`, key);
    }
  }
  return issues;
}

function quoteFor(record, profile) {
  const fields = record.fields;
  const lines = [];
  for (const [kind, key] of [['menu', 'menus'], ['beverage', 'beverages']]) {
    const selected = fields[kind].value;
    if (kind === 'beverage' && profile.beverages[selected].billing === 'pay_separately') continue;
    for (const category of GUEST_CATEGORIES) {
      const quantity = fields[category].value;
      if (quantity === 0 || quantity === null) continue;
      const unit = profile[key][selected].prices_cents[category];
      const amount = quantity * unit;
      if (!Number.isSafeInteger(amount)) throw new Error('Quote amount exceeds safe integer arithmetic.');
      lines.push({
        description: `${selected} · ${profile.categories[category].label}`,
        quantity, unit_cents: unit, amount_cents: amount,
        source_fields: [kind, category],
        rule: `${key}.${selected}.prices_cents.${category}`,
        calculation: `${quantity} × ${unit} cents = ${amount} cents`
      });
    }
  }
  const total = lines.reduce((sum, line) => sum + line.amount_cents, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Quote total exceeds safe integer arithmetic.');
  const separateDrinks = profile.beverages[fields.beverage.value].billing === 'pay_separately';
  const provisional = fields.guest_13_plus_count.preparation?.kind === 'guest_total_basis';
  return { currency: 'USD', lines, total_cents: total, ...(provisional ? {provisional: true} : {}), note: separateDrinks
    ? 'Food estimate only. Drinks are billed separately and are not included in this amount.'
    : profile.quote_note, ...(separateDrinks ? {total_label: 'Food estimate · drinks separate', beverages_excluded: true} : {}) };
}

// Retain reviews for documents whose actual rules/content did not change.
// Baseline fingerprints preserve existing reviews; settings-only additions do
// not reset every event. Blockers and normalized field values are hashed below.
function documentProfileRevision(profile, baseline, record, id) {
  if (!baseline) return fingerprint(profile);
  const relevant = p => ({
    name: p.name, version: p.version, categories: p.categories, readiness: p.readiness[id],
    ...(['quote', 'staff'].includes(id) ? {quote_note: p.quote_note,
      menu_prices: p.menus[record.fields.menu.value]?.prices_cents,
      drink_prices: p.beverages[record.fields.beverage.value]?.prices_cents,
      drink_billing: p.beverages[record.fields.beverage.value]?.billing ?? 'per_person'} : {}),
    ...(['quote', 'staff', 'guest'].includes(id) ? {drink_description: p.beverages[record.fields.beverage.value]?.description} : {}),
    ...(['kitchen', 'staff', 'guest'].includes(id) ? {courses: p.menus[record.fields.menu.value]?.courses} : {})
  });
  const baselineHash = fingerprint(baseline), current = relevant(profile);
  return fingerprint(current) === fingerprint(relevant(baseline)) ? baselineHash : fingerprint({baselineHash, settings: current});
}

export function prepareEventPackage({ input, original, profile, baselineProfile = null, restaurantSettings = null, corrections = {}, extraction = null, readinessPolicy = GUEST_DIETARY_POLICY, normalizationPolicy = APP_NORMALIZATION, workflowPolicy = DRAFT_WORKFLOW }) {
  if (![DRAFT_WORKFLOW, DRAFT_WORKFLOW_V1, LEGACY_WORKFLOW].includes(workflowPolicy)) throw new Error('Unknown draft workflow policy.');
  const usableDrafts = workflowPolicy !== LEGACY_WORKFLOW;
  if (![GUEST_DIETARY_POLICY, PROFILE_READINESS_POLICY].includes(readinessPolicy)) throw new Error('Unknown draft readiness policy.');
  validateRestaurant(profile);
  validatePackageRecord(original, input);
  if (![APP_NORMALIZATION, AS_EXTRACTED, SUPPORTED_DETAILS_V1, SUPPORTED_DETAILS_V2, SUPPORTED_DETAILS_V3].includes(normalizationPolicy)) throw new Error('Unknown detail preparation policy.');
  const corrected = applyPackageCorrections(original, corrections);
  const normalized = normalizationPolicy === AS_EXTRACTED ? corrected : normalizePackageRecord(corrected, profile, corrections, normalizationPolicy);
  const record = usableDrafts ? applyDraftWorkflow(normalized, profile, corrections, workflowPolicy) : normalized;
  const issues = policyIssues(record, profile, normalizationPolicy);
  const sourceRevision = fingerprint(input);
  const profileRevision = fingerprint(profile);
  const recordRevision = fingerprint({ sourceRevision, profileRevision, record });
  const unresolved = [
    ...(record.pending_changes ?? []).map(item => ({ ...item, kind: 'pending_change', reason: `${FIELD_DEFINITIONS[item.field].label}: a change to ${item.value} is still requested, not accepted.` })),
    ...(record.open_questions ?? []).map(item => ({ ...item, kind: 'open_question', reason: `${FIELD_DEFINITIONS[item.field].label}: ${item.question}` }))
  ].filter(item => !record.fields[item.field].resolved);
  const documents = DOCUMENTS.map(document => {
    const rules = profile.readiness[document.id];
    const hostDietaryRequired = document.id === 'guest' && readinessPolicy === GUEST_DIETARY_POLICY && hostRaisedDietary(input, original);
    const allRequired = hostDietaryRequired ? [...new Set([...rules.required, 'dietary'])] : rules.required;
    const omitted = usableDrafts ? allRequired.filter(field => optionalDraftField(document.id, field, record, unresolved, hostRaisedDietary(input, original))) : [];
    const required = allRequired.filter(field => !omitted.includes(field));
    const notices = usableDrafts ? draftNotices(document.id, record, omitted) : [];
    const blockers = [];
    for (const item of unresolved.filter(item => required.includes(item.field))) {
      blockers.push({ field: item.field, reason: item.reason, kind: item.kind });
    }
    for (const field of required) {
      const detail = record.fields[field];
      if (!hasValue(detail)) {
        blockers.push({ field, reason: `${FIELD_DEFINITIONS[field].label}: ${detail.status === 'conflicting' ? 'resolve the conflicting information' : 'not supplied'}.` });
      } else if (rules.agreed.includes(field) && detail.status !== 'agreed') {
        blockers.push({ field, reason: `${FIELD_DEFINITIONS[field].label}: agreement is required; current status is ${detail.status}.` });
      } else if (hostDietaryRequired && field === 'dietary' && detail.status === 'requested') {
        blockers.push({ field, reason: 'Dietary requirements: the host’s request still needs confirmation.' });
      }
    }
    for (const issue of issues) {
      const field = issue.fields.find(name => required.includes(name));
      if (field) blockers.push({ field, reason: issue.reason, rule: issue.rule });
    }
    const ready = blockers.length === 0;
    const kitchenPlan = ready && document.id === 'kitchen' ? kitchenPrep(record, profile) : null;
    const dependencies = [...new Set([...allRequired, ...PRESENTATION_FIELDS[document.id]])];
    const displayed = [...new Set([...rules.required, ...PRESENTATION_FIELDS[document.id].filter(field =>
      hasValue(record.fields[field]) && ['stated', 'agreed'].includes(record.fields[field].status)
      && !unresolved.some(item => item.field === field) && !issues.some(issue => issue.fields.includes(field)))])];
    const result = {
      ...document,
      state: ready ? 'ready_for_review' : 'blocked',
      blockers,
      ...(notices.length ? {notices} : {}),
      dependencies,
      // Source changes invalidate prior review; no old approval is carried to a new thread snapshot.
      revision: fingerprint({ sourceRevision, profileRevision: documentProfileRevision(profile, baselineProfile, record, document.id), extraction: extraction?.run_id ?? null, document: document.id, fields: dependencies.map(field => record.fields[field]), blockers, ...(notices.length ? {notices} : {}), ...(document.id === 'kitchen' ? { kitchenPlan } : {}) }),
      ...(document.id === 'kitchen' ? { kitchen_plan: kitchenPlan } : {}),
      rows: ready ? displayed.map(field => ({ field, label: FIELD_DEFINITIONS[field].label, value: record.fields[field].value, status: record.fields[field].status })) : [],
      quote: ready && document.id === 'quote' ? quoteFor(record, profile) : null,
      beverage_note: ready && ['quote', 'staff', 'guest'].includes(document.id) ? profile.beverages[record.fields.beverage.value].description : null,
      ...(ready && ['quote', 'staff', 'guest'].includes(document.id) && record.fields.beverage.notes ? {beverage_notes: record.fields.beverage.notes} : {}),
      menu_courses: ready && ['kitchen', 'staff', 'guest'].includes(document.id) ? profile.menus[record.fields.menu.value].courses : [],
      policy_refs: [`readiness.${document.id}`]
    };
    if (hostDietaryRequired) result.policy_refs.push(GUEST_DIETARY_POLICY);
    if (result.menu_courses.length) result.policy_refs.push(`menus.${record.fields.menu.value}.courses`);
    if (result.beverage_note) result.policy_refs.push(`beverages.${record.fields.beverage.value}.description`);
    if (result.quote) result.policy_refs.push(...result.quote.lines.map(line => line.rule), 'quote_note');
    return result;
  });
  const staffDocument = documents.find(document => document.id === 'staff');
  const quoteDocument = documents.find(document => document.id === 'quote');
  // Staff pricing reuses the same checked quote. No second calculator and no
  // model/profile migration: existing receipts and the paid allowance stay valid.
  staffDocument.staff_pricing = staffDocument.state === 'ready_for_review' && quoteDocument.state === 'ready_for_review'
    ? structuredClone(quoteDocument.quote) : null;
  staffDocument.revision = fingerprint({ revision: staffDocument.revision, staff_sheet: 'v1', pricing: staffDocument.staff_pricing });
  const guestDocument = documents.find(document => document.id === 'guest');
  guestDocument.revision = fingerprint({ revision: guestDocument.revision, guest_sheet: 'v1' });
  return {
    schema_version: 'eventbrief.prepared-package.v1',
    mode: extraction?.mode ?? 'authored_reference',
    label: extraction ? (extraction.mode === 'simulated' ? 'Simulated provider · no AI call' : 'AI extraction · human review required') : 'Authored demo · no AI call',
    extraction,
    scenario_id: input.id,
    source_revision: sourceRevision,
    profile_revision: profileRevision,
    ...(restaurantSettings ? {restaurant_settings: restaurantSettings} : {}),
    readiness_policy: readinessPolicy,
    normalization_policy: normalizationPolicy,
    workflow_policy: workflowPolicy,
    record_revision: recordRevision,
    input: structuredClone(input),
    profile: structuredClone(profile),
    original_record: structuredClone(original),
    record,
    corrections: structuredClone(corrections),
    issues,
    unresolved,
    documents,
    note: 'All event details, source messages, restaurant rules and prices are fictional. Readiness is permission to review a draft, not a booking or business commitment.'
  };
}
