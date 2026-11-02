# S33 — Departmental outgoing-letterhead and Director-finalized dispatch

## Outcome

Outgoing letters are now a distinct governed lifecycle rather than internal memos with an external address added at dispatch time. The originator captures the external ultimate recipient, previews the departmental letterhead, and routes the working copy internally. The Director's desk is the final internal router; the DG is not inserted into this route.

## Administrative setup

Complete these controls before a department originates an outgoing letter:

1. Synchronize the department, Director, reporting lines and staff identities from ITF Workspace.
2. Configure **Directorate continuity** with the substantive Director, first next-in-line and second next-in-line.
3. Ensure the Director has an active transparent PNG signature profile.
4. Open **Department letterheads** and configure:
   - the department selected from its active continuity plan;
   - the departmental email address that receives the record copy;
   - the official letterhead address, one printed line per row; and
   - the configuration authority/reason.
5. Run the database migration and protected email-outbox worker.

The photographed ICT letterhead supplied by stakeholders was used only as a visual reference. It is not stored as a page background because it contains skew, shadows, compression artefacts and ICT-specific text. Flow renders a clean controlled PDF using the bundled ITF logo, the selected department heading, configured address and configured department email.

## User lifecycle

1. The originator selects **Outgoing letter**.
2. Flow requires the ultimate external recipient's name, email and postal/office address; organization is optional.
3. The originator composes the rich-text letter and selects **Preview letterhead PDF**. The preview is watermarked `WORKING PREVIEW - NOT DISPATCHED` and has no dispatch-valid signature.
4. On submission, Flow snapshots the sending department and profile version and creates a provider-backed working preview visible to every authorized participant in the route.
5. Each intermediate action holder acknowledges, reviews, annotates/minutes where needed, and routes to the next authorized reporting-line desk.
6. Routing an outgoing departmental letter to the DG is rejected. The route must end at the department Director.
7. If the Director is unavailable, the existing continuity policy assigns the action item to the first available authorized next-in-line officer. The substantive Director retains the read-only oversight copy already defined by S19A.
8. The acknowledged Director desk selects **Finalize, sign and queue official email**. Flow does not ask for a second recipient address at this point; it uses the governed ultimate-recipient fields captured at origination.
9. Flow generates the final PDF with the substantive Director's name and visual signature followed by `For: Director-General/CE`. When a successor performs the action, the event and document metadata record both the human actor and the substantive Director authority.
10. One outbox item sends the signed PDF to the external recipient. A second item sends the same PDF to the configured department mailbox with the explicit heading `DEPARTMENTAL COPY - NO ACTION REQUIRED`.
11. SMTP acceptance marks the primary dispatch record dispatched. Department-copy delivery has its own outbox attempts and does not falsely alter the external delivery state.

## Data and audit controls

- External name, organization, email and delivery address are stored on the correspondence and displayed to the routing line.
- Sending department, department-profile ID and profile version are snapshotted on submission.
- Working and final letterhead PDFs are distinguished from source attachments.
- Finalization records the Director, acting human, continuity/delegation metadata, signature-profile ID/version, department-profile version, final attachment and dispatch record.
- Email attachments are read from the configured private provider and SHA-256 verified immediately before SMTP submission.
- The final PDF is system generated and released as available; uploaded supporting files remain subject to the configured malware security gate.
- The final output uses the visual signature profile. It is not a certificate-backed qualified electronic signature; S31B remains policy-gated.

## Deployment and acceptance

```cmd
npm run db:migrate
npm run verify
```

Acceptance should cover:

- pre-submit ICT letterhead preview;
- one non-ICT department to prove that department heading/email are data driven;
- ordinary Director finalization;
- first and second next-in-line finalization with correct substantive authority attribution;
- attempted DG routing rejection;
- missing department profile and missing Director signature failure;
- primary recipient and clearly labelled departmental copy outbox messages;
- attached PDF integrity verification and retry/dead-letter behavior; and
- evidence-package inclusion of working preview, final PDF, movement, authority and dispatch records.

## Known boundary

This slice implements official email delivery. Physical delivery, courier and stakeholder-portal dispatch can remain in historical records, but they are not offered by the new Director-finalization control until their recipient, signature and proof-of-delivery policies are separately approved.
