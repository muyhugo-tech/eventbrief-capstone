import * as nativeFs from 'node:fs/promises';
import { join } from 'node:path';
import { fingerprint, validateRestaurant } from './event-package.mjs';
import { SourceConflictError } from './package-workspace.mjs';

const categories = ['guest_13_plus_count', 'child_count'];
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => plain(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const text = (value, label, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`${label} needs text (up to ${max} characters).`);
  return value.trim();
};
const nameKey = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').replace(/[.;]+$/, '').trim();
function lines(value, label, max = 25, allowEmpty = false) {
  if (!Array.isArray(value) || value.length > max || (!allowEmpty && !value.length)) throw new Error(`Add ${label.toLowerCase()} (up to ${max} lines).`);
  const result = value.map(item => text(item, label));
  if (new Set(result.map(nameKey)).size !== result.length) throw new Error(`${label} has repeated entries.`);
  return result;
}
function prices(value) {
  if (!exact(value, categories) || categories.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 1000000)) throw new Error('Enter prices from $0 to $10,000 with at most two decimal places.');
  return Object.fromEntries(categories.map(key => [key, value[key]]));
}
function choices(value, label, build) {
  if (!plain(value) || !Object.keys(value).length || Object.keys(value).length > 20) throw new Error(`Keep between 1 and 20 ${label}.`);
  const seen = new Set();
  return Object.fromEntries(Object.entries(value).map(([key, option]) => {
    const name = text(key, 'Name', 100), normalized = nameKey(name);
    if (['__proto__', 'constructor', 'prototype'].includes(normalized) || seen.has(normalized)) throw new Error(`Use different, ordinary names for ${label}.`);
    seen.add(normalized);
    return [name, build(option)];
  }));
}

export function settingsFromProfile(profile) {
  return {
    venues: structuredClone(profile.venues), menus: structuredClone(profile.menus),
    beverages: Object.fromEntries(Object.entries(profile.beverages).map(([name, option]) => [name, { ...structuredClone(option), billing: option.billing ?? 'per_person', aliases: option.aliases ?? [] }]))
  };
}

// Only operational choices are editable. Prompt, schema, readiness policy,
// restaurant identity and the original extraction profile stay immutable.
export function validateSettings(value, baseline) {
  if (!exact(value, ['venues', 'menus', 'beverages'])) throw new Error('Save spaces, menus and drinks together.');
  const venues = choices(value.venues, 'spaces', option => {
    if (!exact(option, ['capacity', 'setups']) || !Number.isSafeInteger(option.capacity) || option.capacity < 1 || option.capacity > 10000) throw new Error('Each space needs a whole-number capacity from 1 to 10,000.');
    return { capacity: option.capacity, setups: lines(option.setups, 'Table setups') };
  });
  const beverages = choices(value.beverages, 'drink options', option => {
    if (!exact(option, ['description', 'prices_cents', 'billing', 'aliases']) || !['per_person', 'pay_separately'].includes(option.billing)) throw new Error('Choose how each drink option is charged.');
    const cost = prices(option.prices_cents);
    if (option.billing === 'pay_separately' && categories.some(key => cost[key] !== 0)) throw new Error('Drinks paid separately cannot also have a package price.');
    return { description: text(option.description, 'Drink details'), prices_cents: cost, billing: option.billing, aliases: lines(option.aliases, 'Equivalent drink wording', 12, true) };
  });
  const beverageNames = new Set(Object.keys(beverages));
  const wording = new Set(Object.keys(beverages).map(nameKey));
  for (const option of Object.values(beverages)) for (const alias of option.aliases) {
    const normalized = nameKey(alias);
    if (wording.has(normalized)) throw new Error('Each drink name or equivalent wording must point to one option only.');
    wording.add(normalized);
  }
  const menus = choices(value.menus, 'menus', option => {
    if (!exact(option, ['description', 'courses', 'prices_cents', 'beverages'])) throw new Error('Each menu needs a description, dishes, prices and allowed drinks.');
    const allowed = lines(option.beverages, 'Allowed drinks', 20);
    if (allowed.some(name => !beverageNames.has(name))) throw new Error('Choose saved drink options for each menu.');
    return { description: text(option.description, 'Menu description'), courses: lines(option.courses, 'Menu dishes'), prices_cents: prices(option.prices_cents), beverages: allowed };
  });
  validateRestaurant({...baseline, venues, menus, beverages});
  return {venues, menus, beverages};
}

export function applyRestaurantSettings(baseline, settings) {
  if (!settings) return structuredClone(baseline);
  const normalized = validateSettings(settings, baseline);
  // Omit default-only additions so an unchanged save keeps old fingerprints.
  for (const option of Object.values(normalized.beverages)) {
    if (option.billing === 'per_person') delete option.billing;
    if (!option.aliases.length) delete option.aliases;
  }
  return {...structuredClone(baseline), ...normalized};
}

export async function createRestaurantSettingsStore(directory, baseline, {fs = nativeFs} = {}) {
  await fs.mkdir(directory, {recursive: true});
  const initial = {revision: 0, settings: settingsFromProfile(baseline), saved_at: null, reason: null};
  async function load() {
    const names = (await fs.readdir(directory)).sort();
    if (!names.length) return structuredClone(initial);
    if (names.some((name, index) => name !== `${String(index + 1).padStart(8, '0')}.json`)) throw new Error('The restaurant settings history needs checking.');
    const saved = JSON.parse(await fs.readFile(join(directory, names.at(-1)), 'utf8'));
    if (saved.revision !== names.length || saved.baseline_hash !== fingerprint(baseline) || !Number.isFinite(Date.parse(saved.saved_at))) throw new Error('The restaurant settings do not match this demo.');
    validateSettings(saved.settings, baseline);
    return saved;
  }
  async function save(settings, expectedRevision, reason) {
    const normalized = validateSettings(settings, baseline), note = text(reason, 'What changed', 500), previous = await load();
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== previous.revision) throw new SourceConflictError('Settings changed in another browser. Reload settings before saving your changes.');
    if (fingerprint(normalized) === fingerprint(previous.settings)) return previous;
    if (previous.revision >= 200) throw new Error('This demo has reached its limit of 200 settings changes.');
    const saved = {revision: previous.revision + 1, settings: normalized, reason: note, saved_at: new Date().toISOString(), baseline_hash: fingerprint(baseline)};
    let file;
    try {
      file = await fs.open(join(directory, `${String(saved.revision).padStart(8, '0')}.json`), 'wx', 0o600);
      await file.writeFile(JSON.stringify(saved) + '\n'); await file.sync();
    } catch (error) {
      if (error.code === 'EEXIST') throw new SourceConflictError('Another browser saved settings first. Reload settings and try again.');
      throw error;
    } finally { if (file) await file.close(); }
    return saved;
  }
  return {load, save};
}
