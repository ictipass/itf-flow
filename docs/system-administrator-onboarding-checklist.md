# ITF Flow system-administrator onboarding and take-off checklist

This is the authoritative, repeatable checklist for configuring a new ITF Flow environment and preparing it for staff use. It covers deployment configuration, Workspace synchronization, organizational routing, document controls, records access, workers, acceptance and operational handover.

Update this file whenever a feature introduces or changes an environment variable, administrator page, role, scheduled worker, external service, policy choice or take-off dependency. The implementation-slice checklist requires that review before a slice is complete.

## How to use this checklist

- Complete it separately for development, staging and production. Never copy production secrets or data into another environment.
- Record evidence beside each checked item in the approved change ticket, assurance repository or operations register. Do not place passwords, tokens or private keys in this file.
- Treat an unchecked **mandatory** item as a launch blocker unless the accountable authority has recorded an explicit, time-limited risk acceptance.
- Test in staging first. A successful build does not by itself authorize production use.

### Environment record

| Item | Entry |
|---|---|
| Environment | Development / Staging / Production |
| Application URL |  |
| Workspace URL |  |
| Release commit |  |
| Change/release reference |  |
| System administrator |  |
| ICT operations owner |  |
| Information-security owner |  |
| Records-management owner |  |
| Business owner |  |
| Configuration started |  |
| Configuration accepted |  |

## Phase 1 — Collect approved setup information

Do not begin production configuration until the following source information is available.

- [ ] Name the product owner, technical owner, support owner, records owner, security owner, incident lead and release authority.
- [ ] Record the approved production, staging, Workspace, health-check and support URLs.
- [ ] Obtain the approved department, directorate, division, unit, position and reporting-line structure from ITF Workspace/HR.
- [ ] Prepare the staff onboarding sheet described in [`provisioning.md`](provisioning.md), including staff number, immutable Workspace identity, organization codes, supervisor and explicit ITF Flow role.
- [ ] Obtain the approved list of DG Secretaries, DG, Directors, Division Heads, Unit Heads, ordinary Officers, Records Administrators and System Administrators.
- [ ] Obtain one approved Department Secretary for every department that will receive Public/Internal executive routing.
- [ ] Obtain the Director, first next-in-line and second next-in-line for every department, including whether each successor may exercise approval authority.
- [ ] Obtain each department's official display name, letterhead address and copy email mailbox.
- [ ] Confirm that every substantive Director who will finalize outgoing letters will upload an active transparent PNG signature.
- [ ] Obtain the approved Open Registry and Secret Registry appointments, expiry dates and authority references.
- [ ] Approve the file plan, retention schedules, records-owning offices, archival ownership and disposal/hold policy. The delivered S29C catalogue must be populated and accepted by Records/Legal before general production.
- [ ] Inventory existing staff personnel boxes/volumes in `edms-current`, including staff identifier, registry unit, box category/number, volume, legacy document/folder ID, object path and verified SHA-256 where available. Do not move legacy objects during mapping.
- [ ] Approve workflow purposes, peer-referral rules, outgoing-approval rule and Routine/Urgent/Immediate SLA days.
- [ ] Decide whether strong annotation authentication is mandatory for the DG, Directors and Division Heads.
- [ ] Decide whether recent enterprise MFA is mandatory for Secret Registry access.
- [ ] Approve the document-storage region, encryption, lifecycle, backup, restoration and data-residency position.
- [ ] Approve the malware-scanner, OCR and Office-to-PDF services and their data-processing terms.
- [ ] Obtain the shared Secretariat mailbox and SMTP/IMAP settings.
- [ ] Approve worker schedules, alert destinations, retry ownership and dead-letter response.
- [ ] Approve RPO, RTO, backup frequency, recovery contacts, pilot scope, support rota and rollback authority.

### Per-department configuration register

Repeat this register for every department.

| Department | Director | First next-in-line | Second next-in-line | Department Secretary | Copy email | Letterhead address verified | Director signature active | Accepted |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  | [ ] | [ ] | [ ] |

### Records catalogue and legacy-box setup

- [ ] Assign at least one trained `RECORDS_ADMIN`; retain `SYSTEM_ADMIN` only as a controlled fallback.
- [ ] Open **Records catalogue** (`/records/catalogue`) and review the transitional entries created by migration `20261103120000_add_records_catalogue`.
- [ ] Create each approved retention policy with trigger, duration, disposition and authority reference.
- [ ] Create approved record series with plain-language use cases, category, retention policy and Workspace-backed default owning office.
- [ ] Retire superseded entries and create a new version; never repurpose an existing code/version silently.
- [ ] Register every reconciled personnel box/volume against the correct synchronized staff member.
- [ ] Test a Director-to-staff personnel matter: the Director is creator, the affected staff member is file subject, and the evidence package lists the correct legacy boxes.
- [ ] Test reasoned re-filing and confirm both the `REFILED` passage event and previous/new file IDs remain auditable.

## Phase 2 — Provision infrastructure and environment variables

Start with [`.env.example`](../.env.example). Store real values only in the approved deployment secret manager.

### Database and application runtime

- [ ] Provision an isolated PostgreSQL database for the environment.
- [ ] Set `DATABASE_URL` to the pooled runtime URL where the provider supplies separate pooled and direct endpoints.
- [ ] Set `DIRECT_URL` to the direct migration/administration URL.
- [ ] Set a unique `SESSION_SECRET` of at least 32 characters.
- [ ] Set `STAFF_SESSION_IDLE_MINUTES` between 5 and 480 according to policy.
- [ ] Keep `STAFF_LOCAL_LOGIN_ENABLED=false` in staging and production.
- [ ] Keep `ALLOW_DEMO_SEED=false` in staging and production and never run `npm run db:seed` there.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the environment's absolute HTTPS ITF Flow URL.

### Workspace identity and interoperability

- [ ] Register the `itf-flow` application in the matching ITF Workspace environment.
- [ ] Set `WORKSPACE_LAUNCH_ISSUER`, `WORKSPACE_LAUNCH_AUDIENCE`, `WORKSPACE_LAUNCH_JWKS_URL` and `WORKSPACE_APP_SLUG`.
- [ ] Set `NEXT_PUBLIC_WORKSPACE_URL` and the same-origin `NEXT_PUBLIC_WORKSPACE_LOGOUT_URL`.
- [ ] Generate separate secrets of at least 32 characters for `WORKSPACE_DIRECTORY_SYNC_SECRET`, `WORKSPACE_INTEROP_SECRET` and `WORKSPACE_APP_NAVIGATION_SECRET`; configure the matching values in Workspace.
- [ ] Review `WORKSPACE_LAUNCH_TTL_SECONDS`, `WORKSPACE_LAUNCH_CLOCK_SKEW_SECONDS`, `WORKSPACE_MFA_STEP_UP_SECONDS` and `WORKSPACE_APP_NAVIGATION_TIMEOUT_MS` only if the defaults do not match approved policy.
- [ ] Keep `WORKSPACE_STAGING_ACCEPTANCE_ENABLED=false` except during a formally controlled, expiring staging diagnostic window. Never enable it in production.

### Signing and document services

- [ ] Generate an independent `APPROVAL_SIGNING_SECRET` of at least 32 characters.
- [ ] Set `DOCUMENT_STORAGE_PROVIDER=VERCEL_BLOB` for the currently supported managed provider and connect a private Blob store so `BLOB_READ_WRITE_TOKEN` is supplied.
- [ ] Set `DOCUMENT_MAX_SIZE_MB` and `EVIDENCE_PACKAGE_MAX_MB` to approved limits.
- [ ] Choose the malware posture:
  - [ ] Production target: `MALWARE_SCANNER=ENABLED` with an approved production scanner adapter.
  - [ ] Temporary exception only: `MALWARE_SCANNER=DISABLED`, which releases signature-valid uploads as **Available · Bypassed** and records that they were not scanned.
- [ ] Set `DOCUMENT_SCANNER_PROVIDER`, `DOCUMENT_OCR_PROVIDER` and their external-service configuration when the S24B contracts/adapters are available.
- [ ] If governed Office-to-PDF conversion is required, set `DOCUMENT_CONVERTER_PROVIDER=GOTENBERG`, `GOTENBERG_URL` and `DOCUMENT_CONVERTER_TIMEOUT_MS`; otherwise DOCX/XLSX remain separate source files.
- [ ] Generate `DOCUMENT_WORKER_SECRET` and set `DOCUMENT_WORKER_BATCH_SIZE`.

Current production boundary: the repository supports private Vercel Blob, but the production malware-scanner and OCR adapters still require S24B. `DOCUMENT_SCANNER_PROVIDER=MOCK` is development-only. Enabling malware scanning without a working scanner intentionally leaves uploads quarantined.

### Mail and automation

- [ ] Set `MAIL_ENABLED=true` only after the mailbox is approved and reachable.
- [ ] Configure `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_IMAP_HOST`, `MAIL_IMAP_PORT`, `MAIL_IMAP_SECURE`, `MAIL_IMAP_FOLDER`, `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_SECURE` and `MAIL_MAX_MESSAGE_SIZE_MB`.
- [ ] Generate independent secrets for `EMAIL_WORKER_SECRET` and `WORKFLOW_WORKER_SECRET`.
- [ ] Set `EMAIL_WORKER_BATCH_SIZE` to the approved bounded batch size.
- [ ] Configure logs, metrics and alerts without recording message bodies, credentials or classified document contents.

The shared Secretariat mailbox credentials are currently deployment-managed. Authorized DG Secretaries can test and synchronize the mailbox from **Shared Secretariat intake**, but they cannot change production credentials through their personal portal.

## Phase 3 — Install, migrate and verify the release

Run from the ITF Flow project directory:

```cmd
npm ci
npm run env:check
npm run db:migrate
npm run db:status
npm run test:assurance
npm run verify
```

- [ ] Confirm every command succeeds against the intended environment.
- [ ] Do not use `prisma db push` as a substitute for committed migrations.
- [ ] Verify `GET /api/health/live` succeeds.
- [ ] Verify `GET /api/health/ready` and review every reported configuration/assurance gap.
- [ ] Confirm the release commit and applied migration list in the deployment evidence.
- [ ] Confirm no demo identity, demo password, database dump, `.env` file or local upload directory was deployed.
- [ ] Configure HTTPS, security headers, least-privilege database credentials and platform access controls.

## Phase 4 — Configure Workspace identities and reporting lines

Workspace is the production system of record. Do not create production staff with the demo seed.

1. [ ] In Workspace, configure offices, departments, divisions, units and positions with stable identifiers.
2. [ ] Validate the staff onboarding sheet using Workspace's dry-run import.
3. [ ] Correct all duplicate staff numbers/emails, unknown organization codes, missing supervisors and invalid roles.
4. [ ] Import the approved identities and reporting lines.
5. [ ] Give only approved staff ITF Flow application access and one explicit Flow role:
   `DG_SECRETARY`, `DG`, `DIRECTOR`, `DIVISION_HEAD`, `UNIT_HEAD`, `OFFICER`, `RECORDS_ADMIN` or `SYSTEM_ADMIN`.
6. [ ] Create the named first System Administrator in Workspace, assign `SYSTEM_ADMIN`, synchronize and verify MFA launch. Do not seed an administrator.
7. [ ] Synchronize entitled staff to ITF Flow.
8. [ ] Open **Provisioning admin** (`/admin/provisioning`) and confirm:
   - [ ] expected directory, active and Workspace-linked counts;
   - [ ] the synchronization run completed;
   - [ ] every ordinary user has a supervisor;
   - [ ] Directors report to the approved authority;
   - [ ] Division Heads, Unit Heads and Officers form the intended route; and
   - [ ] inactive/revoked users are not active in Flow.
9. [ ] Test Workspace launch, recent MFA, Flow-only sign-out, global sign-out, entitlement removal, role change and deactivation/session revocation.
10. [ ] Confirm the named DG Secretaries have `DG_SECRETARY`; this grants shared intake privileges. Do not use a Department Secretary assignment as a substitute for the DG Secretary role.

## Phase 5 — Complete in-application administration

Perform these steps in order because later configuration depends on earlier directory data.

### 5.1 Review workflow policies and SLAs

Open **Workflow policies** (`/admin/workflows`).

- [ ] Confirm the migrated Standard correspondence template has an active version.
- [ ] Confirm whether controlled peer referral is enabled.
- [ ] Confirm whether outgoing letters require formal approval.
- [ ] Confirm allowed purposes: Action, Review, Concurrence and Approval.
- [ ] Review or create categories for Incoming Letter, Internal Memo and Outgoing Letter.
- [ ] Review Routine, Urgent and Immediate SLA days.
- [ ] Run safe simulations for representative type/priority/purpose combinations.
- [ ] Record an approval reason for every activated version or SLA change.

### 5.2 Assign Department Secretaries

Open **Department Secretaries** (`/admin/department-secretaries`).

- [ ] Assign one active synchronized Secretary for every department that receives unrestricted DG/Director routing.
- [ ] Confirm the selected staff member belongs to the intended department.
- [ ] Record the appointment authority/reason.
- [ ] Test that Public/Internal DG or Director routing copies the recipient department Secretary.
- [ ] Test that Confidential/Secret routing creates no Secretary copy.

### 5.3 Configure Directorate continuity

Open **Directorate continuity** (`/admin/continuity`).

- [ ] Select the substantive Director, distinct first next-in-line and distinct second next-in-line for every department.
- [ ] Confirm all three people belong to the same department.
- [ ] Grant successor approval authority only where the approved instrument explicitly permits it.
- [ ] Record the authority reference/reason.
- [ ] Ask each listed officer to open **Availability and next-in-line** and verify their membership.
- [ ] Test Director unavailable, Director plus first successor unavailable, restoration to available, no eligible successor and restricted-classification routing.
- [ ] Confirm the Director receives read-only oversight while a successor acts and that the human actor and substantive authority are both audited.

### 5.4 Configure department letterheads and copy mailboxes

Open **Department letterheads** (`/admin/department-correspondence`). This depends on an active continuity plan.

- [ ] Configure every department's approved name, official copy email and printed address.
- [ ] Record the mailbox/address authority or change reason.
- [ ] Confirm the substantive Director uploads an active transparent PNG at **Signature profile** (`/profile/signature`).
- [ ] Open **Signature governance** (`/admin/signatures`) and confirm the identity, active version and audit digest. Staff signatures are self-activated; this is an audit/revocation register, not an approval queue.
- [ ] Preview an outgoing letter for at least two departments and confirm the heading, address and department email are data-driven.
- [ ] Finalize one letter as the Director and one under approved next-in-line continuity.
- [ ] Confirm the external email receives the signed PDF and the department mailbox receives `DEPARTMENTAL COPY - NO ACTION REQUIRED`.
- [ ] Confirm the signature block shows the substantive Director and `For: Director-General/CE`.

### 5.5 Configure document and annotation security

Open **Document security** (`/admin/documents`).

- [ ] Confirm new uploads show the state expected from the selected malware policy.
- [ ] Require or relax strong annotation authentication separately for DG, Directors and Division Heads, with the approved reason.
- [ ] Test an allowed PDF/image annotation, an unavailable/quarantined denial and a stored hash/integrity check.
- [ ] If scanning is enabled, test clean, EICAR/infected, scanner timeout, retry and dead-letter/alert behavior in staging.
- [ ] Confirm administrators can retry failed processing without bypassing the security state.

### 5.6 Configure records governance

Open **Records governance** (`/admin/records`).

- [ ] Appoint approved Open Registry staff for Public/Internal retrieval.
- [ ] Appoint approved Secret Registry staff for all-classification retrieval, with expiry where appropriate.
- [ ] Decide and configure Secret Registry MFA.
- [ ] Record authority/reason for every appointment and test revocation.
- [ ] Test that Open Registry cannot retrieve Confidential/Secret correspondence.
- [ ] Test that Secret Registry access still respects MFA and need-to-know controls.
- [ ] Export an auditor evidence package and reconcile its manifest, files and hashes.

`RECORDS_ADMIN` is an application role for records/dispatch administration. Open/Secret Registry access is a separate, time-bound appointment controlling archival retrieval. Do not treat these as interchangeable.

### 5.7 Configure need-to-know groups where required

Open **Need-to-know access** (`/admin/access-groups`).

- [ ] Create only approved groups with clear business purposes.
- [ ] Add the minimum required active members.
- [ ] Assign groups to restricted correspondence only when the classification policy requires them.
- [ ] Test allowed and denied access, watermarking, step-up and the sensitive-access report.
- [ ] Remove members or restrictions with a recorded reason when the authority ends.

### 5.8 Configure delegations and acting appointments where required

Open **Delegations and acting** (`/admin/delegations`).

- [ ] Use this for approved time-bound desk delegation that is not already covered by the permanent Director/next-in-line continuity chain.
- [ ] Set principal, delegate, office label, start/end, authority reason and approval grant.
- [ ] Test Personal Inbox versus Acting Office Inbox.
- [ ] Revoke or allow expiry promptly and confirm subsequent work is no longer actionable by the delegate.

### 5.9 Configure reminders, appearance and optional capabilities

- [ ] In **Reminder automation** (`/admin/reminders`), set due-soon lead days, overdue escalation days, digest choice and `Africa/Lagos` timezone; run once manually and inspect the ledger.
- [ ] In **Appearance** (`/admin/appearance`), privately preview the approved interface before activating it organization-wide with a reason.
- [ ] If broadcasts will be used, provision approved `BroadcastPublisherGrant` records by the governed administrative process described in [`broadcasts.md`](broadcasts.md). There is currently no general broadcast-grant administration page; do not use the demo seed in production.
- [ ] If the external stakeholder portal will be used, approve its identity/privacy/anti-abuse policy and test registration, email verification, submission and internal acceptance separately.

## Phase 6 — Configure and observe background workers

Schedule authenticated `POST` requests from an approved scheduler. Each endpoint requires its own Bearer secret.

| Worker | Endpoint | Credential | Minimum acceptance evidence |
|---|---|---|---|
| Email outbox | `/api/workers/email-outbox` | `EMAIL_WORKER_SECRET` | SMTP accepted, retry, dead letter, signed-PDF attachment and department copy |
| Reminders | `/api/workers/reminders` | `WORKFLOW_WORKER_SECRET` | Due-soon, overdue, escalation, digest and empty repeat run |
| Documents | `/api/workers/documents` | `DOCUMENT_WORKER_SECRET` | Clean/reject/failure/retry states and bounded batch |

- [ ] Use HTTPS and do not place worker secrets in URLs.
- [ ] Confirm schedules cannot overlap in a way that duplicates work.
- [ ] Confirm stale processing locks are reclaimed.
- [ ] Alert on repeated failures, dead-letter mail, quarantined/failed documents and missed schedules.
- [ ] Open **Email outbox** (`/admin/email-outbox`) and inspect queued, sent, failed and dead-letter items.
- [ ] From **Shared Secretariat intake**, test the mail connection and perform one controlled mailbox synchronization.
- [ ] Confirm repeated sync/worker calls do not duplicate correspondence or emails.

## Phase 7 — Run role-based acceptance journeys

### Incoming hard-copy correspondence

- [ ] A DG Secretary scans/registers an Incoming Letter and it reaches the DG.
- [ ] The DG acknowledges, opens, annotates/minutes and routes it.
- [ ] Public/Internal routing reaches the Director and copies the recipient department Secretary.
- [ ] Confidential/Secret routing reaches only the authorized Director desk.
- [ ] The final owner resolves it and authorized Records staff retrieve its evidence package.

### Internal memo

- [ ] An Officer raises, previews and submits a rich-text memo through the reporting line.
- [ ] Every action recipient acknowledges before treatment.
- [ ] Annotation with mouse/touch/stylus works on the current PDF.
- [ ] Review, concurrence and approval decisions record safe validation feedback and audit evidence.
- [ ] A Director-to-Director peer referral and same-department Division Head peer referral work with a clear purpose.
- [ ] Return, revision, resubmission, resolution and archival retrieval preserve earlier evidence.

### Outgoing departmental letter

- [ ] The originator enters external recipient name, organization, email and printed address.
- [ ] The letterhead preview is visible to the originator and authorized routing line.
- [ ] Attempted routing to the DG is rejected; the department Director is the final routing desk.
- [ ] Director-unavailable routing selects the correct next-in-line and preserves Director oversight.
- [ ] Finalization uses the substantive Director's name/signature and `For: Director-General/CE`.
- [ ] The recipient and department-copy emails contain the same hash-verified official PDF.
- [ ] SMTP failure is retryable and does not falsely mark the dispatch delivered.

### Authorization and revocation

- [ ] A copied recipient cannot act as the action owner.
- [ ] An unauthorized role cannot view Secret correspondence or administrative pages.
- [ ] Open Registry is denied Confidential/Secret retrieval.
- [ ] Workspace entitlement removal, role change and deactivation terminate the old Flow authority/session.
- [ ] Expired/revoked delegation, registry appointment and access-group membership no longer grant access.

## Phase 8 — Backups, assurance, pilot and go-live

- [ ] Configure encrypted PostgreSQL backups and private document-store backup/version/lifecycle controls from a consistent recovery point.
- [ ] Restore PostgreSQL into a disposable isolated target with `npm run backup:verify`.
- [ ] Restore/reconcile the document store separately and compare representative attachment IDs and SHA-256 hashes.
- [ ] Record measured RPO/RTO and resolve discrepancies.
- [ ] Run authorization, penetration, dependency, accessibility, load and resilience testing.
- [ ] Run `npm run load:smoke` only against an approved environment and separately test authenticated journeys and large documents.
- [ ] Open **Production assurance** (`/admin/assurance`) and enter the owner, evidence reference, status and expiry for every required check.
- [ ] Resolve every readiness configuration issue; a warning about bypassed malware scanning, missing OCR or another unsafe adapter is not a production-ready result.
- [ ] Train named DG Secretariat, Directors, Department Secretaries, Records staff, System Administrators and pilot users using [`user-guide.md`](user-guide.md).
- [ ] Run a controlled pilot and review errors, authorization events, document failures, delivery failures, latency, support requests and adoption.
- [ ] Obtain formal business, ICT operations, information-security, privacy/data-governance and Records acceptance.
- [ ] Record the approved release commit, deployment time, rollback authority, support rota and monitoring window.

## Launch blockers — do not mark the system ready when

- [ ] A non-executive active user has no authoritative supervisor.
- [ ] A receiving department lacks an active Department Secretary.
- [ ] A department lacks a Director/first/second continuity chain.
- [ ] An outgoing-letter department lacks a copy mailbox, address or active Director signature.
- [ ] Required database migrations are unapplied.
- [ ] The email, reminder or document worker is unscheduled or unmonitored.
- [ ] Production uses local filesystem document storage, demo seed data or local staff passwords.
- [ ] Malware scanning is required but no working scanner is configured; uploads will remain quarantined.
- [ ] A temporary malware bypass lacks explicit risk acceptance.
- [ ] Backups have not been restored and reconciled.
- [ ] Required assurance evidence is failed, pending, blocked, expired or missing.
- [ ] Production readiness still reports configuration gaps.

## Ongoing administration and update triggers

| Change | Required administrator action |
|---|---|
| Staff joins, transfers, changes role/supervisor or leaves | Change Workspace, synchronize, inspect Provisioning admin and verify session/entitlement revocation |
| Department Secretary changes | Replace/deactivate under Department Secretaries with reason; test unrestricted routing |
| Director or next-in-line changes | Update Directorate continuity, approval grants and acceptance test |
| Director becomes unavailable/available | Director/successor records availability; inspect automatic handoff and stalled work |
| Department name, address or email changes | Update Department letterheads; existing submitted correspondence retains its snapshot |
| Visual signature changes | Staff uploads a new version; administrator audits/revokes obsolete versions |
| Registry authority changes | Create/revoke time-bound appointment and test scope/MFA |
| Annotation or Secret Registry MFA policy changes | Update the relevant admin policy with approval reason and retest |
| Workflow/SLA changes | Create/activate immutable workflow version or update category with reason; simulate first |
| Mail/storage/scanner/OCR/converter endpoint or credential changes | Rotate deployment secret, redeploy, run connection/security tests and retain evidence |
| Worker secret or schedule changes | Update scheduler and app atomically; run manual acceptance and monitor |
| New ITF Flow feature adds configuration | Update this checklist, `.env.example`, user guide, slice register and operations/assurance evidence in the same slice |

## Final sign-off

- [ ] System Administrator: configuration complete and audited.
- [ ] Workspace Administrator: identities, entitlements and reporting lines accepted.
- [ ] Records owner: filing, registry access, retention and evidence retrieval accepted.
- [ ] Security owner: MFA, classification, document security and assurance accepted.
- [ ] ICT operations: workers, mail, storage, monitoring, backup and recovery accepted.
- [ ] Business owner: role-based pilot and workflow accepted.
- [ ] Release authority: production activation approved.

Record names, dates and evidence references in the approved release record—not in this repository.
