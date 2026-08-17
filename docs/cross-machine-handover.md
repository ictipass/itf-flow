# Cross-machine development handover

This runbook reproduces ITF Flow on another Windows development machine without committing secrets or
mistaking Git for a database or file backup.

## What moves through Git

Source code, Prisma migrations, seed logic, documentation, and `.env.example` move through GitHub.
The `.env` file, PostgreSQL contents, `storage/uploads`, `.next`, generated Prisma client, and
`node_modules` are intentionally excluded.

## 1. Finish work on the original machine

```cmd
cd C:\drxloanx\apps\itf-flow
git status
npm run verify
git push origin main
```

Do not proceed with uncommitted work unless it is intentionally being carried separately. Confirm the
latest commit on GitHub. Back up `.env` through an approved secret-transfer channel; never email it or
commit it.

If existing local demo records and uploaded documents must be retained, follow the backup section below.
For a fresh seeded demo, no database or upload backup is required.

## 2. Install prerequisites on the new machine

- Git
- Node.js 20.9 or newer (current LTS recommended)
- PostgreSQL with command-line tools available
- The same Codex account if conversation continuity is required

Use an equivalent parent directory so sibling Workspace URLs and instructions remain predictable:

```cmd
mkdir C:\drxloanx\apps
cd C:\drxloanx\apps
git clone https://github.com/ictipass/itf-flow.git
git clone https://github.com/ictipass/itf-workspace.git
git clone https://github.com/ictipass/itf-clients-reimbursement.git
git clone https://github.com/ictipass/itf-siwes-automation.git
cd itf-flow
npm ci
copy .env.example .env
```

These are four independent Git repositories, not folders managed by one parent repository. Push and
verify each repository separately before moving machines. Each application may also have its own `.env`,
database, generated files, uploads, and setup instructions; transferring ITF Flow does not transfer the
runtime state of the other three applications.

Edit `.env` locally. Replace development placeholders, keep secrets out of screenshots and chat, and use
the same `WORKSPACE_LAUNCH_TOKEN_SECRET` in ITF Flow and ITF Workspace.

## 3. Create and initialize PostgreSQL

Create an empty `itf_flow` database, then ensure `DATABASE_URL` points to it.

```cmd
npm run db:migrate
npm run db:seed
npm run env:check
npm run dev
```

Use `prisma migrate deploy` through `npm run db:migrate`. Do not use `migrate dev` merely to install
already committed migrations; it is intended for authoring new schema changes.

## 4. Restore existing demo data when required

On the old machine, use PostgreSQL's supported backup tool:

```cmd
pg_dump --format=custom --file=itf_flow.backup itf_flow
```

Transfer the backup through an approved encrypted medium. Restore only into the explicitly created
`itf_flow` database on the new machine:

```cmd
pg_restore --clean --if-exists --no-owner --dbname=itf_flow itf_flow.backup
npm run db:migrate
```

`--clean` replaces objects inside the selected database. Verify the database name before running it.
For a new demo environment, prefer migrations plus seeding instead of restoring old data.

## 5. Transfer uploaded documents

Database attachment rows reference files under `storage/uploads`. If the database is restored, securely
copy that entire directory while preserving its internal correspondence folders. Restore it to:

```text
C:\drxloanx\apps\itf-flow\storage\uploads
```

Database restoration without this directory preserves metadata but attachment downloads will fail.
This local storage procedure will be replaced by shared object storage or the ITF EDMS in production.

## 6. Mailbox and Workspace verification

Start with `MAIL_ENABLED=false` until the UI and database pass `npm run env:check`. Add the mailbox
password only through the local `.env` or the deployment secret store. Then enable mail and use the
administrator connection test. Mail credentials are environment configuration, not database seed data.
Automated processing also requires a separate `EMAIL_WORKER_SECRET` of at least 32 characters. Configure
the scheduler to call `POST /api/workers/email-outbox` with a Bearer token; never reuse a staff session,
Workspace secret or mailbox password.

Reminder and escalation processing requires a different `WORKFLOW_WORKER_SECRET` of at least 32
characters. Schedule `POST /api/workers/reminders` with its own Bearer token. Repeated daily or more
frequent invocations are safe because reminder, escalation and digest effects are idempotent.

For Workspace integration, confirm the Workspace runs on its configured URL and registers:

```text
http://localhost:3001/workspace/launch
```

## 7. Conversation continuity

Git transfers implementation state, not a local chat transcript. Sign in to Codex with the same account
and open the saved conversation when available. Also provide the latest commit hash, current branch,
`docs/next-slices.md`, and this runbook. Those repository artifacts remain the authoritative handover if
conversation history is unavailable.

Never depend on chat history as the only record of architecture, configuration, migrations, or pending work.
