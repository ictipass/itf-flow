import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../lib/generated/prisma/client";
import { canManageRecordsCatalogue, organizationUnitOptionsFromUsers, preferredOrganizationUnitKey } from "../lib/records-catalogue";
import { normalizedLegacyKey, recordCategoryGuidance, retentionPolicySummary } from "../lib/records-catalogue-shared";

const directoryUser = {
  office: "Headquarters",
  department: "Information and Communication Technology",
  division: "Software",
  unit: "Applications",
  workspaceOfficeId: "office-hq",
  workspaceDepartmentId: "department-ict",
  workspaceDivisionId: "division-software",
  workspaceUnitId: "unit-applications",
};

test("Workspace organization choices retain stable identifiers and prefer the most specific unit", () => {
  const choices = organizationUnitOptionsFromUsers([directoryUser, directoryUser]);
  assert.equal(choices.length, 4);
  assert.ok(choices.some((item) => item.key === "workspace:department-ict" && item.level === "DEPARTMENT"));
  assert.equal(preferredOrganizationUnitKey(directoryUser), "workspace:unit-applications");
});

test("filing categories provide practical guidance", () => {
  assert.match(recordCategoryGuidance.PERSONNEL, /named staff member/i);
  assert.match(recordCategoryGuidance.OFFICE, /department, division or unit/i);
  assert.match(recordCategoryGuidance.EXTERNAL_CASE, /external person or organization/i);
});

test("retention summaries explain trigger, duration and disposition", () => {
  assert.equal(retentionPolicySummary({
    id: "retention-1", code: "PER-10Y", name: "Personnel ten years", description: "Approved schedule",
    trigger: "EMPLOYMENT_END", durationYears: 10, disposition: "REVIEW", version: 1,
  }), "Personnel ten years. Retain for 10 years from employment end; final disposition: review.");
  assert.equal(retentionPolicySummary({
    id: "retention-2", code: "PERMANENT", name: "Permanent archive", description: "Approved schedule",
    trigger: "PERMANENT", durationYears: null, disposition: "PERMANENT", version: 1,
  }), "Permanent archive. Retain permanently.");
});

test("legacy box locators normalize consistently and catalogue administration is restricted", () => {
  assert.equal(normalizedLegacyKey(["Secret Registry", "Personnel Files", "Box 12", "Volume 2"]), "secret-registry:personnel-files:box-12:volume-2");
  assert.equal(canManageRecordsCatalogue(UserRole.RECORDS_ADMIN), true);
  assert.equal(canManageRecordsCatalogue(UserRole.SYSTEM_ADMIN), true);
  assert.equal(canManageRecordsCatalogue(UserRole.OFFICER), false);
});
