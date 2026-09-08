import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveWorkspaceNavigationUrls } from "../lib/workspace-navigation-urls";

describe("Workspace navigation URLs", () => {
  test("separates Flow-only return from global Workspace sign-out", () => {
    assert.deepEqual(
      resolveWorkspaceNavigationUrls({
        NODE_ENV: "production",
        NEXT_PUBLIC_WORKSPACE_URL: "https://workspace.example.test",
        NEXT_PUBLIC_WORKSPACE_LOGOUT_URL:
          "https://workspace.example.test/dashboard/apps",
      }),
      {
        workspaceOrigin: "https://workspace.example.test",
        workspaceLoginUrl: "https://workspace.example.test/login",
        flowLogoutReturnUrl: "https://workspace.example.test/dashboard/apps",
        globalLogoutUrl: "https://workspace.example.test/logout",
      }
    );
  });

  test("defaults Flow-only sign-out to the Workspace catalogue", () => {
    const urls = resolveWorkspaceNavigationUrls({
      NEXT_PUBLIC_WORKSPACE_URL: "http://localhost:3000",
    });
    assert.equal(urls.flowLogoutReturnUrl, "http://localhost:3000/dashboard/apps");
  });

  test("rejects insecure or cross-origin deployed destinations", () => {
    assert.throws(
      () =>
        resolveWorkspaceNavigationUrls({
          NODE_ENV: "production",
          NEXT_PUBLIC_WORKSPACE_URL: "http://workspace.example.test",
        }),
      /HTTPS/
    );
    assert.throws(
      () =>
        resolveWorkspaceNavigationUrls({
          NODE_ENV: "production",
          NEXT_PUBLIC_WORKSPACE_URL: "https://workspace.example.test",
          NEXT_PUBLIC_WORKSPACE_LOGOUT_URL: "https://attacker.example/collect",
        }),
      /configured Workspace origin/
    );
  });
});
