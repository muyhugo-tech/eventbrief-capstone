# Reused Yanni's code

These files are copied or narrowly adapted from the user's existing Yanni's
application, with the user's authorization. They are source code only. No live
database, customer records, message archive, environment file, or credentials
were copied. The source application is read-only during this capstone build.

## Evidence and source history

| Capstone file | Existing application source | Source SHA-256 | Adaptation |
| --- | --- | --- | --- |
| `evidence.mjs` | `lib/mailbox/conversation/evidence.ts` | `684783cc9b5159dfd2fac41ba135a41edbdb655dbc721b2484d9505b3f328b08` | Complete `sourceQuote` and `currentBody` implementations. TypeScript annotations removed using Node's type stripper; algorithms unchanged. |
| `source-history.mjs` | `lib/mailbox/conversation/history.ts` | `04a3c8476d2407c6e8ab6da07b2b7e9e7f3f939063d889b0a145fa35c49d07dc` | Stable fingerprint implementation and `appendHistory` identity, baseline, and immutable source guards. Adapted to append local source revisions instead of the original claim/observation ledger. |

The source application's `lib/conversation-review/snapshot.ts` (SHA-256
`790bf3f056b4ab2b34e26872245231dce7ff5f024e9a626f2c9f81488f72f8a9`)
also informed the stale-snapshot rule: when sources change, old results remain
readable but cannot be treated as current review results.

`../package-workspace.mjs` is the **new local-storage adapter** around that reused
source-integrity code. Numbered, exclusive-create files replace Supabase
transactions. Each reply advances a same-event source revision, preserves all
previous messages, and rejects changes based on an old version. Exact retries
return the same revision. Review marks remain tied to the original run and
document fingerprint; a new source version needs a fresh review.

The full `history-linker.ts` claim reconciler was inspected but **is not imported**.
It depends on a separate claim schema, Zod, and many restaurant-specific evidence
modules. This capstone retains its existing 18-field extraction contract and
re-analyzes the whole bounded conversation after a reply. Do not describe this
as a copy of the entire production conversation engine or as incremental LLM
reconciliation.

The guided sample in `../package-demo.mjs` has explicitly authored results for
one exact synthetic conversation and one exact reply. It is an offline
walkthrough, not an AI accuracy measurement or fallback for a failed AI request.
