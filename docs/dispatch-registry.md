# Outgoing dispatch and delivery tracking

DG Secretariat, Records, and system administrators can manage the dispatch registry. Only outgoing
letters may be dispatched. If a correspondence has entered a formal approval workflow, a current,
non-superseded approval is required before a dispatch record can be prepared.

Each recipient and delivery channel receives a unique annual outgoing reference. Supported channels are
official email, physical delivery, courier, and stakeholder portal. Records move through prepared,
dispatched, delivered, or failed states. Failed delivery may be retried. Delivery and failure notes are
mandatory and every transition is added to the correspondence timeline.

Where multiple dispatch records exist, correspondence closes only after every record is delivered.
Official-email selection currently records controlled dispatch; automated SMTP delivery, attempts, and
retry workers belong to the notification/email-delivery slice.
