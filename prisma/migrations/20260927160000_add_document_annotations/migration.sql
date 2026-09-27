-- Add immutable, authenticated in-document annotation history.
ALTER TYPE "DocumentEventType" ADD VALUE 'ANNOTATED';

CREATE TYPE "DocumentAnnotationPlacement" AS ENUM ('TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT');

CREATE TABLE "DocumentAnnotation" (
  "id" TEXT NOT NULL,
  "correspondenceId" TEXT NOT NULL,
  "sourceAttachmentId" TEXT NOT NULL,
  "outputAttachmentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "revisionId" TEXT NOT NULL,
  "revisionVersion" INTEGER NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "placement" "DocumentAnnotationPlacement" NOT NULL,
  "minuteText" TEXT NOT NULL,
  "signerId" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signerRole" TEXT NOT NULL,
  "signerPosition" TEXT,
  "authorityPrincipalId" TEXT,
  "authorityPrincipalName" TEXT,
  "delegationId" TEXT,
  "authenticationMethod" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "outputSha256" TEXT NOT NULL,
  "canonicalPayload" JSONB NOT NULL,
  "signatureValue" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'HMAC-SHA256',
  "keyId" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentAnnotation_outputAttachmentId_key" ON "DocumentAnnotation"("outputAttachmentId");
CREATE UNIQUE INDEX "DocumentAnnotation_revisionId_key" ON "DocumentAnnotation"("revisionId");
CREATE UNIQUE INDEX "DocumentAnnotation_correspondenceId_version_key" ON "DocumentAnnotation"("correspondenceId", "version");
CREATE INDEX "DocumentAnnotation_sourceAttachmentId_version_idx" ON "DocumentAnnotation"("sourceAttachmentId", "version");
CREATE INDEX "DocumentAnnotation_signerId_signedAt_idx" ON "DocumentAnnotation"("signerId", "signedAt");
CREATE INDEX "DocumentAnnotation_correspondenceId_signedAt_idx" ON "DocumentAnnotation"("correspondenceId", "signedAt");

ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_sourceAttachmentId_fkey" FOREIGN KEY ("sourceAttachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_outputAttachmentId_fkey" FOREIGN KEY ("outputAttachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CorrespondenceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
