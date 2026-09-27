import { createHash } from "crypto";
import { DocumentEventType, DocumentOcrStatus, DocumentProcessingStatus, MalwareScanStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { readStoredDocument, releaseStoredDocument } from "@/lib/document-storage";
import { malwareScannerEnabled } from "@/lib/document-security";
import { detectDocumentMime } from "@/lib/document-validation";
import { captureRevision } from "@/lib/revisions";

export interface MalwareScanner { scan(bytes: Buffer): Promise<{ clean: boolean; engine: string; signature?: string }>; }
export interface OcrProvider { extract(bytes: Buffer, mimeType: string): Promise<{ text: string | null; provider: string }>; }
function scanner(): MalwareScanner { const mode = process.env.DOCUMENT_SCANNER_PROVIDER ?? "DISABLED"; if (mode === "MOCK" && process.env.NODE_ENV !== "production") return { async scan(bytes) { const infected = bytes.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")); return { clean: !infected, engine: "development-mock", signature: infected ? "EICAR-Test-File" : undefined }; } }; throw new Error("A production malware scanner is not configured."); }
function ocr(): OcrProvider | null { const provider = process.env.DOCUMENT_OCR_PROVIDER ?? "DISABLED"; if (provider === "DISABLED") return null; throw new Error(`OCR provider ${provider} is not available until its technical contract is configured.`); }

async function processOne(attachmentId: string) {
  const attachment = await db.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
  try {
    const bytes = await readStoredDocument(attachment.storageKey, attachment.storageProvider);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== attachment.sha256) throw new Error("Stored content hash does not match the intake hash.");
    const detectedMimeType = detectDocumentMime(bytes);
    if (!detectedMimeType || detectedMimeType !== attachment.mimeType) {
      await db.$transaction(async (tx) => { await tx.attachment.update({ where: { id: attachment.id }, data: { detectedMimeType, isIncluded: false, processingStatus: DocumentProcessingStatus.REJECTED, malwareScanStatus: MalwareScanStatus.QUARANTINED, processedAt: new Date(), processingLockedAt: null, processingError: "Declared type does not match file signature." } }); await tx.documentEvent.create({ data: { attachmentId: attachment.id, type: DocumentEventType.REJECTED, detail: "Magic-byte validation failed; attachment excluded from the document package.", metadata: { declaredMimeType: attachment.mimeType, detectedMimeType } } }); await captureRevision(tx, attachment.correspondenceId, null, `Rejected unsafe attachment ${attachment.originalName}.`); });
      return "rejected";
    }
    const scan = malwareScannerEnabled()
      ? await scanner().scan(bytes)
      : { clean: true, engine: "explicit-bypass" };
    if (!scan.clean) {
      await db.$transaction(async (tx) => { await tx.attachment.update({ where: { id: attachment.id }, data: { detectedMimeType, isIncluded: false, processingStatus: DocumentProcessingStatus.REJECTED, malwareScanStatus: MalwareScanStatus.INFECTED, processedAt: new Date(), processingLockedAt: null, processingError: scan.signature ?? "Malware detected." } }); await tx.documentEvent.create({ data: { attachmentId: attachment.id, type: DocumentEventType.SCAN_INFECTED, detail: "Malware scanner rejected and excluded the document.", metadata: { engine: scan.engine, signature: scan.signature } } }); await captureRevision(tx, attachment.correspondenceId, null, `Rejected infected attachment ${attachment.originalName}.`); });
      return "infected";
    }
    const releasedKey = await releaseStoredDocument(attachment.storageKey, attachment.storageProvider);
    const ocrProvider = ocr();
    const ocrResult = ocrProvider ? await ocrProvider.extract(bytes, detectedMimeType) : null;
    const bypassed = scan.engine === "explicit-bypass";
    await db.$transaction([db.attachment.update({ where: { id: attachment.id }, data: { storageKey: releasedKey, detectedMimeType, processingStatus: DocumentProcessingStatus.AVAILABLE, malwareScanStatus: bypassed ? MalwareScanStatus.BYPASSED : MalwareScanStatus.CLEAN, ocrStatus: ocrResult?.text ? DocumentOcrStatus.COMPLETED : DocumentOcrStatus.UNAVAILABLE, extractedText: ocrResult?.text?.slice(0, 1_000_000), processedAt: new Date(), processingLockedAt: null, processingError: null } }), db.documentEvent.create({ data: { attachmentId: attachment.id, type: bypassed ? DocumentEventType.SCAN_BYPASSED : DocumentEventType.RELEASED, detail: bypassed ? "Validated and released without malware scanning because MALWARE_SCANNER=DISABLED." : "Validated, malware-scanned and released.", metadata: { scanner: scan.engine, scannerMode: bypassed ? "DISABLED" : "ENABLED", ocrProvider: ocrResult?.provider ?? null } } })]);
    return "released";
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Document processing failed.";
    await db.$transaction([db.attachment.update({ where: { id: attachment.id }, data: { processingStatus: DocumentProcessingStatus.FAILED, processingLockedAt: null, processingError: message, nextProcessingAt: new Date(Date.now() + Math.min(60, 2 ** attachment.processingAttempts) * 60_000) } }), db.documentEvent.create({ data: { attachmentId: attachment.id, type: DocumentEventType.RETRY_SCHEDULED, detail: message, metadata: { attempt: attachment.processingAttempts } } })]);
    return "failed";
  }
}

export async function processPendingDocuments(limit = 10) { const result = { processed: 0, released: 0, rejected: 0, infected: 0, failed: 0 }; for (let i = 0; i < Math.min(Math.max(limit, 1), 50); i++) { const candidate = await db.attachment.findFirst({ where: { processingStatus: { in: [DocumentProcessingStatus.QUARANTINED, DocumentProcessingStatus.FAILED] }, processingAttempts: { lt: 5 }, nextProcessingAt: { lte: new Date() }, OR: [{ processingLockedAt: null }, { processingLockedAt: { lt: new Date(Date.now() - 10 * 60_000) } }] }, orderBy: { nextProcessingAt: "asc" } }); if (!candidate) break; const claimed = await db.attachment.updateMany({ where: { id: candidate.id, processingStatus: candidate.processingStatus, processingLockedAt: candidate.processingLockedAt }, data: { processingStatus: DocumentProcessingStatus.PROCESSING, processingLockedAt: new Date(), processingAttempts: { increment: 1 } } }); if (!claimed.count) continue; const outcome = await processOne(candidate.id); result.processed++; result[outcome as "released" | "rejected" | "infected" | "failed"]++; } return result; }
