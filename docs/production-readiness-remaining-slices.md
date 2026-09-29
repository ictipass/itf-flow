# ITF Flow — remaining production-readiness slices

ITF Flow is beyond an MVP in functional breadth. “Production ready” nevertheless means the external services,
governance evidence, operational recovery and independent assurance are accepted—not merely that application features
exist.

## Mandatory before general production

| Slice | Remaining outcome | Exit evidence |
|---|---|---|
| S24B | Real malware scanner and OCR; fail-closed document worker | EICAR/clean/timeout tests, OCR accuracy sample, alerting and approved data residency |
| S28 production acceptance | Approved private object store, lifecycle/encryption/backup policy and Vercel Blob live test | Upload/quarantine/release/retrieve/restore evidence for every classification |
| S29/S29A/S29B acceptance | Approved file plan/retention codes, registry appointments, MFA decision and evidence-package archival trial | Records/Legal sign-off plus successful export, hash reconciliation and denied-access tests |
| S27B/A01 | Authoritative Workspace reporting lines, Department Secretary and registry/desk assignments with revocation | Production identity, role-change, termination, central logout and resynchronization evidence |
| S15/S16/S24 operations | Production schedules for mail, reminders and document workers | Monitored schedules, retry/dead-letter alerts and runbook ownership |
| S33 | EDMS archival transfer, retention, legal hold, disposal and reconciliation | Versioned integration contract, idempotent transfer, retrieval drill and disposition approval |
| S34 | Backup, document-store restoration and disaster recovery | Successful isolated restore with measured RPO/RTO and reconciled database/object hashes |
| S35 | Independent authorization, penetration, dependency, accessibility, load and resilience assurance | Closed findings and signed reports; current dependency audit has no unaccepted critical/high exposure |
| S36 | Controlled pilot, training, support and formal go-live | Role-based training, help desk/runbooks, pilot acceptance, rollback decision and management sign-off |

## Important product completion

| Slice | Outcome |
|---|---|
| S32 | Installable PWA baseline, offline-safe shell, update handling and privacy-preserving push subscriptions/notifications |
| Search/OCR hardening | Searchable scan text, indexing/reconciliation and scale test against realistic archive volume |
| Mailbox hardening | Production mailbox authorization, monitored synchronization, deduplication and credential rotation |
| Records migration | Governed metadata/backfill for legacy/unfiled correspondence and current EDMS identifiers |

## Conditional rather than automatic

S31B certificate-backed signing becomes mandatory only if ITF Legal/management decides that selected documents need
PAdES/certificate trust outside ITF Flow. Until the CA, timestamp, key-custody, revocation and archival-validation
policy is approved, the current visual and application signatures must continue to be described accurately and must
not be presented as qualified certificate signatures.

## Release rule

The application should move from staging to a controlled pilot only when migrations are applied, production
configuration reports no unsafe adapter, scheduled workers are observed, backup/document restoration is proven, and
all required S26 assurance items are current. A successful build or feature demonstration alone is not go-live
approval.
