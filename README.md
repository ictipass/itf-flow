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
4. Confirm `ALLOW_DEMO_SEED=true`, then run `npm run db:seed` for a disposable local/demo database only.
5. Run `npm run dev` (port 3001 if Workspace uses port 3000).

Run `npm run env:check` to validate Node.js, required configuration, database access, migration presence,
and local document storage without printing secret values. Full cross-machine setup and restoration are
documented in [`docs/cross-machine-handover.md`](docs/cross-machine-handover.md), with a concise
[`fresh-machine checklist`](docs/fresh-machine-checklist.md).

Every seeded staff account uses `SEED_PASSWORD` (`Demo123!` by default). Seed credentials are for
local demonstrations only and must never be enabled in production.

Production staff are provisioned through ITF Workspace without a local Flow password. Workspace synchronization
clears any prior local password for a matched email. `STAFF_LOCAL_LOGIN_ENABLED` defaults off in production and
demo seeding refuses to run under `NODE_ENV=production`.

The seeded system administrator account is `admin@itf.gov.ng`. It uses `SEED_PASSWORD` and exists
only to expose configuration and connection-testing controls during development.

If a mailbox password contains `#`, spaces, or other shell-sensitive characters, enclose the entire
value in double quotes in `.env`. ITF Flow reports authentication, timeout, TLS, and folder failures
without exposing server responses or credentials in the browser.

## Workspace registration

S23 adds the `itf-workspace-launch-v2` contract with explicit entitlement, MFA and central-session evidence.
Workspace users must be provisioned before launch and their asserted role must match the locally assigned app role.
Staff sessions are database-backed, idle/absolute-expiring and immediately revocable through the central session-event
API. The versioned attention API returns counts only. Full payloads and configuration are documented in the
[`S23 delivery note`](docs/slices/S23-enterprise-identity-interoperability.md).

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

Event-driven in-app notifications and durable email delivery are documented in
[`docs/notifications-and-email-outbox.md`](docs/notifications-and-email-outbox.md). The browser does not
continuously poll PostgreSQL for notification updates.

System administrators can privately preview and activate the preserved Classic staff interface,
the Modern command workspace, the neumorphic Soft UI workspace, or the glossy black Glass workspace from **Appearance**. The active mode is database-backed,
audited and defaults to Classic after migration; workflow permissions and data are shared by both modes.

Due-date reminders, overdue reporting-line escalations and role-scoped daily digests run through a
protected scheduled worker and the durable email outbox. Administrators configure policy and inspect
execution history from **Reminder automation**.

Secretariat and Records staff can register scan metadata, track the current physical-file location,
print authenticated QR tracking labels and review likely duplicate intake without claiming malware
scanning or EDMS storage.

Development slices are tracked in the [`implementation slice register`](docs/implementation-slice-register.md).
New-machine assistant handoff and environment launches are documented in
[`coding-assistant-handoff.md`](docs/coding-assistant-handoff.md) and
[`environment-launch-checklist.md`](docs/environment-launch-checklist.md). The complete capability/use-case catalogue
is [`app-feature-list.md`](docs/app-feature-list.md).

System administrators manage constrained, immutable workflow versions and category SLAs from **Workflow policies**.
New correspondence snapshots its category and active template version; simulation previews due date, approval and
routing capabilities without creating work. See the [`S25 delivery note`](docs/slices/S25-workflow-templates-slas-simulation.md).

The [`comprehensive user and stakeholder demo guide`](docs/user-guide.md) explains each role, expected controls,
the recommended live-demo sequence, and the current production boundaries.

Time-bound delegations and acting appointments provide a separate acting-office inbox while retaining the
substantive desk as owner. Approval must be explicitly delegated, every action has dual attribution, and local
appointment administration remains interim until HR/Workspace supplies authoritative dates.

Need-to-know access groups, Secret password step-up, controlled-copy marking and sensitive-access reporting
now protect classified workflow paths. Enterprise MFA, embedded document watermarking and governed redaction
remain explicit production integration gates.

Positive formal approvals require password re-confirmation and create a verifiable HMAC-SHA256 assertion bound
to the exact immutable revision and acting authority. This application assertion is deliberately not described
as a certificate-backed or qualified digital signature; PKI and legal signature policy remain external decisions.
Every new slice should follow the reusable [`implementation checklist`](docs/slice-implementation-checklist.md);
the authoritative register identifies the next planned slice and its dependencies.

Verified external stakeholders can use `/portal` to submit Public correspondence, retain organization-scoped
tracking and respond to staff clarification securely. The portal intentionally exposes only a coarse status and
never exposes internal minutes, recipients, decisions, classifications, attachments or audit history. See the
[`S22 delivery note`](docs/slices/S22-authenticated-stakeholder-portal.md) for the demo path and boundaries.

## Current demo boundaries

- Local disk remains demo-only, but `lib/document-storage.ts` now provides separate quarantine/released storage behind
  the provider boundary for the future ITF EDMS.
- S24A performs hash and magic-byte validation asynchronously and releases files only after a configured scanner
  reports clean. No production scanner or OCR/EDMS adapter is bundled; with scanning disabled, files fail closed and
  remain unavailable. Existing files are `LEGACY_UNVERIFIED` until reprocessed.
- The legacy `/submit` route remains a separate one-time submission path. Authenticated tracking is available only
  for correspondence created inside `/portal`; external attachments remain blocked pending S24's EDMS controls.
- Workflow definitions are code-controlled for the demo. A later phase should version configurable
  workflow templates while keeping server-side transition policies.
- Workspace v2 launch consumes upstream MFA and supports central logout and entitlement revocation. Production IdP
  registration, managed key rotation and end-to-end Workspace configuration remain deployment responsibilities.

## Secretariat mailbox

The shared intake page can manually synchronize unread messages over IMAP/TLS and verify both IMAP
and SMTP connectivity. Copy the `MAIL_*` placeholders from `.env.example`; keep the real password
only in the runtime secret store. Imported email HTML is not rendered, remote images are not loaded,
and unsupported attachments are rejected.

For local development, `odukaye.abiodun@itf.gov.ng` may be used. Production switches to the DG
mailbox by changing environment configuration, without changing source code. A persistent IMAP
connection must not run inside Vercel request handlers; production should invoke synchronization
from an authenticated scheduled job or a dedicated worker.
