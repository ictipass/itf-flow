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
`WORKSPACE_LAUNCH_JWKS_URL`, `WORKSPACE_DIRECTORY_SYNC_SECRET` and `WORKSPACE_INTEROP_SECRET`. Workspace requires the
matching directory and interoperability credentials plus `WORKSPACE_OUTBOX_WORKER_SECRET`; the approved scheduler must
invoke the outbox worker.

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
WORKSPACE_LAUNCH_TTL_SECONDS="120"
WORKSPACE_LAUNCH_CLOCK_SKEW_SECONDS="30"
WORKSPACE_MFA_STEP_UP_SECONDS="600"
NEXT_PUBLIC_WORKSPACE_URL="https://itf-workspace-staging.vercel.app"
NEXT_PUBLIC_WORKSPACE_LOGOUT_URL="https://itf-workspace-staging.vercel.app/logout"
NEXT_PUBLIC_APP_URL="https://itf-flow-staging.vercel.app"
STAFF_LOCAL_LOGIN_ENABLED="false"
ALLOW_DEMO_SEED="false"
```

`WORKSPACE_DIRECTORY_SYNC_SECRET` and `WORKSPACE_INTEROP_SECRET` are separate staging-only credentials and must match
the corresponding Workspace values. They are not interchangeable and must not be reused in another environment.

Flow uses `DATABASE_URL` only for application traffic and prefers Prisma Postgres's pooled endpoint in deployed
environments. `DIRECT_URL` is selected by Prisma migration/admin commands and should use the provider's direct
endpoint. Both `postgres://` and `postgresql://` are accepted; neither URL may be logged or retained as evidence.

Vercel Hobby cron is not an acceptable continuous revocation-retry scheduler: it runs at most daily with hourly
imprecision, invokes only Production deployments, and therefore cannot serve the staging Preview deployment. Keep the
default 30-second retry base for an external scheduler capable of invoking the protected Workspace worker at least
every 30 seconds. For the finite A01 staging exercise, an authorized manual worker invocation may prove outage/retry
recovery, but it is acceptance evidence only and does not satisfy the controlled-pilot operational gate.

## Verification

- ITF Flow: TypeScript and ESLint pass; production build passes; 24/24 security, database-configuration and contract
  tests pass.
- ITF Workspace: TypeScript and ESLint pass; production build passes; 40/40 security and contract tests pass.
- Local PostgreSQL: all 28 Flow migrations and all 8 Workspace migrations are applied.
- Flow environment validation reaches PostgreSQL but correctly fails readiness because launch issuer, audience and
  JWKS URL are not configured. Workspace validation passes development rules and reports Flow directory sync as not
  configured.
- On 2026-09-05, the deployed Flow staging `/api/health/ready` endpoint returned `status: ready` and
  `database: reachable`, with an observed latency of 732 ms. This proves reachability for that request only; it is not
  load, sustained-latency or failover evidence.

The staging database credential must be rotated after its disclosure before further acceptance evidence is collected.
The replacement must be stored only in the staging-scoped Vercel Sensitive variable and ignored local environment
file; it must not be copied into documentation or chat.

The next acceptance exercise must prove provisioning, launch, replay rejection, role change, assurance increase,
central logout, entitlement revocation, duplicate delivery and outage/retry recovery in a production-like staging
environment.

## UI effect

No Flow page layout changed. Users whose role, status or required assurance changes will have their old Flow session
ended and must return through Workspace. Workspace administrators now receive explicit guidance to synchronize Flow
after changing an entitlement role.

## Readiness

A01 code implementation is complete. Environment-separated staging configuration and the joint acceptance exercise
remain external gates. Until those pass, ITF Flow is not approved for a controlled pilot.
