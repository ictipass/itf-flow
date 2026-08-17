# ITF Flow stakeholder presentation package

## Presentation objective

Secure stakeholder agreement that ITF Flow should proceed from working MVP to a controlled pilot. The
presentation should demonstrate that ITF's hierarchy can be digitized without losing accountability,
while making clear which production safeguards and integrations remain outstanding.

## Logical discussion order

### 1. The operational problem

- Correspondence enters through physical letters, email, internally composed memos, and external users.
- Staff must know where a matter is, who currently owns it, what was minuted, and whether action is late.
- Switching among email, paper files, and separate applications fragments the official record.
- Generic collaboration tools do not automatically represent ITF's formal reporting hierarchy.

### 2. The proposed operating model

ITF Flow provides one correspondence register and one auditable passage history. Normal communication
follows Officer → Unit Head → Division Head → Director → DG. Controlled exceptions allow Director peers
and Division Head peers in the same department to collaborate without silently bypassing policy.

External organizations can submit without using ITF Workspace. Staff can open ITF Flow directly or
launch it through Workspace, which remains the registry for all recognized ITF applications.

### 3. Who uses the system

- External submitters create incoming correspondence.
- DG Secretaries share intake work and can see when another Secretary has claimed an item.
- Officers and managers originate, receive, acknowledge, minute, return, revise, and route work.
- Directors make peer referrals and request concurrence or approval.
- DG handles executive routing and decisions.
- Records/Secretariat officers manage outgoing dispatch.
- System administrators monitor provisioning and configuration; they do not replace business authority.

### 4. The lifecycle to explain before demonstrating

```text
Capture → Register → Assign → Acknowledge → Treat
       → Review / Concur / Approve → Revise if returned
       → Dispatch → Confirm delivery → Close
```

At each transition, ITF Flow records the actor, time, instruction, recipients, resulting status, and
technical request context. Copied recipients receive visibility but do not become accountable owners.

### 5. Demonstrated capabilities

- Public portal, scanned letters, composed memos, and manually synchronized email intake.
- Shared Secretariat claim/release controls.
- Scanning-desk metadata, physical-file location history, duplicate review and authenticated QR labels.
- Searchable staff directory and explicit reporting lines.
- Multiple action and copied recipients.
- Drafts and autosave.
- Hierarchical routing and controlled peer referral.
- Return, correction, numbered revisions, and resubmission.
- Review, concurrence, approval, rejection, and decision audit register.
- Passage timeline and current ownership.
- Scoped organizational broadcasts with mandatory acknowledgement.
- Outgoing dispatch reference and delivery/failure tracking.
- Workspace launch handoff and directory synchronization contract.

### 6. Security and governance talking points

- Server-side authorization rechecks every routing, decision, draft, attachment, and dispatch action.
- Drafts are private to their authors, including direct attachment URLs.
- Audit events are append-only through normal application operations.
- Positive decisions remain visible when later content changes but are marked superseded.
- Secrets stay in environment configuration and are excluded from Git.
- Email HTML is not rendered and remote content is not loaded.
- Classification labels exist, but full need-to-know enforcement and step-up authentication remain a
  production slice and must not be overstated.
- Attachments are not yet malware-scanned. Production use is blocked until validation, scanning, and
  quarantine are operational.

### 7. Architecture overview

```text
External users ───────┐
ITF Workspace ────────┼─→ Next.js application ─→ PostgreSQL
ITF staff ────────────┘          │                    │
                                ├─→ Local demo files  └─→ Audit / workflow records
Private mail server ─ IMAP/SMTP ┘

Future: ITF EDMS/object storage · malware scanner · enterprise OIDC/MFA · scheduled workers
```

The current implementation uses typed server actions, Prisma migrations, PostgreSQL, and a replaceable
document-storage boundary. Integration contracts are intended to support applications outside the
JavaScript ecosystem through versioned HTTP APIs and signed events.

### 8. Performance, scale, and maintainability

- Staff lookup is server-filtered and capped; the browser does not load the full staff directory.
- Indexed work queues and recipient snapshots support growth beyond the small demo dataset.
- Database migrations are versioned and reproducible across machines.
- Workflow decisions, dispatch, broadcasts, and revisions have separate models rather than ambiguous
  free-text flags.
- Production scale still requires managed storage, background workers, monitoring, load testing, backup
  restoration tests, and database capacity planning.

### 9. Honest MVP boundaries

- Official-email dispatch uses protected scheduled SMTP processing, bounded retry and dead-letter recovery;
  recipient delivery remains separately confirmed and unscanned attachments are omitted.
- IMAP synchronization is manual in the demo; production needs an authenticated scheduled worker.
- Local uploads are unsuitable for Vercel production and multi-instance hosting.
- Digital signatures and cryptographic certificates are not implemented; current approval is auditable,
  account-bound workflow approval.
- OCR, EDMS integration, malware scanning, retention, legal hold, and disposal are planned.
- Enterprise identity, MFA, central logout, delegation, acting appointments, and detailed information
  barriers remain planned.
- The stakeholder portal does not yet provide authenticated tracking accounts.

### 10. Proposed pilot and success measures

Pilot with the DG Secretariat, ICT, Human Resources, and Records. Measure registration time, time to first
acknowledgement, overdue items, untraceable correspondence incidents, return/rework rates, and user
completion rates. Review authorization and audit reports weekly during the pilot.

### 11. Decisions requested from stakeholders

1. Approve a limited pilot scope and nominate process owners.
2. Confirm the authoritative organizational hierarchy and staff-master source.
3. Approve correspondence classifications and handling rules.
4. Identify which correspondence types require review, concurrence, approval, or DG action.
5. Confirm Records and Secretariat dispatch authority.
6. Assign mail-server, EDMS, security, infrastructure, and data-protection contacts.
7. Approve malware scanning, backup, retention, and hosting requirements before production.

## Suggested slide sequence

1. Title and desired decision
2. Current correspondence problem
3. ITF Workspace and ITF Flow vision
4. Users and hierarchy
5. End-to-end lifecycle
6. Live demonstration scenario
7. Passage timeline and accountability
8. Review, approval, and version integrity
9. Broadcast and dispatch
10. Security and audit controls
11. Architecture and integrations
12. MVP boundaries and production gates
13. Pilot plan and measures
14. Roadmap
15. Stakeholder decisions and questions

## Likely stakeholder questions

| Question | Recommended answer |
|---|---|
| Is this a legal digital signature? | Not yet. It is an authenticated, timestamped, auditable workflow approval. Digital signatures are a separate controlled slice. |
| Can a Director bypass the hierarchy? | Normal routing is restricted. Director peers and same-department Division Head peers are explicit audited referrals; wider bypass is not currently permitted. |
| Can we see who has a file now? | Yes. Current action owners, copies, status, location, time at stage, and complete passage are shown. |
| Can three Secretaries process the same letter? | They share one queue; atomic claim/release identifies who is handling an item and prevents silent duplicate registration. |
| Does it replace email? | It consolidates the official workflow record. Intake can import email, and Official Email dispatch uses durable SMTP processing while preserving separate delivery confirmation. |
| Is it ready for sensitive production documents? | Not yet. Malware scanning, quarantine, managed/EDMS storage, stronger classification enforcement, MFA, and assurance testing are production gates. |
| Will it scale to all staff? | The directory is searched server-side and core queues are indexed, but production load and capacity testing remain required. |
| Can non-ITF users use it? | External submission exists now. Authenticated stakeholder accounts and tracking are planned. |
| What happens when content changes after approval? | A new immutable version is created and earlier positive decisions are marked superseded, requiring fresh approval where applicable. |
| Can it integrate with existing systems? | Yes, through Workspace handoff, directory sync, mail adapters, the document-storage boundary, and planned versioned REST/webhook contracts. |
