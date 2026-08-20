# Stakeholder live-demo script

## Before opening the screen

State the outcome: “We are demonstrating traceable correspondence movement through ITF's real hierarchy,
not claiming final production readiness.” Keep the presentation package open on a second device.

## Scene 1 — Workspace entry (2 minutes)

1. Sign in to ITF Workspace as a staff user entitled to ITF Flow.
2. Show accessible applications and greyed-out applications.
3. Launch ITF Flow.

Expected: ITF Flow opens without another password prompt when handoff is configured, and the staff role
and office appear. Explain that direct application login remains possible for permitted users and external
users do not require Workspace for public submission.

## Scene 2 — External intake and Secretary coordination (3 minutes)

1. Open the public submission page in a private window and submit a small test letter.
2. Sign in as `secretary.abuja@itf.gov.ng`.
3. Open Shared Secretariat intake, claim the item, and show the handler indicator.
4. Register and send it to DG.

Expected: the other Secretaries would see who claimed the item; registration creates an auditable event
and places the item in DG's inbox. If public submission is already rehearsed, use that prepared record.
Show the tracking code, current physical location and duplicate-review state; print or preview the QR
label if time permits. Clarify that this is operational scan metadata, not malware scanning.

## Scene 3 — Staff draft and hierarchy (3 minutes)

1. Sign in as `officer.apps@itf.gov.ng`.
2. Create a memo, save a partial draft, open My drafts, and continue it.
3. Search for the configured Unit Head and submit.

Expected: the draft is private, searchable recipients are limited by policy, and submission creates the
official reference and first immutable version.

## Scene 4 — Peer approval path (4 minutes)

1. Sign in as `director.ict@itf.gov.ng` and open or create an outgoing ICT letter.
2. Select Director HR as action recipient, choose Formal approval, add a clear purpose, and optionally copy DG.
3. Sign in as `director.hr@itf.gov.ng`, acknowledge, open Decision required, enter a note, and approve.
4. Minute and route the approved correspondence upward to DG.

Expected: Director HR appears because Directors are authorized peers. Approval is separate from ordinary
routing, remains in the decision register, and HR retains custody after approval to forward onward.

For the complete role-by-role facilitator sequence, seeded accounts, expected controls and honest boundaries,
use [`user-guide.md`](user-guide.md). Conclude the workflow demonstration by searching the resulting reference
or minute in **All correspondence**, applying an owner/date filter, and downloading both filtered CSV reports.

Optional continuity scene: as the System Administrator, create a short acting appointment for the ICT Director's
desk. Sign in as the acting officer, open **Acting office inbox**, acknowledge a prepared item and show the passage
metadata attributing the action to both the officer and delegated desk. Revoke the appointment and show that the
desk queue is no longer accessible; do not imply that local dates replace the authoritative HR record.

## Scene 5 — Return, correction, and version integrity (2 minutes)

Use a rehearsed returned record if time is limited.

1. Return a staff-originated item with a mandatory correction reason.
2. As its author, select Edit and create new version, change the content, and provide a correction note.
3. Open the current and previous numbered entries in version history, explain the recorded changes, and resubmit.

Expected: resubmission is blocked until a corrected version exists. Earlier positive decisions remain but
are marked superseded when content changes.

## Scene 6 — Division Head peer referral (1 minute)

As `head.hardware@itf.gov.ng`, search for `head.pass@itf.gov.ng` as action recipient and copy
`director.ict@itf.gov.ng`.

Expected: PASS and NCS peers are available because they share ICT; Division Heads in another department
would not be available as action recipients.

## Scene 7 — Organizational broadcast (2 minutes)

1. As an authorized publisher, open Announcements and create or open a broadcast.
2. Show scope, recipient snapshot, read state, and mandatory acknowledgement.
3. As a recipient, mark it read and acknowledge it.

Expected: publication authority and audience are enforced server-side, and acknowledgement is distinct
from merely opening the announcement.

## Scene 8 — Dispatch registry (2 minutes)

1. Sign in as a DG Secretary and open Dispatch registry.
2. Open an approved outgoing letter and prepare a dispatch record.
3. Show its generated outgoing reference and status transitions.

Expected: missing/superseded approval blocks controlled items. Explain that Official Email queues one
durable message; the protected worker marks it dispatched only after SMTP acceptance, while recipient
delivery remains separately confirmable. Attachments remain omitted until the production scanning gate.

## Scene 9 — Close on accountability (1 minute)

Return to a detailed correspondence page. Show current owners, time at stage, complete passage, decisions,
versions, attachments, and dispatch. Then state the production gates and request the stakeholder decisions
listed in the presentation package.
