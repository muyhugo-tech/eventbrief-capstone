import { hostedFetch } from '../lib/hosted/handler.mjs';

// One function reuses the same extraction, validation, review, and export core.
export default { fetch: hostedFetch };
