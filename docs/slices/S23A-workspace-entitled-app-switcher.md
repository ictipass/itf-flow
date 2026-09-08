# S23A - Workspace-entitled app switcher

ITF Flow implementation commit: `4747f67`  
ITF Workspace implementation commit: `bc03856`

## Outcome

Every Flow staff UI now offers a nine-dot ITF application switcher without requiring the user to sign out. The list is
requested lazily from Workspace and contains only other applications that the current user is entitled to launch.
Workspace remains the complete registry and the authorization authority.

## Contract and security

- The browser calls Flow's authenticated same-origin `/api/workspace/apps` route; the navigation credential is never
  sent to browser code.
- Flow permits the request only for a current database session created by Workspace and sends the immutable Workspace
  user/session identity to Workspace using a dedicated, environment-specific credential.
- Flow validates the response version, correlation UUID, curated icon key and every launch URL's exact Workspace origin
  and path before exposing the result to its component.
- Every app link returns through Workspace's normal target launch route, so a stale menu cannot bypass current
  entitlement, status, session or MFA enforcement.
- Requests use a configurable bounded timeout, and all responses are private and non-cacheable. Unavailability fails
  closed with a retryable message.

## Configuration

Create one independent 32-byte random credential per environment. Store the same value as:

- `WORKSPACE_APP_NAVIGATION_SECRET` in Flow;
- `ITF_FLOW_APP_NAVIGATION_SECRET` in Workspace.

Do not reuse `WORKSPACE_DIRECTORY_SYNC_SECRET`, `WORKSPACE_INTEROP_SECRET`, a launch signing key or any worker secret.
`WORKSPACE_APP_NAVIGATION_TIMEOUT_MS` defaults to 3000 and accepts 500-10000. `NEXT_PUBLIC_WORKSPACE_URL` and
`WORKSPACE_APP_SLUG` bind the request to the intended Workspace environment and `itf-flow` application registration.

No database migration or seed is required. Deploy Workspace `bc03856` first, then Flow `4747f67`.

## Visible UI effect

The switcher is present in Classic, Modern, Soft UI and Glass headers. Normal selection replaces the current tab;
native Ctrl/Cmd-click and context-menu behavior can open a new tab. A direct Workspace shortcut opens the complete
registry. The Glass shell also collapses long navigation into its existing compact menu before it overlaps search,
notifications, profile and logout controls.

## Verification

- `npm run test:security`: 27/27 passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed and includes `/api/workspace/apps`.

Staging acceptance remains until both credentials are configured and the entitled/empty/error states, same/new-tab
behavior and Glass responsive layouts are exercised. Flow logout remains child-app-only; this slice does not introduce
a global logout action.

## Rollback

Redeploy both preceding application commits and then remove the paired navigation variables. There is no database
rollback. A temporary credential mismatch displays the fail-closed unavailable state and does not weaken launch
authorization.

## Next action

Complete joint W27/S23A staging acceptance, then continue the A01 lifecycle exercise with replay rejection, role and
assurance changes, central logout, entitlement revocation, duplicate delivery and outage/retry recovery.
