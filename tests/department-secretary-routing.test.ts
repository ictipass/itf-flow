import assert from "node:assert/strict";
import test from "node:test";
import { Classification, UserRole } from "../lib/generated/prisma/client";
import {
  departmentIdentity,
  routingClassification,
  shouldCopyDepartmentSecretary,
  validateConfidentialRoute,
} from "../lib/department-secretaries";

test("department identity prefers the immutable Workspace department ID", () => {
  assert.deepEqual(
    departmentIdentity({ department: "ICT", workspaceDepartmentId: "dept_ict" }),
    { key: "workspace:dept_ict", name: "ICT" },
  );
  assert.deepEqual(
    departmentIdentity({ department: " Human Resources ", workspaceDepartmentId: null }),
    { key: "name:human resources", name: "Human Resources" },
  );
});

test("DG and Directors automatically copy destination secretaries only for unrestricted distribution", () => {
  assert.equal(shouldCopyDepartmentSecretary(UserRole.DG, Classification.INTERNAL), true);
  assert.equal(shouldCopyDepartmentSecretary(UserRole.DIRECTOR, Classification.PUBLIC), true);
  assert.equal(shouldCopyDepartmentSecretary(UserRole.DG, Classification.CONFIDENTIAL), false);
  assert.equal(shouldCopyDepartmentSecretary(UserRole.DIRECTOR, Classification.SECRET), false);
  assert.equal(shouldCopyDepartmentSecretary(UserRole.UNIT_HEAD, Classification.INTERNAL), false);
});

test("confidential DG routing is Director-only and never permits copies", () => {
  assert.throws(() => validateConfidentialRoute({ actorRole: UserRole.DG, classification: Classification.CONFIDENTIAL, actionRecipientRoles: [UserRole.DIVISION_HEAD], explicitCopyCount: 0 }), /Director/);
  assert.throws(() => validateConfidentialRoute({ actorRole: UserRole.DIRECTOR, classification: Classification.CONFIDENTIAL, actionRecipientRoles: [UserRole.DIVISION_HEAD], explicitCopyCount: 1 }), /copy recipients/);
  assert.doesNotThrow(() => validateConfidentialRoute({ actorRole: UserRole.DG, classification: Classification.CONFIDENTIAL, actionRecipientRoles: [UserRole.DIRECTOR], explicitCopyCount: 0 }));
});

test("only DG and Directors can raise unrestricted correspondence to Confidential while routing", () => {
  assert.equal(routingClassification({ actorRole: UserRole.DG, current: Classification.INTERNAL, requested: Classification.CONFIDENTIAL }), Classification.CONFIDENTIAL);
  assert.equal(routingClassification({ actorRole: UserRole.DIRECTOR, current: Classification.PUBLIC, requested: Classification.CONFIDENTIAL }), Classification.CONFIDENTIAL);
  assert.throws(() => routingClassification({ actorRole: UserRole.UNIT_HEAD, current: Classification.INTERNAL, requested: Classification.CONFIDENTIAL }), /DG or a Director/);
  assert.throws(() => routingClassification({ actorRole: UserRole.DIRECTOR, current: Classification.CONFIDENTIAL, requested: Classification.INTERNAL }), /DG or a Director/);
});
