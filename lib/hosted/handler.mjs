import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHandler } from '../../server.mjs';
import { createPackageWorkspace, pastedPrompt } from '../package-workspace.mjs';
import { createRestaurantSettingsStore } from '../restaurant-settings.mjs';
import { createAttemptStore } from '../attempt-store.mjs';
import { packageFixtures } from '../package-fixtures.mjs';
import { buildPackageRequest } from '../package-provider.mjs';
import { createBlobFiles } from './blob-files.mjs';
import { createHostedAccess } from './access.mjs';
import { createHostedPackageAllowance } from './allowance.mjs';
import {createEvaluationStore} from '../demo-evaluation.mjs';

const prompt = await readFile(new URL('../../prompts/extract-package-v3.txt', import.meta.url), 'utf8');
const fixture = packageFixtures.values().next().value;
const storageRoot = resolve('/eventbrief'); // Virtual Blob path only; never written to disk.
// A server-selected, stable namespace. Neither the code nor a client-supplied
// workspace ID is a storage key. Code rotation keeps the saved private work.
const privateWorkspaceId = 'shared-private-workspace-v1';
const securityHeaders = {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'Vary': 'Cookie',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};

export function createHostedFetch({ env = process.env, sdk, packageTransport, quotePdfRenderer } = {}) {
  return async function handle(request) {
    const cookies = [];
    const json = (status, data) => {
      const headers = new Headers({...securityHeaders, 'Content-Type': 'application/json; charset=utf-8'});
      for (const cookie of cookies) headers.append('Set-Cookie', cookie);
      return new Response(JSON.stringify(data), {status, headers});
    };
    try {
      const url = new URL(request.url);
      const origins = [env.EVENTBRIEF_PUBLIC_ORIGIN, ...[env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map(host => `https://${host}`)].filter(Boolean);
      if (!origins.includes(url.origin)) return json(403, {error: 'Open EventBrief using its published link.'});
      if (!['GET', 'POST'].includes(request.method)) return json(405, {error: 'This request is not supported.'});
      if (request.method === 'POST' && (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site')) return json(403, {error: 'Open EventBrief before making changes.'});
      const routed = url.searchParams.get('route');
      const pathname = routed === null ? url.pathname : `/api/${routed}`;
      if (!/^\/api\/(?:hosted\/(?:session|unlock|lock)|package\/(?:scenarios|settings|demo|messages|reply|edit|feedback|tests|review(?:\/load)?|(?:quote|kitchen|staff|guest)\/pdf|prepare|analyze|attempts\/[a-f0-9-]{36}))$/.test(pathname)) return json(404, {error: 'Not found.'});
      // The capstone is open by default. The legacy gate is opt-in for private
      // installations; public demo requests never require a code or cookie.
      const accessRequired = env.EVENTBRIEF_REQUIRE_ACCESS_CODE === 'true';
      const access = accessRequired ? createHostedAccess({accessCode: env.EVENTBRIEF_ACCESS_CODE, sessionSecret: env.EVENTBRIEF_SESSION_SECRET}) : null;
      const cookieHeader = request.headers.get('cookie') ?? '';
      const visitor = access?.visitor(cookieHeader) ?? {visitorId: privateWorkspaceId};
      if (visitor.setCookie) cookies.push(visitor.setCookie);
      const unlocked = !accessRequired || access.isUnlocked(cookieHeader, visitor.visitorId);
      const aiConfigured = env.EVENTBRIEF_LIVE_ENABLED === 'true' && Boolean(env.EVENTBRIEF_OPENAI_API_KEY);
      const scope = !accessRequired ? 'demo' : unlocked ? 'private' : 'public';
      const hosted = {hosted: true, unlocked, access_required: accessRequired, workspace: scope, ai_configured: aiConfigured, storage: 'private-cloud'};
      let body = Buffer.alloc(0);
      if (request.method === 'POST') {
        if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, {error: 'JSON is required.'});
        if (Number(request.headers.get('content-length')) > 65536) return json(413, {error: 'This request is too large.'});
        const chunks = []; let length = 0;
        for await (const chunk of request.body ?? []) {
          length += chunk.byteLength;
          if (length > 65536) return json(413, {error: 'This request is too large.'});
          chunks.push(Buffer.from(chunk));
        }
        body = Buffer.concat(chunks);
      }
      if (pathname.startsWith('/api/hosted/')) {
        if (pathname.endsWith('/session') && request.method === 'GET') return json(200, hosted);
        if (!accessRequired) return json(404, {error: 'This demo does not use an access code.'});
        if (pathname.endsWith('/unlock') && request.method === 'POST') {
          let data; try { data = JSON.parse(body); } catch { return json(400, {error: 'Enter your access code.'}); }
          if (!data || Object.keys(data).join() !== 'code' || typeof data.code !== 'string' || data.code.length > 256) return json(400, {error: 'Enter your access code.'});
          const result = access.unlock({code: data.code, visitorId: visitor.visitorId});
          if (!result.ok) return json(401, {error: 'That code did not work. Please try again.'});
          cookies.push(result.setCookie);
          return json(200, {...hosted, unlocked: true, workspace: 'private'});
        }
        if (pathname.endsWith('/lock') && request.method === 'POST') {
          cookies.push(access.lock());
          return json(200, {...hosted, unlocked: false, workspace: 'public'});
        }
        return json(405, {error: 'This request is not supported.'});
      }
      // Bind every mutation to the workspace the page was showing. A lock,
      // unlock, or expiry in another tab must never silently move a write.
      const expectedScope = request.headers.get('x-eventbrief-workspace');
      if ((request.method === 'POST' || expectedScope !== null) && expectedScope !== scope) {
        return json(409, {code: 'WORKSPACE_CHANGED', error: 'Your workspace changed. Refresh this page before continuing.'});
      }
      if (pathname === '/api/package/demo' && accessRequired && unlocked) return json(409, {error: 'Open the public sample first. Samples stay separate from your private events.'});
      if (pathname === '/api/package/analyze' && !unlocked) return json(401, {error: 'Enter the access code to open the private workspace and use real AI.'});
      const fs = createBlobFiles({root: storageRoot, visitorId: unlocked ? privateWorkspaceId : visitor.visitorId, sdk});
      const workspace = await createPackageWorkspace(join(storageRoot, 'workspace'), fixture.profile, {fs});
      const restaurantSettingsStore = unlocked ? await createRestaurantSettingsStore(join(storageRoot, 'restaurant-settings'), fixture.profile, {fs}) : null;
      const attemptStore = createAttemptStore(join(storageRoot, 'attempts'), {fs});
      const model = 'gpt-6.1-sol', maxOutputTokens = 7500;
      const allowance = aiConfigured && unlocked ? await createHostedPackageAllowance({
        fs: createBlobFiles({root: storageRoot, visitorId: 'global-paid-allowance-v1', sdk}),
        directory: join(storageRoot, 'paid'), attemptStore,
        templates: [prompt, pastedPrompt(prompt)].map(text => buildPackageRequest(fixture.input, fixture.profile, text, model, {maxOutputTokens}))
      }) : null;
      const core = createHandler({
        key: env.EVENTBRIEF_OPENAI_API_KEY ?? '', enabled: aiConfigured && unlocked,
        model, maxCalls: 20, packageMaxOutputTokens: maxOutputTokens,
        packageWorkspace: workspace, packageStore: allowance?.store ?? attemptStore,
        packageAllowance: allowance, hostedOrigin: url.origin, hosted, restaurantSettingsStore,
        evaluationStore:createEvaluationStore(join(storageRoot,'evaluation-runs'), {fs}),
        buildRevision:env.VERCEL_GIT_COMMIT_SHA ?? 'local',
        ...(packageTransport ? {packageTransport} : {}), ...(quotePdfRenderer ? {quotePdfRenderer} : {})
      });
      const req = {method: request.method, url: pathname, headers: {...Object.fromEntries(request.headers), host: url.host},
        async *[Symbol.asyncIterator]() { if (body.length) yield body; }};
      let response;
      const res = {writeHead(status, values) { this.status = status; this.headers = values; }, end(value) {
        const headers = new Headers({...this.headers, ...securityHeaders});
        for (const cookie of cookies) headers.append('Set-Cookie', cookie);
        response = new Response(value, {status: this.status, headers});
      }};
      await core(req, res);
      return response ?? json(500, {error: 'The request could not be completed.'});
    } catch (error) {
      // Never log source messages, provider responses, cookies, or credentials.
      console.error('EventBrief hosted request failed', {type: error?.name ?? 'Error'});
      return json(503, {error: 'The saved workspace is temporarily unavailable. Please try again shortly.'});
    }
  };
}

export const hostedFetch = createHostedFetch();
