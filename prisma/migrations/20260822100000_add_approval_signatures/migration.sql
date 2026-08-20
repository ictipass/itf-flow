CREATE TABLE "ApprovalSignature" (
  "id" TEXT NOT NULL, "decisionRequestId" TEXT NOT NULL, "correspondenceId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL, "revisionVersion" INTEGER NOT NULL, "documentDigest" TEXT NOT NULL,
  "canonicalPayload" JSONB NOT NULL, "signatureValue" TEXT NOT NULL, "algorithm" TEXT NOT NULL DEFAULT 'HMAC-SHA256',
  "keyId" TEXT NOT NULL, "authenticationMethod" TEXT NOT NULL, "signerId" TEXT NOT NULL,
  "signerName" TEXT NOT NULL, "signerRole" TEXT NOT NULL, "signerPosition" TEXT,
  "authorityPrincipalId" TEXT, "authorityPrincipalName" TEXT, "delegationId" TEXT,
  "signedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalSignature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApprovalSignature_decisionRequestId_key" ON "ApprovalSignature"("decisionRequestId");
CREATE INDEX "ApprovalSignature_correspondenceId_signedAt_idx" ON "ApprovalSignature"("correspondenceId","signedAt");
CREATE INDEX "ApprovalSignature_signerId_signedAt_idx" ON "ApprovalSignature"("signerId","signedAt");
CREATE INDEX "ApprovalSignature_documentDigest_idx" ON "ApprovalSignature"("documentDigest");
ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_decisionRequestId_fkey" FOREIGN KEY ("decisionRequestId") REFERENCES "DecisionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CorrespondenceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
