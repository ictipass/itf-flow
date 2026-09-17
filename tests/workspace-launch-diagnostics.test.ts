import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { classifyWorkspaceLaunchFailure, validWorkspaceLaunchReference, WorkspaceLaunchFailure } from "../lib/workspace-launch-diagnostics";

test("launch diagnostics distinguish verification, provisioning, replay and session failure", () => {
  assert.equal(classifyWorkspaceLaunchFailure(new Error("Invalid Workspace launch token signature."), "VERIFY_TOKEN"), "SIGNATURE_INVALID");
  assert.equal(classifyWorkspaceLaunchFailure(new Error("Workspace launch claims are invalid."), "VERIFY_TOKEN"), "CLAIMS_INVALID");
  assert.equal(classifyWorkspaceLaunchFailure(new WorkspaceLaunchFailure("ROLE_MISMATCH"), "PROVISIONING"), "ROLE_MISMATCH");
  assert.equal(classifyWorkspaceLaunchFailure({ code: "P2002" }, "REDEMPTION"), "TOKEN_REPLAYED");
  assert.equal(classifyWorkspaceLaunchFailure({ code: "P2002" }, "PROVISIONING"), "PROVISIONING_FAILED");
  assert.equal(classifyWorkspaceLaunchFailure({ code: "P2028" }, "PROVISIONING"), "DATABASE_UNAVAILABLE");
  assert.equal(classifyWorkspaceLaunchFailure(new Error("SESSION_SECRET must contain at least 32 characters."), "CREATE_SESSION"), "SESSION_CREATION_FAILED");
});
test("launch diagnostics never return arbitrary error messages or staff credentials", () => {
  const error = new Error("secret token, staff@example.test, postgres://credentials");
  for (const stage of ["VERIFY_TOKEN", "PROVISIONING", "REDEMPTION", "CREATE_SESSION"] as const) {
    assert.doesNotMatch(classifyWorkspaceLaunchFailure(error, stage), /secret|postgres|@/);
  }
  assert.equal(validWorkspaceLaunchReference("f6f7ac6c-19e8-4f1a-8d43-e9e94bc83a3d"), true);
  for (const value of ["bad", ["f6f7ac6c-19e8-4f1a-8d43-e9e94bc83a3d"], "<script>"]) assert.equal(validWorkspaceLaunchReference(value), false);
});
test("receiver fails closed and logs only allow-listed metadata", async () => {
  const route = await readFile(new URL("../app/workspace/launch/route.ts", import.meta.url), "utf8");
  assert.match(route, /verifyWorkspaceToken\(token\)/);
  assert.match(route, /USER_INACTIVE/);
  assert.match(route, /ROLE_MISMATCH/);
  assert.match(route, /launchTokenRedemption\.create/);
  assert.match(route, /console\.error\(JSON\.stringify\(\{ event: "workspace_launch_failed", reference, stage, code: classifyWorkspaceLaunchFailure\(error, stage\) \}\)\)/);
  assert.doesNotMatch(route, /console\.(?:log|error)\([^\n]*(?:payload|token|error\.message)/);
});
