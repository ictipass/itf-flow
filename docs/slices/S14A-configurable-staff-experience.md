# S14A - Configurable Staff Experience and Modern Dashboard

## Status

Implemented locally. This stakeholder-priority slice is inserted without renumbering the established
delivery sequence. S15 remains Automated Email Delivery and Secure Worker Processing.

## Outcome

ITF Flow preserves its Classic staff interface and adds structurally different Modern, Soft UI and Glass experiences.
A system administrator can privately preview any mode and activate one organization-wide without a
deployment. Both modes use the same authorization-aware navigation and dashboard data.

## Delivered scope

- `StaffUiMode` supports `CLASSIC`, `MODERN`, `SOFT_UI` and `GLASS`, with Classic as the migration default.
- A singleton application configuration stores the active mode and an optimistic-concurrency version.
- Every organization-wide change records the administrator, previous value, new value, reason and time.
- The Appearance administration page supports private 30-minute previews, activation and rollback.
- Preview cookies are honored only for authenticated system administrators.
- The Classic shell and dashboard remain available as dedicated presentation components.
- The Modern shell uses a compact navigation rail, responsive mobile navigation, floating header,
  attention-first metrics, priority work list, authorized quick actions and recent activity.
- The Soft UI shell uses horizontal workspace navigation and neumorphic raised/inset surfaces, with a
  calm tactile dashboard, responsive menu, shared metrics, work queue, quick actions and activity.
- The Glass shell uses a near-black layered canvas, translucent glossy surfaces, restrained luminous
  burgundy accents, responsive navigation and high-contrast adaptations for existing workflow pages.
- Navigation destinations and dashboard queries are shared so presentation mode does not alter policy.

## Security and operational rules

- Only `SYSTEM_ADMIN` may preview or activate a staff interface.
- Client-provided mode values are validated against the generated Prisma enum.
- A meaningful change reason is mandatory.
- Concurrent changes are rejected when the submitted configuration version is stale.
- Configuration and audit records are committed in one database transaction.
- The migration inserts the singleton configuration in Classic mode, providing a safe rollout default.
- The Appearance link exists in both shells so rollback remains available after switching.

## Rollout

1. Apply the migration and sign in as the seeded Flow administrator.
2. Open **Appearance** and privately preview Modern.
3. Smoke-test seeded roles and responsive widths without changing the organization-wide selection.
4. Record the stakeholder rollout reason and activate Modern.
5. If required, return to Appearance and activate Classic with a rollback reason.

## Acceptance evidence

- Prisma schema validation passes.
- Prisma client generation passes.
- TypeScript `--noEmit` passes.
- ESLint passes.
- Next.js production build passes and includes the dynamic `/admin/appearance` route.
- The additive migration was applied successfully and Prisma reports the development database up to date.
- Seeded-role browser smoke testing remains a pre-commit/operator check.
