# S31A — PDF-first in-document annotation and authenticated signing

Status: **Implemented; migration and deployment pending**

Implementation commit: `5a03f02`

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
- Strong authentication is required by default. An administrator can independently relax it for DG, Director and
  Division Head authority, with optimistic concurrency, a mandatory reason and a `ConfigurationChange` audit row.
  Relaxed annotations record `ADMIN_POLICY_RELAXED` and the configuration version in their signed payload/event.
  Other roles continue to require recent Workspace MFA or the local/demo password fallback.
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
document event. The corrective migration `20260927180000_add_annotation_auth_policy` adds safe-default leadership
authentication toggles. Deploy both with the normal `npm run db:migrate` procedure before releasing the application build.

No new environment variable is required. `pdf-lib` is an application dependency and does not require a SaaS
subscription. Generated PDFs use the configured document-storage provider and inherit the source's Clean or
Bypassed security provenance.

## User-visible changes

- **Minute and sign on document** appears for an eligible current action holder.
- A responsive PDF.js canvas and annotation form collect page, stylus/touch/mouse ink, optional typed text, corner and signing confirmation.
- **Document annotation history** exposes the preserved source and generated signed PDF with audit details.
- Document Administration reports the total authenticated annotation count and explains provenance.
- Document Administration exposes the three role-specific authentication toggles and their change history.

## Verification

- 59 assurance tests pass, including PDF immutability, stylus-ink embedding, generated-PDF parsing, page bounds, signed-record tampering and
  the supported-format boundary.
- `npm run verify` passes Prisma validation, generated route/type checking, ESLint and the optimized 44-route build.

## Remaining boundary

S31A2 adds direct freehand visual ink and records its hash/input method, but that mark is not a public-key PDF
certificate. S30 still needs ITF's reusable visual-signature policy and profile controls. Certificate-backed PAdES
and trusted timestamps require an approved PKI/HSM/trust-service architecture. More precise movable/resizable markup
and multi-page ink sessions can be considered after this controlled baseline is accepted.

## Rollback

Rollback the application commit. The additive table and enum values may remain harmlessly in the database; do not
drop annotation records or generated documents after users have relied on them without an approved records migration.
