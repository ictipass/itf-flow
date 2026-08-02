# Fresh-machine verification checklist

- [ ] Repository cloned from `origin` and expected branch checked out.
- [ ] `git status` is clean before local configuration begins.
- [ ] Node.js is 20.9 or newer and `npm ci` succeeds.
- [ ] `.env` was created from `.env.example` and was not committed.
- [ ] PostgreSQL database name and credentials were independently verified.
- [ ] `npm run db:migrate` reports the schema is current.
- [ ] `npm run db:seed` creates the documented demo users when a fresh database is used.
- [ ] `npm run env:check` passes without exposing any secret values.
- [ ] Existing `storage/uploads` was restored when an existing database was restored.
- [ ] `npm run verify` passes.
- [ ] Login works with a seeded account.
- [ ] Draft creation, hierarchy routing, peer referral, approval, revision, and dispatch are smoke-tested.
- [ ] Shared Secretariat intake opens for a Secretary or administrator.
- [ ] Mail connection is tested only after credentials are installed securely.
- [ ] ITF Workspace launch uses matching secrets and the correct local ports.
- [ ] Latest commit hash and pending slice are recorded for the next developer session.
