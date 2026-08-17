# S17 - Secretariat Scanning, Duplicate Review and Physical-file Control

## Status

Implemented. Schema validation, migration deployment, TypeScript, ESLint and the production build pass.

## Practical outcome

The Secretariat can connect a physical letter or scan to its digital correspondence record, identify
where the paper file currently sits, print a scannable tracking label, detect likely duplicate intake,
and record every location or duplicate decision with an actor, reason and timestamp.

This reduces lost files, conflicting registrations and untraceable desk-to-desk movement. It does not
claim that document content has passed malware scanning; scanning-desk metadata and security scanning
remain separate controls.

## Delivered controls

- One Secretariat record per correspondence.
- Unique `ITF-FILE-<year>-<token>` tracking code.
- Scanning desk, scan timestamp, page count, physical file reference and handling notes.
- Current room, shelf, registry or desk location.
- QR label linking to the authenticated Flow correspondence page.
- Automatic potential-duplicate detection using an exact sender reference or matching sender and subject.
- Explicit possible, confirmed and cleared duplicate states.
- Confirmed duplicates are blocked from new DG registration.
- Audited metadata registration, duplicate decisions and physical-location reassignment.
- Shared intake visibility for tracking code, location and duplicate status.

## Authorization

Only roles already authorized for Secretariat registration—DG Secretary, Records Administrator and
System Administrator—may create or change these records or print labels. Existing correspondence read
authorization remains required after scanning a QR label.

## Boundaries

- The QR code identifies the Flow record; it does not expose document content or bypass authentication.
- Duplicate detection proposes a match but a human operator must confirm or clear it.
- Physical location values are controlled audit text pending an authoritative office/location directory.
- Barcode hardware integration and bulk label templates may be added after the target devices are known.
- Malware scanning, quarantine, OCR and EDMS storage remain S24 production gates.
