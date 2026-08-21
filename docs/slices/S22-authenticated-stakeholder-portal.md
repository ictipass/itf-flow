# S22 - Authenticated external stakeholder portal

## Practical implication

Verified organizations now have a durable workspace for sending correspondence, retaining its ITF reference,
tracking a deliberately coarse status, and answering clarification requests without exposing the internal workflow.
Staff can request and close clarification from the correspondence action desk, including while acting under an
authorized delegation.

## Delivered

- Separate external accounts, email verification, organization membership and an eight-hour portal session.
- Password hashing, generic authentication responses, hashed verification tokens, database-backed throttles and
  security events that do not store plain email addresses.
- Organization-scoped dashboard and detail view. Portal submissions are forced to `PUBLIC`; internal classifications,
  recipients, minutes, decisions, attachments, storage locations and audit history are never selected.
- Secure clarification request, response and closure with work-authority checks, audit events and durable emails.
- The public one-time submission route remains separate; anonymous records never appear in the portal.

## Demonstration

1. Register an organization account in **Stakeholder portal** and process the queued verification email.
2. Verify, sign in, submit Public correspondence and copy the generated reference.
3. As Secretariat, claim and register it, then route it to an action officer.
4. As that officer, request clarification and process the email outbox.
5. Answer in the stakeholder portal, then close the response from the staff action desk.

## Boundaries and production dependencies

- Attachments remain unavailable until S24 supplies private EDMS/object storage, magic-byte validation, malware
  scanning, quarantine and controlled release.
- S23 remains responsible for OIDC, MFA, central logout/revocation and cross-application identity contracts.
- The email worker and correct public `NEXT_PUBLIC_APP_URL` must operate for verification and alerts.
- Member invitation, password reset, support recovery and identity proofing need approved operating policy.

Validation: migration deploy/status, Prisma validation/client generation, TypeScript, ESLint and production build.
