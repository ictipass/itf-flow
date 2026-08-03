# Exhaustive implementation-slice checklist

Use this checklist for every ITF Flow slice, especially when development continues on another machine.
Copy it into the slice issue/working notes and mark items with evidence. "Not applicable" requires a short
reason; it is not a substitute for checking the item.

## A. Handover and repository state

- [ ] Read the master slice register and the planned-next slice document.
- [ ] Record repository, branch, starting commit and developer/machine date.
- [ ] Run `git status --short`; identify every pre-existing change before editing.
- [ ] Confirm whether existing changes belong to the user, another slice or generated output.
- [ ] Fetch and fast-forward from the intended remote branch where authorized.
- [ ] Confirm Node.js, npm, PostgreSQL and application versions.
- [ ] Run `npm ci` after lockfile or machine changes.
- [ ] Create `.env` from `.env.example`; never copy secrets into source, issues or chat.
- [ ] Run `npm run env:check` and resolve required configuration gaps.
- [ ] Run `npm run db:status`; apply committed migrations with `npm run db:migrate`.
- [ ] Confirm local upload restoration if the database was transferred.
- [ ] Run the existing baseline lint/build/tests before changing code when feasible.
- [ ] Confirm the previous slice is committed and the current tree is clean.

## B. Slice definition

- [ ] State the business outcome in one paragraph.
- [ ] Identify primary users, accountable owner and affected offices.
- [ ] Write the happy-path workflow from start to finish.
- [ ] Write exception, rejection, cancellation, retry and recovery paths.
- [ ] List explicit in-scope and out-of-scope behavior.
- [ ] Identify dependencies on previous and future slices.
- [ ] Define user-visible statuses and transitions.
- [ ] Define authorization rules independently of UI visibility.
- [ ] Define audit events and required metadata.
- [ ] Define notifications and email effects.
- [ ] Define performance and scale constraints.
- [ ] Define security/privacy/classification assumptions.
- [ ] Define production gates that the demo does not satisfy.
- [ ] Write measurable acceptance criteria and test matrix before implementation.
- [ ] Confirm terminology with ITF business owners where ambiguity changes behavior.

## C. Data and migration design

- [ ] Reuse an existing model only when its meaning remains unambiguous.
- [ ] Prefer additive schema changes for deployed data.
- [ ] Add enums only for stable controlled states, not arbitrary labels.
- [ ] Define foreign keys, deletion behavior and nullable fields deliberately.
- [ ] Add uniqueness constraints for business invariants and idempotency.
- [ ] Add indexes for every expected queue, ownership, unread, date or status query.
- [ ] Consider multi-recipient and simultaneous-action behavior.
- [ ] Consider historical snapshots when directory/user data later changes.
- [ ] Preserve immutable audit and version records.
- [ ] Write a timestamped migration; do not rely on schema push for shared environments.
- [ ] Backfill existing rows when a new invariant applies to historical data.
- [ ] Avoid destructive migration operations unless separately approved and recoverable.
- [ ] Validate migration order from an empty database.
- [ ] Validate migration against a representative existing database.
- [ ] Confirm seed remains idempotent and does not erase business records.
- [ ] Update `.env.example` for new configuration without real values.

## D. Authorization and workflow integrity

- [ ] Authenticate every server action and protected route.
- [ ] Re-fetch the acting user from the server session.
- [ ] Validate record existence, current status and current ownership.
- [ ] Enforce role, reporting-line, peer, grant or dispatch authority server-side.
- [ ] Validate all recipient IDs are active, allowed and complete.
- [ ] Prevent hierarchy bypass through crafted form requests or direct API calls.
- [ ] Prevent a copied recipient from acting as an accountable owner.
- [ ] Prevent stale/repeated form submissions from repeating transitions.
- [ ] Use conditional updates or transactions for claims and concurrency-sensitive state.
- [ ] Define behavior for simultaneous recipients and partial completion.
- [ ] Reject invalid state transitions with safe, non-secret error messages.
- [ ] Recheck classification/need-to-know policy for reads and attachment downloads.
- [ ] Ensure broad administrative access does not accidentally expose private drafts or restricted files.
- [ ] Verify returned, superseded, withdrawn, expired, closed and deleted-like states.
- [ ] Keep approval, digital signature and dispatch confirmation meanings distinct.

## E. Transaction, audit and idempotency

- [ ] Perform business state, work item, decision, audit and notification writes in one transaction.
- [ ] Record actor, actor type, source and timestamp.
- [ ] Record previous and resulting status.
- [ ] Record action/copy recipients and routing purpose where relevant.
- [ ] Use stable source IDs and deterministic idempotency keys.
- [ ] Add unique constraints so retries cannot duplicate durable effects.
- [ ] Ensure transaction rollback removes notification/outbox side effects.
- [ ] Avoid external network calls inside database transactions.
- [ ] Avoid SMTP, EDMS or scanning calls inside ordinary request transactions.
- [ ] Ensure failed external operations remain retryable without corrupting workflow state.
- [ ] Preserve earlier decisions and mark supersession instead of deleting history.

## F. Input, file and content safety

- [ ] Validate every form/API field server-side with length and format limits.
- [ ] Give every user input an understandable label and placeholder.
- [ ] Validate dates, email addresses, URLs and enumerated values.
- [ ] Apply upload size and accepted-type limits.
- [ ] Validate file magic bytes before production use.
- [ ] Require malware status `CLEAN` before external transmission.
- [ ] Block quarantined/infected downloads and sends.
- [ ] Prevent path traversal and unsafe filenames.
- [ ] Do not render untrusted email HTML or load remote images.
- [ ] Do not expose secrets or full external-server responses.
- [ ] Keep local storage explicitly marked as demo-only.
- [ ] Preserve the EDMS/storage-provider boundary.

## G. Notification and background-work design

- [ ] Create notifications from events; do not continuously poll the database.
- [ ] Use indexed unread queries during navigation or an approved push transport.
- [ ] Keep notification text classification-safe.
- [ ] Create outbox records transactionally with their business event.
- [ ] Never wait for SMTP in an ordinary workflow request.
- [ ] Bound batch size, concurrency, retries and lock duration.
- [ ] Reclaim stale processing locks safely.
- [ ] Store sanitized error codes, not credentials or verbose server responses.
- [ ] Stop at dead-letter after the configured attempts.
- [ ] Protect scheduled/manual worker entry points.
- [ ] Ensure repeated worker invocations cannot duplicate delivery.
- [ ] Provide administrator visibility and recovery actions with audit reasons.

## H. UI, accessibility and usability

- [ ] Show the current status, owner, required action and next permitted step.
- [ ] Distinguish action, copy, review, concurrence, approval and dispatch responsibilities.
- [ ] Explain why an action is unavailable rather than silently hiding critical workflow context.
- [ ] Use searchable server-filtered people selection; do not load the full staff list.
- [ ] Preserve form values across validation errors where practical.
- [ ] Provide empty, loading, success and failure states.
- [ ] Make destructive/irreversible actions explicit and confirmed.
- [ ] Use semantic labels, keyboard-operable controls and visible focus.
- [ ] Check color contrast against the burgundy/black/white ITF theme.
- [ ] Do not rely on color alone for status.
- [ ] Verify tables at presentation resolution and on smaller screens.
- [ ] Avoid flicker, hydration loops and client-side refresh loops.
- [ ] Keep displayed dates/times consistent with Africa/Lagos expectations.

## I. Performance and scalability

- [ ] Avoid unbounded `findMany`, full staff lists and full audit-history loads.
- [ ] Apply pagination or explicit limits to registries and administrative queues.
- [ ] Select only required columns for search and aggregate queries.
- [ ] Verify indexes match filters and ordering.
- [ ] Avoid N+1 queries in lists and recipient resolution.
- [ ] Avoid per-user continuous polling.
- [ ] Keep scheduled work bounded and resumable.
- [ ] Consider thousands of staff, simultaneous recipients and large audit histories.
- [ ] Keep local/serverless filesystem limitations explicit.
- [ ] Identify caching opportunities only where authorization and freshness remain correct.

## J. Verification

- [ ] Run `npx prisma validate`.
- [ ] Run `npm run db:migrate` and `npm run db:status`.
- [ ] Run `npx prisma generate` after schema changes.
- [ ] Run `npm run lint` with zero warnings.
- [ ] Run TypeScript checking or the production build.
- [ ] Run `npm run build` and inspect generated routes.
- [ ] Run `git diff --check`.
- [ ] Verify the intended migration is present and no empty migration directory exists.
- [ ] Test the happy path using seeded roles.
- [ ] Test unauthorized roles and crafted IDs.
- [ ] Test duplicate submission and concurrency-sensitive actions.
- [ ] Test empty, invalid, expired, returned, superseded and closed states.
- [ ] Test database rollback for multi-write operations.
- [ ] Test email disabled, authentication failure, retry and dead-letter behavior where applicable.
- [ ] Test attachment absent, oversized, unsafe and unavailable states where applicable.
- [ ] Confirm no real credentials, personal data or correspondence entered fixtures/logs.
- [ ] Restore generated `next-env.d.ts` noise before staging when the build changes it.

## K. Documentation and presentation

- [ ] Update the master slice register status and commit evidence.
- [ ] Update the detailed slice document with actual decisions and deviations.
- [ ] Update `docs/next-slices.md` and remove duplicated/outdated bullets.
- [ ] Update README links and setup commands.
- [ ] Update `.env.example` and environment doctor.
- [ ] Update cross-machine handover for new services, data or secrets.
- [ ] Update operator/admin runbooks.
- [ ] Update stakeholder capabilities and honest MVP boundaries.
- [ ] Update live-demo steps, seeded roles and expected outcomes.
- [ ] Update "do not claim" statements.
- [ ] Document rollback/recovery and operational ownership.
- [ ] Record any production gate explicitly.

## L. Git and handoff completion

- [ ] Review `git status --short` and stage only slice files.
- [ ] Exclude `.env`, dumps, uploads, generated clients, logs and unrelated user changes.
- [ ] Run `git diff --cached --check`.
- [ ] Review staged diff/stat for accidental scope expansion.
- [ ] Use a focused conventional commit message.
- [ ] Record the commit hash in the master register.
- [ ] Confirm `git status` is clean after commit.
- [ ] Push only when authorized and confirm the remote commit.
- [ ] On another machine, pull with `--ff-only`, install, migrate and verify.
- [ ] State the next slice and any local configuration still required.

## Definition of done

A slice is done only when its business outcome works, server-side authorization and audit behavior are
correct, migrations are reproducible, performance constraints are respected, lint/build and relevant
tests pass, documentation/presentation claims are accurate, the change is committed independently, and
another machine can resume from repository artifacts without relying on chat history.
