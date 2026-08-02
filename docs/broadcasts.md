# Organizational broadcasts

ITF Flow broadcasts are official in-app announcements. They are separate from correspondence:
correspondence has an accountable workflow owner and routing path, while a broadcast distributes
the same approved information to a defined audience.

## Authorization

Publishing authority is stored in `BroadcastPublisherGrant`. A grant constrains the publisher by:

- audience scope and value;
- permitted categories;
- whether mandatory acknowledgement may be requested;
- active/inactive status.

The server re-evaluates the grant for both immediate publication and publication of a saved draft.
Client-side options are convenience only and are not an authorization boundary.

Demo grants include:

- DG: organization-wide, all categories;
- Human Resources Director: organization-wide HR, policy and general categories;
- System Administrator: organization-wide system and emergency categories only;
- Directors: explicitly granted departments;
- Division Heads: explicitly granted divisions.

## Recipient snapshots

When published, each audience is resolved against the active staff directory. A deduplicated
recipient record snapshots the recipient's name, email, role, office, department, division and unit.
Later staff transfers do not rewrite the historical publication audience.

## Lifecycle and evidence

Broadcasts support drafts, immediate or future-dated publication, expiry and withdrawal. Recipient
records track delivery, reading and acknowledgement. Audit events record drafting, publication,
reading, acknowledgement and withdrawal.

The current slice is in-app only. Email/push delivery, attachment ingestion, approval chains and a
grant-administration screen remain later increments. Attachments must not be enabled for production
until the malware quarantine and scanning pipeline is operational.
