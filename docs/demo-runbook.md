# ITF Flow Demo Runbook

## Environment

- ITF Workspace: `http://localhost:3000`
- ITF Flow: `http://localhost:3001`
- Workspace launch URL: `http://localhost:3001/workspace/launch`
- Workspace app slug: `itf-flow`
- The same `WORKSPACE_LAUNCH_TOKEN_SECRET` must be configured in both apps.

## Preparation

```powershell
Copy-Item .env.example .env
npx prisma migrate deploy
npm run db:seed
npm run dev -- -p 3001
```

Run Workspace on port 3000 and run its seed once to register ITF Flow. Assign app roles using exact
ITF Flow role codes such as `DG_SECRETARY`, `DG`, `DIRECTOR`, `DIVISION_HEAD`, `UNIT_HEAD`, or
`OFFICER`.

## Ten-minute presentation

1. Open ITF Flow publicly and submit an incoming letter as an external organization.
2. Sign in as `secretary.abuja@itf.gov.ng` and open the submission in Correspondence.
3. Verify/register it; the system sends it to the DG.
4. Sign in as `dg@itf.gov.ng`, acknowledge it, add a minute, and select multiple Directors.
5. Sign in as `director.ict@itf.gov.ng` and route it to Head PASS Division.
6. Continue to Head Applications Unit and Applications Officer.
7. Resolve it and show the complete movement/minutes timeline.
8. Open Workspace and show all registered apps, including greyed-out inaccessible apps.
9. Launch ITF Flow from Workspace to demonstrate one-time session handoff.

All local demo users use `Demo123!` unless `SEED_PASSWORD` overrides it.
