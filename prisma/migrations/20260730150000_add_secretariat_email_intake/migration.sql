CREATE TYPE "IntakeSource" AS ENUM ('MANUAL', 'PORTAL', 'EMAIL');
CREATE TYPE "MalwareScanStatus" AS ENUM ('NOT_SCANNED', 'PENDING', 'CLEAN', 'QUARANTINED', 'INFECTED');

ALTER TYPE "EventType" ADD VALUE 'EMAIL_IMPORTED';
ALTER TYPE "EventType" ADD VALUE 'CLAIMED';
ALTER TYPE "EventType" ADD VALUE 'RELEASED';
ALTER TYPE "EventType" ADD VALUE 'RESUBMITTED';

ALTER TABLE "Correspondence"
ADD COLUMN "intakeSource" "IntakeSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "claimedById" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3);

UPDATE "Correspondence"
SET "intakeSource" = 'PORTAL'
WHERE "externalOrganizationId" IS NOT NULL;

ALTER TABLE "Attachment"
ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "externalDocumentId" TEXT,
ADD COLUMN "malwareScanStatus" "MalwareScanStatus" NOT NULL DEFAULT 'NOT_SCANNED';

CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "uidValidity" TEXT NOT NULL,
    "uid" INTEGER NOT NULL,
    "messageId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "sentAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailboxSyncRun" (
    "id" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "MailboxSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailMessage_correspondenceId_key" ON "EmailMessage"("correspondenceId");
CREATE UNIQUE INDEX "EmailMessage_mailbox_folder_uidValidity_uid_key" ON "EmailMessage"("mailbox", "folder", "uidValidity", "uid");
CREATE INDEX "EmailMessage_messageId_idx" ON "EmailMessage"("messageId");
CREATE INDEX "MailboxSyncRun_startedAt_idx" ON "MailboxSyncRun"("startedAt");
CREATE INDEX "MailboxSyncRun_status_idx" ON "MailboxSyncRun"("status");
CREATE INDEX "Correspondence_intakeSource_status_receivedAt_idx" ON "Correspondence"("intakeSource", "status", "receivedAt");
CREATE INDEX "Correspondence_claimedById_status_idx" ON "Correspondence"("claimedById", "status");

ALTER TABLE "Correspondence"
ADD CONSTRAINT "Correspondence_claimedById_fkey"
FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailMessage"
ADD CONSTRAINT "EmailMessage_correspondenceId_fkey"
FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
