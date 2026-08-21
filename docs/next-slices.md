# ITF Flow — Next Implementation Slices

Slices are ordered so each one produces a demonstrable, testable increment.

The normalized status register is maintained in `docs/implementation-slice-register.md`; every slice must
use `docs/slice-implementation-checklist.md` so another machine can continue without chat context.

Cross-machine setup, database/file restoration, environment verification and conversation-independent
handover are documented and implemented as a project-readiness slice.

The stakeholder narrative, role-based live demonstration, anticipated questions, honest MVP boundaries,
pilot decisions and recovery checklist are documented as a presentation-readiness slice.

## Slice 14A - Configurable staff experience and modern dashboard - Implemented locally

- Preserves the Classic staff shell and dashboard as a safe fallback.
- Adds a Modern compact navigation shell and attention-first command workspace using the approved theme.
- Adds a third Soft UI option with neumorphic surfaces and a distinct horizontal workspace layout.
- Adds a fourth Glass option with a glossy black canvas, translucent panels and high-contrast workflow surfaces.
- Lets system administrators privately preview and organization-wide activate either interface.
- Audits each activation and protects against concurrent stale configuration changes.
- Shares navigation authorization and dashboard data across both presentations.

This stakeholder-priority insertion does not renumber the implementation register. Automated email
delivery remains S15 in the detailed slice sequence.

## Slice 2 — Organization-aware directory and reporting lines — Implemented

- Replaced role-only adjacency with explicit supervisor/direct-report relationships.
- Added unit and stable Workspace office, department, division, unit, and position identifiers.
- Action-recipient search and server-side mutations now enforce the assigned reporting line.
- Cross-department action routing is blocked unless represented by an explicit reporting assignment.
- Workspace launch exchange now synchronizes the available staff identity and organization IDs.

Acting appointments and time-bound delegation are implemented through S19's interim administrator-managed model.

## Slice 2A — Correspondence passage visibility — Implemented

- Added a chronological, immutable correspondence journey to the detail page.
- Shows the status after every recorded event and time spent at each point.
- Shows the actor, role, office, minute, action recipients, copied recipients, and simultaneous routing branches.
- Highlights current action owners, current offices, active copies, and elapsed time at the current stage.

## Slice 3 — Drafts, review and dispatch — In progress

- Save private drafts, autosave composed correspondence, and submit through the author's reporting line. Implemented.
- Controlled Director-to-Director and same-department Division Head peer referrals. Implemented.
- Explicit review, concurrence and approval requests with an auditable decision register. Implemented.
- Immutable document versions, controlled correction and approval supersession. Implemented.
- Separate author, reviewer, approving officer and dispatch authority.
- Add outgoing dispatch records, delivery channels and acknowledgement of delivery.
- Outgoing dispatch registry, approval gate, delivery channels, failure/retry tracking and delivery confirmation. Implemented.
- Add document version history and compare revisions.

## Slice 4 — Secretariat operations — In progress

- Shared intake queue for the three DG Secretaries with atomic claim/release controls. Implemented.
- Return-for-correction and auditable resubmission for staff-originated correspondence. Implemented.
- Manual IMAP mailbox synchronization into the shared intake queue. Implemented.
- Duplicate detection, scanning desk metadata, physical-file location and barcode/QR labels.
- Reassignment between secretariat locations with reason and audit trail.
- Scanning metadata, physical location history, scannable QR labels, duplicate suggestions and controlled
  duplicate decisions. Implemented.
- Service-level timers for unregistered and unacknowledged items.

## Slice 5 — Notifications and escalations

- In-app organizational broadcasts with scoped publishing grants, recipient snapshots, read status
  and mandatory acknowledgement. Implemented.
- In-app notifications, email delivery and optional push notifications.
- Event-driven in-app notifications and a durable, idempotent email outbox with manual processing, retry and dead-letter states. Implemented without continuous database polling.
- Reminders before due dates and configurable overdue escalations.
- Daily digest for executives, Directors and secretaries.
- Due-soon reminders, overdue owner notices, reporting-line escalation, protected processing, run ledger
  and role-scoped daily digests. Implemented.
- Delivery attempts, retries and dead-letter monitoring.

## Slice 6 — Search, registry and records management

- Full-text search across subject, reference, sender, minutes and permitted document text.
- Filters by office, department, classification, priority, owner, status and date.
- Retention schedules, archival, legal hold and disposal approvals.
- Exportable correspondence register and movement report.
- Classification-aware multi-field search, operational filters, filtered correspondence register and
  passage-level movement CSV exports. Implemented.

## Slice 7 — Delegation and acting appointments

- Time-bound delegation during leave or absence.
- Acting-position authority with explicit start/end dates.
- Personal and office/desk inbox distinction.
- Auditable reassignment when staff move roles.
- Administrator-managed appointments, separate personal/acting desk inboxes, explicit approval grants,
  automatic access expiry and dual-attribution audit metadata are implemented. Authoritative HR/Workspace
  synchronization and permanent personnel-transfer reassignment remain integration boundaries.

## Slice 8 — Confidentiality and information barriers

- Classification-specific access policy and need-to-know groups.
- Redacted copies and restricted attachments.
- Step-up authentication for Secret correspondence.
- Download watermarking and sensitive-access reporting.
- Need-to-know groups, central enforcement, 15-minute password step-up for Secret records, controlled-copy
  marking and sensitive view/download/export reporting are implemented. Enterprise MFA, embedded binary
  watermarking and governed redaction remain later integration gates.

## Slice 9 — Digital approval and signatures

- Approval policy by correspondence type and authority threshold.
- PIN/password re-confirmation for sensitive approval.
- Signature placement and approved signature assets.
- Certificate-backed cryptographic signatures where policy requires them.
- Password-confirmed, revision-bound HMAC-SHA256 approval assertions with visible verification, acting-authority
  attribution, concurrency protection and dispatch integrity checks are implemented. Certificate/PKI signatures,
  timestamp authority and approved visual signature assets remain policy and trust-service dependencies.

## Slice 10 — External stakeholder portal

- Verified external accounts and organization membership.
- Submission tracking, clarification requests and secure responses.
- Email verification, anti-abuse controls and submission rate limiting.
- Stakeholder dashboards spanning future ITF applications.
- Verified accounts, organization-scoped submissions, privacy-reduced tracking, anti-abuse controls and secure
  clarification responses are implemented. Cross-application identity remains S23; safe document upload remains S24.

## Slice 11 — Workspace and interoperability contract

- Enterprise OIDC, MFA, central logout and entitlement revocation.
- Notification badges in the Workspace launcher.
- Versioned REST/webhook contracts for non-JavaScript applications.
- Correlation IDs and centralized audit/event forwarding.

## Slice 12 — Production document platform

- Private S3 or Vercel Blob storage.
- Magic-byte validation, malware scanning and quarantine.
- OCR for scanned correspondence and searchable extracted text.
- Encryption, backup, restoration and storage lifecycle policies.

## Slice 13 — Workflow administration

- Versioned workflow templates without allowing unsafe arbitrary transitions.
- Configurable correspondence categories, classifications, priorities and SLAs.
- Controlled exception/escalation paths with approval.
- Workflow simulation and change-impact preview.

## Slice 14 — Assurance and production rollout

- Authorization regression suite, database integration tests and browser end-to-end tests.
- Accessibility, load, penetration, backup/restore and disaster-recovery tests.
- Observability dashboards, alerts, runbooks and support procedures.
- Pilot rollout, training, data-governance approval and production sign-off.
