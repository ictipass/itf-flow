# S16 - Due-date Reminders, Overdue Escalations and Executive Digests

## Status

Implemented. Schema validation, migration deployment, TypeScript, ESLint and the production build pass.

## Practical outcome

Active action owners receive one due-soon reminder and one overdue notice for each assigned deadline.
When an item remains overdue beyond the configured threshold, the assignee's explicit supervisor receives
an escalation. DG, Directors and DG Secretaries receive one daily count digest for their authorized scope.

This reduces silent deadline slippage without introducing browser polling or exposing classified subjects
in generic email messages.

## Policy

System administrators configure:

- whether scheduled automation is enabled;
- reminder lead days, from zero to thirty;
- overdue days before supervisor escalation, from zero to thirty;
- whether executive digests are enabled; and
- the business timezone used for daily digest idempotency.

Each policy update uses optimistic concurrency and records the previous value, new value, administrator,
reason and timestamp in the configuration audit log.

## Processing and idempotency

`POST /api/workers/reminders` requires an independent Bearer token from `WORKFLOW_WORKER_SECRET`.
The job evaluates at most 1,000 active action items per run. Notification uniqueness includes the work
item and exact due date, so rerunning the worker cannot duplicate a reminder or escalation. Changing a
deadline creates a new reminder identity. Completed and cancelled items are excluded.

Daily digests use recipient plus business-local date as their identity. DG receives organization-wide
counts; Directors receive department counts; DG Secretaries receive their own active-action counts.
Emails contain counts or neutral deadline language and link authenticated users back to Flow.

Every execution creates a run-ledger record with status and delivery counts. Administrators can inspect
the ledger, change policy, or invoke a controlled manual run from `/admin/reminders`.

## Operational schedule

Invoke the protected worker at least once daily after the desired digest time. More frequent runs are
safe and improve due/overdue responsiveness because all effects are idempotent. Do not use a browser
timer or reuse the email-worker, Workspace, session or mailbox secret.

## Production boundaries

- The worker queues email through the durable outbox; it does not wait for SMTP.
- Reporting-line accuracy determines the escalation recipient.
- A later workflow-administration slice may add category-specific SLA calendars and working-day rules.
- Current calculations use elapsed calendar days rather than public-holiday/business-day calendars.
