# Email and document integration

## Mailbox configuration

ITF Flow uses IMAP/TLS on port 993 for incoming mail and SMTP/TLS on port 465 for connectivity and
future replies. Credentials are runtime secrets and must never be stored in Git, displayed in the
administrator UI, or written to audit logs.

The current demonstration provides a manual mailbox sync from the shared Secretariat intake page.
Each message is deduplicated by mailbox UID/UIDVALIDITY and, when present, `Message-ID`. Imported
messages remain `SUBMITTED` until a secretary claims, reviews, and registers them.

Email is untrusted input:

- Only the plain-text body is displayed.
- Remote images and HTML are not rendered.
- Unsupported and oversized attachments are rejected.
- Persisted attachments enter the S24A quarantine pipeline and remain unavailable until processing releases them.

## Production malware gate

Production ingestion and downloads require a scanning pipeline:

```text
Receive → quarantine → validate magic bytes → malware scan → release or reject
```

The protected document worker performs hash and magic-byte checks and calls the centralized ITF ClamAV FastAPI
gateway through authenticated server-side HTTPS multipart requests. It validates the contract-v1 response before
releasing a document. HTTP 429/503/504, timeouts and network interruptions remain quarantined and receive bounded
retries; authentication, oversized and malformed-response failures stop for administrator review. Confirmed infected
files are rejected and never retried automatically.

Production configuration uses `DOCUMENT_SCANNER_PROVIDER=CLAMAV_HTTP`, `CLAMAV_HTTP_URL`,
`CLAMAV_HTTP_TOKEN` and `CLAMAV_HTTP_TIMEOUT_MS`. `CLAMAV` remains a compatibility alias. The 20 MiB gateway limit
is enforced when scanning is enabled even if `DOCUMENT_MAX_SIZE_MB` is higher. A local mock is available only outside
production.

The product-owner-approved administrative exception remains `MALWARE_SCANNER=DISABLED`. Under that explicit
deployment setting, signature-valid uploads are accepted as `Available · Bypassed`; they are never represented as
`Clean`. Re-enable scanning by restoring `MALWARE_SCANNER=ENABLED`, verifying all ClamAV variables and redeploying.
Existing Bypassed files are not retroactively relabelled as Clean.

## Electronic document management server

The current local provider is isolated in `lib/document-storage.ts`. A future EDMS provider should
implement equivalent store/read operations and return:

- provider name;
- external document identifier;
- immutable content hash;
- version or rendition identifier;
- retention and classification metadata.

Before connecting the EDMS, confirm its API/protocol, authentication method, document identifiers,
versioning, check-in/check-out semantics, retention rules, maximum sizes, encryption, availability,
backup, and audit-export capabilities. Database records remain the workflow source of truth while
the EDMS becomes the authoritative document-content store.
