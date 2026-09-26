# S28 — Private Vercel Blob document storage

Status: **Implemented locally; live Vercel acceptance pending**

## Practical outcome

Vercel deployments can store correspondence attachments in a connected private Vercel Blob store instead of
attempting to write into the read-only application bundle. The S24A quarantine/release boundary remains intact:
new content is written under `quarantine/`, authorized server-side reads use the private-store token, and clean
content is copied to a separate `released/` path by the document worker.

## Delivered scope

- Official `@vercel/blob` 2.3 server SDK.
- Explicit `LOCAL` and `VERCEL_BLOB` document-provider selection.
- Private uploads with deterministic application-generated keys and collision protection.
- Authenticated, uncached server reads used by processing and protected attachment delivery.
- Idempotent quarantine-to-release copies.
- Correct `VERCEL_BLOB` provider metadata on attachment records.
- Environment and production-readiness validation for `BLOB_READ_WRITE_TOKEN`.
- Regression coverage for provider selection, unsupported providers, and missing production credentials.

No database migration is required because `Attachment.storageProvider` is already a string field.

## Deployment

1. Create a **private** Blob store and connect it to the same Vercel project as ITF Flow.
2. Confirm Vercel added `BLOB_READ_WRITE_TOKEN` to every intended deployment environment.
3. Set `DOCUMENT_STORAGE_PROVIDER=VERCEL_BLOB` for those environments.
4. Redeploy the application; environment-variable changes do not alter an already-built deployment.
5. Submit a non-sensitive test document and confirm a `quarantine/` object and `VERCEL_BLOB` attachment record exist.

`BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` are not storage credentials and are not consumed by this adapter.

## Security and operational boundaries

- The Blob store must be private. Document bytes are delivered only through the existing authenticated attachment
  route and remain subject to classification, step-up, need-to-know and clean-scan checks.
- Storage success does not make a document downloadable. A real production malware scanner and scheduled document
  worker remain mandatory; otherwise the document remains quarantined.
- No real Blob object is created by the automated test suite. Staging must complete upload/read/release acceptance.
- Submission idempotency and compensating cleanup after a partial database/storage failure remain a separate
  reliability hardening item.
