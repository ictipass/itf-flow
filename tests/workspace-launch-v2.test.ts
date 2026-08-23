import assert from "node:assert/strict";
import { generateKeyPairSync, sign as signBytes, type JsonWebKey } from "node:crypto";
import test from "node:test";

import {
  verifyWorkspaceTokenWithJwks,
  type WorkspaceLaunchReceiverConfiguration,
  type WorkspacePayload,
} from "../lib/workspace-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
const keyId = "workspace-test-key";
const publicJwk = {
  ...(publicKey.export({ format: "jwk" }) as JsonWebKey),
  kid: keyId,
  alg: "RS256",
  use: "sig",
};
const now = new Date("2026-08-23T12:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1000);
const configuration: WorkspaceLaunchReceiverConfiguration = {
  issuer: "https://workspace.example.test/",
  audience: "itf-flow",
  appSlug: "itf-flow",
  jwksUrl: "https://workspace.example.test/api/integrations/workspace/v2/jwks",
  ttlSeconds: 120,
  clockSkewSeconds: 30,
  stepUpSeconds: 600,
};

function payload(requiredAssurance: "STANDARD" | "SENSITIVE" = "STANDARD"): WorkspacePayload {
  return {
    version: "itf-workspace-launch-v2",
    iss: configuration.issuer,
    sub: "workspace-user-1",
    aud: configuration.audience,
    iat: nowSeconds,
    nbf: nowSeconds,
    exp: nowSeconds + 120,
    jti: "single-use-token-1",
    identity: {
      name: "Example Staff",
      email: "staff@example.test",
      staffNumber: "ITF-001",
      workspaceRole: "STAFF",
    },
    entitlement: {
      appId: "workspace-app-1",
      slug: "itf-flow",
      role: "OFFICER",
      requiredAssurance,
    },
    authentication: {
      workspaceSessionId: "workspace-session-1",
      methods: requiredAssurance === "SENSITIVE" ? ["pwd", "totp"] : ["pwd"],
      authenticatedAt: nowSeconds - 60,
      idleExpiresAt: nowSeconds + 1200,
      absoluteExpiresAt: nowSeconds + 10800,
      mfaAuthenticatedAt: requiredAssurance === "SENSITIVE" ? nowSeconds - 30 : undefined,
    },
  };
}

function tokenFor(value: WorkspacePayload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "itf-workspace-launch+jwt", kid: keyId })).toString("base64url");
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${header}.${body}`;
  const signature = signBytes("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
  return `${input}.${signature}`;
}

test("ITF Flow accepts a valid Workspace v2 assertion", () => {
  const verified = verifyWorkspaceTokenWithJwks(tokenFor(payload()), { keys: [publicJwk] }, configuration, now);
  assert.equal(verified.sub, "workspace-user-1");
  assert.equal(verified.entitlement.role, "OFFICER");
});

test("ITF Flow rejects tampering and an assertion for another audience", () => {
  const valid = tokenFor(payload());
  const finalCharacter = valid.at(-1);
  assert.throws(
    () => verifyWorkspaceTokenWithJwks(`${valid.slice(0, -1)}${finalCharacter === "a" ? "b" : "a"}`, { keys: [publicJwk] }, configuration, now),
    /signature/
  );
  const wrongAudience = payload();
  wrongAudience.aud = "another-app";
  assert.throws(
    () => verifyWorkspaceTokenWithJwks(tokenFor(wrongAudience), { keys: [publicJwk] }, configuration, now),
    /claims/
  );
});

test("ITF Flow applies fresh TOTP only to sensitive assertions", () => {
  assert.equal(
    verifyWorkspaceTokenWithJwks(tokenFor(payload("SENSITIVE")), { keys: [publicJwk] }, configuration, now).entitlement.requiredAssurance,
    "SENSITIVE"
  );
  const missingTotp = payload("SENSITIVE");
  missingTotp.authentication.methods = ["pwd"];
  missingTotp.authentication.mfaAuthenticatedAt = undefined;
  assert.throws(
    () => verifyWorkspaceTokenWithJwks(tokenFor(missingTotp), { keys: [publicJwk] }, configuration, now),
    /Fresh Workspace TOTP/
  );
});

test("ITF Flow rejects assertions after the approved skew window", () => {
  assert.throws(
    () => verifyWorkspaceTokenWithJwks(tokenFor(payload()), { keys: [publicJwk] }, configuration, new Date(now.getTime() + 151_000)),
    /timing/
  );
});

test("ITF Flow rejects expired or inverted upstream session bounds", () => {
  const expiredIdle = payload();
  expiredIdle.authentication.idleExpiresAt = nowSeconds;
  assert.throws(
    () => verifyWorkspaceTokenWithJwks(tokenFor(expiredIdle), { keys: [publicJwk] }, configuration, now),
    /timing/
  );
  const inverted = payload();
  inverted.authentication.idleExpiresAt = inverted.authentication.absoluteExpiresAt + 1;
  assert.throws(
    () => verifyWorkspaceTokenWithJwks(tokenFor(inverted), { keys: [publicJwk] }, configuration, now),
    /timing/
  );
});
