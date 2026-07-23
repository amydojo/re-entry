# Security model

## Provider workspace

Every provider mutation is performed with a verified Supabase session. Server code uses `auth.getClaims()` rather than trusting unvalidated session payloads. Provider-owned tables have Row Level Security policies rooted in `auth.uid()` and the pass owner.

## Client access

Client access is accountless but not public. The route contains a random permanent pass ID and a high-entropy token. The raw token is returned once at issuance and never stored. Postgres stores `SHA-256(token)` and compares hashes inside `lookup_skin_pass`.

The lookup function:

- has an empty `search_path`
- is the only RPC executable by `anon`
- applies a 30-attempt per 10-minute fingerprint limit
- validates token revocation and expiration
- returns minimal lifecycle data for invalid, expired, and revoked access
- never exposes provider workspace tables
- emits `serverNow` and `lastVerifiedAt`

## Mutation integrity

- completed return events are protected by update and delete triggers
- `publish_protocol_update` accepts only incomplete future events
- each update creates a new immutable protocol version and audit event
- revocation updates the pass and all active tokens atomically
- authenticated and token responses are not cacheable

## Secrets

Only the publishable Supabase key is allowed in browser code. The repository contains no secret or service-role key. `SUPABASE_SECRET_KEY` is used only by the optional local seed script and deployment environment. `.env*` files are ignored.

## Practical limitations

The public rate limit is database-backed and intentionally modest for this slice. A larger deployment should add Vercel Firewall or equivalent edge abuse controls while retaining the database check as defense in depth.
