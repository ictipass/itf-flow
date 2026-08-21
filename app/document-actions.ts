"use server";

import { revalidatePath } from "next/cache";
import { DocumentEventType, DocumentProcessingStatus, MalwareScanStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { captureRevision } from "@/lib/revisions";

export async function retryDocumentProcessingAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can retry document processing.");
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const attachment = await db.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.processingStatus === DocumentProcessingStatus.PROCESSING || attachment.processingStatus === DocumentProcessingStatus.AVAILABLE) throw new Error("This document cannot be retried.");
  await db.$transaction(async (tx) => { await tx.attachment.update({ where: { id: attachmentId }, data: { isIncluded: true, processingStatus: DocumentProcessingStatus.QUARANTINED, malwareScanStatus: MalwareScanStatus.PENDING, processingAttempts: 0, nextProcessingAt: new Date(), processingLockedAt: null, processingError: null } }); await tx.documentEvent.create({ data: { attachmentId, type: DocumentEventType.RETRY_SCHEDULED, detail: "Administrator scheduled document reprocessing.", metadata: { userId: user.id } } }); await captureRevision(tx, attachment.correspondenceId, user.id, `Reprocessing attachment ${attachment.originalName}.`); });
  revalidatePath("/admin/documents");
}
