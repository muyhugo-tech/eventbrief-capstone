import test from 'node:test';
import assert from 'node:assert/strict';
import { eventStage, renderBoard, renderAssetLibrary } from '../public/workspace-board.mjs';

const event = overrides => ({
  id: 'example-event', title: 'Alex Morgan dinner', event_date: '2027-11-14', venue: 'Garden Patio',
  guest_count: 18, child_count: 2, ready_count: 5, reviewed_count: 0,
  documents: ['calendar', 'quote', 'kitchen', 'staff', 'guest'].map(id => ({ id, state: 'ready_for_review', reviewed: false })),
  quote_total_cents: 225050, source: 'Written example', revision: 1, ...overrides,
});

test('board stages prefer new messages and blocked details over stale review marks', () => {
  assert.equal(eventStage({}), 'messages');
  assert.equal(eventStage(event({ ready_count: null, reviewed_count: 5 })), 'messages');
  assert.equal(eventStage(event({ pending_update: true, reviewed_count: 5 })), 'messages');
  assert.equal(eventStage(event({ ready_count: 4, reviewed_count: 5 })), 'needs-details');
  assert.equal(eventStage(event()), 'ready');
  assert.equal(eventStage(event({ reviewed_count: 1 })), 'reviewing');
  assert.equal(eventStage(event({ reviewed_count: 5 })), 'reviewed');
});

test('board preserves event navigation, document actions and plain guest labels', () => {
  const board = renderBoard([event()]);
  assert.match(board, /18 Guests · 2 Children \(0–12\)/);
  assert.doesNotMatch(board, /13\+|Adults|Won|Negotiation/);
  assert.match(board, /Nov 14, 2027/);
  assert.match(board, /\$2,250\.50/);
  for (const id of ['quote', 'kitchen', 'staff', 'guest']) {
    assert.match(board, new RegExp(`data-open-event="example-event" data-open-document="${id}"`));
  }
  assert.equal((board.match(/class="wb-card"/g) || []).length, 1);
});

test('asset libraries use each document state instead of the package total', () => {
  const item = event({ ready_count: 4, documents: [
    { id: 'quote', state: 'ready_for_review', reviewed: true },
    { id: 'kitchen', state: 'blocked', reviewed: true },
    { id: 'staff', state: 'ready_for_review', reviewed: false },
  ] });
  assert.match(renderAssetLibrary([item], 'quote'), /wb-status-reviewed/);
  assert.match(renderAssetLibrary([item], 'quote'), /\$2,250\.50/);
  assert.match(renderAssetLibrary([item], 'kitchen'), /wb-status-blocked/);
  assert.match(renderAssetLibrary([item], 'kitchen'), />Add details</);
  assert.match(renderAssetLibrary([item], 'staff'), /wb-status-ready/);
  assert.match(renderAssetLibrary([item], 'guest'), /Not prepared/);
  assert.doesNotMatch(renderAssetLibrary([item], 'kitchen'), /\$2,250\.50/);
});

test('unprepared, blocked and stale quotes never expose an old total', () => {
  for (const item of [
    event({ pending_update: true }),
    event({ documents: [] }),
    event({ documents: [{ id: 'quote', state: 'blocked', reviewed: true }] }),
  ]) {
    assert.doesNotMatch(renderBoard([item]), /\$2,250\.50/);
    assert.doesNotMatch(renderAssetLibrary([item], 'quote'), /\$2,250\.50/);
  }
  assert.match(renderAssetLibrary([event({ pending_update: true })], 'quote'), /New messages/);
});

test('untrusted event text is escaped in content and attributes', () => {
  const item = event({ id: 'x" onclick="bad()', title: '<img src=x onerror=bad()>', venue: '<script>bad()</script>', source: '"quoted" & private' });
  for (const output of [renderBoard([item]), renderAssetLibrary([item], 'quote')]) {
    assert.doesNotMatch(output, /<img|<script|data-open-event="x" onclick=/);
    assert.match(output, /&lt;img/);
    assert.match(output, /&lt;script&gt;/);
    assert.match(output, /&quot;quoted&quot; &amp; private/);
  }
});

test('empty libraries have a new-event action and busy render disables actions', () => {
  assert.match(renderBoard([]), /Your events start here/);
  for (const id of ['quote', 'kitchen', 'staff', 'guest']) {
    assert.match(renderAssetLibrary([], id), /data-create-event/);
    assert.match(renderAssetLibrary([event()], id, { busy: true }), / disabled/);
  }
  assert.match(renderBoard([event()], { busy: true }), /data-open-event="example-event" disabled/);
  assert.throws(() => renderAssetLibrary([], 'unknown'), TypeError);
});

test('invalid dates and absent counts are displayed as missing, not invented', () => {
  const output = renderBoard([event({ event_date: '2027-02-31', guest_count: null, child_count: null, quote_total_cents: NaN })]);
  assert.match(output, /Date needed/);
  assert.match(output, /Guest count needed/);
  assert.doesNotMatch(output, /NaN|0 Guests|Invalid Date/);
});
