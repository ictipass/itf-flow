# ITF Flow Workspace launch v2 receiver

ITF Flow accepts only the `itf-workspace-launch-v2` handoff. The receiver verifies an RS256 signature against
Workspace's versioned JWKS, validates the exact issuer, audience and app slug, then atomically consumes the
assertion's `jti` while resolving the provisioned identity. Legacy shared-secret launch assertions are not accepted.

## Required production configuration

| Variable | Purpose | Required value |
|---|---|---|
| `WORKSPACE_LAUNCH_ISSUER` | Exact trusted Workspace issuer | Canonical Workspace HTTPS origin |
| `WORKSPACE_LAUNCH_AUDIENCE` | Audience assigned to ITF Flow in Workspace | `itf-flow`, unless the registry uses another approved stable identifier |
| `WORKSPACE_LAUNCH_JWKS_URL` | Public signing-key source | Workspace `/api/integrations/workspace/v2/jwks` HTTPS URL |
| `WORKSPACE_APP_SLUG` | Workspace registry slug checked in the entitlement | Defaults to `itf-flow` |
| `WORKSPACE_LAUNCH_TTL_SECONDS` | Maximum assertion lifetime | `120` under D06 |
| `WORKSPACE_LAUNCH_CLOCK_SKEW_SECONDS` | Allowed clock difference | `30` under D06 |
| `WORKSPACE_MFA_STEP_UP_SECONDS` | Maximum age of TOTP for a sensitive launch | `600` under D05 |

Development defaults point to `http://localhost:3000`, use audience/slug `itf-flow`, and retain the approved timing
values. Production configuration fails closed unless the issuer and audience are explicit and all Workspace URLs use
HTTPS.

## Runtime behavior

1. The receiver parses a three-part JWS and permits only `RS256`, type `itf-workspace-launch+jwt`, and a non-empty
   `kid`.
2. It caches public JWKS for five minutes. An unknown key triggers a refresh so an approved rotation can converge.
3. It verifies the signature, `iss`, `aud`, app slug, timestamps, immutable Workspace subject, explicit role and
   authentication context and current Workspace idle/absolute session limits.
4. `STANDARD` entitlements require password authentication. `SENSITIVE` entitlements additionally require a TOTP
   event no older than ten minutes when the assertion was issued.
5. The unique `LaunchTokenRedemption.tokenId` record rejects replay. A valid assertion is exchanged for an ITF Flow
   session and is never used as the application session itself. The Flow session cannot outlive either Workspace's
   idle deadline or its three-hour absolute deadline.
6. The locally provisioned ITF Flow user must still be active and have exactly the asserted ITF Flow role. Immutable
   Workspace ID is authoritative; split ID/email matches, unknown users and role mismatches fail closed.

## Handoff failure support procedure

The login URL `error=invalid-token` is deliberately generic: it also covers provisioning and database/session failures.
On S23D or later, capture the displayed UUID reference/time, then find `workspace_launch_failed` with that reference in
Flow Vercel runtime logs. Never share the assertion URL or token. The record exposes only an allow-listed stage/code.

| Code | Safe action |
|---|---|
| `USER_NOT_PROVISIONED`, `USER_INACTIVE`, `ROLE_MISMATCH` | Reconfirm central access is approved, examine pending revocations, then synchronize entitled staff from Workspace; never force active state in SQL |
| `IDENTITY_CONFLICT`, `ROLE_UNSUPPORTED` | Escalate immutable identity or implemented-role reconciliation; no fallback |
| `SIGNING_KEY_UNKNOWN`, `SIGNATURE_INVALID` | Check trusted JWKS and signer/key pairing; rotation uses a new `kid`; never disable verification |
| `CLAIMS_INVALID`, `RECEIVER_CONFIGURATION_INVALID` | Compare exact deployed normalized issuer, audience and slug with registry/environment settings |
| `TIMING_INVALID`, `TOKEN_REPLAYED` | Use a fresh Workspace launch with a live central session; check clocks if timing repeats |
| `ASSURANCE_REQUIRED` | Complete fresh approved TOTP |
| `JWKS_UNAVAILABLE`, `JWKS_RESPONSE_INVALID`, `TOKEN_VERIFICATION_FAILED` | Check Flow-to-Workspace HTTPS/key fetch and parser/configuration failures using the reference |
| `DATABASE_UNAVAILABLE`, `SESSION_CREATION_FAILED`, `PROVISIONING_FAILED` | Check database pooling, migration/transaction behavior and Flow `SESSION_SECRET`; public readiness is not a launch transaction test |
| `TOKEN_MALFORMED`, `HEADER_INVALID` | Start at Workspace and verify current v2 deployment |

Synchronization affects all active Flow entitlements. A pending old revocation may disable a restored identity later;
ordered/versioned lifecycle delivery remains a separate gate. Local env-file checks do not prove Vercel env scopes.

## Deployment gates

- Workspace must use the same issuer and ITF Flow audience configured here.
- Infrastructure must provide trusted HTTPS routing from ITF Flow to Workspace's JWKS endpoint.
- Workspace and Flow must deploy this assertion revision together. Assertions without upstream session bounds are
  rejected rather than receiving a compatibility fallback.
- Production signing remains blocked until the approved non-exportable KMS/HSM adapter and key are selected and the
  launch key-management checklist is completed.
- The W04 session-event worker must remain operational for immediate central logout and entitlement revocation. The
  assertion deadline is an additional fail-safe, not a replacement for event delivery.
