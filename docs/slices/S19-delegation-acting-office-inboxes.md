# S19 — Delegation, acting appointments and office/desk inboxes

Status: Implemented locally; pending feature commit.

## Practical outcome

Work no longer becomes invisible when an authority holder is temporarily absent. An administrator can record
a dated delegation or acting appointment, and the acting officer receives a separate office/desk inbox without
changing the original owner. Actions identify both the signed-in officer and the authority used.

## Delivered scope

- Administrator-created appointments with start/end time, office label, reason and optional approval authority.
- Validation against overlap, self-delegation, invalid dates and periods longer than one year.
- Separate personal and acting-office inbox views.
- Acting access to permitted correspondence details, attachments, search and reports.
- Delegated acknowledgement, routing, decisions, return and resolution.
- Automatic activation/expiry based on server time; expired or revoked authority immediately stops access.
- Immutable appointment history, assignment/revocation notifications and delegated event metadata.

## Authorization decisions

- Only System Administrators manage appointments until an authoritative HR/Workspace contract exists.
- The original desk retains each work item; no destructive bulk reassignment occurs.
- Routing uses the authority holder's reporting line, not the delegate's personal position.
- Approval requires an explicit `canApprove` grant.
- Delegation never upgrades the signed-in user's Secret-classification eligibility.
- Revocation preserves all actions already taken and their historical authority.

## Explicit boundaries

- HR remains authoritative for real leave and acting dates; local administration is an interim adapter.
- Expiry takes effect during the next query/action without a polling worker. Assignment and manual revocation
  notify users; advance-expiry notification awaits agreement on HR event ownership.
- Office inboxes are derived from active appointments and staff desks. A future organization service may supply
  stable office entities and personnel-transfer events.
