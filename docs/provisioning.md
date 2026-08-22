# Workspace Directory Provisioning

ITF Workspace is the system of record for staff identity, organization placement, reporting lines,
application entitlement, status, and ITF Flow role.

## Production account rule

Production staff accounts are created in ITF Workspace, assigned an explicit ITF Flow entitlement/role and synchronized into Flow. A synchronized Flow user has no local password and enters through the Workspace launch with enterprise MFA/session evidence. Synchronizing a matching email clears any prior demo/local password hash, so `Demo123!` cannot coexist with that production identity.

`npm run db:seed` is local-demo tooling only: it requires `ALLOW_DEMO_SEED=true` and refuses to run with `NODE_ENV=production`. Staging and production must not contain seeded users. Local staff-password login defaults off in production and an approved production configuration keeps `STAFF_LOCAL_LOGIN_ENABLED=false`.

Do not create a production administrator by seeding `admin@itf.gov.ng`. Create the named administrator in Workspace, grant the narrowly approved `SYSTEM_ADMIN` entitlement, synchronize it, test Workspace MFA/launch and retain the approval record. Emergency/break-glass administration requires a separately designed governed process; the demo login is not that process.

## Master-list columns

```csv
staffNumber,fullName,email,workspaceRole,officeCode,departmentCode,divisionCode,unitCode,positionCode,supervisorStaffNumber,itfFlowRole
```

`supervisorStaffNumber` may refer to another row in the same import or an existing Workspace user.
`itfFlowRole` is optional; when present it grants ITF Flow access with one of:

```text
DG_SECRETARY, DG, DIRECTOR, DIVISION_HEAD, UNIT_HEAD, OFFICER, RECORDS_ADMIN, SYSTEM_ADMIN
```

## Safe import and synchronization

1. Configure offices, departments, divisions, units, and positions in Workspace.
2. Download Workspace reference codes and the current CSV template.
3. Convert the staff spreadsheet to CSV and populate the required codes.
4. Upload with **Validate only (dry run)** enabled.
5. Correct every validation error; dry run changes no data.
6. Upload again without dry run to create identities, reporting lines, and Flow entitlements.
7. Configure the same `WORKSPACE_DIRECTORY_SYNC_SECRET` in both applications.
8. From the Workspace import page, select **Synchronize entitled staff to ITF Flow**.
9. In ITF Flow, open **Provisioning admin** to inspect run history and reporting-line gaps.

Synchronization is paginated in batches of 200, authenticated separately from browser SSO, and
records a run ledger in ITF Flow. Suspended or inactive Workspace users are disabled in Flow on
the next synchronization. Synchronization also removes a prior local password from each matched identity.

The Workspace import described here may be create-only, but the Flow synchronization endpoint reconciles existing matched users, placements, roles, reporting lines and active status. Changes must originate through controlled Workspace lifecycle administration.
