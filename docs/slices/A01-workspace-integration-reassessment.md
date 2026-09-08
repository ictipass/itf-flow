# A01 - ITF Workspace integration reassessment

ITF Flow implementation commit: `02b433d`

ITF Workspace implementation commit: `1a08a5b`

## Outcome

The two applications have been reassessed as one security lifecycle. Launch, provisioning, role/assurance changes and
revocation no longer behave as independent paths that can temporarily disagree. The code is ready for joint staging,
but this is not pilot or production approval.

## Implemented boundaries

- A Workspace launch carries the authoritative idle and three-hour absolute session deadlines. Flow caps its database
  session and cookie at the earlier deadline and rejects missing, expired or inverted bounds.
- The versioned `itf-workspace-directory-v1` contract is target-bound, limited to 500 users per request and sent in a
  configurable batch size (200 by default) with a 30-second bounded timeout.
- Directory request UUIDs are idempotent and bound to a SHA-256 digest of the validated payload. A repeated identical
  request returns its recorded outcome; UUID reuse with different content is rejected.
- The immutable Workspace user ID is the primary identity. Email can link only an existing Flow user without a
  Workspace ID. Split or conflicting ID/email matches fail the transaction.
- Directory role changes and active-to-inactive transitions revoke existing Flow sessions in the same transaction.
- Launch consumes its one-time token in the same transaction as immutable identity resolution. Unknown, inactive,
  conflicting or role-mismatched identities fail closed.
- Workspace role changes first issue entitlement revocation. Directory synchronization refuses to reactivate an
  included identity while its relevant revocation event remains undelivered.
- Raising an ITF Flow app or role from standard to sensitive terminates current Flow sessions so the next launch must
  satisfy the stronger TOTP requirement.

No database migration was required; existing integration-event, provisioning-run and session records support the
contract.

## Deployment order

This launch revision is deliberately fail-closed and has no fallback for assertions without upstream session bounds.
Deploy the Flow receiver before or together with Workspace, configure the matching trust values and service
credentials, then run directory synchronization before allowing staff launch. Keep local, staging and production
credentials separate.

Required Flow values for staging are `WORKSPACE_LAUNCH_ISSUER`, `WORKSPACE_LAUNCH_AUDIENCE`,
`WORKSPACE_LAUNCH_JWKS_URL`, `WORKSPACE_DIRECTORY_SYNC_SECRET`, `WORKSPACE_INTEROP_SECRET` and
`WORKSPACE_APP_NAVIGATION_SECRET`. Workspace requires the matching directory, interoperability and app-navigation
credentials plus `WORKSPACE_OUTBOX_WORKER_SECRET`; the approved scheduler must invoke the outbox worker.

## Approved staging profile

Recorded 2026-09-04:

- ITF Flow staging origin: `https://itf-flow-staging.vercel.app`;
- ITF Workspace staging origin: `https://itf-workspace-staging.vercel.app`;
- application assurance: `STANDARD`;
- initial `SYSTEM_ADMIN` child-app role assurance: `SENSITIVE`; and
- the Flow staging database exists with migrations applied.

The application-level `STANDARD` classification permits password-only launch for standard Flow roles. The
`SYSTEM_ADMIN` role remains `SENSITIVE`, so the more restrictive role classification requires a fresh TOTP step-up.

Configure the Flow Preview environment for the staging branch with:

```dotenv
WORKSPACE_LAUNCH_ISSUER="https://itf-workspace-staging.vercel.app"
WORKSPACE_LAUNCH_AUDIENCE="itf-flow"
WORKSPACE_LAUNCH_JWKS_URL="https://itf-workspace-staging.vercel.app/api/integrations/workspace/v2/jwks"
WORKSPACE_APP_SLUG="itf-flow"
WORKSPACE_APP_NAVIGATION_TIMEOUT_MS="3000"
WORKSPACE_LAUNCH_TTL_SECONDS="120"
WORKSPACE_LAUNCH_CLOCK_SKEW_SECONDS="30"
WORKSPACE_MFA_STEP_UP_SECONDS="600"
NEXT_PUBLIC_WORKSPACE_URL="https://itf-workspace-staging.vercel.app"
NEXT_PUBLIC_WORKSPACE_LOGOUT_URL="https://itf-workspace-staging.vercel.app/dashboard/apps"
NEXT_PUBLIC_APP_URL="https://itf-flow-staging.vercel.app"
STAFF_LOCAL_LOGIN_ENABLED="false"
ALLOW_DEMO_SEED="false"
```

`WORKSPACE_DIRECTORY_SYNC_SECRET`, `WORKSPACE_INTEROP_SECRET` and `WORKSPACE_APP_NAVIGATION_SECRET` are separate
staging-only credentials and must match their corresponding Workspace values. They are not interchangeable and must
not be reused in another environment.

Flow uses `DATABASE_URL` only for application traffic and prefers Prisma Postgres's pooled endpoint in deployed
environments. `DIRECT_URL` is selected by Prisma migration/admin commands and should use the provider's direct
endpoint. Both `postgres://` and `postgresql://` are accepted; neither URL may be logged or retained as evidence.

Vercel Hobby cron is not an acceptable continuous revocation-retry scheduler: it runs at most daily with hourly
imprecision, invokes only Production deployments, and therefore cannot serve the staging Preview deployment. Keep the
default 30-second retry base for an external scheduler capable of invoking the protected Workspace worker at least
every 30 seconds. For the finite A01 staging exercise, an authorized manual worker invocation may prove outage/retry
recovery, but it is acceptance evidence only and does not satisfy the controlled-pilot operational gate.

## Verification

- ITF Flow: TypeScript and ESLint pass; production build passes; 30/30 security, database-configuration and contract
  tests pass.
- ITF Workspace: TypeScript and ESLint pass; production build passes; 68/68 security and contract tests pass across
  13 suites.
- Local PostgreSQL: all 28 Flow migrations and all 8 Workspace migrations are applied.
- Flow environment validation reaches PostgreSQL but correctly fails readiness because launch issuer, audience and
  JWKS URL are not configured. Workspace validation passes development rules and reports Flow directory sync as not
  configured.
- On 2026-09-05, the deployed Flow staging `/api/health/ready` endpoint returned `status: ready` and
  `database: reachable`, with an observed latency of 732 ms. This proves reachability for that request only; it is not
  load, sustained-latency or failover evidence.

ITF confirmed rotation of the disclosed staging database credential on 2026-09-05. The replacement remains confined
to the staging-scoped Vercel Sensitive variable and ignored local environment file; no replacement value is retained
as evidence.

An unauthenticated external probe on 2026-09-05 found that Workspace's JWKS endpoint is publicly reachable, while
Flow's staging readiness and `/workspace/launch` routes redirect to Vercel Authentication. A browser already signed
into Vercel can mask this condition, but ordinary staff and Workspace's server-to-server requests do not possess that
Vercel session. A01 provisioning and launch acceptance are therefore blocked until Flow staging has a controlled
public application boundary or an approved protection design that supports both browser navigation and
machine-to-machine calls without putting a bypass secret in launch URLs.

ITF confirmed on 2026-09-05 that `itf-flow-staging` is a dedicated staging-only Vercel project and production will
use the separate `itf-flow.vercel.app` deployment. The recommended staging correction is therefore to disable Vercel
Authentication for the dedicated staging project, while retaining Flow's application authentication, signed
single-use launch assertion and service-credential enforcement. This does not approve the same protection setting for
the separate production project.

After ITF applied that correction, an independent unauthenticated probe returned HTTP 200 JSON from
`/api/health/ready`; an unsigned `/workspace/launch` request reached Flow and resolved to its own
`/login?error=missing-token` response instead of Vercel login. Authenticated probes using the locally held staging
directory and interoperability credentials reached both protected receivers and returned HTTP 400 for deliberately
invalid empty payloads, rather than HTTP 401. No provisioning or session-event record was created. This confirms the
Flow-side credentials are installed and the application boundary is ready for Workspace configuration.

The next acceptance exercise must prove provisioning, launch, replay rejection, role change, assurance increase,
central logout, entitlement revocation, duplicate delivery and outage/retry recovery in a production-like staging
environment.

On 2026-09-06, ITF confirmed that the matching Workspace staging integration configuration was installed and
Workspace was redeployed. ITF Flow was registered, the administrator was granted its `SYSTEM_ADMIN` entitlement, the
entitled user synchronized successfully, and a genuine Workspace-to-Flow launch completed. Provisioning and the first
launch happy path are therefore accepted. Replay rejection, role and assurance changes, central logout, entitlement
revocation, duplicate delivery and outage/retry recovery remain. W28/S23B now provides the user-facing confirmed
central-logout path for that acceptance exercise.

## UI effect

Flow commit `4747f67` adds the entitled-app switcher to all four staff shells and corrects Glass-header navigation
collisions. Users whose role, status or required assurance changes will have their old Flow session ended and must
return through Workspace. Workspace administrators receive explicit guidance to synchronize Flow after changing an
entitlement role.

## Readiness

A01 code implementation, environment-separated staging configuration, provisioning and first launch are accepted.
The remaining lifecycle exercise and a continuous retry scheduler remain gates. Until those pass, ITF Flow is not
approved for a controlled pilot.
