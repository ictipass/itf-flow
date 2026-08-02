# Correspondence drafts

Staff can save incomplete correspondence without routing it. A draft is private to its author,
does not appear in the correspondence registry or recipient inbox, and creates no work items.

After the first explicit save, leaving a changed field triggers background autosave. File inputs are
excluded from background persistence and are stored only during an explicit save or submission.
Submitting validates all required content and recipients again, replaces the temporary draft reference
with an official ITF Flow reference, creates recipient work items, and records the transition in the
immutable correspondence event history.

All draft mutations enforce author ownership and `DRAFT` status on the server. A submitted draft can no
longer be edited through the draft actions.
