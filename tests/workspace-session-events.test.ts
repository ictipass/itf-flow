import assert from "node:assert/strict";
import test from "node:test";
import {
  sessionRevocationSelector,
  workspaceSessionEventSchema,
} from "../lib/workspace-session-event-contract";

const baseEvent = {
  version: "itf-workspace-session-event-v1",
  eventId: "f1a83545-6687-4aec-8644-c38d4e7f2722",
  type: "CENTRAL_LOGOUT",
  workspaceUserId: "workspace-user-1",
  workspaceSessionId: "workspace-session-1",
  targetAppSlug: "itf-flow",
  occurredAt: "2026-08-23T12:00:00.000Z",
  reason: "USER_SIGN_OUT",
} as const;

test("accepts the versioned Workspace central-logout contract", () => {
  const event = workspaceSessionEventSchema.parse(baseEvent);
  assert.deepEqual(sessionRevocationSelector("flow-user-1", event), {
    userId: "flow-user-1",
    revokedAt: null,
    workspaceSessionId: "workspace-session-1",
  });
});

test("entitlement revocation targets every active Flow session for the user", () => {
  const event = workspaceSessionEventSchema.parse({
    ...baseEvent,
    type: "ENTITLEMENT_REVOKED",
    workspaceSessionId: undefined,
  });
  assert.deepEqual(sessionRevocationSelector("flow-user-1", event), {
    userId: "flow-user-1",
    revokedAt: null,
  });
});

test("rejects malformed, unversioned and non-UUID events", () => {
  assert.equal(workspaceSessionEventSchema.safeParse({ ...baseEvent, version: "v0" }).success, false);
  assert.equal(workspaceSessionEventSchema.safeParse({ ...baseEvent, eventId: "repeatable-id" }).success, false);
  assert.equal(workspaceSessionEventSchema.safeParse({ ...baseEvent, targetAppSlug: "ITF Flow" }).success, false);
});
