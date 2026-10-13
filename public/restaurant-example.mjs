// Explicitly invented capstone settings, not Yannis operational data.
export function rehearsalExample(current) {
  const settings = structuredClone(current);
  settings.venues['Garden Patio'] = {capacity: 60, setups: settings.venues['Garden Patio']?.setups ?? ['One long table']};
  settings.beverages['À la carte + cash bar'] = {
    description: 'Drinks ordered à la carte are charged separately. Guests pay for their own alcoholic drinks.',
    prices_cents: {guest_13_plus_count: 0, child_count: 0}, billing: 'pay_separately',
    aliases: ['Beverages à la carte; cash bar. Guests will pay for their own alcoholic drinks.', 'Beverages à la carte, cash bar']
  };
  settings.menus['Menu 3'] = {
    description: 'Fictional rehearsal dinner menu',
    courses: ['Mediterranean salad', 'Lemon herb chicken with roasted vegetables', 'Chocolate dessert'],
    prices_cents: {guest_13_plus_count: 6400, child_count: 2400},
    beverages: Object.keys(settings.beverages)
  };
  return settings;
}
