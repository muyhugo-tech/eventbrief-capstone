// Deterministic preparation only. Never rewrite the saved model response or
// promote a requested/conflicting detail to an agreed one.
export const APP_NORMALIZATION = 'supported-details-v2';
export const SUPPORTED_DETAILS_V1 = 'supported-details-v1';
export const AS_EXTRACTED = 'as-extracted-v1';
const key = value => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
const usable = detail => detail.value !== null && ['stated', 'agreed'].includes(detail.status);

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
export function supportedBeverageNotes(option, notes, policy = APP_NORMALIZATION) {
  if (policy === SUPPORTED_DETAILS_V1 || policy === AS_EXTRACTED) return supportedBeverageNotesV1(option, notes);
  if (!notes?.trim()) return true;
  const clauses = notes.split(/[,.;\n]+/).map(key).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.every(clause => supportedBeverageNotesV1(option, clause) ||
    option === 'Nonalcoholic service' && (includedSoftDrinks.test(clause) || noAlcohol.test(clause)));
}

export function normalizePackageRecord(record, profile, corrections = {}, policy = APP_NORMALIZATION) {
  const result = structuredClone(record), fields = result.fields;
  const pending = field => [...result.pending_changes, ...result.open_questions].some(item => item.field === field) && !fields[field].resolved;
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
    const parts = raw.match(/^([^,;.\n]+)(?:[,;.\n]\s*([\s\S]*))?$/);
    const matches = parts ? Object.keys(profile.beverages).filter(option => key(option) === key(parts[1])) : [];
    if (matches.length === 1) {
      const option = matches[0];
      const notes = [parts[2]?.trim(), fields.beverage.notes?.trim()].filter(Boolean).join('\n');
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
