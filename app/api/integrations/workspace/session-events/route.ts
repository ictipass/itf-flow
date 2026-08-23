import { NextResponse } from "next/server";
import { IntegrationEventType } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { correlationId, serviceAuthorized } from "@/lib/integration-auth";
import {
  sessionRevocationSelector,
  workspaceSessionEventSchema,
} from "@/lib/workspace-session-event-contract";

export async function POST(request: Request) {
  const requestCorrelationId = correlationId(request);
  const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "X-Correlation-Id": requestCorrelationId, "Cache-Control": "no-store" } });
  if (!serviceAuthorized(request)) return response({ error: "Unauthorized" }, 401);
  const parsed = workspaceSessionEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: "Invalid session event", details: parsed.error.flatten() }, 400);
  const expectedAppSlug = process.env.WORKSPACE_APP_SLUG?.trim() || "itf-flow";
  if (parsed.data.targetAppSlug !== expectedAppSlug) {
    return response({ error: "Session event is not addressed to this application." }, 400);
  }

  const result = await db.$transaction(async (tx) => {
    const inserted = await tx.integrationEvent.createMany({
      data: [{
        eventId: parsed.data.eventId,
        correlationId: requestCorrelationId,
        source: "itf-workspace",
        type: parsed.data.type === "CENTRAL_LOGOUT"
          ? IntegrationEventType.CENTRAL_LOGOUT
          : IntegrationEventType.ENTITLEMENT_REVOKED,
        workspaceUserId: parsed.data.workspaceUserId,
        metadata: {
          workspaceSessionId: parsed.data.workspaceSessionId,
          targetAppSlug: parsed.data.targetAppSlug,
          occurredAt: parsed.data.occurredAt,
          reason: parsed.data.reason,
        },
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { duplicate: true, matchedSessions: 0 };

    const user = await tx.user.findUnique({
      where: { workspaceUserId: parsed.data.workspaceUserId },
    });
    if (!user) return { duplicate: false, matchedSessions: 0 };

    const sessions = await tx.staffSession.updateMany({
      where: sessionRevocationSelector(user.id, parsed.data),
      data: { revokedAt: new Date(), revocationReason: parsed.data.reason },
    });
    if (parsed.data.type === "ENTITLEMENT_REVOKED") {
      await tx.user.update({ where: { id: user.id }, data: { isActive: false } });
    }
    await tx.integrationEvent.update({
      where: { eventId: parsed.data.eventId },
      data: {
        userId: user.id,
        metadata: {
          workspaceSessionId: parsed.data.workspaceSessionId,
          targetAppSlug: parsed.data.targetAppSlug,
          occurredAt: parsed.data.occurredAt,
          reason: parsed.data.reason,
          matchedSessions: sessions.count,
        },
      },
    });
    return { duplicate: false, matchedSessions: sessions.count };
  });
  return response({ accepted: true, ...result });
}
