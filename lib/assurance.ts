import { db } from "@/lib/db";

export function productionConfigurationIssues(env: NodeJS.ProcessEnv = process.env) {
  const issues: string[] = [];
  const required = ["SESSION_SECRET", "WORKSPACE_LAUNCH_TOKEN_SECRET", "WORKSPACE_DIRECTORY_SYNC_SECRET", "WORKSPACE_INTEROP_SECRET", "APPROVAL_SIGNING_SECRET", "EMAIL_WORKER_SECRET", "WORKFLOW_WORKER_SECRET", "DOCUMENT_WORKER_SECRET"];
  for (const name of required) if ((env[name]?.length ?? 0) < 32) issues.push(`${name} is missing or too short`);
  if ((env.DOCUMENT_STORAGE_PROVIDER ?? "LOCAL") === "LOCAL") issues.push("managed document storage is not configured");
  if (["DISABLED", "MOCK"].includes(env.DOCUMENT_SCANNER_PROVIDER ?? "DISABLED")) issues.push("a production malware scanner is not configured");
  if (["DISABLED", "MOCK"].includes(env.DOCUMENT_OCR_PROVIDER ?? "DISABLED")) issues.push("a production OCR provider is not configured");
  if (env.STAFF_LOCAL_LOGIN_ENABLED === "true") issues.push("local staff-password login is enabled");
  return issues;
}

export async function readinessSnapshot() {
  const startedAt = Date.now();
  await db.$queryRaw`SELECT 1`;
  const [required, unresolved, failed, expired] = await Promise.all([
    db.assuranceCheck.count({ where: { required: true } }),
    db.assuranceCheck.count({ where: { required: true, status: { not: "PASSED" } } }),
    db.assuranceCheck.count({ where: { required: true, status: "FAILED" } }),
    db.assuranceCheck.count({ where: { required: true, status: "PASSED", expiresAt: { lt: new Date() } } }),
  ]);
  const configurationIssues = productionConfigurationIssues();
  return { database: "reachable" as const, latencyMs: Date.now() - startedAt, assurance: { required, unresolved, failed, expired }, configurationIssues, productionReady: unresolved === 0 && expired === 0 && configurationIssues.length === 0 };
}

export async function recordOperationalEvent(input: { severity: "INFO" | "WARN" | "ERROR" | "CRITICAL"; component: string; eventType: string; message: string; correlationId?: string; metadata?: Record<string, string | number | boolean | null> }) {
  try { await db.operationalEvent.create({ data: input }); } catch (error) { console.error("Operational event persistence failed", error); }
}
