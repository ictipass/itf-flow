# S31A — PDF-first in-document annotation and authenticated signing

Status: **Implemented locally; migration and deployment pending**

## Outcome

The current action holder or an authorized delegate can preview an available PDF or scanned JPEG/PNG inside Flow,
place a minute on a selected page and create a new PDF carrying an authenticated signer block. The uploaded source
is never rewritten: it becomes a preserved historical source and the generated PDF becomes the included document
version.

## Controls

- Server-side authorization uses the active Action work item, delegation and existing sensitive-record policy.
- Only documents already **Available · Clean** or **Available · Bypassed** can be annotated.
- Source bytes are re-hashed and compared with the immutable database hash before rendering.
- Every later document view/download rechecks the stored byte hash; generated annotated documents also fail closed
  if their canonical signing-record HMAC no longer verifies.
- Workspace users sign with recent enterprise MFA; local/demo users re-confirm their password.
- The database retains source/output attachment IDs and hashes, page, placement, minute, actor and substantive
  authority, delegation, authentication method, time, correspondence revision and an HMAC-protected canonical
  payload.
- Creating an annotation supersedes prior completed recommendations, concurrences or approvals because the document
  revision changed. It does not itself record formal approval.
- Historical sources are downloadable only when they are retained by a recorded annotation relationship; arbitrary
  excluded or rejected documents remain blocked.

## Formats

- PDF: annotated directly and emitted as a new PDF.
- JPEG/PNG: placed on a one-page PDF, then annotated.
- DOCX: upload remains supported, but annotation waits for an approved Office renderer/editor or conversion service.
- XLSX: attachment-only; spreadsheet editing is outside this document-markup workflow.

## Data and deployment

Migration `20260927160000_add_document_annotations` adds `DocumentAnnotation`, placement values and the `ANNOTATED`
document event. Deploy with the normal `npm run db:migrate` procedure before releasing the application build.

No new environment variable is required. `pdf-lib` is an application dependency and does not require a SaaS
subscription. Generated PDFs use the configured document-storage provider and inherit the source's Clean or
Bypassed security provenance.

## User-visible changes

- **Minute and sign on document** appears for an eligible current action holder.
- A responsive in-app preview and annotation form collect page, corner, minute and signing confirmation.
- **Document annotation history** exposes the preserved source and generated signed PDF with audit details.
- Document Administration reports the total authenticated annotation count and explains provenance.

## Verification

- 54 assurance tests pass, including PDF immutability, generated-PDF parsing, page bounds, signed-record tampering and
  the supported-format boundary.
- `npm run verify` passes Prisma validation, generated route/type checking, ESLint and the optimized 44-route build.

## Remaining boundary

This increment embeds authenticated name/role/time evidence, not an uploaded handwritten image or public-key PDF
certificate. S30 still needs ITF's visual-signature policy and profile controls. Certificate-backed PAdES and trusted
timestamps require an approved PKI/HSM/trust-service architecture. More precise drag-and-drop coordinates and mobile
freehand markup can be considered after this controlled baseline is accepted.

## Rollback

Rollback the application commit. The additive table and enum values may remain harmlessly in the database; do not
drop annotation records or generated documents after users have relied on them without an approved records migration.
