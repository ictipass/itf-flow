# Workspace Directory Provisioning

ITF Workspace is the system of record for staff identity, organization placement, reporting lines,
application entitlement, status, and ITF Flow role.

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
the next synchronization.

The current import is intentionally create-only. Changes to existing staff should be made through
controlled lifecycle administration until an update/reconciliation import is implemented.
