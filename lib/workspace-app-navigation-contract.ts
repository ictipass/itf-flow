import { z } from "zod";

export const WORKSPACE_APP_NAVIGATION_VERSION =
  "itf-workspace-app-navigation-v1" as const;

const appIconKeySchema = z.enum([
  "app-window",
  "workflow",
  "wallet-cards",
  "graduation-cap",
  "users-round",
  "briefcase-business",
  "chart-combined",
  "shield-check",
  "clipboard-check",
  "file-text",
  "database",
  "wrench",
  "building",
  "hand-coins",
  "megaphone",
  "landmark",
]);

export const workspaceAppNavigationResponseSchema = z.object({
  version: z.literal(WORKSPACE_APP_NAVIGATION_VERSION),
  requestId: z.uuid(),
  generatedAt: z.iso.datetime(),
  apps: z.array(
    z.object({
      id: z.string().min(1).max(200),
      name: z.string().min(1).max(200),
      slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
      icon: appIconKeySchema,
      category: z.string().min(1).max(64),
      launchUrl: z.url(),
    })
  ).max(500),
});

export type WorkspaceAppNavigationResponse = z.infer<
  typeof workspaceAppNavigationResponseSchema
>;
export type WorkspaceNavigationApp = WorkspaceAppNavigationResponse["apps"][number];

export function parseWorkspaceAppNavigationResponse(
  value: unknown,
  expectedRequestId: string,
  workspaceOrigin: string
) {
  const parsed = workspaceAppNavigationResponseSchema.parse(value);
  if (parsed.requestId !== expectedRequestId) {
    throw new Error("Workspace navigation response request ID does not match.");
  }

  const expectedOrigin = new URL(workspaceOrigin).origin;
  for (const app of parsed.apps) {
    const launchUrl = new URL(app.launchUrl);
    if (
      launchUrl.origin !== expectedOrigin ||
      !/^\/dashboard\/apps\/[^/]+\/launch$/.test(launchUrl.pathname) ||
      launchUrl.search ||
      launchUrl.hash
    ) {
      throw new Error("Workspace navigation response contains an invalid launch URL.");
    }
  }
  return parsed;
}
