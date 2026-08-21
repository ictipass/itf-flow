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

The protected document worker now performs hash and magic-byte checks and calls a scanner interface. A development
mock is available only when explicitly enabled outside production. ClamAV or a managed scanner must implement the
production stage; when none is configured, processing fails closed and downloads remain blocked.

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
