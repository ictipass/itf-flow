# ITF Flow memo lifecycle, movement and retrieval guide

This is the canonical operating guide for an internal memo from composition through retrieval. Update it whenever a field, routing rule, records policy or archive integration changes.

## 1. Compose and preview

Open **Raise correspondence** and select **Internal memo**.

| Field | Meaning and use |
|---|---|
| Workflow category | The active business policy, allowed routing purposes and priority-based SLA. It is not the document type. |
| Sender | The originating officer shown on the record. |
| Subject | Short searchable description and memo heading. |
| Sender reference | Existing departmental reference, when one exists. Flow also assigns its own immutable reference. |
| Due date | Explicit required-response date; the workflow policy may also calculate one. |
| Classification | Public, Internal, Confidential or Secret. Classification controls distribution and retrieval; do not use it merely as a priority marker. |
| Priority | Routine, Urgent or Immediate. It influences the workflow deadline. |
| Ultimate recipient | The staff member for whom the matter is finally intended. This remains stable while custody moves through intermediate desks. |
| Official record category | Office, Personnel, Corporate or External Case. This identifies the logical official file, not who may read the Blob path. |
| File-plan code | An approved functional records classification code. It must come from ITF's file plan. |
| Retention class | The approved retention/disposal rule tied to the file-plan entry. It is not a user-created label. |
| Owning office/unit | The organizational custodian of a non-personnel official file. For Personnel, select the staff member who owns the personnel file instead. |
| Summary | Searchable explanation of the request, decision required and essential context. |
| Compose memo | Rich-text memo body. Supported formatting is carried into the ITF PDF template. |
| Action recipient | The next accountable desk, which must acknowledge and treat the item. For A → B → C → Z, A sends to B only. |
| Copy recipient | A person informed for visibility; a copy does not own treatment. Confidential and Secret routes cannot include copies. |
| Routing purpose | **Action** means ordinary treatment; **Review** asks for a recommendation; **Concurrence** asks for formal agreement or objection; **Approval** asks for a formal approval decision. |
| Routing minute | The required action, reason, expected result and deadline. Review, concurrence, approval and peer referrals require at least 10 clear characters. |
| Supporting document | Evidence accompanying the memo. Security-cleared PDF/images can be included in the memo packet; governed Office conversion is used when configured. |

Select **Preview memo PDF** before submission. The preview uses the current ITF template, recipient, formatting and active originator signature, is marked `DRAFT PREVIEW`, is not stored as an official output and does not consume an ITF reference. Uploaded attachments are excluded from this pre-submission preview because they have not yet passed the document-security gate.

## 2. Peer-to-peer routing

Peer correspondence is already supported when the synchronized reporting structure and active workflow policy permit it:

- a Director may refer to another active Director;
- a Division Head may refer to another active Division Head in the same department;
- the selected workflow version must have peer referral enabled; and
- the sender must enter a referral purpose of at least 10 characters.

Therefore ICTD Director → AHRD Director is a Director peer referral. PASS Division Head → Hardware Division Head is permitted only when both synchronized users belong to the same department. If a peer is absent from search, check active Flow access, role, authoritative department identifiers, directory synchronization and the workflow policy.

## 3. Submit and receive

Submission creates the Flow reference, immutable first revision, action/copy work items, notifications and initial passage event. A Public/Internal executive route may automatically copy the **recipient department secretary**. Confidential/Secret routing suppresses explicit and automatic copies.

### Personal and Acting Office inboxes

- **Personal inbox** contains work assigned to the signed-in officer personally. The desk owner is the user.
- **Acting office inbox** contains work assigned to a substantive officer for whom the user has a current delegation or acting appointment. The substantive desk remains the owner and every action records both identities.
- A sender never addresses an “acting inbox.” The sender selects the substantive officer. An active, date-bounded appointment makes that work visible to the acting officer automatically. Approval appears only when the appointment explicitly delegates approval.

The Responsibility column displays two distinct facts: **Action recipient/Copy recipient** is the assignment kind; **Purpose: Action/Review/Concurrence/Approval** is what the assignee is expected to do.

## 4. Acknowledge, treat and move

An Action recipient must select **Acknowledge receipt** in the Correspondence header before opening, annotating, routing, resolving or returning the document. Acknowledgement establishes custody. Copy recipients do not become action owners.

After acknowledgement, the action owner may:

1. read the ITF memo packet and authorized attachments;
2. minute or sign on an annotatable PDF/image using typed text, stylus, touch or mouse;
3. record a requested review, concurrence or approval;
4. route to the next authorized supervisor, direct report or peer with a minute;
5. return it to the initiator with correction instructions; or
6. record the outcome and mark it resolved.

When corrected, the initiator creates a new numbered revision and resubmits. Earlier revisions, decisions, annotations and movements remain evidence. An outgoing letter additionally proceeds through controlled dispatch until delivery closes it.

## 5. Ultimate destination and records metadata governance

For an internal memo, the ultimate recipient is correctly selected from the synchronized staff directory. For an incoming letter, the current free-text ultimate destination is only a transitional control. The production design should select an authoritative Workspace organizational unit by immutable ID, while retaining its display-name snapshot. External outgoing recipients remain free text because they are outside the Workspace directory.

File-plan code, retention class and owning office must not remain arbitrary production inputs. ITF Records Management must approve a versioned file-plan/retention catalogue. The intended next records-governance slice will:

1. let Records Administration maintain active file-plan entries and their descriptions;
2. derive retention class from the selected entry instead of asking the originator to type it;
3. select owning units from synchronized Workspace organization IDs;
4. validate category/subject/owner compatibility server-side; and
5. correct a wrong filing through a reasoned, audited re-file operation without rewriting historical events or moving access control into Blob folders.

Until that catalogue is approved and implemented, originators must use approved values supplied by Records Management. A wrong value must be escalated to Records Administration; it must not be silently overwritten.

## 6. Records and registry responsibilities

These are complementary capabilities, not three names for the same access:

| Capability | Operational responsibility | Public/Internal retrieval | Confidential/Secret retrieval |
|---|---|---:|---:|
| `RECORDS_ADMIN` role | Registers intake, physical-file metadata and movements, dispatch, operational records quality and future file-plan administration. | Operational access under current policy. | No blanket right merely because the user administers records. |
| Open Registry appointment | Searches and retrieves official Public/Internal records for an approved period and reason. | Yes | No |
| Secret Registry appointment | Searches and retrieves every classification under the active need-to-know and step-up policy. | Yes | Yes, with MFA when the administrator-enforced policy requires it |

Open/Secret Registry are time-bounded appointments, not permanent application roles. The system administrator appoints/revokes them with reasons and may enforce or relax Secret Registry MFA. Blob credentials are never issued to registry staff.

At present, registry search covers live and resolved Flow records; “archived” is logical retention in the configured private store, not yet an EDMS transfer/disposal state. The permanent EDMS integration must add archive transfer acknowledgement, retention clock, legal hold, disposal review and restore evidence. Those lifecycle states must preserve the same Flow reference and hashes.

## 7. Auditor and archive retrieval

1. An authorized Open or Secret Registry appointee opens **Official records**.
2. Search by Flow reference, sender reference, subject, ultimate recipient, personnel subject, staff number, owning unit or file-plan code.
3. Open the record and verify classification, official file, current status, revision and movement history.
4. Select **Download evidence package**.
5. The S29 ZIP contains the memo/documents, revisions, movements and minutes, decisions/approvals, annotations, document events, hashes and a machine-readable manifest.
6. Verify the manifest hashes before relying on an exported copy. Sensitive retrieval/download events remain auditable.
7. When EDMS integration is enabled, transfer this governed package plus its metadata and retain the EDMS acknowledgement against the Flow record.

The evidence package—not a screenshot or an unaudited Blob URL—is the response when an auditor asks for the memo and the path governing the process.

## 8. Administration checklist

- synchronize users, roles, supervisors and immutable organization identifiers from Workspace;
- configure Department Secretaries, workflow policies and authorized peer referral;
- create and review acting/delegation appointments with exact dates and approval authority;
- appoint Open/Secret Registry staff and configure Secret Registry MFA;
- operate document-security, notification, email and reminder workers;
- review access, configuration changes, evidence exports and failures;
- deploy schema migrations and test backup/document-store restoration; and
- update this guide whenever a field, permission, workflow or archive contract changes.
