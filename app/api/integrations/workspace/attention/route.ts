import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { IntegrationEventType, RecipientKind, WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { correlationId, serviceAuthorized } from "@/lib/integration-auth";

export async function GET(request: Request) {
  const requestCorrelationId = correlationId(request);
  const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "X-Correlation-Id": requestCorrelationId, "Cache-Control": "private, no-store" } });
  if (!serviceAuthorized(request)) return respond({ error: "Unauthorized" }, 401);
  const workspaceUserId = new URL(request.url).searchParams.get("workspaceUserId")?.trim();
  if (!workspaceUserId) return respond({ error: "workspaceUserId is required" }, 400);
  const user = await db.user.findUnique({ where: { workspaceUserId }, select: { id: true, isActive: true } });
  if (!user?.isActive) return respond({ version: "itf-flow-attention-v1", workspaceUserId, entitled: false, counts: { total: 0, unreadNotifications: 0, actionItems: 0, overdue: 0 } });
  const activeStatuses = [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED];
  const [unreadNotifications, actionItems, overdue] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.workItem.count({ where: { assigneeId: user.id, kind: RecipientKind.ACTION, status: { in: activeStatuses } } }),
    db.workItem.count({ where: { assigneeId: user.id, kind: RecipientKind.ACTION, status: { in: activeStatuses }, dueAt: { lt: new Date() } } }),
  ]);
  const total = unreadNotifications + actionItems;
  await db.integrationEvent.create({ data: { eventId: randomUUID(), correlationId: requestCorrelationId, source: "itf-workspace", type: IntegrationEventType.ATTENTION_QUERIED, userId: user.id, workspaceUserId, metadata: { total, unreadNotifications, actionItems, overdue } } });
  return respond({ version: "itf-flow-attention-v1", workspaceUserId, entitled: true, generatedAt: new Date().toISOString(), counts: { total, unreadNotifications, actionItems, overdue }, launchPath: "/workspace/launch" });
}
