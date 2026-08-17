import { Classification, NotificationType, RecipientKind, ScheduledAutomationStatus, UserRole, WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { enqueueNotifications, type NotificationDelivery } from "@/lib/notifications";

export const REMINDER_POLICY_ID = "default";
const JOB = "WORKFLOW_REMINDERS_AND_DIGESTS";

function localDate(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function safeReference(classification: Classification, reference: string) {
  return classification === Classification.SECRET || classification === Classification.CONFIDENTIAL ? "a classified correspondence item" : reference;
}

async function enqueueOne(delivery: NotificationDelivery) {
  const exists = await db.notification.findUnique({ where: { userId_sourceType_sourceId_type: { userId: delivery.userId, sourceType: delivery.sourceType, sourceId: delivery.sourceId, type: delivery.type } } });
  if (exists) return false;
  await db.$transaction((tx) => enqueueNotifications(tx, [delivery]));
  return true;
}

export async function getReminderPolicy() {
  const policy = await db.workflowReminderPolicy.findUnique({ where: { id: REMINDER_POLICY_ID }, include: { updatedBy: true } });
  if (!policy) throw new Error("Workflow reminder policy is unavailable. Apply the latest migration.");
  return policy;
}

export async function processWorkflowReminders(now = new Date()) {
  const run = await db.scheduledAutomationRun.create({ data: { job: JOB } });
  try {
    const policy = await getReminderPolicy();
    if (!policy.enabled) {
      await db.scheduledAutomationRun.update({ where: { id: run.id }, data: { status: ScheduledAutomationStatus.COMPLETED, completedAt: new Date() } });
      return { reminders: 0, overdue: 0, escalations: 0, digests: 0, disabled: true };
    }
    const reminderLimit = new Date(now.getTime() + policy.reminderLeadDays * 86_400_000);
    const escalationLimit = new Date(now.getTime() - policy.escalationAfterDays * 86_400_000);
    const items = await db.workItem.findMany({
      where: { kind: RecipientKind.ACTION, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] }, dueAt: { not: null } },
      include: { correspondence: true, assignee: { select: { id: true, name: true, supervisorId: true, department: true, workspaceDepartmentId: true } } },
      orderBy: { dueAt: "asc" }, take: 1000,
    });
    let reminders = 0, overdue = 0, escalations = 0, digests = 0;
    for (const item of items) {
      const dueAt = item.dueAt!;
      const reference = safeReference(item.correspondence.classification, item.correspondence.referenceNumber);
      const sourceVersion = `${item.id}:${dueAt.toISOString()}`;
      if (dueAt >= now && dueAt <= reminderLimit && await enqueueOne({ userId: item.assigneeId, type: NotificationType.DUE_SOON, title: "Correspondence due soon", message: `${reference} is due ${dueAt.toLocaleDateString("en-NG")}.`, href: `/correspondence/${item.correspondenceId}`, sourceType: "DUE_REMINDER", sourceId: sourceVersion, emailSubject: "ITF Flow: correspondence due soon", emailBody: `You have correspondence due ${dueAt.toLocaleDateString("en-NG")}. Open ITF Flow to review the controlled record.` })) reminders++;
      if (dueAt < now && await enqueueOne({ userId: item.assigneeId, type: NotificationType.OVERDUE, title: "Correspondence overdue", message: `${reference} passed its due date on ${dueAt.toLocaleDateString("en-NG")}.`, href: `/correspondence/${item.correspondenceId}`, sourceType: "OVERDUE_REMINDER", sourceId: sourceVersion, emailSubject: "ITF Flow: overdue correspondence", emailBody: `You have overdue correspondence with a due date of ${dueAt.toLocaleDateString("en-NG")}. Open ITF Flow to review the controlled record.` })) overdue++;
      if (dueAt <= escalationLimit && item.assignee.supervisorId && await enqueueOne({ userId: item.assignee.supervisorId, type: NotificationType.ESCALATED, title: "Overdue item escalated", message: `${item.assignee.name} has an overdue action on ${reference}.`, href: `/correspondence/${item.correspondenceId}`, sourceType: "OVERDUE_ESCALATION", sourceId: sourceVersion, emailSubject: "ITF Flow: overdue action escalation", emailBody: "A direct report has an overdue correspondence action. Open ITF Flow to review the controlled record." })) escalations++;
    }
    if (policy.executiveDigestEnabled) {
      const digestDate = localDate(now, policy.timeZone);
      const recipients = await db.user.findMany({ where: { isActive: true, role: { in: [UserRole.DG, UserRole.DIRECTOR, UserRole.DG_SECRETARY] } } });
      for (const recipient of recipients) {
        const scoped = recipient.role === UserRole.DG
          ? items
          : recipient.role === UserRole.DIRECTOR
            ? items.filter((item) => recipient.workspaceDepartmentId ? item.assignee.workspaceDepartmentId === recipient.workspaceDepartmentId : Boolean(recipient.department) && item.assignee.department === recipient.department)
            : items.filter((item) => item.assigneeId === recipient.id);
        const overdueCount = scoped.filter((item) => item.dueAt! < now).length;
        const dueSoonCount = scoped.filter((item) => item.dueAt! >= now && item.dueAt! <= reminderLimit).length;
        if (!overdueCount && !dueSoonCount) continue;
        if (await enqueueOne({ userId: recipient.id, type: NotificationType.DAILY_DIGEST, title: "Daily correspondence digest", message: `${overdueCount} overdue · ${dueSoonCount} due soon in your current scope.`, href: "/dashboard", sourceType: "EXECUTIVE_DIGEST", sourceId: `${recipient.id}:${digestDate}`, emailSubject: "ITF Flow daily correspondence digest", emailBody: `Daily ITF Flow summary: ${overdueCount} overdue and ${dueSoonCount} due soon. Open ITF Flow for authorized details.` })) digests++;
      }
    }
    const result = { reminders, overdue, escalations, digests, disabled: false };
    await db.scheduledAutomationRun.update({ where: { id: run.id }, data: { status: ScheduledAutomationStatus.COMPLETED, reminderCount: reminders, overdueCount: overdue, escalationCount: escalations, digestCount: digests, completedAt: new Date() } });
    return result;
  } catch (error) {
    await db.scheduledAutomationRun.update({ where: { id: run.id }, data: { status: ScheduledAutomationStatus.FAILED, errorCode: error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN", completedAt: new Date() } });
    throw error;
  }
}
