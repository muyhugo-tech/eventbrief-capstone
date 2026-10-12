import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFile, calendarMonth, renderCalendar, shiftMonth } from '../public/workspace-calendar.mjs';
import { prepareEventPackage } from '../lib/event-package.mjs';
import { packageFixtures } from '../lib/package-fixtures.mjs';

const prepared = prepareEventPackage([...packageFixtures.values()][0]);
const base = prepared.documents.find(document => document.id === 'calendar');
const options = { eventId: 'saved-event-one', now: new Date('2026-10-12T12:34:56Z') };
const withFields = changes => ({ ...base, rows: base.rows.map(row => ({ ...row, value: Object.hasOwn(changes, row.field) ? changes[row.field] : row.value })) });
const unfolded = value => value.replace(/\r\n /g, '');
const item = { id: 'event-one', title: 'Alex Morgan', event_date: '2027-11-14', start_time: '18:00', end_time: '21:00', timezone: 'America/Los_Angeles', venue: 'Garden Patio', guest_count: 18, child_count: 2, documents: [{ id: 'calendar', state: 'ready_for_review', reviewed: false }] };

test('calendar chooses a useful month and shifts across years without day overflow', () => {
  assert.equal(calendarMonth([item], new Date('2026-10-12T12:00:00Z')), '2027-11');
  assert.equal(calendarMonth([{ ...item, event_date: '2025-01-03' }, { ...item, event_date: '2025-12-03' }], new Date('2026-10-12T12:00:00Z')), '2025-12');
  assert.equal(calendarMonth([], new Date('2027-01-01T01:00:00Z')), '2026-12');
  assert.equal(shiftMonth('2027-12', 1), '2028-01');
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
  assert.throws(() => shiftMonth('2027-13', 1), /valid calendar month/);
});

test('calendar keeps undated and partial schedules visible without inventing reservations', () => {
  const html = renderCalendar([item, { ...item, id: 'undated', event_date: null, title: 'Date unknown' }, { ...item, id: 'partial', start_time: null, title: 'Time unknown' }], { month: '2027-11' });
  assert.match(html, /2 event drafts this month/);
  assert.match(html, /Date needed/);
  assert.match(html, /data-open-event="undated"/);
  assert.match(html, /data-open-document="calendar"/);
  assert.match(html, /Schedule incomplete/);
  assert.match(html, /Draft · not booked/);
  assert.match(html, /18 guests · 2 children \(0–12\)/);
  assert.doesNotMatch(html, /13\+|confirmed booking/i);
  assert.equal((html.match(/<td /g) ?? []).length, 42);
});

test('calendar escapes all event text and identifiers; busy controls cannot mutate', () => {
  const html = renderCalendar([{ ...item, title: '<script>private source</script>', venue: '<img onerror=alert(1)>', id: 'x" onclick="alert(1)', internal_notes: 'SECRET INTERNAL NOTES', messages: 'SECRET SOURCE' }], { month: '2027-11', busy: true });
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-open-event="x&quot; onclick=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /<script>|<img|SECRET INTERNAL NOTES|SECRET SOURCE/);
  assert.ok([...html.matchAll(/<button[^>]*>/g)].every(([button]) => / disabled/.test(button)));
});

test('calendar exports winter and summer venue times as UTC and remains a tentative draft', () => {
  const winter = calendarFile(withFields({ event_date: '2027-12-12', start_time: '18:00', end_time: '21:00' }), prepared, options);
  const summer = calendarFile(withFields({ event_date: '2027-07-12', start_time: '18:00', end_time: '21:00' }), prepared, { ...options, reviewed: true });
  assert.match(winter, /DTSTART:20271213T020000Z\r\n/);
  assert.match(winter, /DTEND:20271213T050000Z\r\n/);
  assert.match(summer, /DTSTART:20270713T010000Z\r\n/);
  assert.match(summer, /DTEND:20270713T040000Z\r\n/);
  assert.match(summer, /STATUS:TENTATIVE\r\nTRANSP:TRANSPARENT/);
  assert.match(unfolded(summer), /Reviewed draft\. Not a booking or invitation/);
  assert.doesNotMatch(summer, /ATTENDEE|ORGANIZER|METHOD:REQUEST/);
});

test('calendar rejects blocked/incomplete records, bad dates and unsafe clock-change times', () => {
  assert.throws(() => calendarFile({ ...base, state: 'blocked' }, prepared, options), /missing calendar details/);
  assert.throws(() => calendarFile(withFields({ end_time: null }), prepared, options), /valid date, time and timezone/);
  assert.throws(() => calendarFile(withFields({ event_date: '2027-02-30' }), prepared, options), /valid date/);
  assert.throws(() => calendarFile(withFields({ start_time: '22:00', end_time: '21:00' }), prepared, options), /end time must follow/);
  assert.throws(() => calendarFile(withFields({ timezone: 'Invalid/Zone' }), prepared, options), /timezone is not valid/);
  assert.throws(() => calendarFile(withFields({ event_date: '2027-03-14', start_time: '02:30', end_time: '04:00' }), prepared, options), /clock change/);
  assert.throws(() => calendarFile(withFields({ event_date: '2027-11-07', start_time: '01:30', end_time: '04:00' }), prepared, options), /clock change/);
});

test('calendar escaping and byte folding stop CRLF/property injection without losing Unicode', () => {
  const title = 'Café 🎉 '.repeat(18) + '\r\nATTENDEE:mailto:someone@example.com,guest;test\\end';
  const file = calendarFile(withFields({ host_name: title, venue: 'Garden\r\nBEGIN:VEVENT' }), prepared, { ...options, eventId: 'identity\r\nEND:VCALENDAR' });
  assert.equal((file.match(/^BEGIN:VEVENT$/gm) ?? []).length, 1);
  assert.doesNotMatch(file, /\r\nATTENDEE:|\r\nEND:VCALENDAR\r\n[^\s]/);
  assert.match(unfolded(file), /Café 🎉/);
  assert.match(unfolded(file), /\\nATTENDEE:mailto:someone@example.com\\,guest\\;test\\\\end/);
  assert.ok(file.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  assert.ok(!file.replace(/\r\n/g, '').includes('\n'));
});

test('calendar UID follows the saved event across source revisions and excludes source/internal notes', () => {
  const earlier = unfolded(calendarFile(base, prepared, options));
  const later = unfolded(calendarFile({ ...base, revision: 'changed', rows: [...base.rows, { field: 'staff_notes', value: 'SECRET TEAM NOTES' }] }, { ...prepared, scenario_id: 'new-source-revision', input: { messages: ['SECRET SOURCE'] } }, options));
  const other = unfolded(calendarFile(base, prepared, { ...options, eventId: 'different-event' }));
  const uid = file => file.match(/^UID:(.+)$/m)?.[1];
  assert.equal(uid(earlier), uid(later));
  assert.notEqual(uid(earlier), uid(other));
  assert.doesNotMatch(later, /SECRET TEAM NOTES|SECRET SOURCE|contact_email|staff_notes/);
  assert.match(later, /DTSTAMP:20261012T123456Z/);
});
