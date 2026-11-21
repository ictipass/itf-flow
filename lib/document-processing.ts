import { createHash } from "crypto";
import { DocumentEventType, DocumentOcrStatus, DocumentProcessingStatus, MalwareScanStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { readStoredDocument, releaseStoredDocument } from "@/lib/document-storage";
import { malwareScannerEnabled } from "@/lib/document-security";
import { detectDocumentMime } from "@/lib/document-validation";
import { captureRevision } from "@/lib/revisions";
import { regenerateWorkingMemoPacket } from "@/lib/memo-packet";
import {
  ClamavHttpScanner,
  ClamavScanError,
  documentScannerProvider,
  type MalwareScanContext,
  type MalwareScanResult,
} from "@/lib/clamav-http";

const MAX_PROCESSING_ATTEMPTS = 5;

export interface MalwareScanner { scan(bytes: Buffer, context: MalwareScanContext): Promise<MalwareScanResult>; }
export interface OcrProvider { extract(bytes: Buffer, mimeType: string): Promise<{ text: string | null; provider: string }>; }
function scanner(): MalwareScanner {
  const provider = documentScannerProvider();
  if (provider === "CLAMAV" || provider === "CLAMAV_HTTP") return new ClamavHttpScanner();
  if (provider === "MOCK" && process.env.NODE_ENV !== "production") return {
    async scan(bytes) {
      const infected = bytes.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));
      return {
        clean: !infected,
        engine: "development-mock",
        engineVersion: "contract-v1",
        signature: infected ? "EICAR-Test-File" : undefined,
        threats: infected ? ["EICAR-Test-File"] : [],
        requestId: `mock-${Date.now()}`,
        clientRequestId: `mock-${Date.now()}`,
        scanDurationMs: 0,
        scannedAt: new Date().toISOString(),
      };
    },
  };
  throw new Error("A production malware scanner is not configured.");
}
function ocr(): OcrProvider | null { const provider = process.env.DOCUMENT_OCR_PROVIDER ?? "DISABLED"; if (provider === "DISABLED") return null; throw new Error(`OCR provider ${provider} is not available until its technical contract is configured.`); }

function scanMetadata(scan: MalwareScanResult, attachmentId: string, sizeBytes: number) {
  return {
    attachmentId,
    requestId: scan.requestId,
    clientRequestId: scan.clientRequestId,
    engine: scan.engine,
    engineVersion: scan.engineVersion,
    scanDurationMs: scan.scanDurationMs,
    scannedAt: scan.scannedAt,
    sizeBytes,
    threats: scan.threats,
  };
}

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
      ? await scanner().scan(bytes, { documentId: attachment.id, fileName: attachment.originalName, mimeType: detectedMimeType })
      : {
          clean: true,
          engine: "explicit-bypass",
          engineVersion: "not-scanned",
          threats: [],
          requestId: `bypass-${attachment.id}`,
          clientRequestId: `bypass-${attachment.id}`,
          scanDurationMs: 0,
          scannedAt: new Date().toISOString(),
        };
    if (!scan.clean) {
      await db.$transaction(async (tx) => { await tx.attachment.update({ where: { id: attachment.id }, data: { detectedMimeType, isIncluded: false, processingStatus: DocumentProcessingStatus.REJECTED, malwareScanStatus: MalwareScanStatus.INFECTED, processedAt: new Date(), processingLockedAt: null, processingError: scan.signature ?? "Malware detected." } }); await tx.documentEvent.create({ data: { attachmentId: attachment.id, type: DocumentEventType.SCAN_INFECTED, detail: "Malware scanner rejected and excluded the document.", metadata: { ...scanMetadata(scan, attachment.id, attachment.sizeBytes), signature: scan.signature } } }); await captureRevision(tx, attachment.correspondenceId, null, `Rejected infected attachment ${attachment.originalName}.`); });
      return "infected";
    }
    const releasedKey = await releaseStoredDocument(attachment.storageKey, attachment.storageProvider);
    const ocrProvider = ocr();
    const ocrResult = ocrProvider ? await ocrProvider.extract(bytes, detectedMimeType) : null;
    const bypassed = scan.engine === "explicit-bypass";
    await db.$transaction(async (tx) => {
      await tx.attachment.update({ where: { id: attachment.id }, data: { storageKey: releasedKey, detectedMimeType, processingStatus: DocumentProcessingStatus.AVAILABLE, malwareScanStatus: bypassed ? MalwareScanStatus.BYPASSED : MalwareScanStatus.CLEAN, ocrStatus: ocrResult?.text ? DocumentOcrStatus.COMPLETED : DocumentOcrStatus.UNAVAILABLE, extractedText: ocrResult?.text?.slice(0, 1_000_000), processedAt: new Date(), processingLockedAt: null, processingError: null } });
      await tx.documentEvent.create({ data: { attachmentId: attachment.id, type: bypassed ? DocumentEventType.SCAN_BYPASSED : DocumentEventType.SCAN_CLEAN, detail: bypassed ? "Validated and accepted without malware scanning because MALWARE_SCANNER=DISABLED." : "ClamAV returned a verified clean verdict.", metadata: { ...scanMetadata(scan, attachment.id, attachment.sizeBytes), scannerMode: bypassed ? "DISABLED" : "ENABLED" } } });
      await tx.documentEvent.create({ data: { attachmentId: attachment.id, type: DocumentEventType.RELEASED, detail: bypassed ? "Released under the explicit administrative malware-scanner override." : "Released after a verified clean malware scan.", metadata: { requestId: scan.requestId, scannerMode: bypassed ? "DISABLED" : "ENABLED", ocrProvider: ocrResult?.provider ?? null } } });
    });
    try {
      const packet = await regenerateWorkingMemoPacket(attachment.correspondenceId);
      if (packet.status === "generated") {
        await db.$transaction((tx) => captureRevision(tx, attachment.correspondenceId, null, `Refreshed the working memo packet after releasing ${attachment.originalName}.`));
      }
    } catch (packetError) {
      console.error("Released the source document, but could not refresh its working memo packet.", packetError);
    }
    return "released";
  } catch (error) {
    const scanError = error instanceof ClamavScanError ? error : null;
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Document processing failed.";
    const retryable = scanError?.retryable ?? true;
    const retryScheduled = retryable && attachment.processingAttempts < MAX_PROCESSING_ATTEMPTS;
    const nextProcessingAt = new Date(Date.now() + Math.min(60, 2 ** attachment.processingAttempts) * 60_000);
    await db.$transaction([
      db.attachment.update({ where: { id: attachment.id }, data: { processingStatus: DocumentProcessingStatus.FAILED, processingLockedAt: null, processingError: message, nextProcessingAt, ...(!retryScheduled ? { processingAttempts: MAX_PROCESSING_ATTEMPTS } : {}) } }),
      db.documentEvent.create({ data: { attachmentId: attachment.id, type: retryScheduled ? DocumentEventType.RETRY_SCHEDULED : DocumentEventType.PROCESSING_FAILED, detail: retryScheduled ? `${message} A bounded retry was scheduled.` : `${message} Automatic retries stopped; administrator review is required.`, metadata: { attachmentId: attachment.id, sizeBytes: attachment.sizeBytes, attempt: attachment.processingAttempts, maximumAttempts: MAX_PROCESSING_ATTEMPTS, retryable, errorCategory: scanError?.category ?? "DOCUMENT_PROCESSING", clientRequestId: scanError?.clientRequestId ?? null, httpStatus: scanError?.httpStatus ?? null } } }),
    ]);
    return "failed";
  }
}

export async function processPendingDocuments(limit = 10) { const result = { processed: 0, released: 0, rejected: 0, infected: 0, failed: 0 }; for (let i = 0; i < Math.min(Math.max(limit, 1), 50); i++) { const candidate = await db.attachment.findFirst({ where: { processingStatus: { in: [DocumentProcessingStatus.QUARANTINED, DocumentProcessingStatus.FAILED] }, processingAttempts: { lt: MAX_PROCESSING_ATTEMPTS }, nextProcessingAt: { lte: new Date() }, OR: [{ processingLockedAt: null }, { processingLockedAt: { lt: new Date(Date.now() - 10 * 60_000) } }] }, orderBy: { nextProcessingAt: "asc" } }); if (!candidate) break; const claimed = await db.attachment.updateMany({ where: { id: candidate.id, processingStatus: candidate.processingStatus, processingLockedAt: candidate.processingLockedAt }, data: { processingStatus: DocumentProcessingStatus.PROCESSING, processingLockedAt: new Date(), processingAttempts: { increment: 1 } } }); if (!claimed.count) continue; const outcome = await processOne(candidate.id); result.processed++; result[outcome as "released" | "rejected" | "infected" | "failed"]++; } return result; }
