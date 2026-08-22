# Coding assistant handoff

This file is the durable starting prompt for a coding assistant on a new machine. Repository state and migrations remain authoritative over chat history.

## First instruction to the new assistant

> Open `docs/coding-assistant-handoff.md`, follow every step under **Repository verification**, then read the files under **Required reading**. Do not implement S24B without the approved EDMS, malware-scanner and OCR contracts. Before making changes, report the checked-out commit, working-tree state, validation result and the production gates that remain open.

## Repository verification

```powershell
git fetch origin
git checkout main
git pull --ff-only
git status --short
git rev-parse HEAD
git log -5 --oneline
npm ci
```

At creation, the last delivered slice was S26 at implementation commit `41f274f`, recorded by `2102582`; the portable handoff and production-account hardening are in `b5af0cb`. Confirm that `docs/implementation-slice-register.md` records the current state and accept a later intentional commit.

Use Node.js 22 LTS on the replacement machine. The previous Windows host used Node 24.18.1 and `tsx` sometimes failed before loading tests with `uv_os_get_passwd returned ENOMEM`; that was a host/runtime failure, not a passed or failed assertion.

## Required reading

1. `docs/implementation-slice-register.md`
2. `docs/environment-launch-checklist.md`
3. `docs/fresh-machine-checklist.md`
4. `docs/production-assurance-runbook.md`
5. `docs/app-feature-list.md`
6. `docs/provisioning.md`
7. `docs/email-and-document-integration.md`
8. `docs/slices/S23-enterprise-identity-interoperability.md`
9. `docs/slices/S24A-secure-document-foundation.md`
10. `docs/slices/S26-production-assurance-pilot.md`
11. `docs/slice-implementation-checklist.md`

## Current state and boundaries

- S01–S26 are implemented; S24B is the only unimplemented registered slice.
- S24B is blocked on real EDMS, malware-scanner and OCR contracts/test services.
- S26 provides assurance tooling, not fabricated evidence. Production is a no-go until every required assurance check is PASSED and current.
- Local disk, disabled/mock scanning, demo accounts and `Demo123!` are not production facilities.
- Production staff are created and governed in ITF Workspace, synchronized to Flow without a local password, and enter through Workspace with MFA evidence.
- Workspace synchronization clears any existing local password hash for the matching email.
- Demo seeding is forbidden under `NODE_ENV=production` and requires `ALLOW_DEMO_SEED=true` elsewhere.
- Local staff-password login defaults off in production and must remain off for assurance approval.
- PostgreSQL is the workflow/metadata source of truth. The selected EDMS/document provider is the content source of truth after S24B.
- Database and document storage must be backed up and recovered as one operational set.

## Engineering rules

- Preserve user changes; inspect `git status` before editing.
- Never commit `.env`, secrets, database dumps, real correspondence, uploads, generated clients, `.next` or `node_modules`.
- Apply committed migrations with `npm run db:migrate`; do not use `migrate dev` merely to install them and never rewrite an applied migration.
- Enforce authorization server-side. UI visibility is not authorization.
- Preserve classification, need-to-know, delegation, step-up and dual-attribution controls.
- Keep business transitions, audit events and notification/outbox effects transactional where applicable.
- Do not log secrets or document content and do not add continuous database polling.
- Keep EDMS and Workspace contracts provider-neutral and versioned.
- For each material implementation, report practical use, changes, validation, limitations and commit hash; update the slice register when it is a slice.

## Baseline validation

```powershell
npm run db:status
npm run env:check
npm run test:assurance
npm run verify
```

Do not call a check passed unless it actually executed successfully. Follow `docs/environment-launch-checklist.md` for local, staging and production procedures.
