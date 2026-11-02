CREATE TABLE "DepartmentCorrespondenceProfile" (
    "id" TEXT NOT NULL,
    "departmentKey" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "addressLines" TEXT[] DEFAULT ARRAY['Headquarters Office Complex', 'Miango Road', 'P.M.B. 2199', 'Jos, Plateau State', 'NIGERIA']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "configuredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DepartmentCorrespondenceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepartmentCorrespondenceProfile_departmentKey_key" ON "DepartmentCorrespondenceProfile"("departmentKey");
CREATE INDEX "DepartmentCorrespondenceProfile_isActive_departmentName_idx" ON "DepartmentCorrespondenceProfile"("isActive", "departmentName");

ALTER TABLE "DepartmentCorrespondenceProfile"
ADD CONSTRAINT "DepartmentCorrespondenceProfile_configuredById_fkey"
FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Correspondence"
ADD COLUMN "ultimateRecipientOrganization" TEXT,
ADD COLUMN "ultimateRecipientEmail" TEXT,
ADD COLUMN "ultimateRecipientAddress" TEXT,
ADD COLUMN "sendingDepartmentKey" TEXT,
ADD COLUMN "sendingDepartmentName" TEXT,
ADD COLUMN "sendingDepartmentEmail" TEXT,
ADD COLUMN "sendingDepartmentAddressLines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "departmentCorrespondenceProfileId" TEXT,
ADD COLUMN "departmentCorrespondenceProfileVersion" INTEGER;

CREATE INDEX "Correspondence_departmentCorrespondenceProfileId_status_idx" ON "Correspondence"("departmentCorrespondenceProfileId", "status");

ALTER TABLE "Correspondence"
ADD CONSTRAINT "Correspondence_departmentCorrespondenceProfileId_fkey"
FOREIGN KEY ("departmentCorrespondenceProfileId") REFERENCES "DepartmentCorrespondenceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attachment"
ADD COLUMN "isOutgoingLetterPreview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isOutgoingLetterFinal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Attachment_correspondenceId_isOutgoingLetterPreview_isIncluded_idx" ON "Attachment"("correspondenceId", "isOutgoingLetterPreview", "isIncluded");
CREATE INDEX "Attachment_correspondenceId_isOutgoingLetterFinal_isIncluded_idx" ON "Attachment"("correspondenceId", "isOutgoingLetterFinal", "isIncluded");

ALTER TABLE "EmailOutbox" ADD COLUMN "attachmentId" TEXT;
CREATE INDEX "EmailOutbox_attachmentId_idx" ON "EmailOutbox"("attachmentId");
ALTER TABLE "EmailOutbox"
ADD CONSTRAINT "EmailOutbox_attachmentId_fkey"
FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
