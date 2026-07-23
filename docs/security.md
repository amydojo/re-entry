# Security model

## Provider workspace

Every provider mutation is performed with a verified Supabase session. Server code uses `auth.getClaims()` rather than trusting unvalidated session payloads. Provider-owned tables have Row Level Security policies rooted in `auth.uid()` and explicit ownership joins.

Protocol Studio browser code never receives a service-role key. Draft save, publication, issuance, and archive are performed by narrowly scoped authenticated RPCs with empty `search_path` values. Direct table mutation grants are withheld from browser roles.

## Tenant isolation

RLS is enabled on:

- protocol templates and draft items
- immutable template versions, version items, aliases, and return events
- Skin Passes, copied items, copied aliases, return events, versions, access tokens, and audit events

A provider can read only records rooted in their own provider ID. Anonymous users cannot enumerate template, version, pass, item, alias, or audit tables.

## Immutable publication

Published edition rows are protected by database triggers that reject update and delete operations. Publication occurs inside `publish_protocol_template`, which locks the template, validates the current draft, allocates the next edition number, and writes the complete normalized edition atomically.

Editing a published protocol updates only the provider’s working draft. It cannot mutate historical editions.

## Transactional issuance

`issue_skin_pass_from_template` verifies all of the following inside one transaction:

- the caller is authenticated
- the requested edition belongs to that provider
- the parent template is published
- the parent template is not archived
- a client name and treatment date are present

It then copies the immutable edition into pass-owned records, creates the issued snapshot, allocates the public ID and random token, stores only `SHA-256(token)`, and writes the audit event. Draft and archived templates are rejected at the database boundary.

## Client access

Client access is accountless but not public. The route contains a random permanent pass ID and a high-entropy token. The raw token is returned once at issuance and never stored. Postgres stores the hash and compares it inside `lookup_skin_pass`.

The lookup function:

- has an empty `search_path`
- is the only protocol-reading RPC executable by `anon`
- applies a 30-attempt per 10-minute fingerprint limit
- validates token revocation and expiration
- returns minimal lifecycle data for invalid, expired, and revoked access
- never exposes provider workspace tables
- emits database-controlled `serverNow` and `lastVerifiedAt`
- returns copied aliases and client explanations only for a verified active pass

## Vocabulary safety

Canonical names, stable keys, and aliases use the same normalization during authoring validation and client lookup. Publication rejects ambiguous cross-item terms. The client engine never silently resolves an alias collision.

Symptom language remains outside item classification and returns `PROVIDER_ONLY`. Unknown vocabulary returns `NOT_IN_PASS`. Neither path invokes medical inference.

## Mutation integrity

- completed return events are protected by update and delete triggers
- pass-specific updates accept only incomplete future events
- each pass update creates a new pass protocol version and audit event
- revocation updates the pass and active tokens atomically
- published template editions are immutable
- archived protocols cannot issue new passes
- existing passes retain copied data after template publication or archive
- authenticated and token responses are not cacheable

## Secrets

Only the publishable Supabase key is allowed in browser code. The repository contains no secret or service-role key. `SUPABASE_SECRET_KEY` is used only by optional local seed tooling and deployment environments. `.env*` files are ignored.

## Practical limitations

The public rate limit is database-backed and intentionally modest for this slice. A larger deployment should add Vercel Firewall or equivalent edge abuse controls while retaining the database check as defense in depth.

`private.pass_access_attempts` is intentionally inaccessible outside security-definer functions. Supabase may flag the private table because RLS is disabled; it is not exposed through the API schema or granted to application roles. Enabling RLS without a matching internal execution policy would block the lookup limiter, so this warning is documented rather than automatically changed.

Supabase leaked-password protection is a project Auth setting and should be enabled before broad provider onboarding. A manual physical assistive-technology pass remains appropriate beyond automated accessibility coverage.
