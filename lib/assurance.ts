import { db } from "@/lib/db";
import { productionConfigurationIssues } from "@/lib/production-configuration";

export { productionConfigurationIssues } from "@/lib/production-configuration";

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
