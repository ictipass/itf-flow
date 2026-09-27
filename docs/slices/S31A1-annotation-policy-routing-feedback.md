# S31A1 — Annotation authentication policy and safe routing feedback

Status: **Implemented locally; migration and deployment pending**

## Outcome

System administrators can require or relax the extra document-annotation authentication step independently for DG,
Directors and Division Heads. Predictable correspondence-routing validation failures now remain on the detail page
and appear as an accessible error toast instead of escaping the Server Action into a generic runtime error page.

## Security and audit behavior

- All three role toggles default to enforced in the database migration.
- Only `SYSTEM_ADMIN` can change them, and each change requires a reason, checks configuration version concurrency
  and records old/new role sets, administrator and time in `ConfigurationChange`.
- Policy follows the substantive authority role, including delegated/acting work. Relaxing a role never relaxes the
  active Action work-item, sensitive-classification, source-hash, output-hash or HMAC integrity gates.
- A bypassed extra-auth step is recorded as `ADMIN_POLICY_RELAXED`, together with the policy version, in the signed
  canonical annotation payload and correspondence event.
- Roles outside DG, Director and Division Head continue to require strong authentication.

## Safe routing behavior

- The routing form uses React action state to retain inputs and display allow-listed validation messages in an
  accessible toast.
- A missing classification-change reason and missing recipient Department Secretary return actionable feedback.
- Selecting Confidential/Secret disables copy-recipient inputs; a crafted/stale request containing copies still
  fails server validation and returns the same safe feedback.
- Unexpected failures show a generic support message and remain logged server-side without exposing infrastructure
  details to the user.
- Role presentation now preserves the `DG` acronym, including `DG Secretary`.

## Data and deployment

Apply migration `20260927180000_add_annotation_auth_policy` before deploying the application. No environment variable
or external subscription is added.

## Verification

All 57 assurance tests pass, including independent role policy evaluation, DG labels and the three reported routing
messages. `npm run verify` passes Prisma validation, TypeScript/route generation, ESLint and the optimized 44-route
production build.

## Rollback

Revert the application commit to restore mandatory strong annotation authentication in code. Retain the additive
columns and audit rows unless an approved data migration says otherwise.
