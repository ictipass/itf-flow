"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  BroadcastCategory,
  BroadcastEventType,
  BroadcastPriority,
  BroadcastScopeType,
  BroadcastStatus,
  UserRole,
} from "@/lib/generated/prisma/client";
import { authorizeBroadcast, resolveBroadcastRecipients, type AudienceInput } from "@/lib/broadcasts";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const broadcastSchema = z.object({
  title: z.string().trim().min(5).max(180),
  message: z.string().trim().min(10).max(20000),
  category: z.enum(BroadcastCategory),
  priority: z.enum(BroadcastPriority),
  publishAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

function readAudiences(formData: FormData): AudienceInput[] {
  const types = formData.getAll("audienceScopeTypes").map(String);
  const values = formData.getAll("audienceScopeValues").map(String);
  const labels = formData.getAll("audienceLabels").map(String);
  const audiences = types.flatMap((type, index) => {
    if (!Object.values(BroadcastScopeType).includes(type as BroadcastScopeType)) return [];
    const scopeType = type as BroadcastScopeType;
    const scopeValue = scopeType === BroadcastScopeType.ORGANIZATION ? null : values[index]?.trim() || null;
    if (scopeType !== BroadcastScopeType.ORGANIZATION && !scopeValue) return [];
    return [{ scopeType, scopeValue, label: labels[index]?.trim() || scopeValue || "Entire organization" }];
  });
  return audiences.filter((audience, index) => audiences.findIndex((candidate) => candidate.scopeType === audience.scopeType && candidate.scopeValue === audience.scopeValue) === index);
}

export async function createBroadcastAction(formData: FormData) {
  const user = await requireUser();
  const parsed = broadcastSchema.parse({
    title: formData.get("title"), message: formData.get("message"),
    category: formData.get("category"), priority: formData.get("priority"),
    publishAt: formData.get("publishAt") || undefined, expiresAt: formData.get("expiresAt") || undefined,
  });
  const audiences = readAudiences(formData);
  if (!audiences.length) throw new Error("Select at least one broadcast audience.");
  const mandatoryAcknowledgement = formData.get("mandatoryAcknowledgement") === "on";
  const intent = String(formData.get("intent") ?? "draft");
  const existingId = String(formData.get("broadcastId") ?? "").trim();
  if (existingId) {
    const existing = await db.broadcast.findUnique({ where: { id: existingId } });
    if (!existing || existing.createdById !== user.id || existing.status !== BroadcastStatus.DRAFT) throw new Error("This draft cannot be edited by you.");
  }
  await authorizeBroadcast({ userId: user.id, category: parsed.category, mandatoryAcknowledgement, audiences });
  const publishAt = parsed.publishAt ? new Date(parsed.publishAt) : null;
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  if (expiresAt && expiresAt <= (publishAt ?? new Date())) throw new Error("Expiry must be after publication.");
  const publish = intent === "publish";
  const recipients = publish ? await resolveBroadcastRecipients(audiences) : [];
  if (publish && !recipients.length) throw new Error("The selected audiences contain no active staff.");

  if (existingId) {
    await db.$transaction(async (tx) => {
      await tx.broadcastAudience.deleteMany({ where: { broadcastId: existingId } });
      await tx.broadcast.update({ where: { id: existingId }, data: {
        title: parsed.title, message: parsed.message, category: parsed.category, priority: parsed.priority,
        mandatoryAcknowledgement, publishAt: publishAt ?? (publish ? new Date() : null), expiresAt,
        status: publish ? BroadcastStatus.PUBLISHED : BroadcastStatus.DRAFT,
        publishedById: publish ? user.id : null, publishedAt: publish ? new Date() : null,
        audiences: { create: audiences },
        recipients: publish ? { create: recipients.map((recipient) => ({ userId: recipient.id, recipientName: recipient.name, recipientEmail: recipient.email, recipientRole: recipient.role, recipientOffice: recipient.office, recipientDepartment: recipient.department, recipientDivision: recipient.division, recipientUnit: recipient.unit })) } : undefined,
      } });
      await tx.broadcastEvent.create({ data: { broadcastId: existingId, actorId: user.id, type: publish ? BroadcastEventType.PUBLISHED : BroadcastEventType.DRAFTED, detail: publish ? `Draft updated and published to ${recipients.length} snapshotted recipients.` : "Broadcast draft updated.", metadata: { audienceCount: audiences.length, recipientCount: recipients.length } } });
    });
    revalidatePath("/broadcasts"); revalidatePath(`/broadcasts/${existingId}`); revalidatePath("/dashboard");
    redirect(`/broadcasts/${existingId}`);
  }

  const broadcast = await db.$transaction(async (tx) => {
    const record = await tx.broadcast.create({
      data: {
        title: parsed.title, message: parsed.message, category: parsed.category, priority: parsed.priority,
        mandatoryAcknowledgement, createdById: user.id, publishAt: publishAt ?? (publish ? new Date() : null), expiresAt,
        status: publish ? BroadcastStatus.PUBLISHED : BroadcastStatus.DRAFT,
        publishedById: publish ? user.id : null, publishedAt: publish ? new Date() : null,
        audiences: { create: audiences },
        recipients: publish ? { create: recipients.map((recipient) => ({
          userId: recipient.id, recipientName: recipient.name, recipientEmail: recipient.email,
          recipientRole: recipient.role, recipientOffice: recipient.office,
          recipientDepartment: recipient.department, recipientDivision: recipient.division, recipientUnit: recipient.unit,
        })) } : undefined,
      },
    });
    await tx.broadcastEvent.create({ data: {
      broadcastId: record.id, actorId: user.id,
      type: publish ? BroadcastEventType.PUBLISHED : BroadcastEventType.DRAFTED,
      detail: publish ? `Published to ${recipients.length} snapshotted recipients.` : "Broadcast draft created.",
      metadata: { audienceCount: audiences.length, recipientCount: recipients.length },
    } });
    return record;
  });
  revalidatePath("/broadcasts"); revalidatePath("/dashboard");
  redirect(`/broadcasts/${broadcast.id}`);
}

export async function markBroadcastReadAction(formData: FormData) {
  const user = await requireUser();
  const broadcastId = String(formData.get("broadcastId") ?? "");
  const recipient = await db.broadcastRecipient.findUnique({ where: { broadcastId_userId: { broadcastId, userId: user.id } }, include: { broadcast: true } });
  const now = new Date();
  if (!recipient || recipient.broadcast.status !== BroadcastStatus.PUBLISHED || (recipient.broadcast.publishAt && recipient.broadcast.publishAt > now) || (recipient.broadcast.expiresAt && recipient.broadcast.expiresAt <= now)) throw new Error("This broadcast is not currently available to you.");
  if (!recipient.readAt) await db.$transaction([
    db.broadcastRecipient.update({ where: { id: recipient.id }, data: { readAt: new Date() } }),
    db.broadcastEvent.create({ data: { broadcastId, actorId: user.id, type: BroadcastEventType.READ, detail: "Broadcast marked as read." } }),
  ]);
  revalidatePath("/broadcasts"); revalidatePath(`/broadcasts/${broadcastId}`); revalidatePath("/dashboard");
}

export async function publishDraftBroadcastAction(formData: FormData) {
  const user = await requireUser();
  const broadcastId = String(formData.get("broadcastId") ?? "");
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId }, include: { audiences: true } });
  if (!broadcast || broadcast.createdById !== user.id || broadcast.status !== BroadcastStatus.DRAFT) throw new Error("This draft cannot be published by you.");
  const audiences = broadcast.audiences.map((audience) => ({ scopeType: audience.scopeType, scopeValue: audience.scopeValue, label: audience.label }));
  await authorizeBroadcast({ userId: user.id, category: broadcast.category, mandatoryAcknowledgement: broadcast.mandatoryAcknowledgement, audiences });
  const recipients = await resolveBroadcastRecipients(audiences);
  if (!recipients.length) throw new Error("The selected audiences contain no active staff.");
  await db.$transaction(async (tx) => {
    await tx.broadcast.update({ where: { id: broadcastId }, data: { status: BroadcastStatus.PUBLISHED, publishedById: user.id, publishedAt: new Date(), publishAt: broadcast.publishAt ?? new Date(), recipients: { create: recipients.map((recipient) => ({ userId: recipient.id, recipientName: recipient.name, recipientEmail: recipient.email, recipientRole: recipient.role, recipientOffice: recipient.office, recipientDepartment: recipient.department, recipientDivision: recipient.division, recipientUnit: recipient.unit })) } } });
    await tx.broadcastEvent.create({ data: { broadcastId, actorId: user.id, type: BroadcastEventType.PUBLISHED, detail: `Published to ${recipients.length} snapshotted recipients.`, metadata: { recipientCount: recipients.length } } });
  });
  revalidatePath("/broadcasts"); revalidatePath(`/broadcasts/${broadcastId}`); revalidatePath("/dashboard");
}

export async function acknowledgeBroadcastAction(formData: FormData) {
  const user = await requireUser();
  const broadcastId = String(formData.get("broadcastId") ?? "");
  const recipient = await db.broadcastRecipient.findUnique({ where: { broadcastId_userId: { broadcastId, userId: user.id } }, include: { broadcast: true } });
  const now = new Date();
  if (!recipient || recipient.broadcast.status !== BroadcastStatus.PUBLISHED || (recipient.broadcast.publishAt && recipient.broadcast.publishAt > now) || (recipient.broadcast.expiresAt && recipient.broadcast.expiresAt <= now)) throw new Error("This broadcast is not currently available to you.");
  if (!recipient.broadcast.mandatoryAcknowledgement) throw new Error("This broadcast does not require acknowledgement.");
  if (!recipient.acknowledgedAt) await db.$transaction([
    db.broadcastRecipient.update({ where: { id: recipient.id }, data: { readAt: recipient.readAt ?? new Date(), acknowledgedAt: new Date() } }),
    db.broadcastEvent.create({ data: { broadcastId, actorId: user.id, type: BroadcastEventType.ACKNOWLEDGED, detail: "Receipt acknowledged." } }),
  ]);
  revalidatePath("/broadcasts"); revalidatePath(`/broadcasts/${broadcastId}`); revalidatePath("/dashboard");
}

export async function withdrawBroadcastAction(formData: FormData) {
  const user = await requireUser();
  const broadcastId = String(formData.get("broadcastId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) throw new Error("Give a withdrawal reason.");
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast || (broadcast.createdById !== user.id && user.role !== UserRole.DG && user.role !== UserRole.SYSTEM_ADMIN)) throw new Error("You cannot withdraw this broadcast.");
  await db.$transaction([
    db.broadcast.update({ where: { id: broadcastId }, data: { status: BroadcastStatus.WITHDRAWN, withdrawnAt: new Date(), withdrawalReason: reason } }),
    db.broadcastEvent.create({ data: { broadcastId, actorId: user.id, type: BroadcastEventType.WITHDRAWN, detail: reason } }),
  ]);
  revalidatePath("/broadcasts"); revalidatePath(`/broadcasts/${broadcastId}`); revalidatePath("/dashboard");
}
