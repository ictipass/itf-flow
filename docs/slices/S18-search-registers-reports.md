# S18 — Search, filters, registers and movement reports

Status: Implemented locally; pending feature commit.

## Practical outcome

Authorized users can locate correspondence using business terms rather than browsing the latest 100 records,
combine operational filters, and download a correspondence register or passage-level movement report for the
same result set. Server-side scope and classification policy applies equally to the UI and exports.

## Delivered scope

- Multi-field case-insensitive search across references, sender, subject, summary, composed body, minutes and
  Secretariat tracking code.
- Filters for classification, priority, status, active owner, office, department and received date range.
- Latest-200 on-screen register with a total result count.
- CSV correspondence register and event-level movement report, capped at 5,000 records.
- Shared query policy, private/no-store exports, authentication and CSV formula-injection protection.
- Comprehensive role-based user and stakeholder demonstration guide.

## Explicit boundary

This slice does not index attachment bytes. OCR and searchable extracted attachment text require the planned
EDMS/object-storage, malware-scanning and OCR platform slice.
