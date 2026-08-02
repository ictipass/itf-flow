# ITF Flow

ITF Correspondence and Workflow Management System.

## Demo workflow

```text
External organization → DG Secretariat intake → DG
                                            ↓
Officer → Unit Head → Division Head → Director → DG
```

The DG routes downward to Directors. Normal upward communication follows Officer → Unit Head →
Division Head → Director → DG. A routing action may name several recipients; the first recipient
is the accountable owner and the others receive action-visible copies.

## Local setup

1. Copy `.env.example` to `.env` and configure PostgreSQL.
2. Run `npm install`.
3. Run `npm run db:migrate`.
4. Run `npm run db:seed`.
5. Run `npm run dev` (port 3001 if Workspace uses port 3000).

Run `npm run env:check` to validate Node.js, required configuration, database access, migration presence,
and local document storage without printing secret values. Full cross-machine setup and restoration are
documented in [`docs/cross-machine-handover.md`](docs/cross-machine-handover.md), with a concise
[`fresh-machine checklist`](docs/fresh-machine-checklist.md).

Every seeded staff account uses `SEED_PASSWORD` (`Demo123!` by default). Seed credentials are for
local demonstrations only and must never be enabled in production.

The seeded system administrator account is `admin@itf.gov.ng`. It uses `SEED_PASSWORD` and exists
only to expose configuration and connection-testing controls during development.

If a mailbox password contains `#`, spaces, or other shell-sensitive characters, enclose the entire
value in double quotes in `.env`. ITF Flow reports authentication, timeout, TLS, and folder failures
without exposing server responses or credentials in the browser.

## Workspace registration

Register this launch URL in ITF Workspace:

```text
http://localhost:3001/workspace/launch
```

Use the slug `itf-flow`, assign an app role matching one of the Prisma `UserRole` values, and set
the same `WORKSPACE_LAUNCH_TOKEN_SECRET` in both applications.

Staff master-list provisioning and secure directory synchronization are documented in
[`docs/provisioning.md`](docs/provisioning.md).

Organizational broadcast authorization, recipient snapshots and acknowledgement tracking are
documented in [`docs/broadcasts.md`](docs/broadcasts.md).

Stakeholder presentation materials are organized in the
[`presentation package`](docs/stakeholder-presentation-package.md), detailed
[`live-demo script`](docs/stakeholder-demo-script.md), and
[`pre-demo checklist`](docs/stakeholder-demo-checklist.md).

## Current demo boundaries

- Local disk attachment storage is suitable only for the local demo. `lib/document-storage.ts`
  is the provider boundary for the future ITF electronic document management server.
- File validation currently checks declared MIME type, size and SHA-256 digest. Attachments are
  explicitly marked `NOT_SCANNED`. Production rollout is blocked until magic-byte inspection,
  malware scanning (for example ClamAV or a managed scanner), and quarantine are operational.
- External submission issues a reference but does not yet authenticate the sender or send email.
- Workflow definitions are code-controlled for the demo. A later phase should version configurable
  workflow templates while keeping server-side transition policies.
- The Workspace handoff is one-time and audited locally, but enterprise OIDC, MFA and central logout
  remain the production target.

## Secretariat mailbox

The shared intake page can manually synchronize unread messages over IMAP/TLS and verify both IMAP
and SMTP connectivity. Copy the `MAIL_*` placeholders from `.env.example`; keep the real password
only in the runtime secret store. Imported email HTML is not rendered, remote images are not loaded,
and unsupported attachments are rejected.

For local development, `odukaye.abiodun@itf.gov.ng` may be used. Production switches to the DG
mailbox by changing environment configuration, without changing source code. A persistent IMAP
connection must not run inside Vercel request handlers; production should invoke synchronization
from an authenticated scheduled job or a dedicated worker.
