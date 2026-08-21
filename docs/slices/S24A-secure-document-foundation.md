# S24A - Secure document-processing foundation

## Practical implication

Uploaded files are no longer treated as usable documents merely because their extension and declared MIME type are
allowed. Every new file is stored in quarantine and remains unavailable until a protected worker verifies its hash,
recognizes its file signature and receives a clean malware result. Unsafe or unavailable documents cannot be
downloaded, formally approved or dispatched.

## Delivered

- Provider-neutral storage interface with separate local quarantine and released namespaces.
- Quarantine-first ingestion for anonymous intake, staff correspondence, drafts, revisions and mailbox imports.
- Magic-byte detection for PDF, JPEG, PNG, DOCX and XLSX, including basic OOXML container identification.
- Malware-scanner and OCR provider interfaces. A development-only mock scanner recognizes the EICAR marker; mock
  scanning is forbidden in production. With scanning disabled, fail-closed processing leaves files unavailable.
- Protected asynchronous document worker with atomic claims, bounded batches, retry backoff and attempt limits.
- Processing, scan and OCR states; EDMS repository/document/version/rendition placeholders; extracted-text field.
- Immutable document-processing event history and authorized-download events.
- Clean-and-available gates on download, positive formal approval and outgoing dispatch.
- Classification-aware correspondence search includes extracted text only after document release.
- Administrator quarantine/reconciliation page with explicit retry control.
- Existing attachments migrate to `LEGACY_UNVERIFIED` and must be reprocessed before download.
- Anonymous submission is now Public-only; classified material requires an authenticated approved channel.

## Worker operation

Invoke `POST /api/workers/documents` with `Authorization: Bearer <DOCUMENT_WORKER_SECRET>`. Configure a scheduler or
dedicated worker; ordinary application requests do not continuously poll the database.

For local functional demonstration only, set `DOCUMENT_SCANNER_PROVIDER=MOCK`. Never use that value in production.
The default `DISABLED` setting intentionally causes processing to fail and retry without releasing content.

## S24B boundary

S24A does not claim a real malware engine, OCR engine or EDMS connection. S24B still requires the EDMS API,
authentication, identifiers, webhook signatures, classification/file-plan mapping, renditions, retention/legal-hold
rules and test credentials. A production scanner and OCR provider must also implement the interfaces and pass
integration/security testing before document handling is production-ready.

Validation: migration deploy/status, magic-byte checks, Prisma generation, TypeScript, ESLint and production build.
