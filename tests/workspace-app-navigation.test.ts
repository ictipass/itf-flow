import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  parseWorkspaceAppNavigationResponse,
  WORKSPACE_APP_NAVIGATION_VERSION,
} from "../lib/workspace-app-navigation-contract";

const requestId = "caa55fef-730c-46c6-8fe6-57db80cf63c2";
const validResponse = {
  version: WORKSPACE_APP_NAVIGATION_VERSION,
  requestId,
  generatedAt: "2026-09-06T00:00:00.000Z",
  apps: [
    {
      id: "reimbursement-id",
      name: "Reimbursement",
      slug: "itf-reimbursement",
      icon: "wallet-cards",
      category: "FINANCE",
      launchUrl:
        "https://workspace.example.test/dashboard/apps/reimbursement-id/launch",
    },
  ],
};

describe("Workspace entitled-app navigation response", () => {
  test("accepts a request-bound Workspace launch link", () => {
    assert.deepEqual(
      parseWorkspaceAppNavigationResponse(
        validResponse,
        requestId,
        "https://workspace.example.test"
      ),
      validResponse
    );
  });

  test("rejects mismatched responses and non-Workspace launch URLs", () => {
    assert.throws(
      () =>
        parseWorkspaceAppNavigationResponse(
          validResponse,
          "037d528b-bf85-4982-9754-b3a56353ae8f",
          "https://workspace.example.test"
        ),
      /request ID/
    );
    assert.throws(
      () =>
        parseWorkspaceAppNavigationResponse(
          {
            ...validResponse,
            apps: [
              {
                ...validResponse.apps[0],
                launchUrl: "https://attacker.example/collect",
              },
            ],
          },
          requestId,
          "https://workspace.example.test"
        ),
      /invalid launch URL/
    );
  });

  test("rejects unapproved icon identifiers", () => {
    assert.throws(() =>
      parseWorkspaceAppNavigationResponse(
        {
          ...validResponse,
          apps: [{ ...validResponse.apps[0], icon: "<svg onload=alert(1)>" }],
        },
        requestId,
        "https://workspace.example.test"
      )
    );
  });
});
