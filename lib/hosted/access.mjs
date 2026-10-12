import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const VISITOR_COOKIE = '__Host-eventbrief-visitor';
const ACCESS_COOKIE = '__Host-eventbrief-access';
const VISITOR_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_SECONDS = 12 * 60 * 60;
const validVisitor = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const equal = (left, right) => timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());

// Duplicate names fail closed rather than choosing a cookie whose order an
// unrelated subdomain or client could influence. __Host also forbids Domain.
function cookies(header) {
  const values = new Map();
  if (typeof header !== 'string' || header.length > 16384) return values;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    values.set(name, values.has(name) ? null : value);
  }
  return values;
}
const cookie = (name, value, lifetime) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${lifetime}`;

export function createHostedAccess({ accessCode, sessionSecret, now = Date.now }) {
  if (typeof accessCode !== 'string' || accessCode.length < 24 || accessCode.length > 512 || !accessCode.trim() ||
      typeof sessionSecret !== 'string' || Buffer.byteLength(sessionSecret) < 32 || sessionSecret.length > 4096 || !sessionSecret.trim()) {
    throw new Error('Hosted access requires a strong access code and session secret.');
  }
  const clock = () => Math.floor(now() / 1000);
  const sign = value => createHmac('sha256', sessionSecret).update(value).digest('base64url');
  const codeBinding = sign(`eventbrief:code:${accessCode}`);
  function encode(kind, visitorId, lifetime) {
    const issued = clock();
    const value = Buffer.from(JSON.stringify({ v: 1, kind, visitorId, issued, expires: issued + lifetime,
      ...(kind === 'access' ? { code: codeBinding } : {}) })).toString('base64url');
    return `${value}.${sign(value)}`;
  }
  function decode(token, kind, lifetime) {
    if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const [value, signature] = token.split('.');
    if (!equal(signature, sign(value))) return null;
    try {
      const result = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (result.v !== 1 || result.kind !== kind || !validVisitor(result.visitorId) ||
          !Number.isSafeInteger(result.issued) || !Number.isSafeInteger(result.expires) ||
          result.issued > clock() || result.expires <= clock() || result.expires !== result.issued + lifetime) return null;
      if (kind === 'access' && (typeof result.code !== 'string' || !equal(result.code, codeBinding))) return null;
      return result;
    } catch { return null; }
  }
  return {
    visitor(cookieHeader) {
      const existing = decode(cookies(cookieHeader).get(VISITOR_COOKIE), 'visitor', VISITOR_SECONDS);
      if (existing) return { visitorId: existing.visitorId };
      const visitorId = randomBytes(16).toString('hex');
      return { visitorId, setCookie: cookie(VISITOR_COOKIE, encode('visitor', visitorId, VISITOR_SECONDS), VISITOR_SECONDS) };
    },
    unlock({ code, visitorId }) {
      if (typeof code !== 'string' || code.length > 512 || !validVisitor(visitorId) || !equal(code, accessCode)) return { ok: false };
      return { ok: true, setCookie: cookie(ACCESS_COOKIE, encode('access', visitorId, ACCESS_SECONDS), ACCESS_SECONDS) };
    },
    isUnlocked(cookieHeader, visitorId) {
      const values = cookies(cookieHeader);
      const visitor = decode(values.get(VISITOR_COOKIE), 'visitor', VISITOR_SECONDS);
      const session = decode(values.get(ACCESS_COOKIE), 'access', ACCESS_SECONDS);
      return Boolean(validVisitor(visitorId) && visitor?.visitorId === visitorId && session?.visitorId === visitorId);
    },
    lock: () => cookie(ACCESS_COOKIE, '', 0)
  };
}
