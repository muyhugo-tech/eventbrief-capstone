import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedAccess } from '../lib/hosted/access.mjs';

const accessCode = 'synthetic-test-access-code-00000001';
const sessionSecret = 'synthetic-test-session-secret-000000000001';
const headerPart = value => value.split(';')[0];
const create = options => createHostedAccess({ accessCode, sessionSecret, ...options });

test('hosted visitor and unlocked sessions use secure cookies without exposing the access code', () => {
  const auth = create();
  const visitor = auth.visitor('');
  assert.match(visitor.visitorId, /^[a-f0-9]{32}$/);
  assert.match(visitor.setCookie, /^__Host-eventbrief-visitor=/);
  assert.match(visitor.setCookie, /; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);
  assert.doesNotMatch(visitor.setCookie, /Domain=/);
  const unlocked = auth.unlock({ code: accessCode, visitorId: visitor.visitorId });
  assert.equal(unlocked.ok, true);
  assert.match(unlocked.setCookie, /^__Host-eventbrief-access=/);
  assert.match(unlocked.setCookie, /; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200$/);
  const headers = `${headerPart(visitor.setCookie)}; ${headerPart(unlocked.setCookie)}`;
  assert.equal(auth.isUnlocked(headers, visitor.visitorId), true);
  assert.deepEqual(auth.visitor(headers), { visitorId: visitor.visitorId });
  const token = headerPart(unlocked.setCookie).split('=')[1].split('.')[0];
  assert.equal(Buffer.from(token, 'base64url').toString('utf8').includes(accessCode), false);
  assert.match(auth.lock(), /^__Host-eventbrief-access=;.*Max-Age=0$/);
});

test('incorrect codes, cookie tampering, duplicate cookies and a different visitor cannot unlock AI', () => {
  const auth = create();
  const first = auth.visitor('');
  const second = auth.visitor('');
  assert.notEqual(first.visitorId, second.visitorId);
  for (const code of ['', accessCode + 'x', null, {}, 'x'.repeat(513)]) {
    assert.deepEqual(auth.unlock({ code, visitorId: first.visitorId }), { ok: false });
  }
  assert.deepEqual(auth.unlock({ code: accessCode, visitorId: '../invalid' }), { ok: false });
  const unlocked = auth.unlock({ code: accessCode, visitorId: first.visitorId });
  const access = headerPart(unlocked.setCookie);
  const original = `${headerPart(first.setCookie)}; ${access}`;
  const tampered = original.slice(0, -1) + (original.endsWith('a') ? 'b' : 'a');
  assert.equal(auth.isUnlocked(tampered, first.visitorId), false);
  assert.equal(auth.isUnlocked(`${headerPart(second.setCookie)}; ${access}`, second.visitorId), false);
  assert.equal(auth.isUnlocked(original, second.visitorId), false);
  assert.equal(auth.isUnlocked(access, first.visitorId), false);
  assert.equal(auth.isUnlocked(`${original}; ${access}`, first.visitorId), false);
  assert.equal(auth.isUnlocked('x'.repeat(17000), first.visitorId), false);
});

test('access expires after 12 hours while the workspace lasts 30 days; code rotation invalidates old access', () => {
  let time = Date.UTC(2026, 9, 12);
  const auth = create({ now: () => time });
  const visitor = auth.visitor('');
  const unlocked = auth.unlock({ code: accessCode, visitorId: visitor.visitorId });
  const headers = `${headerPart(visitor.setCookie)}; ${headerPart(unlocked.setCookie)}`;
  time += 12 * 60 * 60 * 1000 - 1000;
  assert.equal(auth.isUnlocked(headers, visitor.visitorId), true);
  const rotated = create({ accessCode: 'synthetic-test-access-code-00000002', now: () => time });
  assert.equal(rotated.isUnlocked(headers, visitor.visitorId), false);
  assert.deepEqual(rotated.visitor(headers), { visitorId: visitor.visitorId });
  time += 1000;
  assert.equal(auth.isUnlocked(headers, visitor.visitorId), false);
  assert.deepEqual(auth.visitor(headers), { visitorId: visitor.visitorId });
  time = Date.UTC(2026, 9, 12) + 30 * 24 * 60 * 60 * 1000;
  assert.notEqual(auth.visitor(headers).visitorId, visitor.visitorId);
});

test('invalid hosted secrets fail closed with an error that contains neither credential', () => {
  assert.throws(() => create({ accessCode: 'short' }), /strong access code/);
  assert.throws(() => create({ sessionSecret: 'short' }), /strong access code/);
  assert.throws(() => create({ sessionSecret: ' '.repeat(40) }), /strong access code/);
});
