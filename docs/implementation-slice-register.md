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
| S14A | Configurable Classic, Modern, Soft UI and Glass staff experiences | Implemented | `5299f9e`, `8a0a466`, `7d5e846` |
| S15 | Automated email delivery and secure worker processing | Implemented | `1aa0ab3` |
| S16 | Due-date reminders, overdue escalations and executive digests | Implemented | `ffd2aea` |
| S17 | Secretariat scanning metadata, physical location, duplicate review and reassignment | Implemented | `c35b86c` |
| S18 | Full-text-style search, filters, registers and movement reports | Implemented | `3075aae`; see [`slices/S18-search-registers-reports.md`](slices/S18-search-registers-reports.md) |
| S19 | Delegation, acting appointments and office/desk inboxes | Implemented | `0686162`; see [`slices/S19-delegation-acting-office-inboxes.md`](slices/S19-delegation-acting-office-inboxes.md) |
| S20 | Confidentiality, need-to-know groups, watermarking and step-up access | Implemented | `3d276f8`; see [`slices/S20-sensitive-access-controls.md`](slices/S20-sensitive-access-controls.md) |
| S21 | Digital signatures and stronger approval authentication | Implemented | `6505d7c`; see [`slices/S21-signed-approval-assertions.md`](slices/S21-signed-approval-assertions.md) |
| S22 | Authenticated external stakeholder portal | Implemented | `b8b9e95`; see [`slices/S22-authenticated-stakeholder-portal.md`](slices/S22-authenticated-stakeholder-portal.md) |
| S23 | Enterprise Workspace identity, MFA, central logout and interoperability contracts | Implemented | `ed5e171`; see [`slices/S23-enterprise-identity-interoperability.md`](slices/S23-enterprise-identity-interoperability.md) |
| S23A | Workspace-entitled app switcher and responsive Glass header | Implemented | `4747f67`, Workspace `bc03856`; see [`slices/S23A-workspace-entitled-app-switcher.md`](slices/S23A-workspace-entitled-app-switcher.md) |
| S23B | Split Flow-only and global Workspace sign-out | Implemented and staging accepted | `515e94c`, Workspace `453a0d3`; accepted 2026-09-08; see [`slices/S23B-session-exit-scope.md`](slices/S23B-session-exit-scope.md) |
| S23C | Public staff entry through Workspace | Implemented and staging accepted | `8ff3202`; accepted 2026-09-08; see [`slices/S23C-public-workspace-staff-entry.md`](slices/S23C-public-workspace-staff-entry.md) |
| S23D | Safe Workspace handoff failure diagnostics | Implemented; staging launch recovery accepted | `9577561`; matching Workspace `c992230`; synchronization restored launch, confirmed 2026-09-17. Independent diagnostic failure-path acceptance remains; 33 security tests and full verification passed; no verification bypass. See [`slices/S23D-workspace-launch-diagnostics.md`](slices/S23D-workspace-launch-diagnostics.md) |
| S23E | Controlled staging lifecycle acceptance profile | Implemented locally; live acceptance pending | 36 Flow regressions/full verification passed; Workspace W42; one pinned ordinary identity, staging-only expiring flags, authenticated pre-side-effect 503 and read-only bounded observations. No migration/new secret; live A01-06/A01-07 pending. See [slice](slices/S23E-controlled-staging-acceptance.md) |
| S24A | Secure provider-neutral quarantine, validation and document-processing foundation | Implemented | `0481866`; see [`slices/S24A-secure-document-foundation.md`](slices/S24A-secure-document-foundation.md) |
| S25 | Configurable workflow templates, category SLAs and safe simulation | Implemented | `a627a92`; see [`slices/S25-workflow-templates-slas-simulation.md`](slices/S25-workflow-templates-slas-simulation.md) |
| S26 | Assurance controls, observability, test/recovery tooling and controlled-pilot gate | Implemented | `41f274f`; see [`slices/S26-production-assurance-pilot.md`](slices/S26-production-assurance-pilot.md) |

The working tree and `git log` remain the final authority if a commit shown here is later superseded.

Machine-independent continuation instructions are maintained in [`coding-assistant-handoff.md`](coding-assistant-handoff.md), environment launch gates in [`environment-launch-checklist.md`](environment-launch-checklist.md), and explicit feature/use cases in [`app-feature-list.md`](app-feature-list.md).

## Post-slice operational hardening

The machine handoff package and production-account separation were completed after S26 in `b5af0cb`. Demo seeding is now explicitly local-only, production local login defaults off, Workspace synchronization removes matching demo passwords, and recent Workspace MFA authenticates formal approval.

The joint Workspace A01 integration reassessment is implemented in Flow commit `02b433d` and Workspace commit
`1a08a5b`. It adds upstream session-bound enforcement, immutable identity reconciliation, versioned payload-bound
directory idempotency and session invalidation on role/status/assurance changes. Environment-separated staging
configuration, provisioning and the first genuine launch were accepted on 2026-09-06. Replay rejection and confirmed
central logout were accepted on 2026-09-08. Role/assurance change were accepted on 2026-09-14; entitlement revocation,
both-browser-profile denial and controlled regrant/synchronization were confirmed on 2026-09-17. S23E/Workspace W42
provide diagnostics, but live duplicate-delivery/outage-retry acceptance and continuous scheduling remain. See
[`slices/A01-workspace-integration-reassessment.md`](slices/A01-workspace-integration-reassessment.md).

The Workspace-entitled child-app switcher is implemented in Flow commit `4747f67` and Workspace commit `bc03856`.
It uses a protected, versioned, live-session navigation manifest and routes every target selection back through
Workspace authorization. It also corrects the Glass header's long-navigation collision. Matching staging credentials
and joint UI/entitlement behavior were accepted on 2026-09-08. See [`slices/S23A-workspace-entitled-app-switcher.md`](slices/S23A-workspace-entitled-app-switcher.md).

Split session exit is implemented in Flow commit `515e94c` and Workspace commit `453a0d3`. The main Flow action ends
Flow only and returns to the Workspace catalogue; its chevron hands confirmed global sign-out to Workspace and W04
central revocation. Staging acceptance passed on 2026-09-08. See [`slices/S23B-session-exit-scope.md`](slices/S23B-session-exit-scope.md).

Direct public staff entry is implemented in `8ff3202`. Flow's landing and staff-login pages link to the validated
environment-specific Workspace login; production local staff login remains disabled. Staging acceptance passed on
2026-09-08. See
[`slices/S23C-public-workspace-staff-entry.md`](slices/S23C-public-workspace-staff-entry.md).

## Planned next slice

**Immediate integration action — A01-02 role-change/mismatch acceptance:** use a dedicated staging identity and
explicitly approved old/new Flow roles to prove an old session ends, a mismatched launch fails closed and only the
reconciled approved role can launch. Do not alter the only recoverable Workspace administrator.

**S24B - Real EDMS, malware-scanner and OCR adapters** is pending the external technical contract and test services.
**S26 - Assurance, observability, load/security tests, backup recovery and pilot rollout** is implemented. External execution evidence and production sign-off remain pending.

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
| S24A | Secure provider-neutral document-processing foundation | Local foundation; production activation remains blocked |
| S24B | Real EDMS, malware scanning, quarantine and OCR adapters | Requires external contracts and test services |
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
