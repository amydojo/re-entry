# RE:ENTRY

**Provider-authored live aftercare. Time is part of the protocol.**

RE:ENTRY issues a permanent digital Skin Pass after treatment and stages the return of products and activities through temporary routine states. The provider authors the rules. RE:ENTRY runs them. The product never diagnoses symptoms, infers clinical guidance, invents timing, or answers an item that was not included in the issued protocol.

## Production vertical slices

### Skin Pass

- provider authentication and Skin Pass desk
- permanent pass ID and one-time secure link delivery
- accountless client Skin Pass
- available, held, queued, returned, and not-listed answers
- provider guidance and symptom escalation boundary
- server-controlled time advancement and offline last-verified state
- future-event update, pass version history, audit history, and revocation

### Protocol Studio

A solo provider can now create a treatment protocol entirely through the product:

- define protocol identity, recovery duration, timezone, guidance, and routine-restored copy
- create ordered product, ingredient, category, or activity items
- define canonical names and client lookup aliases
- place each held item on the Re-entry Rail
- preview the real client Skin Pass engine across recovery days
- save partial private drafts
- validate and publish immutable editions
- inspect version history
- issue a pass from the current published edition
- archive a protocol without breaking historical passes

The seeded Microneedling protocol and the Light Chemical Peel demonstration use the same generic product model. No treatment-specific branch exists in the client engine.

## Domain model

RE:ENTRY separates three records deliberately:

1. **Protocol template**: the provider-owned working draft and lifecycle state.
2. **Published template version**: an immutable, numbered edition containing the exact authored definition.
3. **Issued pass snapshot**: the definition copied to one client pass at issuance.

Editing a template never rewrites a published version. Publishing a newer edition never silently changes a pass already issued from an older edition. Pass-specific future-event changes continue to create their own pass protocol versions and audit history.

See [architecture](docs/architecture.md), [security model](docs/security.md), and [ADR 0002](docs/adr/0002-immutable-protocol-editions.md).

## Architecture

Next.js App Router and strict TypeScript run on Vercel. Supabase provides Postgres, provider Auth, Row Level Security, transactional publication and issuance functions, and the accountless token boundary. Shared Zod schemas validate authoring and API input. Vitest covers deterministic domain logic. Playwright covers provider, client, keyboard, narrow-width, and reduced-motion journeys.

## Visual system

The implementation is derived from the RE:ENTRY Figma source of truth and centralizes its variables in `src/app/globals.css`:

- Geist for human meaning and Geist Mono for machine metadata
- warm mineral canvas and paper artifact
- ink black, graphite hairlines, and black enamel boundaries
- amber only for live or current states
- protocol items as labeled technical strips
- the Re-entry Rail as a time instrument
- publication as fixing a stable edition
- version history as a technical record
- the live client preview as machine output

There are no gradients, generic dashboard cards, medical recommendations, gamification, or decorative analytics. Motion communicates state change rather than celebration. `prefers-reduced-motion` replaces the sequence with an immediate state swap.

## Local setup

Requirements: Node.js 22+, npm, and a Supabase project.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SECRET_KEY=
DEMO_PROVIDER_EMAIL=
DEMO_PROVIDER_PASSWORD=
REENTRY_DEMO_MODE=0
```

`NEXT_PUBLIC_*` values are publishable. `SUPABASE_SECRET_KEY` is server-only and is needed only for deterministic seed tooling. Never expose it in browser code or commit it.

## Database setup

Apply migrations in order:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

The Protocol Studio migration is additive. It creates provider-owned templates, private draft items, immutable editions and edition children, aliases, return-event definitions, pass snapshot linkage, RLS policies, immutability triggers, transactional RPCs, and a safe Microneedling backfill. Existing Skin Pass rows are linked to the migrated edition without rewriting their historical item timing.

Publication is transactional through `publish_protocol_template`. Issuance is transactional through `issue_skin_pass_from_template`. Draft and archived templates are rejected by the database, not only the interface.

## Alias rules

Aliases and canonical names use the same normalization in authoring and client lookup:

- Unicode compatibility normalization
- lowercase conversion
- punctuation collapsed to spaces
- repeated whitespace collapsed
- leading and trailing whitespace removed

Publication rejects duplicate canonical names, duplicate aliases within an item, aliases that repeat the same item’s canonical vocabulary, and terms that collide across different items. RE:ENTRY never chooses silently between ambiguous matches.

## Seed

The original seed creates a provider and Microneedling pass:

```bash
npm run seed
```

Protocol Studio includes a deterministic Light Chemical Peel authoring preset in `src/lib/domain/protocol-presets.ts`. It is exercised through the same draft, publication, issuance, and client-evaluation code as every other treatment.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Database verification files cover provider isolation, anonymous denial, immutable edition records, draft and archived issuance rejection, transaction boundaries, historical pass stability, and the existing public lookup behavior. CI runs clean install, lint, strict typecheck, unit tests, production build, and Playwright.

## Adding another treatment

1. Open Protocol Studio.
2. Create a draft and define the treatment label and recovery window.
3. Add canonical items, aliases, authored explanations, and return days.
4. Preview client states and item answers.
5. Resolve validation and publish an edition.
6. Issue a pass from that edition.

No application code change is required for a valid new treatment protocol.

## Deployment

1. Import the GitHub repository into Vercel.
2. Add the public Supabase URL and publishable key.
3. Keep `REENTRY_DEMO_MODE` unset or `0` outside automated tests.
4. Deploy the feature branch for preview verification.
5. Set Supabase Auth site and redirect URLs to the Vercel domains.

Authenticated provider routes and client-token routes are dynamic and emit `private, no-store` cache policy.

## Clinical and product boundaries

RE:ENTRY displays only the provider-authored issued protocol. It does not:

- diagnose symptoms or recovery conditions
- infer whether an unlisted product or activity is safe
- search general skincare guidance
- generate medical protocols or recommendations
- change timing from the client device clock
- replace the provider for pain, reactions, worsening symptoms, or unexpected recovery

Those questions route directly to the provider. An item not included in the pass receives **Not listed**, never a guessed answer.

## Known limitations

This slice remains optimized for a solo provider. It intentionally excludes organizations, staff roles, multiple locations, billing, scheduling, analytics, automated SMS, AI protocol generation, and external EHR imports. Public lookup rate limiting remains database-backed; a larger deployment should add Vercel Firewall as defense in depth.
