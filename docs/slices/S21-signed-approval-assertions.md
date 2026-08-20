# S21 — Signed approval assertions and stronger authentication

Status: Implemented in `6505d7c`.

## Practical outcome

A positive formal approval is no longer only a database status change. The approving officer must re-enter their
current password, and ITF Flow creates an immutable signed assertion bound to the exact document revision,
decision, signer and acting authority. The decision register verifies the assertion whenever it is displayed.

## Delivered controls

- Password re-confirmation for every `APPROVED` formal approval.
- SHA-256 digest of the latest immutable correspondence revision, including attachment hashes captured by it.
- Canonical signed payload containing decision, revision, signer, acting authority, authentication method and time.
- HMAC-SHA256 assertion using a dedicated, deployment-managed `APPROVAL_SIGNING_SECRET` and key identifier.
- One signature per decision request and conditional decision update to prevent concurrent duplicate approval.
- Signature verification and fingerprint display in the decision register.
- Acting-appointment signature attribution to both the signed-in officer and substantive authority.
- Dispatch blocked when a present current approval signature fails verification.
- Earlier unsigned approvals are visibly identified as legacy records; later revisions continue to supersede them.

## Key management

`APPROVAL_SIGNING_SECRET` must be at least 32 random characters, held in the deployment secret store, backed up
through an approved recovery channel and kept stable for the lifetime of signatures under key ID
`itf-flow-local-v1`. Changing it makes existing assertions unverifiable. Production key rotation requires a
versioned key ring rather than overwriting the old key.

## Explicit legal and technical boundary

This is an application-level electronic signature assertion using a symmetric server secret. It proves that ITF
Flow recorded the authenticated approval against the identified revision and detects later payload tampering. It
is not a certificate-backed signature, a qualified electronic signature, or independent non-repudiation because
the application controls the signing key. PKI, certificate identity, timestamp authority, signature placement and
approved signature images require ITF legal policy and enterprise trust-service decisions.
