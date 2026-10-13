// Deterministic preparation only. Never rewrite the saved model response or
// promote a requested/conflicting detail to an agreed one.
export const APP_NORMALIZATION = 'supported-details-v5';
export const SUPPORTED_DETAILS_V4 = 'supported-details-v4';
export const SUPPORTED_DETAILS_V3 = 'supported-details-v3';
export const SUPPORTED_DETAILS_V2 = 'supported-details-v2';
export const SUPPORTED_DETAILS_V1 = 'supported-details-v1';
export const AS_EXTRACTED = 'as-extracted-v1';
const key = value => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
const usable = detail => detail.value !== null && ['stated', 'agreed'].includes(detail.status);
// A bare occasion describes why people are gathering. Additional words can
// contain a service request, so only complete purpose labels qualify.
export const isEventPurpose = value => /^(?:birthday|anniversary|retirement|graduation|rehearsal|wedding|family|team|corporate|holiday)(?:\s+(?:celebration|dinner|lunch|luncheon|party|gathering|event))?[.!]?$/i.test(String(value ?? '').trim());
const wordingKey = value => key(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.;]+$/, '').trim();
export function configuredBeverageNotes(option, notes, profile) {
  return Boolean(notes?.trim() && profile.beverages[option]?.aliases?.length && [option, ...profile.beverages[option].aliases].some(alias => wordingKey(alias) === wordingKey(notes)));
}

// Only notes already covered by these demo packages can share their price.
// Every clause must match in full: custom drinks, prices and exceptions stay
// blocked for coordinator correction rather than disappearing into free text.
function supportedBeverageNotesV1(option, notes) {
  if (!notes?.trim()) return true;
  const clauses = notes.split(/[.;\n]+/).map(key).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.every(clause => {
    if (/^(?:with )?(?:juice and soda|soft drinks|nonalcoholic drinks|non-alcoholic drinks) for (?:the )?children$/.test(clause)) return true;
    if (/^no (?:spirits or cocktails|cocktails or spirits)$/.test(clause)) return true;
    return option === 'Beer and wine service' && /^beer and wine (?:will only be served to|only for) guests confirmed to be 21 or older$/.test(clause);
  });
}

// Keep v1 available for historical evaluations. Current preparation recognizes
// included soft-drink instructions, but never invents a package from free text
// or silently accepts a custom price, alcoholic addition or exception.
const softDrinks = '(?:juice and soda|soda and juice|juice|soda|soft drinks|non-?alcoholic drinks)';
const recipients = '(?:everyone|everybody|all guests(?: and children)?|(?:all )?guests and children|(?:the )?children)';
const includedSoftDrinks = new RegExp(`^(?:with )?${softDrinks} for ${recipients}$`);
const noAlcohol = /^(?:with )?no alcohol$/;
function supportedBeverageNotesV2(option, notes) {
  if (!notes?.trim()) return true;
  const clauses = notes.split(/[,.;\n]+/).map(key).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.every(clause => supportedBeverageNotesV1(option, clause) ||
    option === 'Nonalcoholic service' && (includedSoftDrinks.test(clause) || noAlcohol.test(clause)));
}

// Recognize conjunctions between complete, supported instructions. Do not split
// drink names or audiences blindly ("juice and soda", "guests and children"),
// remove unrecognized text, or change the notes saved for the documents.
function supportedCombinedClause(option, clause, accepts = supportedBeverageNotesV2) {
  const memo = new Map();
  const matchFrom = start => {
    if (memo.has(start)) return memo.get(start);
    if (accepts(option, clause.slice(start))) return true;
    for (let split = clause.indexOf(' and ', start); split !== -1; split = clause.indexOf(' and ', split + 5)) {
      if (accepts(option, clause.slice(start, split)) && matchFrom(split + 5)) {
        memo.set(start, true);
        return true;
      }
    }
    memo.set(start, false);
    return false;
  };
  return matchFrom(0);
}

export function supportedBeverageNotes(option, notes, policy = APP_NORMALIZATION) {
  if (policy === SUPPORTED_DETAILS_V1 || policy === AS_EXTRACTED) return supportedBeverageNotesV1(option, notes);
  if (policy === SUPPORTED_DETAILS_V2) return supportedBeverageNotesV2(option, notes);
  if (!notes?.trim()) return true;
  const clauses = notes.split(/[,.;\n]+/).map(key).filter(Boolean);
  if (!clauses.length) return false;
  if (policy === APP_NORMALIZATION) {
    const accepts = (option, clause) => supportedBeverageNotesV2(option, clause) ||
      option === 'Beer and wine service' && /^only for guests confirmed to be 21 or older$/.test(clause);
    // A conjunction following a comma/semicolon joins instructions. Preserve
    // its exact text in the document; remove it only for clause validation.
    return clauses.every((clause, index) => supportedCombinedClause(option, index ? clause.replace(/^and\s+/, '') : clause, accepts));
  }
  return clauses.length > 0 && clauses.every(clause => supportedCombinedClause(option, clause));
}

// Match a whole configured option before its note separator, including labels
// that contain punctuation themselves. Do not identify packages by a substring
// or discard any remainder: every note still has to pass the existing checks.
function beverageOptionParts(raw, profile, policy) {
  if (![APP_NORMALIZATION, SUPPORTED_DETAILS_V4].includes(policy)) {
    const parts = raw.match(/^([^,;.\n]+)(?:[,;.\n]\s*([\s\S]*))?$/);
    return parts ? Object.keys(profile.beverages).filter(option => key(option) === key(parts[1]))
      .map(option => ({option, notes:parts[2]?.trim()})) : [];
  }
  return Object.keys(profile.beverages).flatMap(option => {
    const prefix = option.trim().split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const separator = policy === APP_NORMALIZATION ? '(?:\\s*[,;:.\\n—–-]\\s*|\\s+)' : '\\s*[,;:.\\n—–-]\\s*';
    const match = raw.trim().match(new RegExp(`^${prefix}(?:${separator}([\\s\\S]*))?$`, 'i'));
    return match ? [{option, notes:match[1]?.trim()}] : [];
  });
}

export function normalizePackageRecord(record, profile, corrections = {}, policy = APP_NORMALIZATION) {
  const result = structuredClone(record), fields = result.fields;
  const pending = field => [...result.pending_changes, ...result.open_questions].some(item => item.field === field) && !fields[field].resolved;
  if (policy === APP_NORMALIZATION && usable(fields.special) && !pending('special') && isEventPurpose(fields.special.value)) {
    fields.special.preparation = {kind:'event_purpose', original_value:fields.special.value,
      description:'This is the event purpose, not an additional restaurant service. The original wording is retained.'};
  }
  const categories = ['guest_13_plus_count', 'child_count'];
  if (fields.guest_count.status === 'unknown' && fields.guest_count.value === null && !Object.hasOwn(corrections, 'guest_count') &&
      !['guest_count', ...categories].some(pending) && categories.every(field => usable(fields[field]))) {
    const total = categories.reduce((sum, field) => sum + fields[field].value, 0);
    if (Number.isSafeInteger(total) && total > 0 && total <= 10000) {
      fields.guest_count = {
        value: total, status: categories.every(field => fields[field].status === 'agreed') ? 'agreed' : 'stated',
        evidence: [...new Map(categories.flatMap(field => fields[field].evidence).map(item => [JSON.stringify(item), item])).values()],
        preparation: {kind: 'calculated_total', source_fields: categories, original_value: null,
          description: `Calculated from ${fields.guest_13_plus_count.value} guests + ${fields.child_count.value} children = ${total} people. The total was not supplied by the AI.`}
      };
    }
  }
  const venue = Object.hasOwn(profile.venues, fields.venue.value) ? profile.venues[fields.venue.value] : null;
  if (venue && usable(fields.setup)) {
    const matches = venue.setups.filter(value => key(value) === key(fields.setup.value));
    if (matches.length === 1 && matches[0] !== fields.setup.value) {
      const original = fields.setup.value;
      fields.setup.value = matches[0];
      fields.setup.preparation = {kind: 'equivalent_setup', original_value: original,
        description: 'Matched the saved table setup using capitalization and spacing only.'};
    }
  }
  if (usable(fields.beverage)) {
    const raw = fields.beverage.value;
    // Full-string, coordinator-saved aliases only. Extra drinks or conditions
    // never match a substring; the original wording remains visible in notes.
    const configured = [APP_NORMALIZATION, SUPPORTED_DETAILS_V4, SUPPORTED_DETAILS_V3].includes(policy) ? Object.entries(profile.beverages).filter(([option, choice]) =>
      (wordingKey(option) === wordingKey(raw) || choice.aliases?.some(alias => wordingKey(alias) === wordingKey(raw))) &&
      (!fields.beverage.notes || configuredBeverageNotes(option, fields.beverage.notes, profile))) : [];
    if (configured.length === 1 && configured[0][1].aliases?.length && raw !== configured[0][0]) {
      fields.beverage.value = configured[0][0];
      fields.beverage.notes = raw;
      fields.beverage.preparation = {kind: 'configured_beverage', original_value: raw,
        description: 'Matched equivalent wording saved by the coordinator in Restaurant settings. The full original drink instruction is kept below.'};
      return result;
    }
    const matches = beverageOptionParts(raw, profile, policy);
    if (matches.length === 1) {
      const {option} = matches[0];
      const notes = [matches[0].notes, fields.beverage.notes?.trim()].filter(Boolean).join('\n');
      if (supportedBeverageNotes(option, notes, policy) && (raw !== option || notes !== (fields.beverage.notes ?? ''))) {
        fields.beverage.value = option;
        if (notes) fields.beverage.notes = notes;
        fields.beverage.preparation = {kind: 'supported_beverage', original_value: raw,
          description: 'Matched the saved drink option. Included drink details are kept separately as notes.'};
      }
    }
  }
  return result;
}
