# ITF Flow implementation slice register

This is the authoritative, conversation-independent index of delivered and planned increments. A slice
is a bounded change that can be migrated, demonstrated, tested, documented, committed, and handed to
another developer without depending on unfinished work from a later slice.

## Status definitions

- **Implemented**: code and migration exist, validation passed, and the commit is recorded.
- **Implemented locally**: validation passed but the work has not yet been committed.
- **Planned next**: scope and acceptance criteria are documented; implementation has not started.
- **Planned**: desired capability exists in the roadmap but needs detailed design before coding.
- **Production gate**: mandatory before production, even if not required for the local demonstration.

## Delivered slices

| ID | Slice | Status | Principal commit or evidence |
|---|---|---|---|
| S01 | Core correspondence intake, routing, recipients, audit events and seeded hierarchy | Implemented | Earlier repository history and Prisma migrations |
| S02 | Organization-aware directory and explicit reporting lines | Implemented | Earlier repository history |
| S03 | Secretariat intake, shared claim/release, mail integration and Flow administrator | Implemented | `8104fdb`, `17b6fd7` |
| S04 | Correspondence passage timeline and current position | Implemented | `dad26ec` |
| S05 | Scoped organizational broadcasts and acknowledgement | Implemented | `030018d` |
| S06 | Private drafts and autosave | Implemented | `5a57941` |
| S07 | Controlled Director and Division Head peer referral | Implemented | `5b37c2e` |
| S08 | Review, concurrence and auditable approval | Implemented | `b66bf3d` |
| S09 | Controlled correction and immutable document revisions | Implemented | `9f9e5c4` |
| S10 | Outgoing dispatch registry and delivery tracking | Implemented | `63aba54` |
| S11 | Cross-machine development handover | Implemented | `b4c343d` |
| S12 | Stakeholder presentation package | Implemented | `2500fa5` |
| S13 | Event-driven in-app notifications and durable email outbox | Implemented | `17e147b` |
| S14 | Node.js LTS alignment | Implemented | `3015551` |
| S14A | Configurable staff experience and modern dashboard | Implemented locally | Working tree; see [`slices/S14A-configurable-staff-experience.md`](slices/S14A-configurable-staff-experience.md) |

The working tree and `git log` remain the final authority if a commit shown here is later superseded.

## Planned next slice

After completion of the stakeholder-priority S14A interface slice, **S15 - Automated Email Delivery and Secure Worker Processing** remains the planned next workflow slice and is specified in
[`slices/S15-automated-email-delivery.md`](slices/S15-automated-email-delivery.md).

Its purpose is to connect the durable outbox to a protected scheduled processor and to connect Official
Email dispatch records to controlled email delivery without introducing request-time SMTP calls or
continuous database polling.

## Subsequent slices

| ID | Slice | Priority/dependency |
|---|---|---|
| S16 | Due-date reminders, overdue escalations and executive digests | Uses notifications and outbox from S13/S15 |
| S17 | Secretariat scanning metadata, physical location, duplicate review and reassignment | Extends shared intake |
| S18 | Full-text search, filters, registers and movement reports | Requires classification-aware query policy |
| S19 | Delegation, acting appointments and office/desk inboxes | Requires authoritative HR dates and approval policy |
| S20 | Confidentiality, need-to-know groups, watermarking and step-up access | Production security gate |
| S21 | Digital signatures and stronger approval authentication | Depends on approved signature policy and PKI decision |
| S22 | Authenticated external stakeholder portal | Requires identity, anti-abuse and privacy design |
| S23 | Enterprise Workspace identity, MFA, central logout and interoperability contracts | Cross-application platform slice |
| S24 | EDMS/object storage, magic-byte validation, malware scanning, quarantine and OCR | Production document gate |
| S25 | Configurable workflow templates, SLAs and simulation | Requires stable business-rule ownership |
| S26 | Assurance, observability, load/security tests, backup recovery and pilot rollout | Final production gate |

## Readiness tracks that remain active across all slices

- Keep the stakeholder presentation accurate after every user-visible capability or limitation changes.
- Keep `.env.example`, cross-machine handover, migration commands and seed documentation current.
- Never commit secrets, `.env`, local uploads, generated clients, database dumps or real correspondence.
- Update the Workspace integration contract whenever roles, entitlements, notifications or launch behavior change.
- Preserve EDMS and malware-scanning boundaries in every attachment-related design.
- Add audit events and notification/outbox effects in the same transaction as the business transition.
- Avoid continuous database polling; use event writes, navigation refresh, scheduled batches or dedicated push infrastructure.

## Resume protocol on another machine

```cmd
cd C:\drxloanx\apps\itf-flow
git fetch origin
git checkout main
git pull --ff-only
git status
npm ci
npm run db:migrate
npm run env:check
npm run verify
```

Then read, in order:

1. `docs/implementation-slice-register.md`
2. `docs/slices/S15-automated-email-delivery.md` or the currently named planned-next document
3. `docs/slice-implementation-checklist.md`
4. `docs/cross-machine-handover.md`
5. `docs/next-slices.md`

Record the starting commit and confirm a clean tree before making changes.
