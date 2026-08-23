import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../lib/generated/prisma/client";
import {
  directoryBatchDigest,
  resolveProvisioningIdentity,
  provisioningChangeRequiresSessionRevocation,
  workspaceDirectoryBatchSchema,
} from "../lib/workspace-directory-contract";

const identity = {
  id: "flow-user-1",
  workspaceUserId: "workspace-user-1",
  email: "staff@example.test",
};

test("accepts a versioned and bounded Workspace directory batch", () => {
  const parsed = workspaceDirectoryBatchSchema.parse({
    version: "itf-workspace-directory-v1",
    requestId: "f1a83545-6687-4aec-8644-c38d4e7f2722",
    source: "itf-workspace",
    targetAppSlug: "itf-flow",
    batch: { index: 1, count: 1 },
    users: [{
      workspaceUserId: "workspace-user-1",
      staffNumber: "ITF-001",
      email: "STAFF@example.test",
      name: "Example Staff",
      role: "OFFICER",
      isActive: true,
      office: { id: "office-1", name: "Headquarters" },
      department: null,
      division: null,
      unit: null,
      position: null,
      supervisorWorkspaceUserId: null,
    }],
  });
  assert.equal(parsed.users[0].email, "staff@example.test");
});

test("prefers immutable Workspace identity and permits linking an unmapped email", () => {
  assert.deepEqual(resolveProvisioningIdentity("workspace-user-1", identity, identity), {
    operation: "update",
    userId: "flow-user-1",
  });
  assert.deepEqual(resolveProvisioningIdentity("workspace-user-1", null, {
    ...identity,
    workspaceUserId: null,
  }), { operation: "update", userId: "flow-user-1" });
});

test("rejects split or conflicting identity matches", () => {
  assert.throws(
    () => resolveProvisioningIdentity("workspace-user-1", identity, {
      id: "flow-user-2",
      workspaceUserId: null,
      email: "new@example.test",
    }),
    /conflicts/
  );
  assert.throws(
    () => resolveProvisioningIdentity("workspace-user-1", null, {
      ...identity,
      workspaceUserId: "workspace-user-2",
    }),
    /different immutable/
  );
});

test("requires session revocation for role changes and deactivation", () => {
  assert.equal(provisioningChangeRequiresSessionRevocation({
    previousRole: UserRole.OFFICER,
    nextRole: UserRole.DIRECTOR,
    previouslyActive: true,
    nextActive: true,
  }), true);
  assert.equal(provisioningChangeRequiresSessionRevocation({
    previousRole: UserRole.OFFICER,
    nextRole: UserRole.OFFICER,
    previouslyActive: true,
    nextActive: false,
  }), true);
  assert.equal(provisioningChangeRequiresSessionRevocation({
    previousRole: UserRole.OFFICER,
    nextRole: UserRole.OFFICER,
    previouslyActive: true,
    nextActive: true,
  }), false);
});

test("rejects malformed batch ordering and unversioned payloads", () => {
  const base = {
    version: "itf-workspace-directory-v1",
    requestId: "f1a83545-6687-4aec-8644-c38d4e7f2722",
    source: "itf-workspace",
    targetAppSlug: "itf-flow",
    batch: { index: 2, count: 1 },
    users: [{}],
  };
  assert.equal(workspaceDirectoryBatchSchema.safeParse(base).success, false);
  assert.equal(workspaceDirectoryBatchSchema.safeParse({ ...base, version: "legacy" }).success, false);
});

test("rejects duplicate immutable IDs or emails within one batch", () => {
  const user = {
    workspaceUserId: "workspace-user-1",
    staffNumber: "ITF-001",
    email: "staff@example.test",
    name: "Example Staff",
    role: "OFFICER",
    isActive: true,
    office: null,
    department: null,
    division: null,
    unit: null,
    position: null,
    supervisorWorkspaceUserId: null,
  };
  const result = workspaceDirectoryBatchSchema.safeParse({
    version: "itf-workspace-directory-v1",
    requestId: "f1a83545-6687-4aec-8644-c38d4e7f2722",
    source: "itf-workspace",
    targetAppSlug: "itf-flow",
    batch: { index: 1, count: 1 },
    users: [user, { ...user, staffNumber: "ITF-002" }],
  });
  assert.equal(result.success, false);
});

test("directory batch digest is stable and changes with the payload", () => {
  const parsed = workspaceDirectoryBatchSchema.parse({
    version: "itf-workspace-directory-v1",
    requestId: "f1a83545-6687-4aec-8644-c38d4e7f2722",
    source: "itf-workspace",
    targetAppSlug: "itf-flow",
    batch: { index: 1, count: 1 },
    users: [{
      workspaceUserId: "workspace-user-1",
      staffNumber: "ITF-001",
      email: "staff@example.test",
      name: "Example Staff",
      role: "OFFICER",
      isActive: true,
      office: null,
      department: null,
      division: null,
      unit: null,
      position: null,
      supervisorWorkspaceUserId: null,
    }],
  });
  assert.equal(directoryBatchDigest(parsed), directoryBatchDigest(parsed));
  assert.notEqual(
    directoryBatchDigest(parsed),
    directoryBatchDigest({ ...parsed, targetAppSlug: "another-app" })
  );
});
