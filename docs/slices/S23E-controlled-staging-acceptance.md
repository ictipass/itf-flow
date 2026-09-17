# S23E — Controlled staging acceptance

Implemented 2026-09-17; joint live A01-06/A01-07 acceptance pending. Workspace dependency: W42.
Implementation commits: Flow `c4cef48`; Workspace `b3a9ab5`.

Adds an explicitly staging-only, default-off, one-identity diagnostic window of at most 24 hours. The authenticated
session-event receiver can return one requested HTTP 503 for the pinned A01-07 revocation before database effects.
Normal retry omits that header. A read-only authenticated diagnostic endpoint reports only the pinned user's
provisioning/active state and bounded event/session counts. It accepts no arbitrary user listing or write operation.

The existing receiver's transactional idempotence and real session revocation remain the behavior under test.
Expired-but-unrevoked sessions are counted separately from live sessions so revocation evidence matches the actual
receiver selector. No migrations, browser-exposed credentials or new secrets.

## Configuration and deployment

In the dedicated Flow staging Vercel project only:

- `ITF_FLOW_DEPLOYMENT_STAGE=staging`;
- `WORKSPACE_STAGING_ACCEPTANCE_ENABLED=true` during the approved window;
- `WORKSPACE_STAGING_ACCEPTANCE_USER_ID` = the dedicated ordinary test user's immutable Workspace ID;
- `WORKSPACE_STAGING_ACCEPTANCE_EXPIRES_AT` = UTC ISO timestamp ending in Z, within 24 hours.

The last three values must match Workspace staging. Keep enable false elsewhere.
The dedicated staging project's Vercel Production slot does not make it the real production application; explicit
stage configuration distinguishes it. Never enable this profile in the real production project.

Deploy both apps, then follow Workspace's `docs/acceptance/A01-staging-diagnostic-operations.md`. Diagnostics require
explicit SYSTEM_ADMIN/fresh-TOTP revocation consent on Workspace, an approved maintenance reference and a live Flow
session. Do not run them against production or the only recoverable administrator.

After each accepted case, regrant OFFICER and synchronize through Workspace before proving new launch recovery.
Resolve pending diagnostic events before disabling flags or reverting code; then disable, remove pin/expiry and
redeploy both apps. No data deletion is required or authorized.

## Verification and remaining gates

Tests check default-off/stage/target/expiry guards, strict request validation, authenticated pre-side-effect failure
ordering and read-only observations. Full types, lint and production build verification are required.
Local tests do not constitute live duplicate/outage acceptance. Continuous retry scheduling and independent production
assurance remain separate gates.

Verification: `npm run test:security` passed 36 cases and `npm run verify` passed schema, types, lint and production
build. Paired Workspace verification passed 100 cases, its full build and 57-document checks.
Starting commit: `5a55007`; worktree was clean before this operation. Live diagnostics were not invoked.

ITF confirmed A01-05 on 2026-09-17: both browser profiles rejected protected pages after entitlement removal;
Workspace disabled Flow; OFFICER regrant and synchronization restored launch. No personal identity or credential is
retained as repository evidence.
