# ITF Flow live-demo runbook

This is the operator's condensed runbook. The presentation narrative and detailed expected outcomes are
in [`stakeholder-presentation-package.md`](stakeholder-presentation-package.md) and
[`stakeholder-demo-script.md`](stakeholder-demo-script.md).

## Command Prompt startup

```cmd
cd C:\drxloanx\apps\itf-flow
npm run env:check
npm run db:status
set PORT=3001 && npm run dev
```

Run ITF Workspace separately on port 3000. Do not reseed immediately before a presentation if rehearsed
records are required; the seed is safe for users and grants, but the intended presentation state should
always be verified after running it.

## Demonstration accounts

All seeded accounts use `SEED_PASSWORD` (`Demo123!` by default) only in a disposable local demonstration database with `ALLOW_DEMO_SEED=true`. They are not production identities.

| Role | Account | Demonstration purpose |
|---|---|---|
| System administrator | `admin@itf.gov.ng` | Provisioning and configuration visibility |
| DG Secretary | `secretary.abuja@itf.gov.ng` | Shared intake and dispatch registry |
| DG | `dg@itf.gov.ng` | Executive minute and routing |
| Director ICT | `director.ict@itf.gov.ng` | Department ownership and peer referral |
| Director HR | `director.hr@itf.gov.ng` | Cross-department approval |
| Head Hardware Division | `head.hardware@itf.gov.ng` | Same-department Division Head referral |
| Head PASS Division | `head.pass@itf.gov.ng` | Peer recipient |
| Applications Officer | `officer.apps@itf.gov.ng` | Staff origination and hierarchy |

## Recommended 20-minute flow

1. Launch ITF Flow from Workspace and explain entitlement-aware app access.
2. Show public external submission, then the Secretary's shared intake queue.
3. Show a staff draft and submit it through the configured supervisor.
4. As Director ICT, prepare an outgoing letter and request formal approval from Director HR.
5. As Director HR, approve with a note and forward upward to DG.
6. Show the immutable passage timeline, decision register, and document versions.
7. Demonstrate a same-department Division Head peer referral with Director ICT copied.
8. Show an organizational broadcast, recipient read state, and acknowledgement.
9. As Secretary, prepare a dispatch record and explain delivery/failure tracking.
10. Close with security controls, current MVP boundaries, EDMS/malware roadmap, and requested decisions.

Use separate browser profiles for simultaneous roles or sign out before changing roles. Never modify
cookies or database records during the presentation to simulate authorization.
