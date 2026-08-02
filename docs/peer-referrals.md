# Peer referrals

ITF Flow permits controlled lateral movement without weakening the formal reporting hierarchy.

- A Director may refer correspondence to another active Director.
- A Division Head may refer correspondence only to another active Division Head in the same department.
- Other roles continue to route only to their configured supervisor or direct reports.
- Copy recipients remain informational and may include the department Director.
- A peer referral requires a meaningful routing purpose of at least 10 characters.
- The server applies the same authorization policy during directory search and final submission.
- Every lateral movement is recorded as a `REFERRED` event with `PEER_REFERRAL` metadata.

This supports, for example, Director ICT referring a matter to Director Human Resources for action or
approval. Director Human Resources can subsequently route it upward to the DG through the configured
reporting line. It also supports one ICT Division Head referring to another ICT Division Head while
copying Director ICT.
