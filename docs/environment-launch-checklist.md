# Local, staging and production launch checklist

## Local development

- [ ] Install Git, Node.js 22 LTS, PostgreSQL and PostgreSQL command-line tools.
- [ ] Clone `https://github.com/ictipass/itf-flow.git`, check out `main`, pull fast-forward only and confirm a clean tree.
- [ ] Run `npm ci`.
- [ ] Copy `.env.example` to `.env`; never commit it.
- [ ] Create an empty local PostgreSQL database and set `DATABASE_URL`.
- [ ] Keep `NODE_ENV` non-production, `STAFF_LOCAL_LOGIN_ENABLED=true` and `ALLOW_DEMO_SEED=true` only for the local demo.
- [ ] Use distinct secrets of at least 32 characters; match Workspace shared secrets only with the local Workspace instance.
- [ ] Run `npm run db:migrate`, `npm run db:seed`, `npm run db:status` and `npm run env:check`.
- [ ] If restoring an existing database, do not seed it; restore the matching `storage/uploads` content and then migrate.
- [ ] Run `npm run test:assurance` and `npm run verify`.
- [ ] Run `npm run dev`; verify `/api/health/live`, `/api/health/ready`, login and representative role workflows.
- [ ] Treat disabled scanning and local storage as fail-closed/demo-only behavior.

## Staging

- [ ] Provision isolated staging app hosting, PostgreSQL, HTTPS hostname, secret store, Workspace registration, mailbox, document services, logs and alerts.
- [ ] Use unique staging credentials; never reuse production data or secrets.
- [ ] Set `NODE_ENV=production`, `STAFF_LOCAL_LOGIN_ENABLED=false` and omit/set `ALLOW_DEMO_SEED=false`.
- [ ] Do not run `npm run db:seed`.
- [ ] Deploy an immutable commit with `npm ci`, `npm run verify`, `npm run db:migrate`, `npm run db:status` and `npm run env:check`.
- [ ] Start the production build with `npm run start`, not the development server.
- [ ] Configure liveness `/api/health/live` and readiness `/api/health/ready`.
- [ ] Schedule authenticated POST calls to `/api/workers/email-outbox`, `/api/workers/reminders` and `/api/workers/documents`, each with its own Bearer secret.
- [ ] Synchronize staging staff from Workspace; verify users have no local password and test MFA, entitlement revocation and central logout.
- [ ] Test mail intake/outbox, reminders/escalations, quarantine/release and provider failure behavior.
- [ ] Run authorization, accessibility, security and production-like performance testing.
- [ ] Run `npm run load:smoke` against the approved URL; separately test authenticated journeys, uploads and largest records.
- [ ] Run `npm run backup:verify` with distinct source and disposable verification database URLs; also restore/reconcile the document store.
- [ ] Record report/ticket references under `/admin/assurance`.
- [ ] Train named pilot users and complete a controlled pilot.

## Production go/no-go

- [ ] S24B is complete if production document handling is in scope.
- [ ] Every required assurance item is PASSED, current and tied to retained evidence.
- [ ] Penetration, authorization, accessibility, load, backup/restore and disaster-recovery tests are accepted.
- [ ] Business, ICT, security, privacy/data-governance and records owners approve release.
- [ ] `STAFF_LOCAL_LOGIN_ENABLED` and `ALLOW_DEMO_SEED` are not true.
- [ ] No seeded/demo identity or shared demo password exists in the production database.
- [ ] Production Workspace/IdP, MFA, logout, revocation and directory synchronization are verified.
- [ ] Managed secrets, TLS, least-privilege database access, EDMS/storage, scanner, OCR, mail, logs, alerts and backup schedules are operational.
- [ ] Incident lead, support rota, rollback authority, RPO/RTO and recovery contacts are named.

## Production deployment

1. Record the approved commit and current deployed version.
2. Confirm consistent database and document-store backups and rollback ownership.
3. Pause affected workers when the release procedure requires it.
4. Deploy the already-tested immutable artifact.
5. Run `npm run db:migrate`, `npm run db:status` and `npm run env:check`; never seed production.
6. Start the application and verify liveness, then readiness.
7. Smoke-test Workspace login, a least-privilege denial and one representative correspondence journey.
8. Resume workers and verify email, reminder and document-processing telemetry.
9. Monitor errors, latency, security events and alerts through the change window.
10. Record release evidence and deployed commit. Prefer forward fixes; never improvise a database rollback.

## Recovery variables

```powershell
$env:BACKUP_SOURCE_DATABASE_URL = "postgresql://...source..."
$env:BACKUP_VERIFY_DATABASE_URL = "postgresql://...disposable-verification-target..."
npm run backup:verify
```

The verification target is destructive and must be isolated/disposable. The supplied check covers PostgreSQL only; recover document content from the selected provider at the same recovery point and reconcile attachment identifiers/hashes.
