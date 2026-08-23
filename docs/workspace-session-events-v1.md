# Workspace session events v1

ITF Flow receives immediate central-session and entitlement revocation from ITF Workspace at:

`POST /api/integrations/workspace/session-events`

## Trust and configuration

- `WORKSPACE_INTEROP_SECRET` is a separate random service credential of at least 32 characters and must match the
  Workspace deployment for the same environment.
- `WORKSPACE_APP_SLUG` identifies this receiver and defaults to `itf-flow`. An event addressed to another slug is
  rejected.
- Development, staging and production must use different credentials. The bearer credential must be stored in the
  deployment secret manager and must not be placed in source control.

## Contract

The JSON body is versioned as `itf-workspace-session-event-v1` and contains a UUID `eventId`, event type,
`workspaceUserId`, optional `workspaceSessionId`, target app slug, occurrence time and a bounded reason code.

- `CENTRAL_LOGOUT` with a session identifier revokes only ITF Flow sessions created from that Workspace session.
- `ENTITLEMENT_REVOKED` revokes every active ITF Flow session for the user and deactivates their ITF Flow identity.

The receiver stores the event identifier and the session/user update in one database transaction. A unique event key
and atomic insert make concurrent retries safe: the first request applies the change and later copies return an accepted
duplicate response. Unknown Workspace users are also recorded as accepted events; they cannot have a matching Flow
session.

Regranting access requires the established Workspace directory synchronization to reactivate and reconcile the ITF
Flow identity before another Workspace launch is accepted.

## Response and audit behavior

Successful and duplicate requests return `accepted: true`. Responses use `Cache-Control: no-store` and carry an
`X-Correlation-Id`. `IntegrationEvent` retains the originating event ID, correlation ID, affected Workspace identity,
reason and matched-session count without storing the bearer credential.

Malformed, unauthenticated or incorrectly addressed requests are rejected before session state changes.

## Verification

- `npm run test:security` covers version, UUID, target slug, session-specific and entitlement-wide selectors.
- `npm run lint`, TypeScript checking and the production build must pass before deployment.
- End-to-end staging acceptance must prove initial delivery, duplicate delivery and delayed delivery after a simulated
  receiver outage using environment-specific credentials.
