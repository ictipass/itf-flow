type WorkspaceNavigationEnvironment = Readonly<Record<string, string | undefined>>;

export type WorkspaceNavigationUrls = {
  workspaceOrigin: string;
  flowLogoutReturnUrl: string;
  globalLogoutUrl: string;
};

function parseAbsoluteUrl(name: string, value: string | undefined) {
  if (!value?.trim()) throw new Error(`${name} is required.`);
  try {
    return new URL(value.trim());
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

export function resolveWorkspaceNavigationUrls(
  environment: WorkspaceNavigationEnvironment = process.env
): WorkspaceNavigationUrls {
  const workspace = parseAbsoluteUrl(
    "NEXT_PUBLIC_WORKSPACE_URL",
    environment.NEXT_PUBLIC_WORKSPACE_URL
  );
  const flowLogoutReturn = parseAbsoluteUrl(
    "NEXT_PUBLIC_WORKSPACE_LOGOUT_URL",
    environment.NEXT_PUBLIC_WORKSPACE_LOGOUT_URL ??
      new URL("/dashboard/apps", workspace).toString()
  );

  if (environment.NODE_ENV === "production" && workspace.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_WORKSPACE_URL must use HTTPS in production.");
  }
  if (flowLogoutReturn.origin !== workspace.origin) {
    throw new Error(
      "NEXT_PUBLIC_WORKSPACE_LOGOUT_URL must use the configured Workspace origin."
    );
  }
  if (flowLogoutReturn.username || flowLogoutReturn.password || flowLogoutReturn.hash) {
    throw new Error(
      "NEXT_PUBLIC_WORKSPACE_LOGOUT_URL must not contain credentials or a fragment."
    );
  }

  return {
    workspaceOrigin: workspace.origin,
    flowLogoutReturnUrl: flowLogoutReturn.toString(),
    globalLogoutUrl: new URL("/logout", workspace).toString(),
  };
}
