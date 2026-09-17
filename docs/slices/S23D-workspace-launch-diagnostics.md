# S23D — Safe Workspace launch failure diagnostics

Status: **Implemented; staging launch recovery accepted; diagnostic failure-path acceptance pending**

Implementation commit: Flow `9577561`; matching Workspace preflight/runbooks `c992230`.

ITF confirmed on 2026-09-17 that directory synchronization restored Workspace-to-Flow launch. This accepts operational
launch recovery, not a code-specific rejection diagnosis or independent staging acceptance of failure logging.
Remaining A01 entitlement-revocation, duplicate-delivery and outage/retry cases are still open.

## Use case

The `invalid-token` login error formerly hid every handoff failure, including correctly signed assertions rejected
because the provisioned user was inactive, the role differed, the database transaction failed, or session creation
failed. Support now receives a UUID reference to locate an allow-listed stage/code in Flow runtime logs.

## Changes

- Launch route retains exact issuer/audience/slug, RS256/JWKS, timing, TOTP, immutable identity, active provisioned role
  and single-use redemption checks. No identity is created or reactivated through launch.
- Runtime `workspace_launch_failed` records contain only event, server-generated reference, stage and category.
  New diagnostics do not log assertions, claims, staff records, raw errors, database credentials or exception stacks.
- Failure redirect retains `error=invalid-token` and adds `reference=<uuid>`; browser shows safe retry/support advice
  only, not provisioning/account details. Failure responses are `no-store` and `no-referrer`.
- Session audit correlation uses the server-generated launch reference, not an incoming header or token identifier.
- No migration, new variable, secret or protocol version. Visible UI changes only on failed handoff login.

## Deployment and acceptance

Deploy Flow, launch freshly from Workspace and search the **Flow** Vercel runtime logs for the displayed reference.
Use the code-specific procedure in [workspace launch v2](../workspace-launch-v2.md). Workspace W39 supplies a local
read-only preflight that compares signing/directory configuration without printing personal records or secrets.

2026-09-17 read-only central checks found one inactive Flow identity among seven otherwise matching active Workspace
entitlements. This is evidence of one provisioning-state problem, not proof that every reported rejection has that
cause. No identity was restored automatically. Reconfirm approved access and outstanding events before synchronization.

## Verification and rollback

Three diagnostics regressions plus existing signature, timing, assurance, replay-contract and identity-contract tests;
33 security tests, TypeScript, lint, Prisma validation and production build passed. Actual
staging recovery remains pending a deployed fresh-launch reference/observation.

Rollback the application commit to remove diagnostics. No data rollback is needed or authorized. Existing central
revocation and app entitlement state must remain authoritative.
