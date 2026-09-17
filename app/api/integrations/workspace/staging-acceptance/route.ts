import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceAuthorized } from "@/lib/integration-auth";
import { stagingAcceptanceTarget, stagingObservationRequest } from "@/lib/workspace-staging-acceptance";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const target = stagingAcceptanceTarget();
  if (!target) return response({ error: "Not found" }, 404);
  if (!serviceAuthorized(request)) return response({ error: "Unauthorized" }, 401);
  const parsed = stagingObservationRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.workspaceUserId !== target) return response({ error: "Invalid diagnostic target" }, 400);
  const user = await db.user.findUnique({ where: { workspaceUserId: target }, select: { id: true, isActive: true } });
  const eventId = parsed.data.eventId ?? null;
  const event = eventId ? await db.integrationEvent.findFirst({
    where: { eventId, workspaceUserId: target, type: "ENTITLEMENT_REVOKED", source: "itf-workspace" },
    select: { metadata: true },
  }) : null;
  const reason = (event?.metadata as { reason?: unknown } | null)?.reason;
  const [activeSessions, unrevokedSessions, revokedSessions] = user ? await Promise.all([
    db.staffSession.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.staffSession.count({ where: { userId: user.id, revokedAt: null } }),
    typeof reason === "string" && /^STAGING_A01_(06|07):/.test(reason)
      ? db.staffSession.count({ where: { userId: user.id, revokedAt: { not: null }, revocationReason: reason } })
      : Promise.resolve(0),
  ]) : [0, 0, 0];
  return response({ version: "itf-workspace-staging-acceptance-v1", eventId, provisioned: Boolean(user),
    isActive: user?.isActive ?? false, activeSessions, unrevokedSessions, eventCount: event ? 1 : 0, revokedSessions });
}
