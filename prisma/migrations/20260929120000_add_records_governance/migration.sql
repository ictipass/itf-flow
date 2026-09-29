CREATE TYPE "UltimateRecipientType" AS ENUM ('STAFF', 'ORGANIZATIONAL_UNIT', 'EXTERNAL_PARTY');
CREATE TYPE "RecordCategory" AS ENUM ('PERSONNEL', 'OFFICE', 'CORPORATE', 'EXTERNAL_CASE');
CREATE TYPE "RegistryScope" AS ENUM ('OPEN', 'SECRET');

ALTER TABLE "ApplicationConfiguration"
  ADD COLUMN "secretRegistryMfaRequired" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Correspondence"
  ADD COLUMN "ultimateRecipientType" "UltimateRecipientType",
  ADD COLUMN "ultimateRecipientUserId" TEXT,
  ADD COLUMN "ultimateRecipientName" TEXT,
  ADD COLUMN "ultimateRecipientOrgUnitKey" TEXT,
  ADD COLUMN "ultimateRecipientOrgUnitName" TEXT,
  ADD COLUMN "recordFileId" TEXT;

CREATE TABLE "RecordFile" (
  "id" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "category" "RecordCategory" NOT NULL,
  "label" TEXT NOT NULL,
  "filePlanCode" TEXT NOT NULL,
  "subjectUserId" TEXT,
  "ownerOrgUnitKey" TEXT,
  "ownerOrgUnitName" TEXT,
  "retentionClass" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecordFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistryAppointment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" "RegistryScope" NOT NULL,
  "reason" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistryAppointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecordFile_fileKey_key" ON "RecordFile"("fileKey");
CREATE INDEX "RecordFile_category_filePlanCode_idx" ON "RecordFile"("category", "filePlanCode");
CREATE INDEX "RecordFile_subjectUserId_idx" ON "RecordFile"("subjectUserId");
CREATE INDEX "RecordFile_ownerOrgUnitKey_idx" ON "RecordFile"("ownerOrgUnitKey");
CREATE INDEX "RegistryAppointment_userId_scope_startsAt_idx" ON "RegistryAppointment"("userId", "scope", "startsAt");
CREATE INDEX "RegistryAppointment_scope_revokedAt_startsAt_idx" ON "RegistryAppointment"("scope", "revokedAt", "startsAt");
CREATE INDEX "Correspondence_ultimateRecipientUserId_status_idx" ON "Correspondence"("ultimateRecipientUserId", "status");
CREATE INDEX "Correspondence_recordFileId_status_idx" ON "Correspondence"("recordFileId", "status");

ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_ultimateRecipientUserId_fkey"
  FOREIGN KEY ("ultimateRecipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_recordFileId_fkey"
  FOREIGN KEY ("recordFileId") REFERENCES "RecordFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecordFile" ADD CONSTRAINT "RecordFile_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistryAppointment" ADD CONSTRAINT "RegistryAppointment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistryAppointment" ADD CONSTRAINT "RegistryAppointment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistryAppointment" ADD CONSTRAINT "RegistryAppointment_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
