"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DelegationEventType, DelegationKind, DelegationStatus, NotificationType, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { enqueueNotifications } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

const appointmentSchema = z.object({
  principalId: z.string().min(1),
  delegateId: z.string().min(1),
  kind: z.enum(DelegationKind),
  officeLabel: z.string().trim().min(3).max(150),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  reason: z.string().trim().min(10).max(1000),
  canApprove: z.boolean(),
});

export async function createDelegationAction(formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can create acting authority.");
  const parsed = appointmentSchema.parse({
    principalId: formData.get("principalId"), delegateId: formData.get("delegateId"), kind: formData.get("kind"),
    officeLabel: formData.get("officeLabel"), startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"),
    reason: formData.get("reason"), canApprove: formData.get("canApprove") === "on",
  });
  if (parsed.principalId === parsed.delegateId) throw new Error("A staff member cannot delegate authority to themselves.");
  if (parsed.endsAt <= parsed.startsAt) throw new Error("The end date must be later than the start date.");
  if (parsed.endsAt <= new Date()) throw new Error("The appointment must end in the future.");
  if (parsed.endsAt.getTime() - parsed.startsAt.getTime() > 366 * 24 * 60 * 60 * 1000) throw new Error("An appointment cannot exceed one year.");
  const [principal, delegate, overlap] = await Promise.all([
    db.user.findFirst({ where: { id: parsed.principalId, isActive: true } }),
    db.user.findFirst({ where: { id: parsed.delegateId, isActive: true } }),
    db.delegation.findFirst({ where: { principalId: parsed.principalId, delegateId: parsed.delegateId, status: DelegationStatus.ACTIVE, startsAt: { lte: parsed.endsAt }, endsAt: { gte: parsed.startsAt } } }),
  ]);
  if (!principal || !delegate) throw new Error("Select two active staff members.");
  if (overlap) throw new Error("An overlapping appointment already exists for these staff members.");
  await db.$transaction(async (tx) => {
    const appointment = await tx.delegation.create({ data: { ...parsed, createdById: actor.id } });
    await tx.delegationEvent.create({ data: { delegationId: appointment.id, actorId: actor.id, type: DelegationEventType.CREATED, reason: parsed.reason, metadata: { canApprove: parsed.canApprove, startsAt: parsed.startsAt, endsAt: parsed.endsAt } } });
    await enqueueNotifications(tx, [{ userId: delegate.id, actorId: actor.id, type: NotificationType.DELEGATION_ASSIGNED, title: parsed.kind === DelegationKind.ACTING_APPOINTMENT ? "Acting appointment assigned" : "Delegated authority assigned", message: `You may act for ${principal.name} from ${parsed.startsAt.toLocaleDateString("en-NG")} to ${parsed.endsAt.toLocaleDateString("en-NG")}.`, href: "/inbox?view=office", sourceType: "DELEGATION", sourceId: appointment.id }]);
  });
  revalidatePath("/admin/delegations"); revalidatePath("/inbox");
}

export async function revokeDelegationAction(formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can revoke acting authority.");
  const id = String(formData.get("delegationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) throw new Error("Give a revocation reason of at least 10 characters.");
  const appointment = await db.delegation.findFirst({ where: { id, status: DelegationStatus.ACTIVE }, include: { principal: true } });
  if (!appointment) throw new Error("This appointment is unavailable or already revoked.");
  await db.$transaction(async (tx) => {
    await tx.delegation.update({ where: { id }, data: { status: DelegationStatus.REVOKED, revokedAt: new Date(), revokedById: actor.id, revocationReason: reason } });
    await tx.delegationEvent.create({ data: { delegationId: id, actorId: actor.id, type: DelegationEventType.REVOKED, reason } });
    await enqueueNotifications(tx, [{ userId: appointment.delegateId, actorId: actor.id, type: NotificationType.DELEGATION_REVOKED, title: "Delegated authority revoked", message: `Your authority for ${appointment.principal.name} has ended.`, href: "/inbox?view=office", sourceType: "DELEGATION_REVOCATION", sourceId: id }]);
  });
  revalidatePath("/admin/delegations"); revalidatePath("/inbox");
}
