# S29C — Governed records catalogue and legacy EDMS crosswalk

## Outcome

Originators no longer invent a file-plan code, retention class or records-owning office. Records Administration configures approved, versioned record series and retention policies. Staff select a friendly record-series title; ITF Flow derives and snapshots the controlled metadata on the official file.

This slice also represents the existing scanned-paper arrangement: a staff member may have one or more physical/legacy EDMS boxes or volumes. Flow records their locators and verified checksum where available. It does not move, rename, expose or duplicate those legacy objects.

## Practical filing model

| Concept | Controlled by | Practical meaning |
|---|---|---|
| Official record category | Record series; selected by originator through a compatible series | Broad ownership pattern: Office, Personnel, Corporate or External Case. |
| Record series / file-plan code | Records Administration | Approved functional subject, such as staff disciplinary queries or ICT maintenance. |
| Retention policy | Records Administration | Trigger, duration, disposition and legal/policy authority. It is derived from the series. |
| Records-owning office/unit | Record-series default or synchronized Workspace selection | Custodian responsible for maintaining the official file; not necessarily the sender or recipient. |
| Personnel-file subject | Originator, when the series category is Personnel | Staff member whose official personnel file owns the matter. The creator may be somebody else. |
| Legacy personnel box | Records Administration | Existing EDMS/physical-box locator for the staff subject, including unit, category, box, volume and reference. |

Example: Director `04411` issues a query to staff `07712`. The Director is the originator, `07712` is the personnel-file subject, the selected disciplinary-query series supplies the file-plan/retention rule, and the linked legacy box identifies where earlier scanned paper records for `07712` remain.

## Administration workflow

1. Synchronize authoritative Workspace users and organization identifiers.
2. Open **Records catalogue** (`/records/catalogue`) as `RECORDS_ADMIN` or `SYSTEM_ADMIN`.
3. Create an approved retention policy with its schedule authority, trigger, duration and disposition.
4. Create a record series, choose its category and retention policy, and assign its default Workspace-backed records owner.
5. Add the legacy EDMS unit/category crosswalk where one exists.
6. For personnel files, inventory each staff box or volume and register its locator. Several mappings may belong to the same staff member.
7. Retire superseded entries rather than editing their history. Create the next version using the same code after retirement.

The migration supplies clearly labelled transitional general entries so deployed records remain usable. Records Management must replace or formally approve them before general production.

## Originator workflow

1. Choose the practical **Official record category** and read its on-screen guidance.
2. Select an active **Record series** filtered to that category. The UI explains its intended use.
3. Review the derived file-plan code, series version, retention rule and legacy crosswalk.
4. For Personnel, select the staff subject.
5. Confirm the records-owning office. A default fixed by the series cannot be overridden by the originator.
6. Submit. Server-side validation re-resolves the active catalogue entry and synchronized office; client-supplied file-plan or retention text is never trusted.

## Versioning and correction

- A catalogue-backed logical file key includes the record-series version. A later version therefore cannot rewrite the filing snapshot seen by older correspondence.
- Retired series and policies cannot be used for new submission; existing records retain their stored version.
- From an authorized correspondence detail page, Records/System Administration can open **Correct official filing**, select the replacement series/owner/subject and provide a reason.
- Re-filing changes the correspondence-to-file link. It records a `REFILED` movement event plus a configuration audit entry containing previous and new official-file IDs. It does not rewrite prior movement or move document objects.

## Evidence and retrieval

The correspondence detail and S29 evidence-package manifest include the record series and version, retention policy and version, owning organization, personnel subject, and active legacy-box locators/checksums. Actual legacy objects remain behind the EDMS authorization boundary; a locator in an evidence manifest is not a public download URL.

Open Registry still retrieves Public/Internal records only. Secret Registry retrieves every classification under its configured MFA rule. `RECORDS_ADMIN` catalogue authority alone does not grant blanket Secret-record access.

## Deployment and acceptance

1. Back up PostgreSQL and record the current migration state.
2. Deploy migration `20261103120000_add_records_catalogue`.
3. Confirm the transitional catalogue, then create/approve the real ITF file plan and schedules.
4. Reconcile Workspace organization IDs and legacy EDMS box inventory in staging.
5. Test Office, Personnel, Corporate and External Case origination; retirement; audited re-filing; Open/Secret retrieval; and evidence-package export.
6. Reconcile a representative staff box from Flow locator to the existing EDMS object without changing its key.
7. Retain Records, Legal, Security and deployment acceptance outside the repository.

## Remaining boundary

This is a governed crosswalk, not the permanent EDMS redesign. S33 must provide a versioned transfer/retrieval contract, archival acknowledgement, retention clock, legal hold, disposition approval, object reconciliation and restoration evidence.
