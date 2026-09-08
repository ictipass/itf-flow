# S23C - Public Workspace staff entry

ITF Flow implementation commit: `8ff3202`

## Outcome

Staff who reach Flow directly are no longer left with an instruction but no navigation path. The public landing page
and `/login` route now link directly to the configured ITF Workspace login page.

## Behavior and boundaries

- The landing page exposes **Staff sign in through Workspace** and a secondary staff-access help route.
- `/login` exposes **Continue to ITF Workspace** whether or not local demonstration login is enabled.
- Local staff fields remain governed by `STAFF_LOCAL_LOGIN_ENABLED`; staging/production keep that setting false.
- The URL is derived from the validated `NEXT_PUBLIC_WORKSPACE_URL`. Production requires HTTPS and shares the same
  origin trust used by app navigation and global logout.
- The stakeholder portal and one-time external submission flows remain separate and are not redirected to Workspace.

## Visible UI effect

The two public staff entry points now contain prominent Workspace buttons. No authenticated Flow layout changed.

## Verification

- `npm run test:security`: 30/30 passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed when run sequentially after Prisma generation/build.
- `npm run build`: passed.
- No migration, seed, secret or new environment variable is required.

## Deployment and acceptance

Deploy `8ff3202` to Flow staging. In a private browser, verify both public links reach
`https://itf-workspace-staging.vercel.app/login`; authenticate and verify Workspace still enforces the entitled app
catalogue and signed Flow launch.

Staging acceptance passed on 2026-09-08: both public entry points reached Workspace login, and the resulting catalogue
and Flow launch retained entitlement enforcement.

## Next action

Continue with A01-02 role-change/mismatch acceptance using a dedicated staging test identity and explicitly approved
old/new Flow roles. Assurance increase, entitlement revocation, duplicate delivery and outage/retry recovery follow.
