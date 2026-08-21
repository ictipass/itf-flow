import { NextResponse } from "next/server";
import { readinessSnapshot, recordOperationalEvent } from "@/lib/assurance";

export const dynamic = "force-dynamic";
export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const result = await readinessSnapshot();
    return NextResponse.json({ status: "ready", database: result.database, latencyMs: result.latencyMs, correlationId }, { headers: { "Cache-Control": "no-store", "X-Correlation-Id": correlationId } });
  } catch {
    await recordOperationalEvent({ severity: "CRITICAL", component: "readiness", eventType: "DEPENDENCY_UNAVAILABLE", message: "A required readiness dependency is unavailable.", correlationId });
    return NextResponse.json({ status: "unavailable", correlationId }, { status: 503, headers: { "Cache-Control": "no-store", "X-Correlation-Id": correlationId } });
  }
}
