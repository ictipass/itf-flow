# S29 — Unified auditor correspondence evidence package

Status: **Implemented; deployment acceptance pending**

Implementation commit: `d2189ab`

## Output

An authorized participant, executive or appointed registry officer can download one ZIP from the correspondence page
or Official Records registry. It contains:

- `manifest.json` with correspondence, ultimate recipient, official filing identity and every included file hash;
- `manifest-signature.json` with the HMAC-signed canonical manifest and key identifier;
- all available current documents and preserved annotation sources under `documents/`;
- correspondence content, movement/work-item path, minutes/events and revisions;
- decisions and approval assertions, annotations, memo outputs and document events;
- dispatch/delivery records and sensitive-access history; and
- a verification/handling README.

The generator rechecks each stored object's SHA-256 digest before including it. A mismatch aborts the entire export.
The maximum uncompressed document payload defaults to 100 MB and is configurable with
`EVIDENCE_PACKAGE_MAX_MB`. Confidential/Secret exports are recorded as sensitive exports, and each included document
records its package identifier in the document audit stream.

The package uses ZIP for portability and `jszip` for in-process creation. It is an archival transfer/evidence format,
not a substitute for EDMS retention, legal hold, disposal, backup or independent certificate signatures.

## Acceptance

1. Export one completed record containing a memo packet, attachment, movement, approval and annotation.
2. Confirm every file listed in the manifest exists and matches its SHA-256 value.
3. Confirm movement, revisions, minutes, approval/annotation assertions and dispatch evidence are present.
4. Tamper with a stored test object and confirm package generation fails closed with HTTP 409.
5. Confirm Open Registry cannot export Confidential/Secret and Secret Registry obeys the active MFA policy.
6. Import the package into the target archival trial and record reconciliation evidence before EDMS integration.
