# ITF Flow comprehensive user and stakeholder demo guide

## Purpose

ITF Flow is the auditable correspondence workflow for receiving, originating, routing, deciding,
tracking and dispatching official ITF correspondence. This guide can be used for user training or as
the facilitator script for a stakeholder demonstration.

## Before a demonstration

1. Run the documented environment check, migrations and seed process.
2. Confirm the configured staff interface and sign in using only demonstration accounts.
3. Open one normal browser and one private window to show two roles without repeatedly signing out.
4. Prepare a harmless sample PDF or image; never use real correspondence in a demonstration database.
5. Explain that access is determined server-side by active user, role, reporting line, assignment and
   classification—not merely by which links are visible.

The seeded accounts and their purpose are listed below. They use `SEED_PASSWORD` (`Demo123!` by default) only in
an explicitly enabled disposable local/demo environment. Production staff are provisioned from Workspace without
a Flow password and launch with enterprise MFA evidence; local staff login is disabled by default in production.

| Category | Seeded account | Best demonstration |
|---|---|---|
| System administrator | `admin@itf.gov.ng` | Appearance, provisioning, email outbox and reminder automation |
| DG Secretary | `secretary.abuja@itf.gov.ng` | Shared intake, registration, physical file controls and dispatch |
| Director-General | `dg@itf.gov.ng` | Executive inbox, minute and formal decision |
| Director | `director.ict@itf.gov.ng` | Department leadership, approval and controlled peer referral |
| Department Secretary | `secretary.ict@itf.gov.ng` | Recipient-department tracking for Public/Internal executive routing |
| Division Head | `head.pass@itf.gov.ng` | Direct-report routing and same-department peer referral |
| Unit Head | `unit.apps@itf.gov.ng` | Receive from officer and escalate through the line |
| Officer | `officer.apps@itf.gov.ng` | Draft, originate, submit, acknowledge and resolve |

## Common concepts for every user

- **Action recipient:** accountable to acknowledge and treat the matter.
- **Copy recipient:** informed and able to read, but does not own the task.
- **Minute:** the instruction or rationale recorded with a movement.
- **Document type:** whether the record is an external Incoming Letter, internal memorandum or external Outgoing Letter.
- **Workflow category:** the governed policy and priority-based response target selected for new correspondence.
- **Concurrence:** a formal agreement, objection or return recorded before a matter proceeds; it is not final approval.

System administrators use **Workflow policies** to simulate a proposed category/purpose, create immutable Draft
versions, activate a validated version and change category SLA days with a recorded reason. Activation applies only
to new correspondence; existing records retain the version shown on their detail page.
- **Current owner:** staff with an open or acknowledged action work item.
- **Passage:** immutable sequence of submissions, acknowledgements, minutes, decisions and movements.
- **Classification:** Public, Internal, Confidential or Secret; Secret is limited to explicitly authorized roles.
- **Reference:** stable ITF Flow identifier used to locate the record.

Every signed-in user can use Overview, My inbox, Notifications, My drafts, All correspondence,
Announcements, Raise correspondence and How it works. Additional operational links depend on role.

## End-to-end correspondence workflow

1. **Compose:** the sender selects the document type and workflow category, writes the correspondence, chooses the
   next action recipient, adds copy recipients only for awareness, attaches supporting documents and submits.
2. **Secure attachments:** with `MALWARE_SCANNER=ENABLED`, every uploaded document enters quarantine. It cannot be
   viewed, downloaded, approved or dispatched until document processing validates its file signature, scans it for
   malware and marks it **Available · Clean**. With the temporary `DISABLED` bypass, signature-valid uploads are
   immediately released as **Available · Bypassed** and the missing malware scan remains visible in the audit trail.
3. **Receive:** the action recipient sees the matter in **My inbox** and acknowledges receipt. This establishes
   custody. Copy recipients can follow the record but do not own the action.
4. **Treat or decide:** the owner performs the work and, where requested, records a recommendation, review,
   concurrence, approval or clarification response.
5. **Minute/sign on the document (where required):** the current action holder opens an available PDF, JPEG or PNG,
   selects **Minute and sign on document**, chooses the page and writes with a stylus, touch or mouse and/or enters a
   typed minute before re-authenticating where policy requires it. Flow preserves the original and creates a new
   immutable PDF with the ink plus an authenticated identity and timestamp block. This is not the same as formal
   approval or a certificate-backed signature.
6. **Minute and route:** if another desk must act, the current owner selects the next authorized recipient and enters
   a clear routing minute. When that owner has already annotated the current included document version, the routing
   field may be left blank and Flow uses the saved annotation as the movement minute. A sequential A → B → C route
   is performed one movement at a time; selecting B and C together assigns them in parallel.
7. **Correct:** when returned, the originator creates a numbered revision with a change note and resubmits. Earlier
   versions, minutes and superseded decisions remain auditable.
8. **Resolve:** the final action owner records what was done and selects **Mark resolved**. Incoming letters and
   internal memos normally finish in `RESOLVED` status.
9. **Dispatch and close:** an approved outgoing letter proceeds to the Dispatch registry. Secretariat or Records
   records its channel and delivery outcome; confirmed delivery changes the correspondence to `CLOSED`.
10. **Retain evidence:** the movement register, detailed passage, revisions, decisions, attachment events and any
   physical-file history remain available subject to role and classification controls.

The compact **Movement & minutes** timeline is always visible on the detail page. **Passage and status** is the
expanded custody/elapsed-time view and is collapsed by default; select its heading to open or close it.

### Document status shown beside attachments

- **Quarantined · Pending:** the upload is stored in the configured private document store, but malware validation
  has not completed. Viewing and download are intentionally blocked.
- **Processing:** the protected document worker is validating the file.
- **Available · Clean:** validation passed; an authorized user can view or download the attachment.
- **Available · Bypassed:** file-signature validation passed and the upload is usable, but malware scanning was
  explicitly disabled. This is recorded as a security exception and must not be represented as a clean scan.
- **Failed:** processing did not complete; a system administrator must inspect and retry it.
- **Rejected/Infected:** the security gate excluded the document from the controlled package.

### In-document minute and signing

1. Open a correspondence while you hold its current Action work item, then find an **Available** attachment.
2. Select **Minute and sign on document**. PDF is the primary format; JPEG and PNG scans are converted to PDF before
   the minute is applied.
3. Inspect the in-app page renderer and use **Previous page** or **Next page** to select the target page. Write
   directly on it with a stylus, touch or mouse, enter searchable typed text, or use both. Choose the corner for the
   authenticated identity block. At least ink or typed text is required.
4. Confirm signing intent. By default, a Workspace user uses recent enterprise MFA and a local/demo user re-confirms
   the password. A system administrator may relax this extra annotation-authentication step independently for DG,
   Directors or Division Heads. A relaxed action remains session-authenticated and is recorded as an administrator
   policy exception; document authority, classification and integrity checks still apply.
5. Select **Create signed PDF version**. Flow verifies the stored source hash, validates and hashes any ink drawing,
   preserves the source, creates a new current PDF, captures a correspondence revision and records the input method,
   signer/delegation, authentication, hashes and time.
6. Use **Document annotation history** to retrieve both the preserved original and each generated signed PDF.
7. When routing immediately after your annotation, leave **Minute / instruction** blank if the annotation itself is
   the instruction. Flow reuses only your annotation attached to the current included document version; otherwise a
   routing minute remains mandatory.

Supported upload formats remain PDF, DOCX, XLSX, JPEG and PNG. This annotation increment supports **PDF, JPEG and
PNG only**. DOCX requires a separately approved Office renderer/editor or controlled conversion service; XLSX stays
attachment-only because spreadsheet editing and formula integrity require a different workflow. Stylus ink is a
visual mark tied to Flow's authenticated audit evidence; it is not a certificate-backed PAdES signature. A reusable
signature asset/profile and certificate-backed signing remain separate policy-led work.

### Records desk and physical tracking

The optional **Records desk** panel is for a hard-copy source or physical file. Secretariat/Records staff use it to
capture scan desk, scan time, page count, physical-file reference and current location, generate a tracking code and
QR label, review possible duplicates, and record every physical movement. Digitally originated correspondence does
not require a physical tracking record. This panel does not assign the digital action owner or advance the workflow.

## Officer and general originator

1. Select **Raise correspondence** and choose the correspondence type. Incoming Letters are registered by authorized
   Secretariat/Records staff; ordinary originators use Internal Memo or Outgoing Letter.
2. Select a compatible Workflow Category or keep **Automatic default**. The category controls business policy and SLA;
   it does not change what kind of document is being raised.
3. Enter subject, summary, body, classification, priority, reference and due date as applicable.
4. Search for the next authorized action recipient. Add copy recipients only for visibility.
5. For a sequential A → B → C → Z route, A selects only B. B later routes to C, and C routes to Z. Selecting all
   three at once creates parallel responsibilities. A merely informed D belongs in Copy.
6. Enter a specific routing minute and attach permitted PDF, DOCX, XLSX, JPEG or PNG material if needed.
7. Save as a private draft or raise and route. Retain the generated ITF Flow reference.
8. Use **My inbox** to acknowledge assigned matters, then minute onward or resolve them.
9. If correspondence is returned, create a corrected revision with a meaningful change note and resubmit.

Expected control: an officer cannot select an arbitrary senior or cross-department action recipient when
that route is absent from the synchronized reporting line. Copy search is organization-wide; if it fails rather than
returning a legitimate empty result, the form displays a synchronization/support message.

## Unit Head, Division Head and Director

1. Open **My inbox** and prioritize Immediate, Urgent, overdue and formal-decision items.
2. Read the document, attachments, prior minutes, decisions and current passage before acting.
3. Acknowledge receipt to establish custody.
4. For Review, Concurrence or Approval, choose a permitted outcome and enter a decision note.
5. Minute the item to an authorized direct report or supervisor, or resolve it when treatment is complete.
6. Directors may refer to Directors; Division Heads may refer to peers in the same department. These are
   controlled routes, not unrestricted directory access.
7. When a Director routes Public/Internal correspondence, the system copies the Secretary assigned to each
   recipient department. Confidential/Secret routing never creates that copy.

Expected control: prior decisions remain in the decision register when a later correction supersedes them.

If routing validation fails, the page retains the entered minute and selections and shows an error toast instead of
opening a server error page. Missing classification reasons and Department Secretary assignments are explained in
the toast. Confidential/Secret selection also disables and removes copy-recipient fields before submission; the
server independently rejects a crafted request that still supplies copies.

### Formally approving a document

1. Confirm the document version, attachments, passage and decision request before selecting **Approve**.
2. Enter a decision note. A local demo user re-confirms the current password; a production Workspace user relies on recent enterprise MFA evidence. Failed strong authentication leaves the request pending.
3. ITF Flow signs the exact latest immutable revision and shows its revision number and digest in the register.
4. Confirm that the decision register displays **Signature assertion verified** before relying on the approval.
5. A corrected later revision supersedes the approval; it must be approved independently where policy requires.

The assertion is an application electronic signature, not a certificate-backed qualified signature. Acting
officers can approve only when their appointment explicitly grants approval authority, and the assertion records
both the officer and substantive authority.

## Director-General

1. Use the dashboard and inbox to review Secretariat-registered and escalated correspondence.
2. Open the passage to see custody, elapsed time and every previous instruction.
3. Record a decision where formally requested, or minute the matter to the appropriate Director.
4. Keep Public/Internal distribution to copy the recipient department's Secretary automatically, or mark it
   Confidential with a reason. A Confidential/Secret DG route can target Directors only and creates no copy.
5. Review notifications and the role-scoped daily digest generated by reminder automation.

Expected control: DG access includes Secret correspondence, but every action remains attributed and timed.

## DG Secretariat and Records Administration

1. Open **Shared Secretariat intake** and claim an item. Claiming is atomic across all secretaries.
2. Verify the sender and document, return unsuitable staff submissions for correction where needed, or
   register a valid external submission for DG attention.
3. Record scanning desk, scan date, page count, physical location, physical-file reference and notes.
4. Review suggested duplicates. Confirming a duplicate prevents it being registered as a new DG submission;
   clearing it records the decision and reason.
5. Print the QR file label. On each physical transfer, record the new location and a meaningful reason.
6. For outgoing correspondence, open **Dispatch registry**, prepare the authorized delivery channel and
   recipient, then record dispatched, delivered or failed status.

Expected control: approval-controlled outgoing correspondence cannot use a missing or superseded approval.

## System administrator

1. Use **Provisioning admin** to inspect directory synchronization and active organizational assignments.
2. Use **Department Secretaries** to assign one active Secretary per department. Replacements and deactivations
   require a reason and affect future movements only.
3. Use **Appearance** to preview a UI privately, then activate Classic, Modern, Soft UI or Glass for staff
   with a recorded reason.
4. Use **Document security → Annotation security policy** to require or relax strong annotation authentication for
   DG, Directors and Division Heads independently. Give a reason for every change. Enforcement is the safe default;
   the audit trail records old/new role sets, administrator and time.
5. Use **Reminder automation** to configure due-soon and escalation timing and inspect run results.
6. Use **Email outbox** to process queued messages, retry failures and inspect dead-letter delivery.
7. Keep worker secrets, mail credentials, session secrets and Workspace signing keys outside source control.
8. Use **Production assurance** to record evidence references and verify that unresolved or expired gates prevent a production-ready decision.

Expected control: operational administration does not grant blanket access to restricted business records;
classification rules continue to apply to registry queries and exports.

### Delegation and acting appointments

1. Open **Delegations and acting** and select the substantive authority holder and acting officer.
2. Choose delegation or acting appointment, enter the office/desk label, exact start/end time and authority reason.
3. Enable formal approval only when the appointment instrument explicitly grants that authority.
4. The acting officer uses **My inbox → Acting office inbox**. The substantive desk remains the record owner.
5. Revoke an appointment with a reason when it ends early. At the scheduled end time, access expires automatically.

An acting officer's correspondence event shows who performed the action and the appointment under which it was
performed. Delegation does not grant Secret access unless the acting officer's own role permits it.

## Search, filters and exports

Open **All correspondence** to search permitted records by ITF reference, sender reference, sender name,
subject, summary, body, routing minute or Secretariat tracking code. Combine that query with classification,
priority, status, active owner, office, department and received-date filters.

- **Export register CSV** downloads the filtered correspondence register with ownership and file-location data.
- **Export movement CSV** downloads every passage event for the same filtered records.
- On-screen results are limited to the latest 200; authorized exports are capped at 5,000 records per request.
- CSV cells are escaped against spreadsheet formula injection.
- The server reapplies visibility and Secret-classification rules during export; altering a URL cannot broaden access.

Search includes composed text and minutes. It can include released attachment extracted text, but a real OCR provider
is not connected until S24B.

## Confidential and Secret correspondence

- For DG/Director movements, Public/Internal correspondence automatically copies the recipient department's
  assigned Secretary—not a DG Secretary.
- Confidential/Secret movements by the DG or a Director suppress both explicit and automatic copies. A DG
  Confidential/Secret movement must go to a Director.
- The DG or a Director can raise Public/Internal correspondence to Confidential while routing, but must state
  the reason. The change creates a new immutable revision and supersedes earlier positive decisions.
- Need-to-know records are visible only to their originator and active group members who also satisfy normal
  workflow authorization.
- Secret access requires an eligible role and password confirmation. Elevation lasts 15 minutes.
- Confidential and Secret screens show a controlled-copy watermark with viewer identity and date.
- Sensitive downloads receive controlled filenames and are logged; sensitive exports are logged per record.
- Administrators configure groups and review access under **Need-to-know access**, but administration alone does
  not bypass group membership.

## Recommended stakeholder demonstration sequence

1. Show the selected staff interface and explain that an administrator can safely switch among four layouts.
2. As an Officer, draft and submit a harmless memo to the Unit Head.
3. As the Unit Head, acknowledge it and route it upward with a minute.
4. As a Director or DG, record a formal decision and show the immutable decision and passage registers.
5. As a Secretary, claim an external submission, record its physical file, review duplicates, print its QR label
   and register it for DG attention.
6. As the DG, route a Public/Internal item to the ICT Director and show the ICT Department Secretary's automatic
   copy; then demonstrate that Confidential routing suppresses all copies.
7. Search for the matter by reference or minute, filter by owner/office/date, and export both CSV reports.
8. Show notifications, reminders and the email outbox, explaining that delivery runs through protected workers.
9. End with the documented production boundaries below rather than implying they are already delivered.

## Current boundaries to state honestly

- Workspace v2 sessions consume enterprise MFA evidence and can be centrally revoked. Local/demo authentication is
  not a production fallback; production IdP registration, key management and central logout delivery must be operated.
- Attachments can use private Vercel Blob storage while retaining quarantine, hash/magic-byte validation and
  clean-only release. A real malware-scanner adapter, OCR and permanent EDMS integration remain production requirements.
- Search is database-backed multi-field text search, not OCR or a dedicated enterprise search engine.
- Digital-signature assertions, acting appointments, need-to-know groups and the external stakeholder portal are
  implemented; PKI/legal-signature policy, legal hold and governed retention/disposal remain external policy/integration work.
- S26 assurance tooling is implemented, but authorization, accessibility, load, security, backup/restore,
  disaster-recovery, governance, pilot and production sign-off evidence must still be executed and approved.

## Facilitation tips

- Use role names and practical outcomes rather than implementation terminology.
- Pause after each movement and ask stakeholders whether the actor, custody and reason are clear.
- Demonstrate one denied action to make authorization tangible.
- Keep the browser zoom readable and pre-open the two accounts needed for each handoff.
- Capture policy questions separately; do not improvise organization-wide permissions during the demo.
# External stakeholder portal (S22)

External stakeholders register at `/portal/register`, verify the queued email, then sign in at `/portal/login`.
An organization member can create Public correspondence and see authenticated submissions belonging to that
organization. The lifecycle is simplified to **Received by Secretariat**, **Under review**,
**Clarification / correction required**, or **Completed**.

When the current staff action holder asks a question, verified members receive an email prompt. Open the submission,
enter the secure response, and submit it. The staff action holder reviews and closes the response. Do not paste
classified material: the portal accepts Public correspondence only and attachment upload remains blocked pending
the real S24B EDMS/scanner/OCR integration.
