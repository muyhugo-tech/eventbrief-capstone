// A deliberately small projection for the board, calendar and document libraries.
// Original messages, evidence, dietary details and internal instructions stay out.
export function packageSummary(prepared, reviews = {}) {
  const fields = prepared.record.fields;
  const documents = prepared.documents.map(doc => ({
    id: doc.id, title: doc.title, state: doc.state,
    reviewed: doc.state === 'ready_for_review' && reviews[doc.id]?.revision === doc.revision
  }));
  return {
    ...Object.fromEntries(['host_name', 'event_date', 'start_time', 'end_time', 'timezone', 'venue',
      'guest_count', 'guest_13_plus_count', 'child_count'].map(field => [field, fields[field]?.value ?? null])),
    ready_count: documents.filter(doc => doc.state === 'ready_for_review').length,
    reviewed_count: documents.filter(doc => doc.reviewed).length,
    documents,
    quote_total_cents: prepared.documents.find(doc => doc.id === 'quote')?.quote?.total_cents ?? null
  };
}
