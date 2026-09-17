import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { allowedStagingEvent, stagingAcceptanceTarget, stagingObservationRequest, stagingAcceptanceConfigurationIssues } from "../lib/workspace-staging-acceptance";
const now = new Date("2026-09-17T12:00:00Z");
const env = { ITF_FLOW_DEPLOYMENT_STAGE: "staging", WORKSPACE_STAGING_ACCEPTANCE_ENABLED: "true", WORKSPACE_STAGING_ACCEPTANCE_USER_ID: "test-staff-id", WORKSPACE_STAGING_ACCEPTANCE_EXPIRES_AT: "2026-09-17T13:00:00Z" };
test("Flow acceptance is off by default and blocks production/expired windows", () => {
  assert.equal(stagingAcceptanceTarget(env, now), "test-staff-id");
  for (const altered of [ {}, { ...env, ITF_FLOW_DEPLOYMENT_STAGE: "production" }, { ...env, WORKSPACE_STAGING_ACCEPTANCE_ENABLED: "false" },
    { ...env, WORKSPACE_STAGING_ACCEPTANCE_USER_ID: "" }, { ...env, WORKSPACE_STAGING_ACCEPTANCE_EXPIRES_AT: now.toISOString() },
    { ...env, WORKSPACE_STAGING_ACCEPTANCE_EXPIRES_AT: "2026-09-19T13:00:00Z" },
  ]) assert.equal(stagingAcceptanceTarget(altered, now), null);
  assert.ok(stagingAcceptanceConfigurationIssues({ ...env, ITF_FLOW_DEPLOYMENT_STAGE: "production" }).length);
});
test("Flow diagnostic target and observation body are exact and bounded", () => {
  const current = { ...env, WORKSPACE_STAGING_ACCEPTANCE_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString() };
  const event = { workspaceUserId: "test-staff-id", reason: "STAGING_A01_07:f1a83545-6687-4aec-8644-c38d4e7f2722" };
  assert.equal(allowedStagingEvent(event, current), true);
  assert.equal(allowedStagingEvent({ ...event, workspaceUserId: "other-staff" }, current), false);
  assert.equal(allowedStagingEvent({ ...event, reason: "ACCESS_REVOKED" }, current), false);
  assert.equal(stagingObservationRequest.safeParse({ workspaceUserId: "test-staff-id", eventId: "f1a83545-6687-4aec-8644-c38d4e7f2722" }).success, true);
  assert.equal(stagingObservationRequest.safeParse({ workspaceUserId: "test-staff-id", eventId: "bad" }).success, false);
  assert.equal(stagingObservationRequest.safeParse({ workspaceUserId: "test-staff-id", arbitrary: true }).success, false);
});
test("receiver failure precedes side effects and observation endpoint cannot mutate", async () => {
  const [receiver, observation] = await Promise.all([
    readFile(new URL("../app/api/integrations/workspace/session-events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/integrations/workspace/staging-acceptance/route.ts", import.meta.url), "utf8"),
  ]);
  assert.ok(receiver.indexOf("serviceAuthorized(request)") < receiver.indexOf("if (faultRequested)"));
  assert.ok(receiver.indexOf("Bounded staging receiver failure") < receiver.indexOf("db.$transaction"));
  assert.match(observation, /serviceAuthorized\(request\)/);
  assert.match(observation, /workspaceUserId !== target/);
  assert.doesNotMatch(observation, /\.(create|createMany|update|updateMany|delete|deleteMany)\(/);
  assert.doesNotMatch(observation, /select: \{[^}]*email/);
});
