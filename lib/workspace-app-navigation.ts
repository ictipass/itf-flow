import "server-only";

import { randomUUID } from "node:crypto";
import {
  parseWorkspaceAppNavigationResponse,
  WORKSPACE_APP_NAVIGATION_VERSION,
} from "@/lib/workspace-app-navigation-contract";

type NavigationEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveWorkspaceAppNavigationConfiguration(
  environment: NavigationEnvironment = process.env
) {
  const workspaceUrlValue = environment.NEXT_PUBLIC_WORKSPACE_URL?.trim();
  const secret = environment.WORKSPACE_APP_NAVIGATION_SECRET?.trim();
  if (!workspaceUrlValue) throw new Error("NEXT_PUBLIC_WORKSPACE_URL is required.");
  const workspaceUrl = new URL(workspaceUrlValue);
  if (
    environment.NODE_ENV === "production" &&
    workspaceUrl.protocol !== "https:"
  ) {
    throw new Error("NEXT_PUBLIC_WORKSPACE_URL must use HTTPS in production.");
  }
  if (!secret || secret.length < 32) {
    throw new Error("WORKSPACE_APP_NAVIGATION_SECRET is missing or too short.");
  }
  const configuredTimeout = Number(
    environment.WORKSPACE_APP_NAVIGATION_TIMEOUT_MS ?? "3000"
  );
  if (
    !Number.isInteger(configuredTimeout) ||
    configuredTimeout < 500 ||
    configuredTimeout > 10000
  ) {
    throw new Error(
      "WORKSPACE_APP_NAVIGATION_TIMEOUT_MS must be between 500 and 10000."
    );
  }
  return {
    workspaceOrigin: workspaceUrl.origin,
    endpoint: new URL(
      "/api/integrations/workspace/v1/app-navigation",
      workspaceUrl
    ).toString(),
    secret,
    timeoutMs: configuredTimeout,
  };
}

export async function fetchWorkspaceAppNavigation(input: {
  workspaceUserId: string;
  workspaceSessionId: string;
}) {
  const configuration = resolveWorkspaceAppNavigationConfiguration();
  const requestId = randomUUID();
  const response = await fetch(configuration.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.secret}`,
      "Content-Type": "application/json",
      "X-Correlation-Id": requestId,
    },
    body: JSON.stringify({
      version: WORKSPACE_APP_NAVIGATION_VERSION,
      requestId,
      sourceAppSlug: process.env.WORKSPACE_APP_SLUG?.trim() || "itf-flow",
      workspaceUserId: input.workspaceUserId,
      workspaceSessionId: input.workspaceSessionId,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(configuration.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Workspace navigation request failed with ${response.status}.`);
  }
  return parseWorkspaceAppNavigationResponse(
    await response.json(),
    requestId,
    configuration.workspaceOrigin
  );
}
