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
- Persisted attachments remain `NOT_SCANNED` during the demonstration.

## Production malware gate

Production ingestion and downloads require a scanning pipeline:

```text
Receive → quarantine → validate magic bytes → malware scan → release or reject
```

ClamAV or a managed malware-scanning service may implement the scanning stage. Infected and
quarantined attachments are already blocked by the download endpoint, but no scanner is connected
yet. This is a release blocker, not an optional enhancement.

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
