import { resolveWorkspaceLaunchReceiverConfiguration } from "@/lib/workspace-token";
import { resolveWorkspaceNavigationUrls } from "@/lib/workspace-navigation-urls";

export function productionConfigurationIssues(env: NodeJS.ProcessEnv = process.env) {
  const issues: string[] = [];
  const required = ["SESSION_SECRET", "WORKSPACE_DIRECTORY_SYNC_SECRET", "WORKSPACE_INTEROP_SECRET", "WORKSPACE_APP_NAVIGATION_SECRET", "APPROVAL_SIGNING_SECRET", "EMAIL_WORKER_SECRET", "WORKFLOW_WORKER_SECRET", "DOCUMENT_WORKER_SECRET"];
  for (const name of required) if ((env[name]?.length ?? 0) < 32) issues.push(`${name} is missing or too short`);
  try {
    resolveWorkspaceLaunchReceiverConfiguration({ ...env, NODE_ENV: "production" } as NodeJS.ProcessEnv);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Workspace launch receiver configuration is invalid");
  }
  try {
    resolveWorkspaceNavigationUrls({ ...env, NODE_ENV: "production" });
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Workspace navigation configuration is invalid");
  }
  const storageProvider = (env.DOCUMENT_STORAGE_PROVIDER ?? "LOCAL").trim().toUpperCase();
  if (storageProvider === "LOCAL") issues.push("managed document storage is not configured");
  else if (storageProvider === "VERCEL_BLOB" && !env.BLOB_READ_WRITE_TOKEN?.trim()) issues.push("BLOB_READ_WRITE_TOKEN is missing for private Vercel Blob storage");
  else if (storageProvider !== "VERCEL_BLOB") issues.push(`unsupported document storage provider: ${storageProvider}`);
  if (["DISABLED", "MOCK"].includes(env.DOCUMENT_SCANNER_PROVIDER ?? "DISABLED")) issues.push("a production malware scanner is not configured");
  if (["DISABLED", "MOCK"].includes(env.DOCUMENT_OCR_PROVIDER ?? "DISABLED")) issues.push("a production OCR provider is not configured");
  if (env.STAFF_LOCAL_LOGIN_ENABLED === "true") issues.push("local staff-password login is enabled");
  return issues;
}
