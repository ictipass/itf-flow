# S25 - Configurable workflow templates, SLAs and simulation

## Practical implication

ITF can change controlled workflow policy and response targets without editing source code. New correspondence records
the exact active template version and category used, so later policy changes do not silently rewrite work already in
progress. Administrators can preview an outcome before activation or correspondence creation.

## Delivered

- Immutable workflow template versions with Draft, Active and Retired states and activation audit.
- Strict rule validation: routing remains hierarchical, Action cannot be removed, and only the established Action,
  Review, Concurrence and Approval purposes may be enabled.
- Configurable controlled peer-referral permission and automatic outgoing-approval requirement.
- Configurable categories by correspondence type with Routine, Urgent and Immediate SLA days.
- Optimistic concurrency on category changes and mandatory reasons for every version, activation and SLA change.
- Business-day deadline calculation that excludes Saturday and Sunday while preserving an explicitly entered date.
- Safe simulation reports category, template version, SLA, due date, approval and peer-referral policy without writing
  correspondence, work items, notifications or audit events.
- Active policy snapshots on anonymous intake, authenticated portal intake, mailbox imports and staff submissions.
- Routing enforces the snapshot's allowed purpose and peer-referral rule; existing unversioned records preserve the
  established code policy.
- Seeded Standard Correspondence v1 plus General Incoming, General Outgoing and Internal Memo categories.

## Administrator use

Open **Workflow policies**:

1. Run a simulation for a type, category, priority and purpose.
2. Create a Draft version with the desired constrained capabilities and a business reason.
3. Activate the Draft. The previous Active version becomes Retired; existing records keep their snapshot.
4. Adjust category SLA values so Immediate ≤ Urgent ≤ Routine, or create a new category.
5. Select a non-default category while composing staff correspondence when required.

## Boundaries

- The calendar excludes weekends but not Nigerian public holidays; an approved holiday calendar is still required for
  statutory business-day calculation.
- S25 deliberately does not permit arbitrary statuses, executable scripts, custom SQL or unsafe transition graphs.
- Changing a template affects new correspondence only. A governed migration tool would be required to move existing
  live records to a later version.
- Business ownership must approve production templates, categories and SLA values.

Validation: migration deploy/status, Prisma generation, focused business-day/simulation checks, TypeScript, ESLint
and production build.
