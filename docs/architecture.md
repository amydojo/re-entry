# RE:ENTRY architecture

## Product boundary

RE:ENTRY is a provider-authored state machine, not a clinical decision system. The provider defines the vocabulary and time rules. Postgres fixes published editions and issued snapshots. Server time selects the current pass state. The client explains only that selected state.

## Runtime

- Next.js App Router renders provider and client surfaces.
- Supabase Auth creates provider sessions.
- Supabase Postgres owns drafts, published editions, issued snapshots, return events, version history, audit history, lifecycle, and token hashes.
- Row Level Security isolates provider-owned workspace data.
- Security-definer mutation RPCs enforce transactional publication, issuance, archive, pass update, and revocation.
- `lookup_skin_pass` is the deliberate public capability boundary. It verifies the token hash, lifecycle state, and database rate limit before returning a shaped client snapshot.
- Vercel runs the application. Authenticated and token routes are dynamic and `private, no-store`.

## Protocol lifecycle

### Mutable template

`protocol_templates` stores provider ownership, identity, duration, timezone, guidance, lifecycle status, latest published version, and whether unpublished work exists. `protocol_draft_items` stores the current editable item order, aliases, explanations, and return rules.

Draft data is provider-private. A draft cannot issue a Skin Pass.

### Immutable published edition

`publish_protocol_template` validates the complete draft inside one database transaction. It allocates the next version number and writes:

- `protocol_template_versions`
- `protocol_template_version_items`
- `protocol_template_version_aliases`
- `protocol_template_version_events`

Update and delete triggers reject mutation of these records. Editing after publication changes only the working draft. A later publication creates another immutable edition.

### Immutable issued snapshot

`issue_skin_pass_from_template` accepts one published edition ID and verifies that its parent template is still published and not archived. In one transaction it creates:

- the Skin Pass record and edition linkage
- an `issued_snapshot` JSON document
- copied pass items and aliases
- treatment-relative return timestamps in the provider timezone
- pass protocol version 1
- a high-entropy access token hash
- the issuance audit event

The raw access token is returned once. Existing passes no longer depend on a mutable template.

## Client evaluation loop

1. A client request invokes `lookup_skin_pass` with the public ID and raw token.
2. Postgres verifies the SHA-256 token hash, lifecycle, expiration, and rate limit.
3. Database time closes due events and emits `serverNow`.
4. The TypeScript time engine derives available, queued, held, returned, and routine-restored presentation from only the issued snapshot.
5. Item lookup uses canonical names, stable keys, and copied aliases.
6. Unknown vocabulary returns `NOT_IN_PASS`; symptom language returns `PROVIDER_ONLY`.
7. Offline presentation keeps the last verified snapshot and does not advance it.

## Time model

The client device clock is never authoritative. Treatment-relative days are converted to timestamps in the provider-authored IANA timezone by the database. The recovery day is calculated from `serverNow`, treatment date, and the same timezone. Routine restoration requires both completion of authored return events and arrival at the declared recovery boundary.

## Pass-specific updates

A provider may still move an incomplete future return event for one issued pass. `publish_protocol_update` preserves the previous timestamp, increments the pass protocol version, and writes an audit event. It does not mutate the template edition or other passes issued from that edition.

## Microneedling migration

The Protocol Studio migration creates a provider-owned Microneedling template, edition 1, items, aliases, and return definitions. Existing Microneedling passes are linked to the edition and receive an explicit historical snapshot. Their established return timestamps and pass version history are not regenerated.

## Main modules

- `src/lib/domain/protocol-studio.ts`: shared authoring schemas, validation, snapshot generation, change summaries, and preview source
- `src/lib/domain/normalization.ts`: shared lookup normalization and symptom boundary
- `src/lib/domain/time-engine.ts`: treatment-agnostic pass state and answer derivation
- `src/lib/domain/protocol-policy.ts`: pass-specific future-only mutation rules
- `src/lib/server/pass-access.ts`: public lookup adapter
- `src/lib/supabase/*`: request-scoped Supabase SSR clients
- `src/components/provider/protocol-studio-editor.tsx`: accessible authoring, rail, preview, publication, history, and archive flows
- `src/components/pass/*`: Skin Pass artifact, rail, answers, inventories, offline and motion states
- `supabase/migrations/20260723190000_protocol_studio.sql`: immutable edition model, RLS, transactions, and migration
