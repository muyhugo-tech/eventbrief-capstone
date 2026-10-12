import { outputSchema, validateOutput } from './contract.mjs';

export function buildRequest(input, prompt, model) {
  // Intentionally accepts only public message input. No reference-answer loader here.
  return {
    model, store: false, reasoning: { effort: 'medium' }, max_output_tokens: 6000,
    instructions: prompt,
    input: [{ role: 'user', content: JSON.stringify({ messages: input.messages }) }],
    text: { format: { type: 'json_schema', name: 'event_brief', strict: true, schema: outputSchema } }
  };
}

export async function analyze({ input, prompt, model, key, fetcher = fetch }) {
  const start = performance.now();
  let response;
  try {
    response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(buildRequest(input, prompt, model)), signal: AbortSignal.timeout(90000)
    });
  } catch {
    throw new Error('The model request did not finish. Its billing outcome may be unknown. No automatic retry was made.');
  }
  if (!response.ok) throw new Error(`The model service returned HTTP ${response.status}. Check the capstone API configuration; no automatic retry was made.`);
  const raw = await response.json();
  if (raw.status !== 'completed') throw new Error('The model returned an incomplete response. No brief was accepted.');
  const content = (raw.output ?? []).filter(item => item.type === 'message').flatMap(item => item.content ?? []);
  if (content.some(item => item.type === 'refusal')) throw new Error('The model declined this request. No brief was accepted.');
  const text = content.filter(item => item.type === 'output_text').map(item => item.text).join('');
  let output;
  try { output = JSON.parse(text); } catch { throw new Error('The model response was not valid JSON. No brief was accepted.'); }
  validateOutput(output, input);
  return { output, meta: { provider: 'OpenAI', model: raw.model ?? model, response_id: raw.id ?? null, usage: raw.usage ?? null, latency_ms: Math.round(performance.now() - start) } };
}
