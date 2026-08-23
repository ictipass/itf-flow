import { resolveWorkspaceLaunchReceiverConfiguration } from "@/lib/workspace-token";

export function productionConfigurationIssues(env: NodeJS.ProcessEnv = process.env) {
  const issues: string[] = [];
  const required = ["SESSION_SECRET", "WORKSPACE_DIRECTORY_SYNC_SECRET", "WORKSPACE_INTEROP_SECRET", "APPROVAL_SIGNING_SECRET", "EMAIL_WORKER_SECRET", "WORKFLOW_WORKER_SECRET", "DOCUMENT_WORKER_SECRET"];
  for (const name of required) if ((env[name]?.length ?? 0) < 32) issues.push(`${name} is missing or too short`);
  try {
    resolveWorkspaceLaunchReceiverConfiguration({ ...env, NODE_ENV: "production" } as NodeJS.ProcessEnv);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Workspace launch receiver configuration is invalid");
  }
  if ((env.DOCUMENT_STORAGE_PROVIDER ?? "LOCAL") === "LOCAL") issues.push("managed document storage is not configured");
  if (["DISABLED", "MOCK"].includes(env.DOCUMENT_SCANNER_PROVIDER ?? "DISABLED")) issues.push("a production malware scanner is not configured");
  if (["DISABLED", "MOCK"].includes(env.DOCUMENT_OCR_PROVIDER ?? "DISABLED")) issues.push("a production OCR provider is not configured");
  if (env.STAFF_LOCAL_LOGIN_ENABLED === "true") issues.push("local staff-password login is enabled");
  return issues;
}
