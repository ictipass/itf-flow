# S19A — Availability-aware Directorate continuity

## Decision: where the setup belongs

For the immediate ITF Flow take-off, the System Administrator configures the approved continuity chain in **ITF Flow** at `/admin/continuity`. Flow owns correspondence custody, routing and the evidence of who exercised authority, so it must enforce the chain even before another system is available.

The permanent authoritative source should be **ITF Workspace/HR**. A future Workspace directory contract should supply the substantive Director, first next-in-line, second next-in-line, effective dates and approval-authority grants. Flow should synchronize that governed data and retain a versioned snapshot on each routed work item. Workspace should not make the correspondence-routing decision itself.

## Setup

1. Synchronize all three active staff accounts from Workspace.
2. Ensure the Director has the `DIRECTOR` role and all three accounts have the same authoritative department identifier. A Workspace department ID takes precedence over the department-name fallback.
3. As System Administrator, open **Directorate continuity**.
4. Select the Director, first next-in-line and second next-in-line. They must be three different people in the same department.
5. Grant approval authority to a successor only where management has approved it.
6. Record an authority reference or reason and save. Replacing a chain increments its version and writes a configuration audit entry.

This is a required take-off register, like Department Secretary assignment. A department without a plan continues routing to an available Director normally, but cannot fail over automatically.

## Runtime behaviour

- Availability defaults to **Available** until a chain member records otherwise.
- Each chain member sees **Availability and next-in-line** in the portal and may change only their own availability, with a reason and optional expected return time.
- If the Director is available, an item addressed to the Director remains with the Director.
- If the Director is unavailable, Flow assigns the action item to the first eligible available successor.
- If the first successor is unavailable, inactive, unable to read the classification, or lacks approval authority for an approval request, Flow tries the second successor.
- A successor's work item stores the substantive Director, plan ID/version, successor rank and approval grant. Actions and signatures identify both the human actor and the Director's authority.
- The unavailable Director receives an `OVERSIGHT` work item. It is read-only and is not a normal copy recipient, so it does not weaken Confidential-routing copy rules.
- An unavailable first successor does not receive a copy when the second successor acts.
- If nobody eligible is available, routing fails safely with a visible message and no partial route is committed.

Changing to Unavailable automatically hands over open, unacknowledged work. Acknowledged work is not moved silently because the officer already accepted custody; it must be completed or formally reassigned. A failed automatic handoff is shown on the availability page for administrative intervention.

## Audit and approval controls

- Every availability change creates an immutable event containing actor, state, reason, expected return and time.
- Each automatic handoff creates a correspondence movement event and notification.
- Director read-only oversight is distinct from action authority.
- Approval requests skip successors who have not been explicitly granted approval authority.
- Existing time-bound delegation/acting appointments remain available for exceptional appointments. S19A is the standing ranked continuity chain; S19 is a dated appointment to another desk.

## Deployment

Apply migration `20261011120000_add_directorate_continuity` before deploying the application build. Configure and acceptance-test every Directorate chain with Public/Internal, Confidential and approval routes before production cutover.

## Workspace/HR integration backlog

Extend the directory contract with immutable department identity and a versioned continuity assignment containing effective dates, ranks, authority source and approval grants. Synchronization must reject ambiguous departments, inactive staff, duplicate ranks and stale versions. Local administration remains the controlled bridge until this contract is approved and delivered.
