// Fictional prep rules for the capstone, separate from the extraction profile.
// Keeping these separate preserves existing AI receipts. The package engine
// includes the resulting plan in the kitchen revision, so changed rules require
// a new kitchen review without invalidating unrelated documents.
const menu2Courses = ['Garden salad', 'Roast squash and herb chicken, served family-style', 'Apple crumble'];
export const KITCHEN_PREP_VERSION = 'fictional-kitchen-v1';

export function kitchenPrep(record, profile) {
  const menu = profile.menus[record.fields.menu.value];
  const attendance = record.fields.guest_count.value;
  const supported = profile.id === 'linden-fig-demo' && record.fields.menu.value === 'Menu 2'
    && JSON.stringify(menu?.courses) === JSON.stringify(menu2Courses);
  if (!supported) return {
    version: KITCHEN_PREP_VERSION, service: null, calculated: false,
    basis: 'Prep quantities are not supplied for this menu. The kitchen team must fill them in before service.',
    sections: [{ title: 'Menu items', lines: (menu?.courses ?? []).map(name => ({ name, quantity: null, unit: null, covers: null })) }]
  };
  if (!Number.isSafeInteger(attendance) || attendance < 1) throw new Error('Kitchen prep needs a positive attendance count.');
  const batch = (name, unit) => ({ name, quantity: Math.ceil(attendance / 10), unit, covers: attendance });
  return {
    version: KITCHEN_PREP_VERSION, service: 'Family-style', calculated: true,
    basis: 'Fictional prep guide: 1 bowl of salad, 1 tray of squash and 1 platter of chicken per 10 people, rounded up. 1 dessert per person. Guests and children each count as 1 person. Confirm quantities with the kitchen lead.',
    sections: [
      { title: 'Salads', lines: [batch('Garden salad', 'bowl')] },
      { title: 'Entrées', lines: [batch('Roast squash', 'tray'), batch('Herb chicken', 'platter')] },
      { title: 'Dessert', lines: [{ name: 'Apple crumble', quantity: attendance, unit: 'portion', covers: attendance }] }
    ]
  };
}
