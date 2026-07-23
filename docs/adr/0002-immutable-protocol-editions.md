# ADR 0002: Immutable protocol editions and issued snapshots

- Status: Accepted
- Date: 2026-07-23

## Context

Protocol Studio introduces a mutable provider authoring workspace. A provider must be able to improve a protocol over time, while clients and providers must also be able to prove what guidance was issued on a particular date.

A single mutable protocol record would make those requirements conflict. Editing the master protocol could silently change active client guidance, destroy historical evidence, and make a pass impossible to reproduce.

## Decision

RE:ENTRY separates three records:

1. A mutable provider-owned protocol template and draft items.
2. Immutable numbered template editions created by publication.
3. An immutable issued snapshot copied to each Skin Pass.

Published edition rows and their child records are protected from update and delete operations by database triggers. Publication and issuance are database transactions.

A pass stores the exact edition link and a complete JSON snapshot, then copies the item, alias, explanation, and return-event data required by the existing client engine. The pass can continue functioning if the template is later edited or archived.

Pass-specific future-event changes remain a separate version stream. They update only one active pass, increment that pass’s protocol version, and preserve audit evidence.

## Consequences

### Positive

- Historical guidance is reproducible.
- Active passes cannot be silently rewritten by master-template edits.
- Archived templates do not break client access.
- Version history has a clear technical meaning.
- A new treatment can be authored without application code changes.
- RLS ownership and issuance eligibility are enforceable in Postgres.

### Costs

- Protocol information is deliberately duplicated at edition and pass boundaries.
- Publication and issuance functions are more complex than direct table writes.
- Storage grows with each edition and issued pass.
- Schema changes affecting snapshot shape require backward-compatible readers or explicit migrations.

These costs are accepted because evidence integrity is a primary product requirement, not an implementation detail.

## Rejected alternatives

### Read active passes from the latest template

Rejected because a later edit would rewrite client guidance without a new issuance event.

### Store only a template version foreign key on the pass

Rejected because the pass should remain self-contained and recoverable even if provider lifecycle policies or future migrations change template availability.

### Allow editing published versions with an audit log

Rejected because audit logs describe mutation but do not preserve an inherently stable edition boundary. RE:ENTRY treats publication as fixing an edition.

### Generate protocol rules at client request time

Rejected because it introduces inference, reduces reproducibility, and violates the provider-authored product boundary.
