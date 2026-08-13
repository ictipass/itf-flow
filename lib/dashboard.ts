import { WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

export async function getDashboardData(userId: string) {
  const now = new Date();
  const [open, acknowledged, overdue, resolved, recent, unreadBroadcasts, pendingAcknowledgements, recentNotifications] = await Promise.all([
    db.workItem.count({ where: { assigneeId: userId, status: WorkItemStatus.OPEN } }),
    db.workItem.count({ where: { assigneeId: userId, status: WorkItemStatus.ACKNOWLEDGED } }),
    db.workItem.count({ where: { assigneeId: userId, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] }, dueAt: { lt: now } } }),
    db.workItem.count({ where: { assigneeId: userId, status: WorkItemStatus.COMPLETED } }),
    db.workItem.findMany({
      where: { assigneeId: userId, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
      include: { correspondence: true },
      orderBy: [{ dueAt: "asc" }, { assignedAt: "desc" }],
      take: 6,
    }),
    db.broadcastRecipient.count({ where: { userId, readAt: null, broadcast: { status: "PUBLISHED", AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] } } }),
    db.broadcastRecipient.count({ where: { userId, acknowledgedAt: null, broadcast: { status: "PUBLISHED", mandatoryAcknowledgement: true, AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] } } }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return { open, acknowledged, overdue, resolved, recent, unreadBroadcasts, pendingAcknowledgements, recentNotifications };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
