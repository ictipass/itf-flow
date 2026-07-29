CREATE TABLE "ProvisioningRun" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "receivedCount" INTEGER NOT NULL,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "inactiveCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ProvisioningRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProvisioningRun_createdAt_idx" ON "ProvisioningRun"("createdAt");
CREATE INDEX "ProvisioningRun_status_idx" ON "ProvisioningRun"("status");
