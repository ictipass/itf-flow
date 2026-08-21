CREATE TYPE "DocumentProcessingStatus" AS ENUM ('QUARANTINED','PROCESSING','AVAILABLE','REJECTED','FAILED','LEGACY_UNVERIFIED');
CREATE TYPE "DocumentOcrStatus" AS ENUM ('NOT_REQUESTED','PENDING','COMPLETED','UNAVAILABLE','FAILED');
CREATE TYPE "DocumentEventType" AS ENUM ('QUARANTINED','VALIDATED','SCAN_CLEAN','SCAN_INFECTED','REJECTED','OCR_COMPLETED','OCR_FAILED','RELEASED','PROCESSING_FAILED','RETRY_SCHEDULED','DOWNLOADED');

ALTER TABLE "Attachment"
ADD COLUMN "externalVersionId" TEXT,
ADD COLUMN "repositoryId" TEXT,
ADD COLUMN "renditionId" TEXT,
ADD COLUMN "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'QUARANTINED',
ADD COLUMN "detectedMimeType" TEXT,
ADD COLUMN "ocrStatus" "DocumentOcrStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "extractedText" TEXT,
ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextProcessingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "processingLockedAt" TIMESTAMP(3),
ADD COLUMN "processedAt" TIMESTAMP(3),
ADD COLUMN "processingError" TEXT;

UPDATE "Attachment" SET "processingStatus" = 'LEGACY_UNVERIFIED', "ocrStatus" = 'NOT_REQUESTED';

CREATE TABLE "DocumentEvent" (
  "id" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "type" "DocumentEventType" NOT NULL,
  "detail" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_processingStatus_nextProcessingAt_idx" ON "Attachment"("processingStatus","nextProcessingAt");
CREATE INDEX "Attachment_malwareScanStatus_processingStatus_idx" ON "Attachment"("malwareScanStatus","processingStatus");
CREATE INDEX "DocumentEvent_attachmentId_createdAt_idx" ON "DocumentEvent"("attachmentId","createdAt");
CREATE INDEX "DocumentEvent_type_createdAt_idx" ON "DocumentEvent"("type","createdAt");
ALTER TABLE "DocumentEvent" ADD CONSTRAINT "DocumentEvent_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
