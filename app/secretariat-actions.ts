"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DuplicateReviewStatus, SecretariatRecordEventType } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { canRegister } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

async function requireSecretariatOperator() {
  const user = await requireUser();
  if (!canRegister(user.role)) throw new Error("You are not authorized to manage Secretariat records.");
  return user;
}

const metadataSchema = z.object({
  correspondenceId: z.string().min(1), scanDesk: z.string().trim().min(2).max(120),
  scannedAt: z.coerce.date(), pageCount: z.coerce.number().int().min(1).max(10000),
  currentLocation: z.string().trim().min(2).max(200), physicalFileReference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(), reason: z.string().trim().min(5).max(500),
});

export async function recordScanningMetadataAction(formData: FormData) {
  const user = await requireSecretariatOperator();
  const parsed = metadataSchema.parse({ correspondenceId: formData.get("correspondenceId"), scanDesk: formData.get("scanDesk"), scannedAt: formData.get("scannedAt"), pageCount: formData.get("pageCount"), currentLocation: formData.get("currentLocation"), physicalFileReference: formData.get("physicalFileReference") || undefined, notes: formData.get("notes") || undefined, reason: formData.get("reason") });
  const record = await db.correspondence.findUnique({ where: { id: parsed.correspondenceId }, include: { secretariatRecord: true } });
  if (!record || record.status === "DRAFT") throw new Error("Only submitted or registered correspondence can receive Secretariat metadata.");
  const candidates = await db.correspondence.findMany({ where: { id: { not: record.id }, status: { not: "DRAFT" }, OR: [
    ...(record.senderReference ? [{ senderReference: record.senderReference }] : []),
    { senderName: { equals: record.senderName, mode: "insensitive" }, subject: { equals: record.subject, mode: "insensitive" } },
  ] }, select: { id: true }, take: 5 });
  const possibleDuplicateId = record.secretariatRecord?.duplicateOfCorrespondenceId ?? candidates[0]?.id ?? null;
  const duplicateStatus = record.secretariatRecord?.duplicateStatus ?? (possibleDuplicateId ? DuplicateReviewStatus.POSSIBLE_DUPLICATE : DuplicateReviewStatus.NOT_REVIEWED);
  await db.$transaction(async (tx) => {
    const secretariatRecord = await tx.secretariatRecord.upsert({ where: { correspondenceId: record.id }, create: {
      correspondenceId: record.id, scanDesk: parsed.scanDesk, scannedAt: parsed.scannedAt, pageCount: parsed.pageCount,
      currentLocation: parsed.currentLocation, physicalFileReference: parsed.physicalFileReference,
      trackingCode: `ITF-FILE-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      duplicateStatus, duplicateOfCorrespondenceId: possibleDuplicateId, duplicateReason: possibleDuplicateId ? "Potential match detected during metadata registration." : null,
      notes: parsed.notes, updatedById: user.id,
    }, update: { scanDesk: parsed.scanDesk, scannedAt: parsed.scannedAt, pageCount: parsed.pageCount, currentLocation: parsed.currentLocation, physicalFileReference: parsed.physicalFileReference, notes: parsed.notes, updatedById: user.id } });
    await tx.secretariatRecordEvent.create({ data: { secretariatRecordId: secretariatRecord.id, actorId: user.id, type: SecretariatRecordEventType.METADATA_RECORDED, toLocation: parsed.currentLocation, reason: parsed.reason, metadata: { scanDesk: parsed.scanDesk, pageCount: parsed.pageCount, candidateCount: candidates.length } } });
    if (!record.secretariatRecord && possibleDuplicateId) await tx.secretariatRecordEvent.create({ data: { secretariatRecordId: secretariatRecord.id, actorId: user.id, type: SecretariatRecordEventType.DUPLICATE_FLAGGED, reason: "Potential duplicate detected from sender reference or matching sender and subject.", metadata: { duplicateOfCorrespondenceId: possibleDuplicateId, candidateCount: candidates.length } } });
  });
  revalidatePath("/intake"); revalidatePath(`/correspondence/${record.id}`);
  redirect(`/correspondence/${record.id}?secretariat=recorded`);
}

export async function reassignSecretariatLocationAction(formData: FormData) {
  const user = await requireSecretariatOperator();
  const parsed = z.object({ correspondenceId: z.string().min(1), location: z.string().trim().min(2).max(200), reason: z.string().trim().min(10).max(500) }).parse({ correspondenceId: formData.get("correspondenceId"), location: formData.get("location"), reason: formData.get("reason") });
  const existing = await db.secretariatRecord.findUnique({ where: { correspondenceId: parsed.correspondenceId } });
  if (!existing) throw new Error("Record scanning metadata before changing physical location.");
  if (existing.currentLocation === parsed.location) throw new Error("Choose a different physical location.");
  await db.$transaction(async (tx) => {
    await tx.secretariatRecord.update({ where: { id: existing.id }, data: { currentLocation: parsed.location, updatedById: user.id } });
    await tx.secretariatRecordEvent.create({ data: { secretariatRecordId: existing.id, actorId: user.id, type: SecretariatRecordEventType.LOCATION_REASSIGNED, fromLocation: existing.currentLocation, toLocation: parsed.location, reason: parsed.reason } });
  });
  revalidatePath("/intake"); revalidatePath(`/correspondence/${parsed.correspondenceId}`);
  redirect(`/correspondence/${parsed.correspondenceId}?secretariat=moved`);
}

export async function reviewDuplicateAction(formData: FormData) {
  const user = await requireSecretariatOperator();
  const parsed = z.object({ correspondenceId: z.string().min(1), outcome: z.enum(["CONFIRMED_DUPLICATE", "CLEARED"]), duplicateOfCorrespondenceId: z.string().optional(), reason: z.string().trim().min(10).max(500) }).parse({ correspondenceId: formData.get("correspondenceId"), outcome: formData.get("outcome"), duplicateOfCorrespondenceId: formData.get("duplicateOfCorrespondenceId") || undefined, reason: formData.get("reason") });
  const existing = await db.secretariatRecord.findUnique({ where: { correspondenceId: parsed.correspondenceId } });
  if (!existing) throw new Error("Record scanning metadata before reviewing duplicates.");
  if (parsed.outcome === "CONFIRMED_DUPLICATE" && (!parsed.duplicateOfCorrespondenceId || parsed.duplicateOfCorrespondenceId === parsed.correspondenceId)) throw new Error("Select the original correspondence record.");
  if (parsed.duplicateOfCorrespondenceId && !await db.correspondence.findUnique({ where: { id: parsed.duplicateOfCorrespondenceId }, select: { id: true } })) throw new Error("The selected original correspondence does not exist.");
  const status = parsed.outcome === "CONFIRMED_DUPLICATE" ? DuplicateReviewStatus.CONFIRMED_DUPLICATE : DuplicateReviewStatus.CLEARED;
  const eventType = parsed.outcome === "CONFIRMED_DUPLICATE" ? SecretariatRecordEventType.DUPLICATE_CONFIRMED : SecretariatRecordEventType.DUPLICATE_CLEARED;
  await db.$transaction(async (tx) => {
    await tx.secretariatRecord.update({ where: { id: existing.id }, data: { duplicateStatus: status, duplicateOfCorrespondenceId: parsed.outcome === "CONFIRMED_DUPLICATE" ? parsed.duplicateOfCorrespondenceId : null, duplicateReason: parsed.reason, updatedById: user.id } });
    await tx.secretariatRecordEvent.create({ data: { secretariatRecordId: existing.id, actorId: user.id, type: eventType, reason: parsed.reason, metadata: { duplicateOfCorrespondenceId: parsed.duplicateOfCorrespondenceId ?? null } } });
  });
  revalidatePath("/intake"); revalidatePath(`/correspondence/${parsed.correspondenceId}`);
  redirect(`/correspondence/${parsed.correspondenceId}?secretariat=duplicate-reviewed`);
}
