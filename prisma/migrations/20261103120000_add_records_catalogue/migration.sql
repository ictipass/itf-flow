CREATE TYPE "RetentionTrigger" AS ENUM ('RESOLUTION', 'FILE_CLOSURE', 'EMPLOYMENT_END', 'CONTRACT_END', 'EVENT_DATE', 'PERMANENT');
CREATE TYPE "RetentionDisposition" AS ENUM ('REVIEW', 'ARCHIVE', 'DESTROY', 'PERMANENT');
ALTER TYPE "EventType" ADD VALUE 'REFILED';

CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trigger" "RetentionTrigger" NOT NULL,
    "durationYears" INTEGER,
    "disposition" "RetentionDisposition" NOT NULL,
    "legalAuthority" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecordSeries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RecordCategory" NOT NULL,
    "retentionPolicyId" TEXT NOT NULL,
    "defaultOwnerOrgUnitKey" TEXT,
    "defaultOwnerOrgUnitName" TEXT,
    "legacyUnit" TEXT,
    "legacyBoxCategory" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecordSeries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegacyPersonnelFile" (
    "id" TEXT NOT NULL,
    "legacyKey" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "legacyDocumentId" TEXT,
    "legacyFolderId" TEXT,
    "legacyUnit" TEXT NOT NULL,
    "boxCategory" TEXT NOT NULL,
    "boxNumber" TEXT NOT NULL,
    "fileVolume" TEXT,
    "legacyRefId" TEXT NOT NULL,
    "legacyRefName" TEXT,
    "fileOpenDate" TIMESTAMP(3),
    "fileCloseDate" TIMESTAMP(3),
    "storagePath" TEXT,
    "sha256" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "mappedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegacyPersonnelFile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecordFile"
ADD COLUMN "recordSeriesId" TEXT,
ADD COLUMN "recordSeriesVersion" INTEGER,
ADD COLUMN "retentionPolicyId" TEXT,
ADD COLUMN "retentionPolicyVersion" INTEGER;

CREATE UNIQUE INDEX "RetentionPolicy_code_version_key" ON "RetentionPolicy"("code", "version");
CREATE INDEX "RetentionPolicy_isActive_name_idx" ON "RetentionPolicy"("isActive", "name");
CREATE UNIQUE INDEX "RecordSeries_code_version_key" ON "RecordSeries"("code", "version");
CREATE INDEX "RecordSeries_category_isActive_title_idx" ON "RecordSeries"("category", "isActive", "title");
CREATE INDEX "RecordSeries_retentionPolicyId_isActive_idx" ON "RecordSeries"("retentionPolicyId", "isActive");
CREATE UNIQUE INDEX "LegacyPersonnelFile_legacyKey_key" ON "LegacyPersonnelFile"("legacyKey");
CREATE INDEX "LegacyPersonnelFile_subjectUserId_isActive_idx" ON "LegacyPersonnelFile"("subjectUserId", "isActive");
CREATE INDEX "LegacyPersonnelFile_legacyUnit_boxCategory_boxNumber_idx" ON "LegacyPersonnelFile"("legacyUnit", "boxCategory", "boxNumber");
CREATE INDEX "LegacyPersonnelFile_legacyRefId_idx" ON "LegacyPersonnelFile"("legacyRefId");
CREATE INDEX "RecordFile_recordSeriesId_idx" ON "RecordFile"("recordSeriesId");
CREATE INDEX "RecordFile_retentionPolicyId_idx" ON "RecordFile"("retentionPolicyId");

ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecordSeries" ADD CONSTRAINT "RecordSeries_retentionPolicyId_fkey" FOREIGN KEY ("retentionPolicyId") REFERENCES "RetentionPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecordSeries" ADD CONSTRAINT "RecordSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegacyPersonnelFile" ADD CONSTRAINT "LegacyPersonnelFile_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegacyPersonnelFile" ADD CONSTRAINT "LegacyPersonnelFile_mappedById_fkey" FOREIGN KEY ("mappedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecordFile" ADD CONSTRAINT "RecordFile_recordSeriesId_fkey" FOREIGN KEY ("recordSeriesId") REFERENCES "RecordSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecordFile" ADD CONSTRAINT "RecordFile_retentionPolicyId_fkey" FOREIGN KEY ("retentionPolicyId") REFERENCES "RetentionPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RetentionPolicy" ("id", "code", "name", "description", "trigger", "durationYears", "disposition", "legalAuthority", "version", "isActive", "reason", "updatedAt")
VALUES ('retention_general_7y_v1', 'GENERAL-7Y', 'General correspondence — 7 years', 'Retain for seven years after the matter is resolved, subject to legal hold and archival review.', 'RESOLUTION', 7, 'REVIEW', 'Transitional ITF Flow migration default; Records Management must confirm before production use.', 1, true, 'Created to preserve the pre-catalogue GENERAL-7Y default.', CURRENT_TIMESTAMP);

INSERT INTO "RecordSeries" ("id", "code", "title", "description", "category", "retentionPolicyId", "legacyUnit", "legacyBoxCategory", "version", "isActive", "reason", "updatedAt") VALUES
('series_general_office_v1', 'GENERAL-OFFICE', 'General office correspondence', 'Operational correspondence belonging to a department, division or unit.', 'OFFICE', 'retention_general_7y_v1', 'RECORDS OFFICE', 'SUBJECT FILES', 1, true, 'Transitional catalogue entry; Records Management must confirm before production use.', CURRENT_TIMESTAMP),
('series_general_personnel_v1', 'GENERAL-PERSONNEL', 'General personnel correspondence', 'Correspondence officially about a named staff member and filed against that staff personnel record.', 'PERSONNEL', 'retention_general_7y_v1', 'SECRET REGISTRY', 'PERSONNEL FILES', 1, true, 'Transitional catalogue entry; Records Management must replace it with approved personnel series.', CURRENT_TIMESTAMP),
('series_general_corporate_v1', 'GENERAL-CORPORATE', 'General corporate correspondence', 'Institution-wide correspondence that does not belong to one employee or operating unit.', 'CORPORATE', 'retention_general_7y_v1', 'RECORDS OFFICE', 'SUBJECT FILES', 1, true, 'Transitional catalogue entry; Records Management must confirm before production use.', CURRENT_TIMESTAMP),
('series_general_external_v1', 'GENERAL-EXTERNAL-CASE', 'General external case correspondence', 'Correspondence forming part of an ongoing matter involving an external person or organization.', 'EXTERNAL_CASE', 'retention_general_7y_v1', 'OPEN REGISTRY', 'SUBJECT FILES', 1, true, 'Transitional catalogue entry; Records Management must confirm before production use.', CURRENT_TIMESTAMP);

UPDATE "RecordFile" SET
  "recordSeriesId" = CASE "category"
    WHEN 'PERSONNEL' THEN 'series_general_personnel_v1'
    WHEN 'OFFICE' THEN 'series_general_office_v1'
    WHEN 'CORPORATE' THEN 'series_general_corporate_v1'
    WHEN 'EXTERNAL_CASE' THEN 'series_general_external_v1'
  END,
  "recordSeriesVersion" = 1,
  "retentionPolicyId" = 'retention_general_7y_v1',
  "retentionPolicyVersion" = 1
WHERE "filePlanCode" = 'GENERAL-CORRESPONDENCE' AND "retentionClass" = 'GENERAL-7Y';
