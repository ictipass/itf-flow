# S29A — Ultimate recipient and official record-file ownership

Status: **Implemented; migration and deployment pending**

Implementation commit: `d2189ab`

## Outcome

Every newly originated correspondence now distinguishes the stable intended endpoint from the changing action holder.
For an A → B → C → Z passage, B and C are accountable intermediate action recipients while Z remains the ultimate
recipient. The ultimate recipient is shown on the record and is used as the **TO** addressee on an internal memo
packet/output.

Origination also assigns a logical official record file. The file records category, file-plan code, retention class,
personnel subject where applicable, and owning organizational unit. Creator, ultimate recipient, record subject and
record custodian are deliberately separate concepts.

## Filing categories and examples

| Category | Official owner | Example |
|---|---|---|
| `PERSONNEL` | Selected staff subject | Director 04411 issues a query to staff 07712: creator 04411, ultimate recipient and personnel subject 07712 |
| `OFFICE` | Department/division/unit | An ICT officer raises an operational infrastructure memo owned by ICT |
| `CORPORATE` | ITF corporate file plan | Organization-wide policy or governance record |
| `EXTERNAL_CASE` | External case/organization file | Continuing case with an external stakeholder |

Personnel filing requires an active staff subject. Office filing requires an owning organizational unit. File-plan and
retention codes are mandatory; production values must come from an approved ITF file plan and retention schedule.

## Blob layout

Object storage remains a private technical store, not the authorization system. New objects are keyed as:

```text
quarantine/file-{immutableRecordFileId}/{correspondenceId}/{uuid}-{safeName}
released/file-{immutableRecordFileId}/{correspondenceId}/{uuid}-{safeName}
```

Unfiled external intake uses `unfiled` until registration assigns its logical record file. Existing keys are not moved
automatically. The database remains authoritative, so later filing correction does not require an unsafe Blob rename
or expose staff numbers in object paths. All reads still pass through ITF Flow authorization, malware state and hash
verification.

## Data and deployment

Migration `20260929120000_add_records_governance` adds ultimate-recipient fields, `RecordFile`, filing relations,
registry appointments and the Secret Registry MFA policy. Apply it before deploying this implementation.

## Acceptance

1. Raise A → B → C → Z correspondence, select Z as ultimate recipient, and confirm Z remains displayed after B/C routing.
2. Raise a personnel query created by one officer for another; confirm creator and personnel subject remain distinct.
3. Upload a document and confirm its new Blob key uses the immutable record-file ID, never a staff number.
4. Generate/annotate a memo and confirm derived PDF versions remain within the same logical file segment.
5. Confirm a Blob key alone grants no access and unauthorized application requests remain denied.
