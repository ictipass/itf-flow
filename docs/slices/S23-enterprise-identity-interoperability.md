# S23 - Enterprise Workspace identity, MFA, central logout and interoperability

## Practical implication

ITF Flow staff sessions can now be revoked immediately by ITF Workspace instead of remaining valid until a signed
cookie expires. Workspace supplies enterprise identity, active application entitlement, the provisioned role,
upstream MFA evidence and its central session identifier. Workspace can also retrieve privacy-safe attention counts.

## Delivered

- Database-backed staff sessions with configurable idle expiry, eight-hour absolute expiry, authentication method,
  identity provider, Workspace session ID, MFA time, step-up time and revocation evidence.
- Workspace launch v2 validates issuer, audience, two-minute lifetime, single use, active entitlement, MFA within
  12 hours, stable identity mapping and agreement with the directory-provisioned role.
- Unknown, inactive or role-mismatched users are rejected; launch cannot create users or grant roles.
- Recent enterprise MFA satisfies the existing 15-minute Secret step-up window.
- Bridge v1 remains for migration and is disabled by default in production.
- Idempotent central logout and entitlement revocation, including optional central-session targeting.
- Directory deactivation immediately revokes active sessions.
- Versioned attention-count API, correlation IDs and a durable integration-event ledger.

## Workspace launch v2

The HMAC envelope uses payload version `itf-workspace-launch-v2` and adds:

```json
{
  "issuer": "itf-workspace",
  "app": { "slug": "itf-flow", "role": "OFFICER", "entitled": true },
  "authentication": {
    "sessionId": "stable-central-session-id",
    "methods": ["password", "mfa"],
    "authenticatedAt": 1787443200
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
  "workspaceSessionId": "optional-specific-session-id",
  "reason": "User signed out centrally"
}
```

`ENTITLEMENT_REVOKED` also deactivates the local user. Repeated event IDs are idempotent. Calls should include
`X-Correlation-Id`.

## Attention contract

`GET /api/integrations/workspace/attention?workspaceUserId=...` uses the same bearer secret and returns
`itf-flow-attention-v1`, entitlement, unread notifications, active action items and overdue counts. It exposes no
subject, classification, sender, minute or document metadata.

## Configuration and boundary

The launch, directory and interoperability APIs use three separate secrets. `WORKSPACE_TOKEN_ISSUER`,
`WORKSPACE_ALLOW_LEGACY_LAUNCH`, `STAFF_SESSION_IDLE_MINUTES` and `NEXT_PUBLIC_WORKSPACE_LOGOUT_URL` control issuer,
migration, idle expiry and central sign-out behavior.

ITF Flow consumes identity and MFA assertions from Workspace but does not operate an OIDC provider. Production still
requires IdP registration, managed keys/secrets, TLS, rotation, logout delivery, MFA policy and security testing.
Local password login remains a development/demo facility only. It defaults off in production; Workspace synchronization removes prior local passwords from matched production identities.

Validation: migration deploy/status, Prisma validation/client generation, TypeScript, ESLint and production build.
