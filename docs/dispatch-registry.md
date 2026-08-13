# Outgoing dispatch and delivery tracking

DG Secretariat, Records, and system administrators can manage the dispatch registry. Only outgoing
letters may be dispatched. If a correspondence has entered a formal approval workflow, a current,
non-superseded approval is required before a dispatch record can be prepared.

Each recipient and delivery channel receives a unique annual outgoing reference. Supported channels are
official email, physical delivery, courier, and stakeholder portal. Records move through prepared,
dispatched, delivered, or failed states. Failed delivery may be retried. Delivery and failure notes are
mandatory and every transition is added to the correspondence timeline.

Where multiple dispatch records exist, correspondence closes only after every record is delivered.
Official Email preparation creates one idempotent durable outbox item. A protected bounded worker sends
it through the configured SMTP server and marks the dispatch `DISPATCHED` only after SMTP acceptance.
SMTP acceptance is not recipient delivery; authorized staff confirm delivery separately. Failed and
dead-letter messages remain visible to administrators and require an audited reason for manual recovery.

Attachments are deliberately omitted until malware scanning marks them `CLEAN` and the configured
document provider can safely supply their content.
