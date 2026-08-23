# S23 - Enterprise Workspace identity, MFA, central logout and interoperability

## Practical implication

ITF Flow staff sessions can now be revoked immediately by ITF Workspace instead of remaining valid until a signed
cookie expires. Workspace supplies enterprise identity, active application entitlement, the provisioned role,
upstream MFA evidence and its central session identifier. Workspace can also retrieve privacy-safe attention counts.

## Delivered

- Database-backed staff sessions with configurable local idle expiry, upstream Workspace idle/absolute bounds,
  authentication method, identity provider, Workspace session ID, MFA time, step-up time and revocation evidence.
- Workspace launch v2 validates issuer, audience, two-minute lifetime, single use, active entitlement, MFA freshness,
  immutable identity mapping, upstream session bounds and agreement with the directory-provisioned role.
- Unknown, inactive or role-mismatched users are rejected; launch cannot create users or grant roles.
- Recent enterprise TOTP satisfies the approved ten-minute Workspace step-up window.
- Legacy shared-secret launch is rejected.
- Idempotent central logout and entitlement revocation, including optional central-session targeting.
- Directory role changes and deactivation immediately revoke active sessions.
- Versioned attention-count API, correlation IDs and a durable integration-event ledger.

## Workspace launch v2

The RS256-signed assertion uses payload version `itf-workspace-launch-v2` and includes:

```json
{
  "iss": "https://workspace.example.test",
  "aud": "itf-flow",
  "entitlement": { "appSlug": "itf-flow", "role": "OFFICER" },
  "authentication": {
    "workspaceSessionId": "stable-central-session-id",
    "methods": ["password", "totp"],
    "authenticatedAt": 1787443200,
    "idleExpiresAt": 1787444400,
    "absoluteExpiresAt": 1787454000
  }
}
```

Workspace must first provision the same stable user and application role through directory sync. Launch is
authentication and entitlement evidence; it is not role provisioning.

## Central session event

`POST /api/integrations/workspace/session-events`, authenticated with `WORKSPACE_INTEROP_SECRET`:

```json
{
  "version": "itf-workspace-session-event-v1",
  "eventId": "globally-unique-event-id",
  "type": "CENTRAL_LOGOUT",
  "workspaceUserId": "workspace-user-id",
  "workspaceSessionId": "required-central-session-id",
  "reason": "User signed out centrally"
}
```

`CENTRAL_LOGOUT` requires an exact Workspace session identifier. `ENTITLEMENT_REVOKED` has no session identifier,
applies to all sessions and also deactivates the local user. Repeated event IDs are idempotent. Calls should include
`X-Correlation-Id`.

## Attention contract

`GET /api/integrations/workspace/attention?workspaceUserId=...` uses the same bearer secret and returns
`itf-flow-attention-v1`, entitlement, unread notifications, active action items and overdue counts. It exposes no
subject, classification, sender, minute or document metadata.

## Configuration and boundary

Launch trust uses Workspace's asymmetric JWKS. Directory synchronization and session events use two separate bearer
credentials. `WORKSPACE_LAUNCH_ISSUER`, `WORKSPACE_LAUNCH_AUDIENCE`, `WORKSPACE_LAUNCH_JWKS_URL`,
`STAFF_SESSION_IDLE_MINUTES` and `NEXT_PUBLIC_WORKSPACE_LOGOUT_URL` control trust, local idle expiry and central sign-out.

ITF Flow consumes identity and MFA assertions from Workspace but does not operate an OIDC provider. Production still
requires managed keys/secrets, TLS, rotation, logout delivery, MFA policy and security testing.
Local password login remains a development/demo facility only. It defaults off in production; Workspace synchronization removes prior local passwords from matched production identities.

Validation: migration deploy/status, Prisma validation/client generation, TypeScript, ESLint and production build.
