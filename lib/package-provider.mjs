import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { packageOutputSchema, PACKAGE_MODEL_VERSION, validatePackageRecord } from './package-contract.mjs';
import { LESSON_GUIDANCE, validateLessons } from './coordinator-feedback.mjs';

const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const sourceFiles = ['package-provider.mjs', 'package-contract.mjs', 'event-package.mjs', 'package-normalization.mjs', 'attempt-store.mjs', 'coordinator-feedback.mjs'];
const implementation = Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, digest(await readFile(new URL(name, import.meta.url), 'utf8'))])));

export function buildPackageRequest(input, profile, prompt, model, { maxOutputTokens = 10000, lessons = [] } = {}) {
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 10000) throw new Error('Invalid output-token allowance.');
  const vocabulary = {
    categories: profile.categories, venues: Object.keys(profile.venues), menus: Object.keys(profile.menus),
    beverages: Object.keys(profile.beverages), dietary: profile.supported_dietary, av: profile.supported_av, special: profile.supported_special
  };
  return {
    model, store: false, reasoning: { effort: 'medium' }, max_output_tokens: maxOutputTokens,
    instructions: prompt,
    input: [{ role: 'user', content: JSON.stringify({ messages: input.messages, vocabulary,
      ...(lessons.length ? {coordinator_lessons:{guidance:LESSON_GUIDANCE,examples:validateLessons(lessons)}} : {}) }) }],
    text: { format: { type: 'json_schema', name: 'event_package_record', strict: true, schema: packageOutputSchema } }
  };
}

export async function responsesTransport({ request, key, fetcher = fetch }) {
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(request), signal: AbortSignal.timeout(90000)
  });
  return { status: response.status, ok: response.ok, body: await response.text(), request_id: response.headers.get('x-request-id') };
}

const messages = {
  transport_error: 'The model request did not finish. Its billing outcome may be unknown.',
  http_error: 'The model service returned an HTTP error.',
  response_json: 'The model service returned an unreadable response.',
  incomplete: 'The model response was incomplete; no package was accepted.',
  refusal: 'The model declined the request; no package was accepted.',
  output_json: 'The model output was not valid JSON; no package was accepted.',
  invalid_output: 'The model output failed the record or source-evidence checks; no package was accepted.'
};
function reject(code) { const error = new Error(messages[code]); error.code = code; throw error; }
function decode(raw, input) {
  if (!raw || raw.status !== 'completed') reject('incomplete');
  const content = (Array.isArray(raw.output) ? raw.output : []).filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : []);
  if (content.some(item => item.type === 'refusal')) reject('refusal');
  const text = content.filter(item => item.type === 'output_text').map(item => item.text).join('');
  let output;
  try { output = JSON.parse(text); } catch { reject('output_json'); }
  try {
    if (output?.schema_version !== PACKAGE_MODEL_VERSION) throw new Error('Expected expanded model contract.');
    validatePackageRecord(output, input);
  } catch { const error = new Error(messages.invalid_output); error.code = 'invalid_output'; error.parsed_output = output; throw error; }
  return output;
}

export async function capturePackageAttempt({ input, profile, prompt, model, key, store, transport = responsesTransport, mode = 'live', maxOutputTokens = 10000, lessons = [] }) {
  if (!['live', 'simulated'].includes(mode)) throw new Error('Invalid provider mode.');
  const request = buildPackageRequest(input, profile, prompt, model, { maxOutputTokens, lessons });
  // The Authorization header and exception strings are deliberately never persisted.
  let runId;
  try {
    runId = await store.begin({ started_at: new Date().toISOString(), purpose: mode === 'simulated' ? 'fake_provider_test' : 'development_model_run', mode,
      scenario_id: input.id, input, profile, input_hash: digest(input), profile_hash: digest(profile), request,
      request_hash: digest(request), prompt_hash: digest(prompt), schema_hash: digest(packageOutputSchema), implementation });
  } catch {
    return { ok: false, status: 'capture_unavailable', error: 'The attempt could not be saved. No model request was made.', dispatched: false, receipt_saved: false, run_id: null };
  }
  const start = performance.now();
  let response = null, raw = null, output = null, failure = null;
  let redacted = false;
  try {
    try { response = await transport({ request, key }); } catch { reject('transport_error'); }
    // Providers can echo a credential in an error response. Preserve text except the exact credential.
    const redact = text => {
      if (typeof text !== 'string' || !key || !text.includes(key)) return text;
      redacted = true;
      return text.split(key).join('[REDACTED_CREDENTIAL]');
    };
    response = { status: response.status, ok: response.ok, body: redact(response.body), request_id: redact(response.request_id ?? null) };
    try { raw = JSON.parse(response.body); } catch { if (response.ok) reject('response_json'); }
    if (!response.ok) reject('http_error');
    output = decode(raw, input);
  } catch (error) {
    failure = { code: Object.hasOwn(messages, error.code) ? error.code : 'invalid_output', message: messages[error.code] ?? messages.invalid_output };
    output = error.parsed_output ?? null;
  }
  const meta = { provider: mode === 'simulated' ? 'Fake provider' : 'OpenAI', requested_model: model, model: raw?.model ?? null,
    response_id: raw?.id ?? null, usage: raw?.usage ?? null, latency_ms: Math.round(performance.now() - start), http_status: response?.status ?? null };
  const receipt = { status: failure ? 'failed' : 'succeeded', finished_at: new Date().toISOString(), raw_response: response?.body ?? null,
    request_id: response?.request_id ?? null, credential_redacted: redacted, parsed_output: output, meta, error: failure, automatic_retries: 0 };
  try { await store.finish(runId, receipt); }
  catch {
    return { ok: false, run_id: runId, error: 'The request finished, but its final receipt could not be saved. No package was accepted. Do not retry automatically.', dispatched: true, receipt_saved: false, status: 'capture_failed' };
  }
  return failure
    ? { ok: false, run_id: runId, error: `${failure.message} No automatic retry was made.`, dispatched: true, receipt_saved: true, status: failure.code }
    : { ok: true, run_id: runId, output, meta, mode, dispatched: true, receipt_saved: true };
}
