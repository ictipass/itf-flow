CREATE TYPE "DuplicateReviewStatus" AS ENUM ('NOT_REVIEWED', 'POSSIBLE_DUPLICATE', 'CONFIRMED_DUPLICATE', 'CLEARED');
CREATE TYPE "SecretariatRecordEventType" AS ENUM ('METADATA_RECORDED', 'LOCATION_REASSIGNED', 'DUPLICATE_FLAGGED', 'DUPLICATE_CONFIRMED', 'DUPLICATE_CLEARED');

CREATE TABLE "SecretariatRecord" (
  "id" TEXT NOT NULL,
  "correspondenceId" TEXT NOT NULL,
  "scanDesk" TEXT NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL,
  "pageCount" INTEGER NOT NULL,
  "currentLocation" TEXT NOT NULL,
  "physicalFileReference" TEXT,
  "trackingCode" TEXT NOT NULL,
  "duplicateStatus" "DuplicateReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
  "duplicateOfCorrespondenceId" TEXT,
  "duplicateReason" TEXT,
  "notes" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecretariatRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretariatRecordEvent" (
  "id" TEXT NOT NULL,
  "secretariatRecordId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "SecretariatRecordEventType" NOT NULL,
  "fromLocation" TEXT,
  "toLocation" TEXT,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecretariatRecordEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecretariatRecord_correspondenceId_key" ON "SecretariatRecord"("correspondenceId");
CREATE UNIQUE INDEX "SecretariatRecord_trackingCode_key" ON "SecretariatRecord"("trackingCode");
CREATE INDEX "SecretariatRecord_currentLocation_updatedAt_idx" ON "SecretariatRecord"("currentLocation", "updatedAt");
CREATE INDEX "SecretariatRecord_duplicateStatus_updatedAt_idx" ON "SecretariatRecord"("duplicateStatus", "updatedAt");
CREATE INDEX "SecretariatRecord_duplicateOfCorrespondenceId_idx" ON "SecretariatRecord"("duplicateOfCorrespondenceId");
CREATE INDEX "SecretariatRecordEvent_secretariatRecordId_createdAt_idx" ON "SecretariatRecordEvent"("secretariatRecordId", "createdAt");
CREATE INDEX "SecretariatRecordEvent_actorId_createdAt_idx" ON "SecretariatRecordEvent"("actorId", "createdAt");
ALTER TABLE "SecretariatRecord" ADD CONSTRAINT "SecretariatRecord_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecretariatRecord" ADD CONSTRAINT "SecretariatRecord_duplicateOfCorrespondenceId_fkey" FOREIGN KEY ("duplicateOfCorrespondenceId") REFERENCES "Correspondence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecretariatRecord" ADD CONSTRAINT "SecretariatRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecretariatRecordEvent" ADD CONSTRAINT "SecretariatRecordEvent_secretariatRecordId_fkey" FOREIGN KEY ("secretariatRecordId") REFERENCES "SecretariatRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecretariatRecordEvent" ADD CONSTRAINT "SecretariatRecordEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
