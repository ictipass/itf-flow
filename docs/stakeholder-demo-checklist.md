# Stakeholder demonstration checklist

## One day before

- [ ] Confirm presentation objective, audience, allotted time, and requested decisions.
- [ ] Pull the intended commits and keep all repositories clean.
- [ ] Run `npm run setup:verify` and `npm run build` in ITF Flow.
- [ ] Verify Workspace separately and confirm the launch secret matches.
- [ ] Confirm all seeded accounts can sign in using the configured demo password.
- [ ] Rehearse the exact scenario and prepare fallback records at every major stage.
- [ ] Use small, non-sensitive sample attachments only.
- [ ] Disable live mailbox synchronization unless credentials were independently verified.
- [ ] Confirm browser zoom, projector resolution, and network requirements.
- [ ] Export or locally cache these Markdown documents for offline access.

## Thirty minutes before

- [ ] Start PostgreSQL and verify `npm run env:check`.
- [ ] Start Workspace on port 3000 and ITF Flow on port 3001.
- [ ] Open public submission, Workspace, Flow login, and presentation notes in separate tabs.
- [ ] Prepare separate browser profiles or private windows for key roles.
- [ ] Confirm there is no real confidential correspondence visible.
- [ ] Record the latest commit hashes and take a database backup if rehearsed records matter.
- [ ] Silence notifications and close terminals that expose environment values.

## Recovery table

| Failure | Safe recovery |
|---|---|
| Workspace handoff fails | Open ITF Flow directly and sign in; explain the integration boundary, then continue the workflow demo. |
| Mail authentication fails | Do not troubleshoot credentials live. Use the public portal or a prepared imported record. |
| New submission fails | Open a rehearsed record at the same stage and continue. |
| Role switching becomes confusing | Sign out explicitly or use labelled browser profiles; do not manipulate cookies. |
| Database is unavailable | Restart PostgreSQL once, run `npm run env:check`, then switch to screenshots only if recovery is not immediate. |
| Attachment download fails | Continue with composed memo text and explain local-storage/EDMS boundaries. |
| Projector or network fails | Use the locally cached presentation package and captured screens; avoid depending on GitHub or Vercel. |
| Unexpected authorization denial | Treat it as evidence of server-side enforcement; use the correct seeded role or prepared record rather than changing data live. |

## Do not claim

- Do not describe current approval as a cryptographic digital signature.
- Do not claim attachments are malware-scanned.
- Do not claim full Secret-classification need-to-know enforcement.
- Do not claim SMTP acceptance proves recipient delivery; delivery confirmation remains a separate step.
- Do not claim automated dispatch emails include attachments while files remain unscanned.
- Do not describe local disk storage as production-ready or Vercel-safe.
- Do not promise EDMS behavior until its API and governance rules are confirmed.
