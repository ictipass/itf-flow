"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ActorType,
  AvailabilityStatus,
  EventType,
  NotificationType,
  RecipientKind,
  UserRole,
  WorkItemStatus,
  WorkPurpose,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { departmentIdentity } from "@/lib/department-secretaries";
import { enqueueNotifications } from "@/lib/notifications";
import { resolveContinuityAssignments } from "@/lib/office-continuity";
import { requireUser } from "@/lib/session";

const planSchema = z.object({
  directorId: z.string().min(1),
  firstSuccessorId: z.string().min(1),
  secondSuccessorId: z.string().min(1),
  reason: z.string().trim().min(10).max(500),
});

export async function configureContinuityPlanAction(formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/continuity?error=validation");
  const ids = [parsed.data.directorId, parsed.data.firstSuccessorId, parsed.data.secondSuccessorId];
  if (new Set(ids).size !== 3) redirect("/admin/continuity?error=distinct");
  const staff = await db.user.findMany({ where: { id: { in: ids }, isActive: true } });
  const byId = new Map(staff.map((user) => [user.id, user]));
  const director = byId.get(parsed.data.directorId);
  const first = byId.get(parsed.data.firstSuccessorId);
  const second = byId.get(parsed.data.secondSuccessorId);
  if (!director || !first || !second || director.role !== UserRole.DIRECTOR) redirect("/admin/continuity?error=staff");
  const department = departmentIdentity(director);
  if (!department || departmentIdentity(first)?.key !== department.key || departmentIdentity(second)?.key !== department.key) {
    redirect("/admin/continuity?error=department");
  }
  const firstCanApprove = formData.get("firstCanApprove") === "on";
  const secondCanApprove = formData.get("secondCanApprove") === "on";
  await db.$transaction(async (tx) => {
    const current = await tx.directorateContinuityPlan.findUnique({ where: { directorId: director.id } });
    const saved = await tx.directorateContinuityPlan.upsert({
      where: { directorId: director.id },
      create: {
        departmentKey: department.key,
        departmentName: department.name,
        directorId: director.id,
        firstSuccessorId: first.id,
        secondSuccessorId: second.id,
        firstCanApprove,
        secondCanApprove,
        reason: parsed.data.reason,
        configuredById: actor.id,
      },
      update: {
        departmentKey: department.key,
        departmentName: department.name,
        firstSuccessorId: first.id,
        secondSuccessorId: second.id,
        firstCanApprove,
        secondCanApprove,
        reason: parsed.data.reason,
        configuredById: actor.id,
        isActive: true,
        version: { increment: 1 },
      },
    });
    await tx.configurationChange.create({ data: {
      setting: `directorateContinuity:${department.key}`,
      previousValue: current ? JSON.stringify({ directorId: current.directorId, firstSuccessorId: current.firstSuccessorId, secondSuccessorId: current.secondSuccessorId, version: current.version, isActive: current.isActive }) : "UNASSIGNED",
      newValue: JSON.stringify({ directorId: saved.directorId, firstSuccessorId: saved.firstSuccessorId, secondSuccessorId: saved.secondSuccessorId, version: saved.version, isActive: saved.isActive }),
      reason: parsed.data.reason,
      changedById: actor.id,
    } });
  });
  revalidatePath("/admin/continuity");
  revalidatePath("/continuity");
  redirect("/admin/continuity?saved=1");
}

async function handOffOpenWork(userId: string, actorId: string) {
  const plans = await db.directorateContinuityPlan.findMany({
    where: { isActive: true, OR: [{ directorId: userId }, { firstSuccessorId: userId }] },
  });
  let moved = 0;
  let stalled = 0;
  for (const plan of plans) {
    const items = await db.workItem.findMany({
      where: {
        assigneeId: userId,
        kind: RecipientKind.ACTION,
        status: WorkItemStatus.OPEN,
        OR: userId === plan.directorId
          ? [{ continuityPlanId: null }, { continuityPlanId: plan.id }]
          : [{ continuityPlanId: plan.id }],
      },
      include: { correspondence: true },
    });
    const director = await db.user.findUnique({ where: { id: plan.directorId } });
    if (!director) continue;
    for (const item of items) {
      try {
        const resolved = await resolveContinuityAssignments({
          intendedRecipients: [director],
          classification: item.correspondence.classification,
          requireApproval: item.purpose === WorkPurpose.APPROVAL,
        });
        const assignment = resolved.assignments[0];
        if (assignment.assignee.id === userId) continue;
        await db.$transaction(async (tx) => {
          const update = await tx.workItem.updateMany({
            where: { id: item.id, assigneeId: userId, status: WorkItemStatus.OPEN },
            data: {
              assigneeId: assignment.assignee.id,
              authorityPrincipalId: director.id,
              continuityPlanId: plan.id,
              continuityRank: assignment.rank,
              continuityCanApprove: assignment.canApprove,
            },
          });
          if (!update.count) return;
          const oversight = await tx.workItem.findFirst({
            where: { correspondenceId: item.correspondenceId, assigneeId: director.id, kind: RecipientKind.OVERSIGHT, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
          });
          if (!oversight) await tx.workItem.create({ data: {
            correspondenceId: item.correspondenceId,
            assigneeId: director.id,
            kind: RecipientKind.OVERSIGHT,
            instruction: "Read-only oversight while your next-in-line officer handles this correspondence.",
            dueAt: item.dueAt,
          } });
          await tx.correspondence.updateMany({ where: { id: item.correspondenceId, currentOwnerId: userId }, data: { currentOwnerId: assignment.assignee.id } });
          await tx.correspondenceEvent.create({ data: {
            correspondenceId: item.correspondenceId,
            actorId,
            actorType: ActorType.STAFF,
            type: EventType.FORWARDED,
            fromStatus: item.correspondence.status,
            toStatus: item.correspondence.status,
            minute: `Automatically handed to the ${assignment.rank === 1 ? "first" : "second"} next-in-line officer after an availability change.`,
            metadata: { continuityPlanId: plan.id, continuityPlanVersion: plan.version, directorId: director.id, previousHandlerId: userId, handlerId: assignment.assignee.id, continuityRank: assignment.rank },
          } });
          await enqueueNotifications(tx, [{
            userId: assignment.assignee.id,
            actorId,
            type: NotificationType.ASSIGNED,
            title: "Continuity assignment received",
            message: `${item.correspondence.referenceNumber} was automatically assigned to you for the Director's office.`,
            href: `/correspondence/${item.correspondenceId}`,
            sourceType: "CONTINUITY_HANDOFF",
            sourceId: item.id,
          }]);
          moved += 1;
        });
      } catch {
        stalled += 1;
      }
    }
  }
  return { moved, stalled };
}

export async function setOwnAvailabilityAction(formData: FormData) {
  const actor = await requireUser();
  const parsed = z.object({
    status: z.enum(AvailabilityStatus),
    reason: z.string().trim().min(10).max(500),
    unavailableUntil: z.string().optional(),
  }).safeParse({ status: formData.get("status"), reason: formData.get("reason"), unavailableUntil: formData.get("unavailableUntil") || undefined });
  if (!parsed.success) redirect("/continuity?error=validation");
  const membership = await db.directorateContinuityPlan.count({
    where: { isActive: true, OR: [{ directorId: actor.id }, { firstSuccessorId: actor.id }, { secondSuccessorId: actor.id }] },
  });
  if (!membership) redirect("/continuity?error=unauthorized");
  const unavailableUntil = parsed.data.status === AvailabilityStatus.UNAVAILABLE && parsed.data.unavailableUntil
    ? new Date(parsed.data.unavailableUntil)
    : null;
  if (unavailableUntil && (Number.isNaN(unavailableUntil.valueOf()) || unavailableUntil <= new Date())) redirect("/continuity?error=date");
  await db.$transaction(async (tx) => {
    await tx.staffAvailability.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, status: parsed.data.status, reason: parsed.data.reason, unavailableUntil, changedById: actor.id },
      update: { status: parsed.data.status, reason: parsed.data.reason, unavailableUntil, changedById: actor.id, changedAt: new Date() },
    });
    await tx.staffAvailabilityEvent.create({ data: { userId: actor.id, actorId: actor.id, status: parsed.data.status, reason: parsed.data.reason, unavailableUntil } });
  });
  const result = parsed.data.status === AvailabilityStatus.UNAVAILABLE
    ? await handOffOpenWork(actor.id, actor.id)
    : { moved: 0, stalled: 0 };
  revalidatePath("/continuity");
  revalidatePath("/inbox");
  redirect(`/continuity?saved=1&moved=${result.moved}&stalled=${result.stalled}`);
}
