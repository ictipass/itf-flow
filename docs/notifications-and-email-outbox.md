# Notifications and durable email outbox

Notifications are created by workflow events inside the same PostgreSQL transaction as assignments,
copies, returns, peer referrals, decisions, broadcasts, and dispatch failures. The user interface does
not run a timer or continuously poll the database. The unread count is an indexed query rendered during
ordinary navigation; opening or marking notifications read causes the normal server refresh.

Each notification also creates an idempotent email-outbox record. Workflow requests never wait for SMTP.
Outbox states are queued, processing, sent, failed, and dead-letter. Every SMTP attempt records only a
sanitized error code, never credentials or full server responses. Failed items use bounded exponential
backoff and stop after the configured maximum attempts. A processing lock older than ten minutes can be
reclaimed after a worker crash.

The processor is available through `POST /api/workers/email-outbox`, authenticated with an independent
Bearer secret from `EMAIL_WORKER_SECRET`. It returns aggregate counts only. A system administrator may
also process a bounded batch manually and may return failed/dead-letter items to the queue with an
audited reason. No unauthenticated or staff-session-only scheduled invocation is accepted.

This slice deliberately does not claim instant real-time push. If that becomes a requirement, use an
event delivery service, Web Push, or appropriately hosted SSE/WebSocket infrastructure. Do not introduce
per-user database polling. Official Email dispatch now creates exactly one dispatch-linked outbox item;
SMTP acceptance marks it dispatched while recipient delivery remains separately confirmable.

Automated dispatch email is plain text and does not include attachments. Current demo attachments are
generally `NOT_SCANNED`; transmitting them remains blocked until the production scanning/release gate.
