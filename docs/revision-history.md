# Document revision history

ITF Flow captures an immutable text and attachment-metadata snapshot when correspondence is first
submitted. Existing records receive a baseline snapshot when the revision migration is deployed.

Only the original author who currently holds a returned action item may alter correspondence content.
Saving a correction creates the next numbered version and records the correction note, author and time.
The returned item cannot be resubmitted until a version newer than its latest return event exists.

Earlier positive review, concurrence and approval decisions are never deleted. If content changes, they
are marked superseded by the new version. The corrected correspondence must therefore pass through a
fresh decision request where policy requires approval.

Draft autosaves remain mutable working state and do not create excessive formal versions. The first
formal immutable version is captured when the draft is submitted.
