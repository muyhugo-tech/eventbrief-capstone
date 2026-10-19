import { rehearsalExample } from './restaurant-example.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories = ['guest_13_plus_count', 'child_count'];
const kinds = ['venues', 'menus', 'beverages'];
const title = {venues:'Spaces', menus:'Menus', beverages:'Drinks'};
const help = {venues:'How many people fit? Which table setups can you offer?', menus:'List the dishes and the price for each person.', beverages:'Choose a package price, or keep drinks separate from the food estimate.'};
const blank = kind => kind === 'venues' ? {capacity:'',setups:[]} : kind === 'menus'
  ? {description:'',courses:[],prices_cents:{guest_13_plus_count:null,child_count:null},beverages:[]}
  : {description:'',prices_cents:{guest_13_plus_count:null,child_count:null},billing:'per_person',aliases:[]};
const list = value => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function cents(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter a price in dollars, such as 64 or 64.50. Use 0 only if it is included for free.');
  return Math.round(Number(value) * 100);
}

export function restaurantSettingsPanel(root, {request, changed, lock}) {
  let saved = null, rows = null, section = 'venues', reason = '', dirty = false, saving = false;
  const field = (key, label, value, options = {}) => `<label>${esc(label)}${options.area
    ? `<textarea data-key="${key}" rows="${options.rows ?? 3}" maxlength="${options.max ?? 4000}" ${options.optional ? '' : 'required'}>${esc(Array.isArray(value) ? value.join('\n') : value)}</textarea>`
    : `<input data-key="${key}" value="${esc(value)}" ${options.number ? 'type="number" min="1" max="10000" step="1"' : options.money ? 'inputmode="decimal" maxlength="12"' : 'maxlength="100"'} required>`}</label>`;
  const priceFields = option => `<div class="settings-grid" data-prices ${option.billing === 'pay_separately' ? 'hidden' : ''}>${categories.map((key, i) => field(`prices.${key}`, `${i ? 'Children (0–12)' : 'Guests'} · price in USD`, option.prices_cents[key] === null ? '' : (option.prices_cents[key] / 100).toFixed(2), {money:true})).join('')}</div>`;
  function render() {
    const editable = saved.editable;
    root.innerHTML = `<div class="overview-heading"><div><h2>Restaurant settings</h2><p>Set up your spaces, menus and drinks. Saved drafts use these settings.</p></div><button type="button" class="button secondary" data-reload>Reload settings</button></div>
      <p class="settings-context">${editable ? 'Shared across this demo workspace. Changes cost no AI calls. Changed drafts need a fresh review.' : 'Public sample settings. Open your private workspace to make changes.'}</p>
      <p class="settings-muted">Use fictional prices and limits for this capstone.</p>
      <form id="restaurant-form" novalidate><fieldset ${editable ? '' : 'disabled'}><legend class="sr-only">Restaurant setup</legend>
      <div class="settings-tabs" role="group" aria-label="Restaurant sections">${kinds.map(kind => `<button type="button" class="button secondary" data-section="${kind}" aria-pressed="${kind === section}">${title[kind]} <span>${rows[kind].length}</span></button>`).join('')}</div>
      ${kinds.map(kind => `<section data-settings-section="${kind}" ${kind === section ? '' : 'hidden'}><h3>${title[kind]}</h3><p class="settings-muted">${help[kind]}</p>${rows[kind].map((row, index) => {
        const option = row.option;
        return `<div class="settings-item" data-kind="${kind}" data-index="${index}"><div class="settings-grid">${field('name', kind === 'venues' ? 'Space name' : kind === 'menus' ? 'Menu name' : 'Drink option name', row.name)}${kind === 'venues' ? field('capacity', 'Maximum people, including children', option.capacity, {number:true}) : ''}</div>
        ${kind === 'venues' ? field('setups', 'Table setups · one per line', option.setups, {area:true}) : field('description', kind === 'menus' ? 'Short description' : 'What is included, and who pays?', option.description, {area:true,max:500})}
        ${kind === 'beverages' ? `<label>How are drinks charged?<select data-key="billing"><option value="per_person" ${option.billing === 'per_person' ? 'selected' : ''}>Price per person</option><option value="pay_separately" ${option.billing === 'pay_separately' ? 'selected' : ''}>Paid separately · outside the quote</option></select></label>` : ''}
        ${kind !== 'venues' ? priceFields(option) : ''}
        ${kind === 'menus' ? field('courses', 'Menu dishes · one per line', option.courses, {area:true}) + `<fieldset class="settings-checks"><legend>Allowed drinks</legend>${rows.beverages.filter(drink => drink.name.trim()).map(drink => `<label><input type="checkbox" data-drink="${esc(drink.name)}" ${option.beverages.includes(drink.name) ? 'checked' : ''}>${esc(drink.name)}</label>`).join('')}</fieldset><p class="settings-muted">New menus show the dishes on the kitchen sheet. Prep quantities still need the kitchen lead.</p>` : ''}
        ${kind === 'beverages' ? `<details class="settings-wording"><summary>Equivalent wording (optional)</summary><p>Paste a complete drink instruction that means exactly this option. Extra words will still need review.</p>${field('aliases', 'One complete instruction per line', option.aliases, {area:true,optional:true})}</details>` : ''}
        <button type="button" class="text-button" data-remove="${kind}:${index}">Remove ${kind === 'venues' ? 'space' : kind === 'menus' ? 'menu' : 'drink option'}</button></div>`;
      }).join('')}<button type="button" class="button secondary" data-add="${kind}">Add ${kind === 'venues' ? 'space' : kind === 'menus' ? 'menu' : 'drink option'}</button></section>`).join('')}
      <div class="settings-save">${field('reason', 'What changed?', reason, {area:true,rows:2,max:500})}<div class="item-actions"><button type="submit" class="button primary">Save restaurant settings</button><span data-dirty class="settings-muted">${dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}</span></div></div></fieldset></form>
      ${editable ? '<details class="settings-example"><summary>Need a fictional rehearsal example?</summary><p>Add Menu 3 ($64 per guest, $24 per child), a 60-person Garden Patio, and à la carte drinks with a cash bar. These are invented demo values, not Yannis prices or limits.</p><button type="button" class="button secondary" data-example>Fill with rehearsal sample</button><p>Review the values above, then save.</p></details>' : ''}
      <p class="settings-muted">${saved.revision ? `Saved version ${saved.revision} · ${esc(new Date(saved.saved_at).toLocaleString())}<br>Last change: ${esc(saved.reason)}` : 'Using the original sample settings.'}</p><p data-settings-status role="status" aria-live="polite"></p><p data-settings-error class="error" role="alert" hidden></p>`;
    if (!editable) {
      for (const node of root.querySelectorAll('fieldset')) node.disabled = false;
      for (const node of root.querySelectorAll('input,textarea,select,button:not([data-section]):not([data-reload])')) node.disabled = true;
    }
  }
  function collect(validate = false) {
    for (const node of root.querySelectorAll('.settings-item')) {
      const row = rows[node.dataset.kind][Number(node.dataset.index)], kind = node.dataset.kind;
      const value = key => node.querySelector(`[data-key="${key}"]`).value.trim();
      row.name = value('name');
      if (kind === 'venues') { row.option.capacity = Number(value('capacity')); row.option.setups = list(value('setups')); }
      else {
        row.option.description = value('description');
        if (kind === 'beverages') { row.option.billing = value('billing'); row.option.aliases = list(value('aliases')); }
        for (const key of categories) {
          const raw = value(`prices.${key}`);
          row.option.prices_cents[key] = row.option.billing === 'pay_separately' ? 0 : validate ? cents(raw) : /^\d+(?:\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : null;
        }
        if (kind === 'menus') { row.option.courses = list(value('courses')); row.option.beverages = [...node.querySelectorAll('[data-drink]:checked')].map(input => input.dataset.drink); }
      }
    }
    reason = root.querySelector('[data-key="reason"]').value.trim();
  }
  function setRows(settings) { rows = Object.fromEntries(kinds.map(kind => [kind, Object.entries(settings[kind]).map(([name, option]) => ({name,option:structuredClone(option)}))])); }
  function settings() {
    for (const kind of kinds) if (new Set(rows[kind].map(row => row.name)).size !== rows[kind].length) throw new Error('Give each item a different name.');
    return Object.fromEntries(kinds.map(kind => [kind, Object.fromEntries(rows[kind].map(row => [row.name,row.option]))]));
  }
  const error = message => { const node = root.querySelector('[data-settings-error]'); node.textContent = message; node.hidden = !message; if (message) node.scrollIntoView({block:'nearest'}); };
  async function load() {
    root.setAttribute('aria-busy','true');
    try { saved = await request('/api/package/settings'); setRows(saved.settings); dirty = false; reason = ''; render(); }
    finally { root.setAttribute('aria-busy','false'); }
  }
  root.addEventListener('input', () => { dirty = true; root.querySelector('[data-dirty]').textContent = 'You have unsaved changes.'; });
  root.addEventListener('change', event => {
    if (event.target.matches('[data-key="billing"]')) {
      const panel = event.target.closest('.settings-item').querySelector('[data-prices]');
      panel.hidden = event.target.value === 'pay_separately';
      for (const input of panel.querySelectorAll('input')) input.required = !panel.hidden;
    }
  });
  root.addEventListener('click', async event => {
    if (saving) return;
    const button = event.target.closest('button'); if (!button) return;
    try {
      if (button.hasAttribute('data-reload')) { lock(true); try {await load();} finally {lock(false);} return; }
      collect();
      if (button.dataset.section) {section = button.dataset.section; render(); return;}
      if (!saved.editable) return;
      if (button.dataset.add) {const kind = button.dataset.add; rows[kind].push({name:'',option:blank(kind)}); dirty = true; render(); root.querySelector(`[data-kind="${kind}"]:last-of-type input`)?.focus();}
      if (button.dataset.remove) {const [kind,index] = button.dataset.remove.split(':'); rows[kind].splice(Number(index),1); dirty = true; render();}
      if (button.hasAttribute('data-example')) {setRows(rehearsalExample(settings())); reason = 'Added fictional rehearsal settings: Menu 3, separate drink charges, and a 60-person patio. These are demo values.'; dirty = true; section = 'menus'; render(); root.querySelector('[data-settings-status]').textContent = 'Sample filled in. Check the values, then save.';}
    } catch (cause) {error(cause.message);}
  });
  root.addEventListener('submit', async event => {
    event.preventDefault(); if (!saved.editable || saving) return;
    error('');
    try {
      const invalid = [...root.querySelectorAll('input,textarea,select')].find(control => !control.closest('[data-prices][hidden]') && !control.checkValidity());
      if (invalid) {
        const panel = invalid.closest('[data-settings-section]');
        if (panel) {section = panel.dataset.settingsSection; for (const node of root.querySelectorAll('[data-settings-section]')) node.hidden = node !== panel; for (const tab of root.querySelectorAll('[data-section]')) tab.setAttribute('aria-pressed', String(tab.dataset.section === section));}
        invalid.reportValidity(); invalid.focus(); return;
      }
      collect(true); const payload = settings(); saving = true; lock(true);
      const result = await request('/api/package/settings', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:payload,revision:saved.revision,reason})});
      saved = result; setRows(saved.settings); dirty = false; reason = ''; render(); lock(true);
      root.querySelector('[data-settings-status]').textContent = 'Saved. Open an event to see its updated drafts. No AI call was made.';
      await changed();
    } catch (cause) {error(cause.message);}
    finally {saving = false; lock(false);}
  });
  return {load};
}
