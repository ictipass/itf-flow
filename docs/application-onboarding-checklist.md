# ITF Workspace Application Onboarding Checklist

This contract applies to JavaScript, .NET, Java, Python, PHP, low-code, and legacy applications.

## Ownership and inventory

- Product owner, technical owner, support owner and data owner are named.
- Production, staging, health-check and callback URLs are documented.
- Users, roles, permissions, data scopes, sessions and audit mechanisms are inventoried.
- External-user and staff-user entry paths are explicitly separated.
- Business continuity, rollback and support escalation contacts are recorded.

## Identity and authorization

- Workspace stable user ID is stored separately from the child app’s local user ID.
- Identity, app entitlement, local role and data scope remain distinct concepts.
- Suspended users and revoked entitlements are rejected server-side.
- Local roles are mapped explicitly; no default privileged role is assigned.
- Multi-role users select an active context and every audit event records that context.
- Sessions have defined idle/absolute expiry, revocation and central-logout behavior.
- MFA and privileged step-up authentication requirements are defined.
- Existing login remains available during a controlled migration and rollback window.

## Launch/SSO integration

- App has a unique immutable ID and slug.
- Token issuer, audience, version, issued time and expiry are validated.
- Launch tokens are short-lived, single-use and removed from the URL immediately.
- Signing keys/secrets are stored outside source control and support rotation.
- Deep links are allowlisted to prevent open redirects.
- Session cookies are HTTP-only, Secure in production and appropriately SameSite.
- `Referrer-Policy: no-referrer` and standard security headers are set.
- App publishes a versioned notification-count contract when required.
- Authentication and authorization failures are correlated in both audit systems.
- Enterprise OIDC/OAuth is the target; custom signed handoff is treated as a bridge.

## Application security

- Threat model and data-classification review are approved.
- TLS, CSRF, XSS, injection, SSRF, clickjacking and open-redirect controls are tested.
- Rate limits cover sign-in, token exchange, uploads and sensitive mutations.
- File uploads use private storage, magic-byte validation, limits, malware scanning and quarantine.
- Secrets use managed storage and documented rotation.
- Sensitive data is encrypted at rest and access is least-privilege.
- Dependency, SAST, container and infrastructure scans are in CI.
- Penetration testing and remediation sign-off precede general production release.
- Break-glass access and incident response are documented and tested.

## Workflow and audit

- Workflow states and permitted transitions are versioned and documented.
- Commands are idempotent and protected from concurrent/stale updates.
- Every decision records actor, active role, reason, timestamp and before/after state.
- Routing records accountable owner, copies, originating desk and receiving desk.
- Audit events use UTC, immutable IDs and cross-application correlation IDs.
- Impersonation, delegation, reassignment and reversals are explicitly visible.
- Audit access is separately authorized; retention and export policies are approved.

## Reliability, performance and operations

- Queue/list queries are indexed, filtered and paginated.
- Email, notifications, scanning and heavy document work run asynchronously.
- Retry, idempotency and dead-letter behavior are defined.
- Structured logs, metrics, tracing, alerts and error reporting are configured.
- Availability, capacity, RPO and RTO targets are documented.
- Backups are encrypted and restoration is tested.
- Health/readiness checks do not expose sensitive information.
- Load tests cover expected concurrency, uploads and largest supported records.

## Engineering and documentation

- Environment-variable contract and secret ownership are documented.
- Database migrations are ordered, immutable after application and replay-tested.
- Unit, authorization, integration and browser tests cover critical paths.
- API or launch contracts are versioned and language-neutral.
- Deployment, rollback, incident, backup and support runbooks are current.
- Role-permission matrix, workflow transition table and data-retention schedule are maintained.
- Accessibility and supported-browser checks are completed.
- A staged pilot and legacy-login retirement plan are approved.

## SIWES-specific onboarding register

- Add stable `workspaceUserId` mapping without replacing SIWES local identity.
- Keep external student, institution, regulator and employer authentication.
- Map staff role assignments and scopes rather than trusting a Workspace role string directly.
- Reduce/reassess the current 30-day staff session and implement revocation.
- Replace the activity logger’s auto-created literal-password system account.
- Add a one-time Workspace exchange endpoint and correlated session/audit events.
- Test multi-role selection, inactive accounts, institution approval and Area Office scope.

## Reimbursement-specific onboarding register

- Implement the documented Workspace exchange endpoint.
- Map Workspace identities to existing active directory users and memberships.
- Keep employer/Google/local authentication for external users.
- Preserve organization, Area Office and Headquarters authorization boundaries.
- Add entitlement revocation checks, cross-app logout and attention-count endpoint.
- Pilot both login paths before making Workspace the primary staff sign-in.
