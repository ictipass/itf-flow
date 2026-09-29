import { createHash } from "crypto";
import {
  CorrespondenceType,
  DocumentEventType,
  DocumentProcessingStatus,
  MalwareScanStatus,
  RecipientKind,
  SignatureProfileStatus,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { attachmentPassesDocumentSecurityGate } from "@/lib/document-security";
import { readStoredDocument, storeSystemGeneratedPdf } from "@/lib/document-storage";
import { itfLogoPng } from "@/lib/itf-branding";
import { renderMemoOutput } from "@/lib/memo-output";
import { richTextPlainText } from "@/lib/rich-text";
import { convertOfficeDocumentToPdf, OFFICE_CONVERSION_MIME_TYPES } from "@/lib/document-conversion";

const packetMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function recipientIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const value = (metadata as Record<string, unknown>).actionRecipientIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function regenerateWorkingMemoPacket(correspondenceId: string, options: { replaceAnnotated?: boolean } = {}) {
  const record = await db.correspondence.findUnique({
    where: { id: correspondenceId },
    include: {
      createdBy: { include: { signatureProfiles: { where: { status: SignatureProfileStatus.APPROVED }, orderBy: { version: "desc" }, take: 1 } } },
      workItems: { where: { kind: RecipientKind.ACTION }, include: { assignee: true }, orderBy: { assignedAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      attachments: { where: { isIncluded: true }, orderBy: { createdAt: "asc" } },
      ultimateRecipient: true,
    },
  });
  if (!record || record.type !== CorrespondenceType.INTERNAL_MEMO || !record.createdBy || !richTextPlainText(record.body)) return { status: "not-applicable" as const };

  const currentPacket = record.attachments.find((attachment) => attachment.isMemoPacket);
  if (currentPacket) {
    const annotation = await db.documentAnnotation.findFirst({
      where: { OR: [{ sourceAttachmentId: currentPacket.id }, { outputAttachmentId: currentPacket.id }] },
      select: { id: true },
    });
    if (annotation && !options.replaceAnnotated) return { status: "annotated" as const, attachmentId: currentPacket.id };
  }

  const sourceAttachments = record.attachments.filter((attachment) => !attachment.isMemoPacket);
  const includedDocuments: { name: string; mimeType: string; bytes: Buffer }[] = [];
  const includedAttachmentIds: string[] = [];
  for (const attachment of sourceAttachments) {
    if ((!packetMimeTypes.has(attachment.mimeType) && !OFFICE_CONVERSION_MIME_TYPES.has(attachment.mimeType)) || !attachmentPassesDocumentSecurityGate(attachment)) continue;
    const bytes = await readStoredDocument(attachment.storageKey, attachment.storageProvider);
    if (createHash("sha256").update(bytes).digest("hex") !== attachment.sha256) {
      throw new Error(`The stored attachment ${attachment.originalName} failed integrity verification.`);
    }
    if (packetMimeTypes.has(attachment.mimeType)) {
      includedDocuments.push({ name: attachment.originalName, mimeType: attachment.mimeType, bytes });
      includedAttachmentIds.push(attachment.id);
      continue;
    }
    try {
      const converted = await convertOfficeDocumentToPdf({ bytes, mimeType: attachment.mimeType, originalName: attachment.originalName });
      if (converted) {
        includedDocuments.push({ name: `${attachment.originalName}.pdf`, mimeType: "application/pdf", bytes: converted });
        includedAttachmentIds.push(attachment.id);
      }
    } catch (error) {
      console.error(`Could not convert ${attachment.originalName} into the working memo packet.`, error);
    }
  }

  const initialRecipientIds = record.events.map((event) => recipientIds(event.metadata)).find((ids) => ids.length) ?? [];
  const addressedItems = initialRecipientIds.length
    ? record.workItems.filter((item) => initialRecipientIds.includes(item.assigneeId))
    : record.workItems.slice(0, 1);
  const routingNames = record.ultimateRecipient
    ? [`${record.ultimateRecipient.name}${record.ultimateRecipient.position ? ` (${record.ultimateRecipient.position})` : ""}`]
    : [...new Set(addressedItems.map((item) => `${item.assignee.name}${item.assignee.position ? ` (${item.assignee.position})` : ""}`))];
  const signature = record.createdBy.signatureProfiles[0] ?? null;
  const generatedAt = new Date();
  const bytes = await renderMemoOutput({
    outputId: `working-memo:${record.id}`,
    referenceNumber: record.referenceNumber,
    classification: record.classification,
    priority: record.priority,
    status: record.status,
    subject: record.subject,
    summary: record.summary,
    body: record.body,
    senderReference: record.senderReference,
    memoDate: record.dateOnDocument ?? record.receivedAt,
    revisionVersion: 0,
    originator: { name: record.createdBy.name, position: record.createdBy.position, office: record.createdBy.office, department: record.createdBy.department },
    routingNames,
    generatedBy: record.createdBy.name,
    generatedAt,
    signaturePng: signature ? Buffer.from(signature.imageBytes) : null,
    signatureProfileVersion: signature?.version ?? 0,
    signatureSha256: signature?.sha256 ?? "",
    events: [],
    attachments: sourceAttachments.map((attachment) => ({ name: attachment.originalName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, sha256: attachment.sha256 })),
    decisions: [],
    logoPng: await itfLogoPng(),
    includedDocuments,
    includeLifecycleEvidence: false,
  });
  const safeReference = record.referenceNumber.replace(/[^a-zA-Z0-9._-]/g, "-");
  const stored = await storeSystemGeneratedPdf({
    correspondenceId: record.id,
    recordFileId: record.recordFileId,
    originalName: `${safeReference}-working-memo.pdf`,
    bytes,
  });

  const packet = await db.$transaction(async (tx) => {
    if (currentPacket) {
      const superseded = await tx.attachment.updateMany({
        where: { id: currentPacket.id, isIncluded: true, sha256: currentPacket.sha256, isMemoPacket: true },
        data: { isIncluded: false },
      });
      if (superseded.count !== 1) throw new Error("The working memo packet changed while it was being refreshed.");
    }
    return tx.attachment.create({
      data: {
        correspondenceId: record.id,
        ...stored,
        isMemoPacket: true,
        processingStatus: DocumentProcessingStatus.AVAILABLE,
        malwareScanStatus: MalwareScanStatus.BYPASSED,
        detectedMimeType: "application/pdf",
        processedAt: generatedAt,
        documentEvents: {
          create: {
            type: DocumentEventType.RELEASED,
            detail: "Generated by ITF Flow as the annotatable working memo packet.",
            metadata: { includedAttachmentIds },
          },
        },
      },
    });
  });
  return { status: "generated" as const, attachmentId: packet.id };
}
