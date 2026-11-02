import assert from "node:assert/strict";
import test from "node:test";
import { Classification, CorrespondenceType, RecordCategory, RegistryScope, UltimateRecipientType } from "../lib/generated/prisma/client";
import { parseFilingInput, recordStorageSegment, registryCanRead, resolveUltimateRecipient } from "../lib/records-governance";

const actor = { id: "staff-1", name: "Staff One", department: "ICT", office: "Headquarters", workspaceDepartmentId: "dept-ict", staffNumber: "06579" };

test("official filing separates personnel subject from creator and organizational ownership", () => {
  const personnel = new FormData();
  personnel.set("recordCategory", RecordCategory.PERSONNEL);
  personnel.set("filePlanCode", "HR/PERSONNEL/QUERY");
  personnel.set("retentionClass", "PERSONNEL-EMPLOYMENT");
  personnel.set("recordSubjectUserId", "staff-07712");
  assert.deepEqual(parseFilingInput(personnel, actor), {
    category: RecordCategory.PERSONNEL,
    filePlanCode: "HR/PERSONNEL/QUERY",
    retentionClass: "PERSONNEL-EMPLOYMENT",
    subjectUserId: "staff-07712",
    ownerOrgUnitKey: "workspace:dept-ict",
    ownerOrgUnitName: "ICT",
  });
  assert.throws(() => { const missing = new FormData(); missing.set("recordCategory", RecordCategory.PERSONNEL); missing.set("filePlanCode", "HR/PERSONNEL"); missing.set("retentionClass", "PERMANENT"); parseFilingInput(missing, actor); }, /identify the staff member/);
});

test("Blob record-file segment uses an immutable internal identifier", () => {
  assert.equal(recordStorageSegment("cm-file-123"), "file-cm-file-123");
  assert.equal(recordStorageSegment(null), "unfiled");
});

test("outgoing letters require a governed external email and printed address", async () => {
  const form = new FormData();
  form.set("ultimateRecipientName", "The Managing Director");
  form.set("ultimateRecipientOrganization", "Example Limited");
  form.set("ultimateRecipientEmail", "md@example.org");
  form.set("ultimateRecipientAddress", "1 Example Road, Abuja");
  assert.deepEqual(await resolveUltimateRecipient(form, CorrespondenceType.OUTGOING_LETTER), {
    ultimateRecipientType: UltimateRecipientType.EXTERNAL_PARTY,
    ultimateRecipientUserId: null,
    ultimateRecipientName: "The Managing Director",
    ultimateRecipientOrgUnitKey: null,
    ultimateRecipientOrgUnitName: null,
    ultimateRecipientOrganization: "Example Limited",
    ultimateRecipientEmail: "md@example.org",
    ultimateRecipientAddress: "1 Example Road, Abuja",
  });
  form.set("ultimateRecipientEmail", "not-an-email");
  await assert.rejects(() => resolveUltimateRecipient(form, CorrespondenceType.OUTGOING_LETTER), /valid email address/);
});

test("Open Registry excludes Confidential and Secret while Secret Registry permits all", () => {
  assert.equal(registryCanRead(RegistryScope.OPEN, Classification.PUBLIC), true);
  assert.equal(registryCanRead(RegistryScope.OPEN, Classification.INTERNAL), true);
  assert.equal(registryCanRead(RegistryScope.OPEN, Classification.CONFIDENTIAL), false);
  assert.equal(registryCanRead(RegistryScope.OPEN, Classification.SECRET), false);
  assert.equal(registryCanRead(RegistryScope.SECRET, Classification.SECRET), true);
});
