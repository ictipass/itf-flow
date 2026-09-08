# S23B - Split Flow-only and global Workspace sign-out

ITF Flow implementation commit: `515e94c`  
ITF Workspace implementation commit: `453a0d3`

## Outcome

The existing Flow sign-out remains a Flow-only action and returns the user to Workspace's application catalogue. A
small adjacent chevron now explains and offers **Sign out of Workspace and all apps**, which transfers the browser to
Workspace's confirmation screen.

## Behavior and security

- Flow-only sign-out revokes the current Flow database session, deletes its signed cookie and redirects to the
  configured Workspace catalogue URL. The central Workspace session remains active.
- The global handoff does not revoke Flow before confirmation. Cancelling in Workspace therefore changes no session
  and returns to the catalogue.
- Confirmation in Workspace revokes the current Workspace session and sends the existing W04 central event to Flow.
  Flow revokes sessions with that exact Workspace session ID. Other Workspace sessions/devices remain active.
- The state change is POST-backed. Navigating to Workspace `/logout` only displays confirmation, preventing logout
  through an unsolicited image/link GET request.
- Flow validates that the configured local return is absolute, on the exact Workspace origin and HTTPS in production.

## Configuration

No new configuration is required. The approved staging values are:

```dotenv
NEXT_PUBLIC_WORKSPACE_URL="https://itf-workspace-staging.vercel.app"
NEXT_PUBLIC_WORKSPACE_LOGOUT_URL="https://itf-workspace-staging.vercel.app/dashboard/apps"
```

The second name is retained for backward compatibility, but its value is the Flow-only return destination, not the
global endpoint. Global logout is derived from the first value.

## Visible UI effect

All four staff themes use a split sign-out control: the existing main action plus a smaller chevron. The chevron panel
states what the main action does and exposes global sign-out. Workspace displays a final confirmation/cancel card.

## Verification

- Flow: 30/30 security/contract tests; lint, typecheck and production build pass.
- Workspace: 68/68 tests; lint and production build pass.
- No migration or seed is required.

## Deployment and acceptance

Deploy Workspace `453a0d3` first, then Flow `515e94c`. Test Flow-only exit, global cancellation, confirmed global exit,
Flow session rejection after confirmation and preservation of a separate Workspace device session. Successful global
delivery counts toward the open A01 central-logout staging evidence.

## Rollback

Redeploy both preceding commits together. Retain the corrected catalogue return URL. No database rollback is required.
