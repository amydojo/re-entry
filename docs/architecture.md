# RE:ENTRY architecture

## Product boundary

RE:ENTRY is a provider-authored state machine, not a clinical decision system. The database stores the protocol. Server time selects the current state. The client explains only that selected state.

## Runtime

- Next.js App Router renders provider and client surfaces.
- Supabase Auth creates provider sessions.
- Supabase Postgres owns protocol data, version history, audit history, lifecycle, and token hashes.
- Row Level Security isolates provider-owned workspace data.
- A single security-definer RPC is the public client boundary. It verifies the token hash, lifecycle state, and practical rate limit before returning a deliberately shaped artifact.
- Vercel runs the application. Authenticated and token routes are dynamic and `private, no-store`.

## Living Skin Pass loop

1. The provider signs in and issues a Microneedling pass.
2. `issue_skin_pass` allocates a non-sequential internal UUID, a permanent random public ID, and a 256-bit client token.
3. Only the SHA-256 token hash is stored.
4. A client request invokes `lookup_skin_pass` with the public ID and raw token.
5. The RPC uses database time, closes due return events, and returns one versioned snapshot.
6. The TypeScript time engine derives available, queued, held, returned, and routine-restored presentation from that snapshot.
7. A provider may publish a future-event date change. The database increments the protocol version and preserves the previous date.
8. Revocation closes the token and causes the public boundary to return no protocol details.

## Time model

The client device clock is never authoritative. `serverNow` is emitted by Postgres. Treatment-relative dates are persisted as timestamps. Visual state is computed on request, so no cron job is needed. Offline presentation keeps the last verified snapshot and does not advance it.

## Main modules

- `src/lib/domain/time-engine.ts`: deterministic state and answer derivation
- `src/lib/domain/protocol-policy.ts`: future-only mutation rules
- `src/lib/server/pass-access.ts`: public lookup adapter
- `src/lib/supabase/*`: request-scoped Supabase SSR clients
- `src/components/pass/*`: Skin Pass artifact, rail, answers, inventories, offline and motion states
- `src/components/provider/*`: issuance and management workflows
- `supabase/migrations/*`: schema, RLS, functions, lifecycle and token security
