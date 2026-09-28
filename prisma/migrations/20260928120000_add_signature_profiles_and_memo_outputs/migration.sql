CREATE TYPE "SignatureProfileStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED', 'SUPERSEDED');

ALTER TYPE "EventType" ADD VALUE 'MEMO_OUTPUT_GENERATED';

CREATE TABLE "SignatureProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'image/png',
  "sizeBytes" INTEGER NOT NULL,
  "imageBytes" BYTEA NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" "SignatureProfileStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "attestation" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewReason" TEXT,
  CONSTRAINT "SignatureProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoOutput" (
  "id" TEXT NOT NULL,
  "correspondenceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "revisionId" TEXT NOT NULL,
  "revisionVersion" INTEGER NOT NULL,
  "generatedById" TEXT NOT NULL,
  "originatorId" TEXT NOT NULL,
  "signatureProfileId" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "canonicalPayload" JSONB NOT NULL,
  "signatureValue" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'HMAC-SHA256',
  "keyId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoOutput_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignatureProfile_userId_version_key" ON "SignatureProfile"("userId", "version");
CREATE INDEX "SignatureProfile_status_submittedAt_idx" ON "SignatureProfile"("status", "submittedAt");
CREATE INDEX "SignatureProfile_reviewedById_reviewedAt_idx" ON "SignatureProfile"("reviewedById", "reviewedAt");
CREATE UNIQUE INDEX "MemoOutput_correspondenceId_version_key" ON "MemoOutput"("correspondenceId", "version");
CREATE INDEX "MemoOutput_generatedById_generatedAt_idx" ON "MemoOutput"("generatedById", "generatedAt");
CREATE INDEX "MemoOutput_originatorId_generatedAt_idx" ON "MemoOutput"("originatorId", "generatedAt");
CREATE INDEX "MemoOutput_sha256_idx" ON "MemoOutput"("sha256");

ALTER TABLE "SignatureProfile" ADD CONSTRAINT "SignatureProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SignatureProfile" ADD CONSTRAINT "SignatureProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoOutput" ADD CONSTRAINT "MemoOutput_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoOutput" ADD CONSTRAINT "MemoOutput_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CorrespondenceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemoOutput" ADD CONSTRAINT "MemoOutput_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemoOutput" ADD CONSTRAINT "MemoOutput_originatorId_fkey" FOREIGN KEY ("originatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemoOutput" ADD CONSTRAINT "MemoOutput_signatureProfileId_fkey" FOREIGN KEY ("signatureProfileId") REFERENCES "SignatureProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
