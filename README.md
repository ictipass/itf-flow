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
3. Run `npx prisma migrate dev`.
4. Run `npm run db:seed`.
5. Run `npm run dev` (port 3001 if Workspace uses port 3000).

Every seeded staff account uses `SEED_PASSWORD` (`Demo123!` by default). Seed credentials are for
local demonstrations only and must never be enabled in production.

## Workspace registration

Register this launch URL in ITF Workspace:

```text
http://localhost:3001/workspace/launch
```

Use the slug `itf-flow`, assign an app role matching one of the Prisma `UserRole` values, and set
the same `WORKSPACE_LAUNCH_TOKEN_SECRET` in both applications.

## Current demo boundaries

- Local disk attachment storage is suitable only for the local demo. Configure private S3 or
  Vercel Blob storage before Vercel deployment.
- File validation currently checks declared MIME type, size and SHA-256 digest. Production needs
  magic-byte inspection, malware scanning and quarantine.
- External submission issues a reference but does not yet authenticate the sender or send email.
- Workflow definitions are code-controlled for the demo. A later phase should version configurable
  workflow templates while keeping server-side transition policies.
- The Workspace handoff is one-time and audited locally, but enterprise OIDC, MFA and central logout
  remain the production target.
