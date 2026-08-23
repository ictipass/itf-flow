import assert from "node:assert/strict";
import test from "node:test";
import { Classification, UserRole } from "../lib/generated/prisma/client";
import { productionConfigurationIssues } from "../lib/production-configuration";
import { canDispatch, canReadClassification, canRegister } from "../lib/permissions";
import { localStaffLoginEnabled } from "../lib/authentication-policy";

test("SECRET correspondence is restricted to privileged roles", () => {
  assert.equal(canReadClassification(UserRole.OFFICER, Classification.SECRET), false);
  assert.equal(canReadClassification(UserRole.DG, Classification.SECRET), true);
  assert.equal(canReadClassification(UserRole.SYSTEM_ADMIN, Classification.SECRET), true);
});

test("registration and dispatch remain restricted", () => {
  assert.equal(canRegister(UserRole.OFFICER), false);
  assert.equal(canDispatch(UserRole.OFFICER), false);
  assert.equal(canRegister(UserRole.RECORDS_ADMIN), true);
  assert.equal(canDispatch(UserRole.DG_SECRETARY), true);
});

test("production configuration detects unsafe document adapters", () => {
  const secret = "x".repeat(40);
  const env = { SESSION_SECRET: secret, WORKSPACE_LAUNCH_ISSUER: "https://workspace.example.test", WORKSPACE_LAUNCH_AUDIENCE: "itf-flow", WORKSPACE_LAUNCH_JWKS_URL: "https://workspace.example.test/api/integrations/workspace/v2/jwks", WORKSPACE_DIRECTORY_SYNC_SECRET: secret, WORKSPACE_INTEROP_SECRET: secret, APPROVAL_SIGNING_SECRET: secret, EMAIL_WORKER_SECRET: secret, WORKFLOW_WORKER_SECRET: secret, DOCUMENT_WORKER_SECRET: secret, DOCUMENT_STORAGE_PROVIDER: "LOCAL", DOCUMENT_SCANNER_PROVIDER: "MOCK", DOCUMENT_OCR_PROVIDER: "DISABLED" } as unknown as NodeJS.ProcessEnv;
  const issues = productionConfigurationIssues(env);
  assert.equal(issues.length, 3);
  assert.ok(issues.some((issue) => issue.includes("malware")));
});

test("local staff-password login defaults off in production", () => {
  assert.equal(localStaffLoginEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
  assert.equal(localStaffLoginEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv), true);
  assert.equal(localStaffLoginEnabled({ NODE_ENV: "production", STAFF_LOCAL_LOGIN_ENABLED: "true" } as NodeJS.ProcessEnv), true);
});
