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

For the local demonstration, a system administrator manually processes up to 20 eligible messages from
the Email outbox page. Production should call the same processor from an authenticated Vercel cron route
or dedicated worker. The processor must never be invoked by an unauthenticated public endpoint.

This slice deliberately does not claim instant real-time push. If that becomes a requirement, use an
event delivery service, Web Push, or appropriately hosted SSE/WebSocket infrastructure. Do not introduce
per-user database polling. Automated outgoing-correspondence email with controlled attachments remains
the next increment on top of this outbox.
