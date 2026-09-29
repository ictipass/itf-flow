# S29B — Open and Secret Registry access

Status: **Implemented; migration and deployment pending**

Implementation commit: `d2189ab`

## Authorization model

System administrators create time-bound, auditable registry appointments. An appointment is a capability separate
from a person's ordinary workflow role:

- **Open Registry** retrieves only Public and Internal records.
- **Secret Registry** retrieves Public, Internal, Confidential and Secret records.
- A legacy `RECORDS_ADMIN` without an appointment is treated as Open Registry for continuity and therefore no longer
  receives broad Confidential access merely because of that role.

Registry users work through **Official records**. Search covers reference, subject, ultimate recipient, staff number,
logical file label and file-plan code. Files are streamed through protected application routes; registry users never
receive Vercel Blob credentials or public URLs.

## Secret Registry MFA policy

`ApplicationConfiguration.secretRegistryMfaRequired` defaults to `true`. Under **Records governance**, a system
administrator may relax or re-enable the requirement only with a reason. Optimistic configuration versioning prevents
one administrator from silently overwriting another.

When enabled, Secret Registry listing and Confidential/Secret retrieval require recent Workspace enterprise MFA.
When relaxed, the active Secret Registry appointment still governs access and all sensitive views, downloads and
exports remain logged. The switch does not weaken ordinary participant/need-to-know policy outside registry access.

## Audit and lifecycle controls

- Appointments record appointee, scope, reason, creator, start, optional expiry and revocation.
- Revocation requires a reason and takes effect immediately.
- Policy and appointment changes write `ConfigurationChange` audit records.
- Confidential/Secret views, downloads and evidence exports write `SensitiveAccessEvent` entries.
- Appointment expiry is evaluated at request time; no background worker is required.

## Acceptance

1. Appoint an Open Registry user and confirm Public/Internal visibility and Confidential/Secret denial.
2. Appoint a Secret Registry user and confirm MFA is requested before sensitive listing/retrieval by default.
3. Relax MFA with a reason and confirm the same active appointee can retrieve while access auditing persists.
4. Re-enable MFA and confirm stale/unverified sessions are redirected to step-up.
5. Revoke/expire both appointment types and confirm **Official records** disappears and direct routes deny access.
