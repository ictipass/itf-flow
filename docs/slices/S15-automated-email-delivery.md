# S15 - Automated Email Delivery and Secure Worker Processing

## Status

Implemented locally. The protected worker, Official Email outbox integration, SMTP-driven dispatch
transition and administrative recovery controls are implemented pending final validation and commit.

## Outcome

Process durable outbox messages through ITF's private SMTP server using a protected, bounded worker.
Connect an Official Email dispatch record to an idempotent outbound message and update dispatch state
only after SMTP accepts that message. Do not perform SMTP work inside ordinary correspondence actions.

## Dependencies already available

- `EmailOutbox` with queued, processing, sent, failed and dead-letter states.
- Per-attempt audit records and bounded exponential retry.
- Idempotency keys and stale-processing-lock recovery.
- Manual administrator batch processor.
- Environment-based private SMTP configuration.
- Dispatch records, channels and delivery state machine.
- Attachment malware status and document-storage boundary.

## In scope

1. Add a worker authentication secret to `.env.example` and environment validation.
2. Add a protected route suitable for Vercel Cron or a dedicated scheduler.
3. Accept only the expected authorization mechanism; return 401 without revealing configuration details.
4. Process a bounded batch and return aggregate counts, never recipient addresses or SMTP responses.
5. Prevent overlapping workers from sending the same outbox row.
6. Recover stale locks and preserve attempt numbering.
7. Create an outbox entry when an authorized officer prepares an `OFFICIAL_EMAIL` dispatch.
8. Use a dispatch-specific idempotency key so retries cannot enqueue duplicates.
9. Link the outbox record to its dispatch source using existing source fields or an additive relation if justified.
10. Mark dispatch `DISPATCHED` only after SMTP accepts the message.
11. Treat SMTP acceptance as dispatched, not as recipient-confirmed delivery.
12. Keep manual delivery confirmation separate.
13. Expose safe administrator retry/dead-letter recovery controls.
14. Add queue age, failure count and dead-letter visibility without exposing message bodies by default.
15. Add audit events for queued, SMTP accepted, failed and administratively retried dispatch email.
16. Update presentation, demo and operations documentation.

## Attachment rule

No attachment may be emailed unless its malware status is `CLEAN` and its content is available from the
configured storage provider. Current demo files are generally `NOT_SCANNED`; therefore S15 must either:

- send a controlled notification without attachments and clearly state that limitation; or
- block the Official Email dispatch until the production scanning pipeline exists.

It must never silently attach `NOT_SCANNED`, `PENDING`, `QUARANTINED`, or `INFECTED` content. The chosen
interim behavior must be visible to dispatch officers and documented.

## Security design

- Use a long independent worker secret stored only in environment/deployment secrets.
- Compare credentials safely and reject missing credentials.
- Do not accept the staff session cookie as sufficient authorization for the scheduled endpoint.
- Do not put credentials, SMTP response text, message bodies or recipient lists in logs or route responses.
- Limit batch size and runtime to protect the private mail server and serverless execution limits.
- Keep recipient validation and dispatch authorization server-side.
- Do not permit arbitrary caller-provided `from` addresses, SMTP hosts or templates.
- Keep HTML disabled initially; send controlled plain text unless a reviewed template system is introduced.
- Preserve classification boundaries and avoid including sensitive subjects in generic notifications.

## Concurrency and idempotency

- Claim each row with a conditional update using its current state/attempt count.
- A second worker must skip a row already claimed by the first worker.
- The dispatch enqueue key must be deterministic.
- Retrying an HTTP request, server action or scheduled invocation must not duplicate a message.
- A worker crash must leave the row reclaimable after the documented lock timeout.
- Success must be committed atomically with the delivery-attempt record and dispatch audit transition.

## Performance constraints

- No continuous database polling from browsers or application servers.
- Scheduled invocation or explicit administrator action performs bounded indexed queries.
- Default batch should remain small for the private mail server; make any increase configuration-controlled.
- Process sequentially or with tightly bounded concurrency until the mail administrator approves a rate.
- Add indexes only through a migration and validate query shape against expected queue volume.

## User experience

- Dispatch officer sees whether email is queued, processing, SMTP accepted, failed or dead-lettered.
- Administrator can retry eligible failed/dead-letter items with a recorded reason.
- User-facing messages distinguish configuration failure from recipient/delivery failure without leaking internals.
- The detail timeline shows who prepared dispatch and what the delivery processor recorded.

## Test matrix

- Missing worker secret -> 401.
- Incorrect worker secret -> 401.
- Correct secret with empty queue -> success and zero counts.
- `MAIL_ENABLED=false` -> safe configuration failure; rows remain retryable and no secret leaks.
- Valid SMTP acceptance -> outbox sent, attempt successful, dispatch marked dispatched once.
- Authentication failure -> sanitized code, failed state, retry scheduled.
- Maximum attempts -> dead-letter.
- Two simultaneous processors -> one send only.
- Repeated dispatch action/request -> one outbox record only.
- Stale processing lock -> safely reclaimed.
- Non-email dispatch -> no SMTP outbox record.
- Missing recipient email -> validation failure before dispatch preparation.
- Unapproved approval-controlled correspondence -> no dispatch or outbox record.
- Superseded approval -> no dispatch or outbox record.
- Unsafe attachment -> blocked or omitted exactly as documented.
- Successful SMTP acceptance does not mark recipient delivery confirmed.

## Migration and rollback considerations

Prefer existing source fields if they provide an unambiguous link. If schema changes are necessary, create
one additive migration, preserve existing outbox rows, and avoid destructive enum/value changes. A failed
deployment must leave queued messages unsent rather than losing or duplicating them.

## Documentation changes required

- `.env.example` and environment doctor.
- `docs/notifications-and-email-outbox.md`.
- `docs/dispatch-registry.md`.
- Stakeholder presentation package, demo script and "do not claim" list.
- Cross-machine handover and production worker instructions.
- This document's status and the master slice register.

## Acceptance criteria

- [ ] Protected worker route passes the authentication test matrix.
- [ ] No continuous polling exists.
- [ ] Official Email dispatch enqueues exactly one durable message.
- [ ] SMTP is not called inside a user workflow request.
- [ ] Dispatch becomes `DISPATCHED` only after SMTP acceptance.
- [ ] Delivery remains separately confirmable.
- [ ] Unsafe attachments cannot be transmitted.
- [ ] Retry, stale-lock, concurrency and dead-letter tests pass.
- [ ] Lint, type checking and production build pass.
- [ ] Migration status is current.
- [ ] Documentation and stakeholder claims match implemented behavior.
- [ ] Changes are committed as one reviewable slice and the tree is clean.
