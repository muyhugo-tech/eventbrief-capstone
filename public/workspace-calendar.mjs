// Adapted from the Yannis month/agenda calendar pattern. EventBrief keeps every
// entry a draft: appearing here never reserves a room or confirms an event.
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const pad = value => String(value).padStart(2, '0');
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) > 0;
const dateKey = date => date.toISOString().slice(0, 10);

function venueToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Open the nearest future event's month, or the most recent past event. Empty
// workspaces open this month. Passing [] is also how the Today button resets.
export function calendarMonth(items = [], now = new Date()) {
  const today = venueToday(now);
  const dates = items.map(item => item.event_date).filter(validDate).sort();
  return (dates.find(date => date >= today) ?? dates.at(-1) ?? today).slice(0, 7);
}

export function shiftMonth(month, delta) {
  if (!validMonth(month) || !Number.isSafeInteger(delta)) throw new Error('Choose a valid calendar month.');
  const cursor = new Date(`${month}-01T12:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() + delta);
  const result = cursor.toISOString().slice(0, 7);
  if (!validMonth(result)) throw new Error('Choose a month between years 1 and 9999.');
  return result;
}

function displayTime(value) {
  if (!validTime(value)) return '';
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}${minute ? `:${pad(minute)}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}

function eventCard(item, busy) {
  const calendar = item.documents?.find(document => document.id === 'calendar');
  const complete = validDate(item.event_date) && validTime(item.start_time) && validTime(item.end_time) && item.end_time > item.start_time && item.timezone && item.venue;
  const status = item.pending_update ? 'New message · check details' : !complete || calendar?.state === 'blocked' ? 'Schedule incomplete' : calendar?.reviewed ? 'Reviewed draft · not booked' : 'Draft · not booked';
  const time = validTime(item.start_time) ? [displayTime(item.start_time), displayTime(item.end_time)].filter(Boolean).join(' – ') : 'Time needed';
  const count = Number.isInteger(item.guest_count) && item.guest_count >= 0 ? `${item.guest_count} guests` : '';
  const children = Number.isInteger(item.child_count) && item.child_count > 0 ? `${item.child_count} ${item.child_count === 1 ? 'child' : 'children'} (0–12)` : '';
  return `<button type="button" class="wc-event${!complete || calendar?.state === 'blocked' ? ' wc-event-incomplete' : ''}" data-open-event="${esc(item.id)}" data-open-document="calendar"${busy ? ' disabled' : ''}>
    <span class="wc-event-title">${esc(item.title || 'Untitled event')}</span>
    <span class="wc-event-time">${esc(time)}</span>
    ${item.venue ? `<span class="wc-event-venue">${esc(item.venue)}</span>` : ''}
    ${count || children ? `<span class="wc-event-count">${esc([count, children].filter(Boolean).join(' · '))}</span>` : ''}
    <span class="wc-event-status">${esc(status)}</span>
  </button>`;
}

export function renderCalendar(items = [], { month = calendarMonth(items), busy = false } = {}) {
  if (!validMonth(month)) throw new Error('Choose a valid calendar month.');
  const byDay = new Map();
  const undated = [];
  for (const item of items) {
    if (!validDate(item.event_date)) { undated.push(item); continue; }
    const group = byDay.get(item.event_date) ?? [];
    group.push(item);
    byDay.set(item.event_date, group);
  }
  for (const group of byDay.values()) group.sort((left, right) => (validTime(left.start_time) ? left.start_time : '99:99').localeCompare(validTime(right.start_time) ? right.start_time : '99:99') || String(left.title).localeCompare(String(right.title)));
  const first = new Date(`${month}-01T12:00:00Z`);
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const today = venueToday();
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const key = dateKey(date);
    const dayItems = byDay.get(key) ?? [];
    return `<td class="wc-day${key.startsWith(month) ? '' : ' wc-day-outside'}${key === today ? ' wc-day-today' : ''}"><time class="wc-day-number" datetime="${key}"${key === today ? ' aria-current="date"' : ''}>${date.getUTCDate()}</time>${dayItems.map(item => eventCard(item, busy)).join('')}</td>`;
  });
  const agenda = [...byDay].filter(([key]) => key.startsWith(month)).sort(([left], [right]) => left.localeCompare(right));
  const count = agenda.reduce((total, [, events]) => total + events.length, 0);
  const disabled = busy ? ' disabled' : '';
  return `<section class="workspace-calendar" aria-label="Event calendar">
    <div class="wc-toolbar"><div class="wc-navigation"><button type="button" data-calendar-shift="-1" aria-label="Previous month"${disabled}>‹</button><button type="button" data-calendar-today${disabled}>Today</button><button type="button" data-calendar-shift="1" aria-label="Next month"${disabled}>›</button></div><h2>${esc(label)}</h2><label class="wc-month-picker"><span class="wc-sr-only">Choose month</span><input type="month" data-calendar-month value="${month}" min="0001-01" max="9999-12"${disabled}></label></div>
    <div class="wc-caption"><p>${count} ${count === 1 ? 'event draft' : 'event drafts'} this month</p><p>Times are at the restaurant. Drafts do not reserve a space.</p></div>
    <div class="wc-desktop-grid"><table class="wc-grid" aria-label="${esc(label)} event drafts"><thead><tr>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<th scope="col">${day}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: 6 }, (_, week) => `<tr>${days.slice(week * 7, week * 7 + 7).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="wc-mobile-agenda">${agenda.length ? agenda.map(([key, events]) => `<section class="wc-agenda-day"><h3><time datetime="${key}">${esc(new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)))}</time></h3>${events.map(item => eventCard(item, busy)).join('')}</section>`).join('') : '<p class="wc-empty">No event drafts this month. Choose another month or add an event.</p>'}</div>
    ${!count ? '<p class="wc-desktop-empty">No event drafts this month. Choose another month or add an event.</p>' : ''}
    ${undated.length ? `<section class="wc-undated"><div class="wc-undated-heading"><h3>Date needed</h3><span>${undated.length}</span></div><p>These events stay here until a date is added.</p><div class="wc-undated-list">${undated.map(item => eventCard(item, busy)).join('')}</div></section>` : ''}
  </section>`;
}

function wallClockInstant(date, time, timezone) {
  if (!validDate(date) || !validTime(time) || typeof timezone !== 'string' || !timezone) throw new Error('The calendar needs a valid date, time and timezone.');
  let formatter;
  try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  catch { throw new Error('The calendar timezone is not valid.'); }
  const target = Date.parse(`${date}T${time}:00Z`);
  const observed = instant => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
  };
  // Both sides of a clock change are sampled. A nonexistent or ambiguous wall
  // time needs human correction, so an export must not guess a UTC offset.
  const offsets = new Set([-2, -1, 0, 1, 2].map(days => { const candidate = target + days * 86400000; return observed(candidate) - candidate; }));
  const matches = [...offsets].map(offset => target - offset).filter(instant => observed(instant) === target);
  if (matches.length !== 1) throw new Error('This event time falls on a clock change. Choose an unambiguous time before downloading.');
  return new Date(matches[0]);
}

const calendarText = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
const utcStamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const encoder = new TextEncoder();
function foldLine(line) {
  let output = '', columnBytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (columnBytes + size > 75) { output += '\r\n '; columnBytes = 1; }
    output += character;
    columnBytes += size;
  }
  return output;
}

export function calendarFile(document, prepared, { reviewed = false, eventId, now = new Date() } = {}) {
  if (document?.id !== 'calendar' || document.state !== 'ready_for_review') throw new Error('Finish the missing calendar details before downloading.');
  const values = Object.fromEntries((document.rows ?? []).map(row => [row.field, row.value]));
  if (![values.host_name, values.venue].every(value => typeof value === 'string' && value.trim())) throw new Error('The calendar needs a host and a venue.');
  const start = wallClockInstant(values.event_date, values.start_time, values.timezone);
  const end = wallClockInstant(values.event_date, values.end_time, values.timezone);
  if (end <= start) throw new Error('The calendar end time must follow its start time.');
  const stamp = new Date(now);
  if (!Number.isFinite(stamp.getTime())) throw new Error('The calendar export date is not valid.');
  const identity = eventId ?? prepared?.input?.event_id ?? prepared?.scenario_id;
  if (typeof identity !== 'string' || !identity.trim() || identity.length > 1024) throw new Error('The calendar needs a saved event identity.');
  // UTF-8 hex preserves the exact event identity without letting user input
  // become iCalendar syntax. Source revisions keep the same event's UID.
  const uid = [...encoder.encode(identity)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const description = `${reviewed ? 'Reviewed draft' : 'Draft - not reviewed'}. Not a booking or invitation. All details are fictional.\nRestaurant timezone: ${values.timezone}.`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EventBrief//Event drafts//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:eventbrief-${uid}@eventbrief.invalid`, `DTSTAMP:${utcStamp(stamp)}`, `DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`, `SUMMARY:${calendarText(`Draft - ${values.host_name}`)}`, `LOCATION:${calendarText(values.venue)}`, `DESCRIPTION:${calendarText(description)}`, 'STATUS:TENTATIVE', 'TRANSP:TRANSPARENT', 'CLASS:PRIVATE', 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
