# S27 — Department Secretariat routing and classification escalation

## Business outcome

When the DG or a Director routes Public or Internal correspondence, ITF Flow automatically copies the
Secretary assigned to each recipient department. The copied Secretary is the recipient department's
Secretary, not a DG Secretary. Confidential and Secret routing creates no Secretariat copy, and a
Confidential or Secret route from the DG can target Directors only.

## Delivered

- A system-administrator register for assigning, replacing and deactivating one active Secretary per
  department, with a mandatory reason and configuration audit record.
- Department identity based on the immutable Workspace department ID when available, with the normalized
  department name used by disposable local/demo accounts.
- Server-side automatic copy resolution for DG and Director routing of Public and Internal correspondence.
- Fail-closed routing when a required recipient-department Secretary has not been assigned.
- Server-side suppression of explicit and automatic copy recipients for Confidential and Secret routing.
- Director-only action recipients when the DG routes Confidential or Secret correspondence.
- A controlled Public/Internal-to-Confidential change by the DG or a Director, requiring a reason, creating
  an immutable revision and audit event, and superseding earlier positive decisions.
- Notifications, work items and routing-event metadata for automatic Department Secretary copies in the same
  transaction as the movement.
- Disposable demo Secretaries and assignments for HR, ICT, RIC and SDO.

## Operating procedure

1. A system administrator opens **Department Secretaries**.
2. Search for the staff member assigned to a department secretariat and record the approved assignment reason.
3. The DG or a Director routes Public/Internal correspondence to a member of that department.
4. The action recipient owns treatment; the assigned Department Secretary receives a copy work item for
   department tracking.
5. For Confidential/Secret correspondence, no Secretary or other copy recipient is added. A DG route must go
   to a Director.

Replacing an assignment affects future movements only. Existing work items and audit events retain the exact
recipient and assignment identifiers used at the time.

## Authorization and audit

- Only `SYSTEM_ADMIN` can maintain Department Secretary assignments.
- Assignment changes do not grant administrators access to restricted correspondence.
- Routing policy is enforced in server actions and cannot be bypassed by altering the form.
- Classification escalation is one-way in this slice. Declassification needs a separately approved records and
  information-security policy.

## Boundaries and production gates

- Workspace/HR remains the future authoritative source for secretariat appointments. This slice provides a
  controlled local register until that integration is approved.
- The organization must complete all department assignments before enabling this rule in production; routing
  fails closed when an assignment is missing.
- Existing Confidential/Secret need-to-know policy, MFA, access testing and S26 production evidence remain gates.
- This slice does not add document annotation, visual signature assets, evidence-pack generation, object-storage
  adapters, EDMS integration or PWA capabilities. Those are separate Priority-1 and post-Priority-1 slices.

## Acceptance evidence

- Focused tests cover department identity, automatic-copy eligibility, confidential recipient/copy restrictions,
  and controlled classification escalation.
- Prisma validation/generation, lint, TypeScript, the 40-test assurance suite and production build passed.
- The additive migration was applied and the configured database reports all 29 migrations up to date.
- Seeded end-to-end demonstration data remains opt-in and was not written to the configured database.
