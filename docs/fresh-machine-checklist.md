# Fresh-machine verification checklist

- [ ] Repository cloned from `origin` and expected branch checked out.
- [ ] `git status` is clean before local configuration begins.
- [ ] Node.js 22 LTS is active (application minimum is 20.9) and `npm ci` succeeds.
- [ ] `.env` was created from `.env.example` and was not committed.
- [ ] PostgreSQL database name and credentials were independently verified.
- [ ] `npm run db:migrate` reports the schema is current.
- [ ] For a disposable local database only, `ALLOW_DEMO_SEED=true` and `npm run db:seed` create the documented demo users.
- [ ] Demo seeding is not used for staging or production.
- [ ] `npm run env:check` passes without exposing any secret values.
- [ ] Existing `storage/uploads` was restored when an existing database was restored.
- [ ] `npm run test:assurance` and `npm run verify` pass; host/runtime failures are recorded separately from assertion failures.
- [ ] Login works with a seeded account.
- [ ] Draft creation, hierarchy routing, peer referral, approval, revision, and dispatch are smoke-tested.
- [ ] Shared Secretariat intake opens for a Secretary or administrator.
- [ ] Mail connection is tested only after credentials are installed securely.
- [ ] ITF Workspace launch uses matching secrets and the correct local ports.
- [ ] Latest commit hash and pending slice are recorded for the next developer session.
- [ ] `docs/coding-assistant-handoff.md` and `docs/environment-launch-checklist.md` were read.
