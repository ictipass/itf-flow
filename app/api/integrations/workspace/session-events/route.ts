import { NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationEventType } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { correlationId, serviceAuthorized } from "@/lib/integration-auth";

const schema = z.object({
  version: z.literal("itf-workspace-session-event-v1"),
  eventId: z.string().min(8).max(200),
  type: z.enum(["CENTRAL_LOGOUT", "ENTITLEMENT_REVOKED"]),
  workspaceUserId: z.string().min(1).max(200),
  workspaceSessionId: z.string().min(1).max(200).optional(),
  reason: z.string().min(3).max(500),
});

export async function POST(request: Request) {
  const requestCorrelationId = correlationId(request);
  const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "X-Correlation-Id": requestCorrelationId, "Cache-Control": "no-store" } });
  if (!serviceAuthorized(request)) return response({ error: "Unauthorized" }, 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: "Invalid session event", details: parsed.error.flatten() }, 400);
  const duplicate = await db.integrationEvent.findUnique({ where: { eventId: parsed.data.eventId } });
  if (duplicate) return response({ accepted: true, duplicate: true, correlationId: duplicate.correlationId });
  const user = await db.user.findUnique({ where: { workspaceUserId: parsed.data.workspaceUserId } });
  if (!user) return response({ accepted: true, matchedSessions: 0 });
  const now = new Date();
  const where = { userId: user.id, revokedAt: null, ...(parsed.data.workspaceSessionId ? { workspaceSessionId: parsed.data.workspaceSessionId } : {}) };
  const result = await db.$transaction(async (tx) => {
    const sessions = await tx.staffSession.updateMany({ where, data: { revokedAt: now, revocationReason: parsed.data.reason } });
    if (parsed.data.type === "ENTITLEMENT_REVOKED") await tx.user.update({ where: { id: user.id }, data: { isActive: false } });
    await tx.integrationEvent.create({ data: { eventId: parsed.data.eventId, correlationId: requestCorrelationId, source: "itf-workspace", type: parsed.data.type === "CENTRAL_LOGOUT" ? IntegrationEventType.CENTRAL_LOGOUT : IntegrationEventType.ENTITLEMENT_REVOKED, userId: user.id, workspaceUserId: user.workspaceUserId, metadata: { workspaceSessionId: parsed.data.workspaceSessionId, reason: parsed.data.reason, matchedSessions: sessions.count } } });
    return sessions.count;
  });
  return response({ accepted: true, duplicate: false, matchedSessions: result });
}
