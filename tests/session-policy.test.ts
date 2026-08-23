import assert from "node:assert/strict";
import test from "node:test";
import { effectiveSessionExpiry } from "../lib/session-policy";

const now = new Date("2026-08-23T12:00:00.000Z");

test("caps a Flow session at the earlier Workspace expiry", () => {
  const upstream = new Date(now.getTime() + 10 * 60_000);
  assert.equal(effectiveSessionExpiry(now, 8 * 60 * 60, upstream).toISOString(), upstream.toISOString());
});

test("retains the shorter local maximum and rejects expired upstream sessions", () => {
  assert.equal(
    effectiveSessionExpiry(now, 8 * 60 * 60, new Date(now.getTime() + 12 * 60 * 60_000)).toISOString(),
    new Date(now.getTime() + 8 * 60 * 60_000).toISOString()
  );
  assert.throws(() => effectiveSessionExpiry(now, 3600, now), /expired/);
});
